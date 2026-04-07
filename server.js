import "dotenv/config";
import cors           from "cors";
import { setupAuthRoutes } from "./auth_routes.js";
import { requireAuth, requireRole } from "./auth.js";
import { randomUUID } from "crypto";
import express        from "express";
import { createWriteStream, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import mysql          from "mysql2/promise";
import { setupCheckoutRoutes } from "./checkout_routes.js";
import { setupProductosRoutes } from "./productos_routes.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── MySQL ──────────────────────────────────────────────────
const db = await mysql.createPool({
    host:     process.env.DB_HOST     || "localhost",
    port:     parseInt(process.env.DB_PORT || "3306"),
    user:     process.env.DB_USER     || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME     || "thermomania",
    waitForConnections: true, connectionLimit: 10, decimalNumbers: true,
});
try {
    await db.query("SELECT 1");
    console.log("[DB] Conexión MySQL OK");
} catch (err) {
    console.error("[DB] Error:", err.message);
    process.exit(1);
}

// ── Log en archivo rotativo ────────────────────────────────
mkdirSync(join(__dirname, "logs"), { recursive: true });
const getStream = () => createWriteStream(
    join(__dirname, "logs", `thermomania-${new Date().toISOString().slice(0, 10)}.jsonl`),
    { flags: "a" }
);
let logStream = getStream();
setInterval(() => { logStream = getStream(); }, 60 * 60 * 1000);

// ── Express ────────────────────────────────────────────────
const app  = express();
const PORT = 3000;

// ── Logs en memoria + SSE ──────────────────────────────────
const recentLogs = [];
const sseClients = new Set();
setInterval(() => sseClients.forEach(r => r.write(": ping\n\n")), 25000);

function pushLog(entry) {
    const safe = JSON.parse(JSON.stringify(entry));
    if (safe?.context?.password) safe.context.password = "***";
    if (safe?.context?.token)    safe.context.token    = "***";

    const log = {
        timestamp:     new Date().toISOString(),
        level:         safe.level         || "info",
        service:       safe.service       || "thermomania-backend",
        env:           "dev",
        message:       safe.message       || "",
        correlationId: safe.correlationId || "unknown",
        userId:        safe.userId        || "anonymous",
        ...safe,
    };
    log.timestamp = new Date().toISOString();

    recentLogs.push(log);
    if (recentLogs.length > 1000) recentLogs.shift();
    sseClients.forEach(r => r.write(`data: ${JSON.stringify(log)}\n\n`));
    logStream.write(JSON.stringify(log) + "\n");
    db.query(
        "INSERT INTO logs (timestamp,level,service,env,message,correlation_id,user_id,method,path,status,response_time_ms,context) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        [log.timestamp, log.level, log.service, log.env, log.message,
         log.correlationId || null, log.userId || null, log.method || null,
         log.path || null, log.status || null, log.responseTimeMs || null,
         log.context ? JSON.stringify(log.context) : null]
    ).catch(() => {});
}

// ── CORS + JSON ────────────────────────────────────────────
app.use(cors({
    origin: function (origin, callback) {
        callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id'],
    credentials: true
}));
app.use(express.json());

// ── Correlation ID + Request logger ───────────────────────
app.use((req, res, next) => {
    const cid = req.headers["x-correlation-id"]?.toString() || randomUUID();
    req.correlationId = cid;
    res.setHeader("x-correlation-id", cid);
    const t0 = process.hrtime.bigint();
    res.on("finish", () => {
        const ms = Number((process.hrtime.bigint() - t0) / 1_000_000n);
        pushLog({
            level: res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info",
            message: "http_request_completed",
            correlationId: cid,
            method: req.method,
            path: req.originalUrl,
            status: res.statusCode,
            responseTimeMs: ms,
            context: { slow: ms > 500 },
        });
    });
    next();
});

// ── Logs frontend ──────────────────────────────────────────
app.post("/logs", (req, res) => {
    const payloads = Array.isArray(req.body) ? req.body : [req.body];
    payloads.forEach(p => pushLog({
        ...p,
        service: "thermomania-frontend",
        correlationId: p?.correlationId || req.correlationId,
    }));
    res.status(202).json({ ok: true });
});

app.get("/logs/sse", (req, res) => {
    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
    });
    recentLogs.slice(-50).forEach(l => res.write(`data: ${JSON.stringify(l)}\n\n`));
    sseClients.add(res);
    req.on("close", () => sseClients.delete(res));
});

app.get("/logs/recent", requireAuth(db), requireRole("admin"), (req, res) => {
    const { limit = "200", level, service, q } = req.query;
    let items = [...recentLogs].reverse();
    if (level)   items = items.filter(l => l.level?.toLowerCase()   === level.toLowerCase());
    if (service) items = items.filter(l => l.service?.toLowerCase() === service.toLowerCase());
    if (q)       items = items.filter(l => JSON.stringify(l).toLowerCase().includes(q.toLowerCase()));
    res.json(items.slice(0, Math.min(parseInt(limit) || 200, 1000)));
});

// ── Validaciones ───────────────────────────────────────────
const esEmailValido    = e => /^[a-zA-Z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(String(e));
const esPasswordValida = p => /^(?=.*[A-Z])(?=.*\d).{8,}$/.test(String(p));

// ── Captcha ────────────────────────────────────────────────
const captchaStore = new Map();
const nowMs        = () => Date.now();
const setCaptcha   = (cid, d)   => captchaStore.set(cid, { ...d, exp: nowMs() + 5 * 60_000 });
const getCaptcha   = (cid)      => {
    const v = captchaStore.get(cid);
    if (!v || v.exp < nowMs()) { captchaStore.delete(cid); return null; }
    return v;
};
const consumeToken = (cid, tok) => {
    const v = getCaptcha(cid);
    if (!v || v.token !== tok) return false;
    captchaStore.delete(cid);
    return true;
};

app.get("/captcha/nonce", (req, res) => {
    const nonce = randomUUID();
    const cid   = req.correlationId;
    setCaptcha(cid, { nonce, token: null });
    pushLog({ level: "info", message: "captcha_nonce_issued", correlationId: cid });
    res.json({ nonce, cid });
});

app.post("/captcha/verify", (req, res) => {
    const { nonce } = req.body || {};
    if (!nonce) return res.status(400).json({ error: "Falta nonce" });
    const cid   = req.correlationId;
    const entry = getCaptcha(cid);
    if (!entry || entry.nonce !== nonce) {
        pushLog({ level: "warn", message: "captcha_verify_failed", correlationId: cid });
        return res.status(400).json({ error: "Nonce inválido o expirado" });
    }
    const captchaToken = randomUUID();
    setCaptcha(cid, { nonce: null, token: captchaToken });
    pushLog({ level: "info", message: "captcha_verified", correlationId: cid });
    res.json({ captchaToken });
});

function requireCaptcha(req, res, next) {
    const token = req.headers["x-captcha-token"]?.toString();
    if (!token) return res.status(400).json({ error: "Captcha requerido" });
    if (!consumeToken(req.correlationId, token)) {
        pushLog({ level: "warn", message: "captcha_token_invalid", correlationId: req.correlationId });
        return res.status(400).json({ error: "Captcha inválido o expirado" });
    }
    next();
}

// ── Auth ───────────────────────────────────────────────────
// ── DEPRECATED: usar /auth/registro ──────────────────────
app.post("/registro", requireCaptcha, async (req, res) => {
    const { email, password, confirm } = req.body || {};
    const cid = req.correlationId;
    if (!email || !password || !confirm) return res.status(400).json({ error: "Faltan campos obligatorios." });
    if (!esEmailValido(email))           return res.status(400).json({ error: "Formato de email inválido." });
    if (password !== confirm)            return res.status(400).json({ error: "Las contraseñas no coinciden." });
    if (!esPasswordValida(password))     return res.status(400).json({ error: "La contraseña debe tener 8+ chars, 1 mayúscula y 1 número." });
    try {
        const [rows] = await db.query("SELECT id FROM usuarios WHERE email = ?", [email.toLowerCase()]);
        if (rows.length) return res.status(400).json({ error: "El correo ya está registrado." });
        await db.query("INSERT INTO usuarios (email, password) VALUES (?, ?)", [email.toLowerCase(), password]);
        pushLog({ level: "info", message: "negocio_registro_exitoso", correlationId: cid, context: { email } });
        res.status(201).json({ mensaje: "Usuario registrado correctamente." });
    } catch (err) {
        pushLog({ level: "error", message: "registro_db_error", correlationId: cid, context: { error: err.message } });
        res.status(500).json({ error: "Error interno al registrar usuario." });
    }
});

// ── DEPRECATED: usar /auth/login ────────────────────────
app.post("/login", requireCaptcha, async (req, res) => {
    const { email, password } = req.body || {};
    const cid = req.correlationId;
    if (!email || !password)   return res.status(400).json({ error: "Email y contraseña son obligatorios." });
    if (!esEmailValido(email)) return res.status(400).json({ error: "Formato de email inválido." });
    pushLog({ level: "info", message: "negocio_login_intento", correlationId: cid, context: { email } });
    try {
        const [rows] = await db.query(
            "SELECT id FROM usuarios WHERE email = ? AND password = ? AND activo = 1 LIMIT 1",
            [email.toLowerCase(), password]
        );
        if (!rows.length) {
            pushLog({ level: "warn", message: "negocio_login_fallido", correlationId: cid, context: { email } });
            return res.status(401).json({ error: "Credenciales inválidas." });
        }
        pushLog({ level: "info", message: "negocio_login_exitoso", correlationId: cid, context: { email, userId: rows[0].id } });
        res.json({ mensaje: "Inicio de sesión correcto.", userId: rows[0].id });
    } catch (err) {
        pushLog({ level: "error", message: "login_db_error", correlationId: cid, context: { error: err.message } });
        res.status(500).json({ error: "Error interno al iniciar sesión." });
    }
});

// ── Productos ──────────────────────────────────────────────
function parseProducto(p) {
    return {
        ...p,
        stock: Boolean(p.stock),
        caracteristicas: typeof p.caracteristicas === "string"
            ? JSON.parse(p.caracteristicas)
            : (p.caracteristicas || []),
    };
}

app.get("/api/categorias", async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM categorias ORDER BY nombre ASC");
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Error al consultar categorías." });
    }
});

app.get("/api/productos", async (req, res) => {
    const { categoria, min, max, stock, q } = req.query;
    let sql = "SELECT * FROM productos WHERE activo = 1";
    const vals = [];
    if (categoria && categoria !== "todos") { sql += " AND categoria = ?";                        vals.push(categoria.toLowerCase()); }
    if (min)                               { sql += " AND precio >= ?";                           vals.push(parseFloat(min)); }
    if (max)                               { sql += " AND precio <= ?";                           vals.push(parseFloat(max)); }
    if (stock === "1")                     { sql += " AND stock = 1"; }
    if (q)                                 { sql += " AND (nombre LIKE ? OR descripcion LIKE ?)"; vals.push(`%${q}%`, `%${q}%`); }
    sql += " ORDER BY id ASC";
    try {
        const [rows] = await db.query(sql, vals);
        pushLog({ level: "info", message: "api_productos_consultados", correlationId: req.correlationId, context: { total: rows.length } });
        res.json(rows.map(parseProducto));
    } catch (err) {
        res.status(500).json({ error: "Error al consultar productos." });
    }
});

// ════════════════════════════════════════════════════════
// CATÁLOGO DE PRODUCTOS (Para el Index)
// ════════════════════════════════════════════════════════
app.get('/api/productos/destacados', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT id, nombre, precio, imagen_url, categoria FROM productos WHERE activo = 1 LIMIT 6");
        res.json(rows);
    } catch (err) {
        console.error("🔴 Error al consultar catálogo:", err);
        res.status(500).json({ error: "Error interno al cargar el catálogo" });
    }
});

app.get("/api/productos/:id", async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM productos WHERE id = ? AND activo = 1", [req.params.id]);
        if (!rows.length) return res.status(404).json({ error: "Producto no encontrado." });
        res.json(parseProducto(rows[0]));
    } catch (err) {
        res.status(500).json({ error: "Error al consultar producto." });
    }
});

// ==========================================
// CREAR PRODUCTO (POST)
// ==========================================
app.post("/api/productos", requireAuth(db), requireRole("admin","editor"), async (req, res) => {
    const { nombre, categoria, precio, stock, imagen } = req.body || {};
    
    if (!nombre || !precio || !categoria) return res.status(400).json({ error: "Faltan campos obligatorios." });
    
    try {
        const [result] = await db.query(
            "INSERT INTO productos (nombre, categoria, precio, stock, imagen_url) VALUES (?,?,?,?,?)",
            [
                nombre, 
                categoria.toLowerCase(), 
                parseFloat(precio), 
                stock ? 1 : 0,
                imagen || "img/termo1.jpg"
            ]
        );
        
        const [rows] = await db.query("SELECT * FROM productos WHERE id = ?", [result.insertId]);
        res.status(201).json(rows[0]);

    } catch (err) {
        console.error("🔴 ERROR SQL AL CREAR:", err.message);
        res.status(500).json({ error: "Error interno del servidor." });
    }
});

// ==========================================
// EDITAR PRODUCTO (PUT)
// ==========================================
app.put("/api/productos/:id", requireAuth(db), requireRole("admin","editor"), async (req, res) => {
    const { nombre, categoria, precio, stock, imagen } = req.body || {};
    
    try {
        await db.query(
            "UPDATE productos SET nombre=?, categoria=?, precio=?, stock=?, imagen_url=? WHERE id=?",
            [
                nombre, 
                categoria?.toLowerCase(), 
                parseFloat(precio), 
                stock ? 1 : 0,
                imagen, 
                req.params.id
            ]
        );
        
        const [rows] = await db.query("SELECT * FROM productos WHERE id = ?", [req.params.id]);
        if (!rows.length) return res.status(404).json({ error: "No encontrado." });
        
        res.json(rows[0]);

    } catch (err) {
        console.error("🔴 ERROR SQL AL ACTUALIZAR:", err.message);
        res.status(500).json({ error: "Error interno del servidor." });
    }
});

app.delete("/api/productos/:id", requireAuth(db), requireRole("admin"), async (req, res) => {
    try {
        const [result] = await db.query("UPDATE productos SET activo = 0 WHERE id = ?", [req.params.id]);
        if (!result.affectedRows) return res.status(404).json({ error: "Producto no encontrado." });
        pushLog({ level: "info", message: "negocio_producto_eliminado", correlationId: req.correlationId, context: { id: req.params.id } });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: "Error al eliminar producto." });
    }
});

// Ruta para obtener el historial de compras del usuario
app.get('/api/mis-pedidos', requireAuth(db), async (req, res) => {
    try {
        const userId = req.user.userId;
        
        const [pedidos] = await db.query(
            "SELECT id, total, estado_pago, created_at FROM pedidos WHERE user_id = ? ORDER BY id DESC",
            [userId]
        );
        
        res.json(pedidos);
    } catch (error) {
        console.error("🔴 Error al obtener pedidos:", error);
        res.status(500).json({ error: "No se pudo cargar el historial" });
    }
});

// ── Auth routes ──────────────────────────────────────────
setupAuthRoutes(app, db, pushLog);
setupCheckoutRoutes(app, db, pushLog);
setupProductosRoutes(app, db);

// ── Health ─────────────────────────────────────────────────
app.get("/health", (req, res) => {
    pushLog({ level: "info", message: "health_check", correlationId: req.correlationId });
    res.json({ ok: true, time: new Date().toISOString(), uptime: process.uptime() });
});

app.listen(PORT, () => {
    pushLog({ level: "info", message: "server_started", context: { port: PORT } });
    console.log(`API corriendo en http://localhost:${PORT}`);
});

// ════════════════════════════════════════════════════════
// GESTOR: Obtener TODOS los pedidos (Solo Admin/Editor)
// ════════════════════════════════════════════════════════
app.get('/api/admin/pedidos', requireAuth(db), requireRole("admin", "editor"), async (req, res) => {
    try {
        const [pedidos] = await db.query(
            "SELECT id, user_id, total, estado_pago, created_at FROM pedidos ORDER BY id DESC"
        );
        res.json(pedidos);
    } catch (error) {
        res.status(500).json({ error: "No se pudieron cargar los pedidos." });
    }
});