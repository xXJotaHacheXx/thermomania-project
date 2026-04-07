// auth_routes.js — Thermomania AG
// Endpoints de autenticación — se importa en server.js
// import { setupAuthRoutes } from "./auth_routes.js";
// setupAuthRoutes(app, db, pushLog);

import {
    hashPassword, comparePassword,
    signAccessToken, generateSecureToken, hashToken,
    generateOTP, hashToken as ht,
    requireAuth, requireRole, rateLimitAuth,
    REFRESH_EXPIRES, MAX_ATTEMPTS, LOCK_MINUTES,
} from "./auth.js";
import { randomUUID } from "crypto";
import { enviarCorreoMFA, enviarCorreoRecuperacion } from "./mailer.js";

export function setupAuthRoutes(app, db, pushLog) {

    const authLimit = rateLimitAuth(10); // máx 10 intentos/min por IP

    // ════════════════════════════════════════════════════════
    // REGISTRO
    // ════════════════════════════════════════════════════════
    app.post("/auth/registro", authLimit, async (req, res) => {
        const { email, password, confirm } = req.body || {};
        const cid = req.correlationId;

        if (!email || !password || !confirm)
            return res.status(400).json({ error: "Faltan campos obligatorios." });
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
            return res.status(400).json({ error: "Email inválido." });
        if (password !== confirm)
            return res.status(400).json({ error: "Las contraseñas no coinciden." });
        if (!/^(?=.*[A-Z])(?=.*\d).{8,}$/.test(password))
            return res.status(400).json({ error: "Contraseña: mínimo 8 chars, 1 mayúscula, 1 número." });

        try {
            const [exists] = await db.query("SELECT id FROM usuarios WHERE email = ?", [email.toLowerCase()]);
            if (exists.length) return res.status(400).json({ error: "El correo ya está registrado." });

            const hash = await hashPassword(password);
            const [result] = await db.query(
                "INSERT INTO usuarios (email, password, role) VALUES (?, ?, 'usuario')",
                [email.toLowerCase(), hash]
            );

            pushLog({ level: "info", message: "auth_registro_exitoso", correlationId: cid, context: { email } });
            res.status(201).json({ ok: true, mensaje: "Usuario registrado. Ya puedes iniciar sesión." });
        } catch (err) {
            pushLog({ level: "error", message: "auth_registro_error", correlationId: cid, context: { error: err.message } });
            res.status(500).json({ error: "Error interno al registrar." });
        }
    });

    // ════════════════════════════════════════════════════════
    // LOGIN — Paso 1: verificar credenciales
    // ════════════════════════════════════════════════════════
    app.post("/auth/login", authLimit, async (req, res) => {
        const { email, password } = req.body || {};
        const cid = req.correlationId;
        const ip  = req.ip || "unknown";
        const ua  = req.headers["user-agent"] || "unknown";

        if (!email || !password)
            return res.status(400).json({ error: "Email y contraseña son obligatorios." });

        try {
            const [rows] = await db.query(
                "SELECT id, email, password, role, mfa_enabled, login_attempts, locked_until, activo FROM usuarios WHERE email = ? LIMIT 1",
                [email.toLowerCase()]
            );

            if (!rows.length)
                return res.status(401).json({ error: "Credenciales inválidas." });

            const user = rows[0];

            // ── Verificar bloqueo por fuerza bruta ─────────
            if (user.locked_until && new Date() < new Date(user.locked_until)) {
                const mins = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
                pushLog({ level: "warn", message: "auth_cuenta_bloqueada", correlationId: cid, context: { email } });
                return res.status(423).json({ error: `Cuenta bloqueada. Intenta en ${mins} min.` });
            }

            if (!user.activo)
                return res.status(401).json({ error: "Cuenta desactivada." });

            const passwordOk = await comparePassword(password, user.password);

            if (!passwordOk) {
                // Incrementar intentos fallidos
                const newAttempts = user.login_attempts + 1;
                if (newAttempts >= MAX_ATTEMPTS) {
                    const lockUntil = new Date(Date.now() + LOCK_MINUTES * 60_000);
                    await db.query(
                        "UPDATE usuarios SET login_attempts = ?, locked_until = ? WHERE id = ?",
                        [newAttempts, lockUntil, user.id]
                    );
                    pushLog({ level: "warn", message: "auth_cuenta_bloqueada_auto", correlationId: cid, context: { email, intentos: newAttempts } });
                    return res.status(423).json({ error: `Demasiados intentos. Cuenta bloqueada ${LOCK_MINUTES} min.` });
                }
                await db.query("UPDATE usuarios SET login_attempts = ? WHERE id = ?", [newAttempts, user.id]);
                pushLog({ level: "warn", message: "auth_login_fallido", correlationId: cid, context: { email, intentos: newAttempts } });
                return res.status(401).json({ error: "Credenciales inválidas." });
            }

            // Resetear intentos al lograr login correcto
            await db.query("UPDATE usuarios SET login_attempts = 0, locked_until = NULL WHERE id = ?", [user.id]);

            // ── MFA activo → paso 2 ─────────────────────────
            if (user.mfa_enabled) {
                const otp     = generateOTP();
                const otpHash = hashToken(otp);
                const exp     = new Date(Date.now() + 10 * 60_000); // 10 min

                await db.query(
                    "INSERT INTO mfa_codes (user_id, code_hash, expires_at) VALUES (?, ?, ?)",
                    [user.id, otpHash, exp]
                );

                try {
                    // ¡Enviamos el correo real!
                    await enviarCorreoMFA(email, otp);
                    pushLog({ level: "info", message: "auth_mfa_correo_enviado", correlationId: cid, context: { email } });
                    
                    return res.json({
                        mfa_required: true,
                        user_id: user.id,
                        mensaje: "Código MFA enviado. Revisa tu correo."
                    });
                } catch (mailError) {
                    pushLog({ level: "error", message: "auth_mfa_mail_fallo", correlationId: cid, context: { error: mailError.message } });
                    return res.status(500).json({ error: "Error al enviar el correo de verificación. Intenta más tarde." });
                }
            }

            // ── Sin MFA → emitir tokens ─────────────────────
            const tokens = await emitirTokens(db, user, ip, ua);
            pushLog({ level: "info", message: "auth_login_exitoso", correlationId: cid, context: { email, role: user.role } });
            res.json({ ok: true, ...tokens, role: user.role });

        } catch (err) {
            pushLog({ level: "error", message: "auth_login_error", correlationId: cid, context: { error: err.message } });
            res.status(500).json({ error: "Error interno." });
        }
    });

    // ════════════════════════════════════════════════════════
    // LOGIN — Paso 2: verificar MFA
    // ════════════════════════════════════════════════════════
    app.post("/auth/mfa/verificar", authLimit, async (req, res) => {
        const { user_id, codigo } = req.body || {};
        const cid = req.correlationId;
        const ip  = req.ip || "unknown";
        const ua  = req.headers["user-agent"] || "unknown";

        if (!user_id || !codigo)
            return res.status(400).json({ error: "user_id y codigo son obligatorios." });

        try {
            const codeHash = hashToken(codigo);
            const [rows] = await db.query(
                "SELECT id FROM mfa_codes WHERE user_id = ? AND code_hash = ? AND usado = 0 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1",
                [user_id, codeHash]
            );

            if (!rows.length) {
                pushLog({ level: "warn", message: "auth_mfa_fallido", correlationId: cid, context: { user_id } });
                return res.status(401).json({ error: "Código inválido o expirado." });
            }

            // Marcar código como usado (previene replay)
            await db.query("UPDATE mfa_codes SET usado = 1 WHERE id = ?", [rows[0].id]);

            const [userRows] = await db.query("SELECT id, email, role FROM usuarios WHERE id = ?", [user_id]);
            const user = userRows[0];
            const tokens = await emitirTokens(db, user, ip, ua);

            pushLog({ level: "info", message: "auth_mfa_exitoso", correlationId: cid, context: { user_id } });
            res.json({ ok: true, ...tokens, role: user.role });

        } catch (err) {
            res.status(500).json({ error: "Error interno." });
        }
    });

    // ════════════════════════════════════════════════════════
    // REFRESH TOKEN
    // ════════════════════════════════════════════════════════
    app.post("/auth/refresh", async (req, res) => {
        const { refresh_token } = req.body || {};
        if (!refresh_token) return res.status(400).json({ error: "refresh_token requerido." });

        try {
            const tokenHash = hashToken(refresh_token);
            const [rows] = await db.query(
                `SELECT rt.id, rt.session_id, rt.user_id, u.email, u.role
                 FROM refresh_tokens rt
                 JOIN usuarios u ON u.id = rt.user_id
                 WHERE rt.token_hash = ? AND rt.revocado = 0 AND rt.expires_at > NOW()`,
                [tokenHash]
            );

            if (!rows.length)
                return res.status(401).json({ error: "Refresh token inválido o expirado." });

            const rt = rows[0];

            // Rotación: revocar el token usado y emitir uno nuevo (previene token replay)
            await db.query("UPDATE refresh_tokens SET revocado = 1 WHERE id = ?", [rt.id]);

            const newAccessToken = await signAccessToken({
                userId: rt.user_id, email: rt.email,
                role: rt.role, sessionId: rt.session_id,
            });
            const newRefresh      = generateSecureToken();
            const newRefreshHash  = hashToken(newRefresh);
            const newExp          = new Date(Date.now() + REFRESH_EXPIRES);

            await db.query(
                "INSERT INTO refresh_tokens (id, user_id, session_id, token_hash, expires_at) VALUES (?, ?, ?, ?, ?)",
                [randomUUID(), rt.user_id, rt.session_id, newRefreshHash, newExp]
            );

            res.json({ access_token: newAccessToken, refresh_token: newRefresh });
        } catch (err) {
            res.status(500).json({ error: "Error interno." });
        }
    });

    // ════════════════════════════════════════════════════════
    // LOGOUT — cerrar sesión actual
    // ════════════════════════════════════════════════════════
    app.post("/auth/logout", requireAuth(db), async (req, res) => {
        await db.query("UPDATE sessions SET activa = 0 WHERE id = ?", [req.user.sessionId]);
        await db.query("UPDATE refresh_tokens SET revocado = 1 WHERE session_id = ?", [req.user.sessionId]);
        pushLog({ level: "info", message: "auth_logout", correlationId: req.correlationId, context: { userId: req.user.userId } });
        res.json({ ok: true, mensaje: "Sesión cerrada." });
    });

    // ════════════════════════════════════════════════════════
    // SESIONES — listar sesiones activas del usuario
    // ════════════════════════════════════════════════════════
    app.get("/auth/sesiones", requireAuth(db), async (req, res) => {
        const [rows] = await db.query(
            "SELECT id, ip, user_agent, created_at, last_seen FROM sessions WHERE user_id = ? AND activa = 1 ORDER BY last_seen DESC",
            [req.user.userId]
        );
        res.json(rows.map(s => ({
            ...s,
            es_actual: s.id === req.user.sessionId,
        })));
    });

    // ════════════════════════════════════════════════════════
    // SESIONES — cerrar sesión específica (remota)
    // ════════════════════════════════════════════════════════
    app.delete("/auth/sesiones/:sessionId", requireAuth(db), async (req, res) => {
        const { sessionId } = req.params;
        // Solo puede cerrar sus propias sesiones
        const [rows] = await db.query(
            "SELECT id FROM sessions WHERE id = ? AND user_id = ?",
            [sessionId, req.user.userId]
        );
        if (!rows.length) return res.status(404).json({ error: "Sesión no encontrada." });

        await db.query("UPDATE sessions SET activa = 0 WHERE id = ?", [sessionId]);
        await db.query("UPDATE refresh_tokens SET revocado = 1 WHERE session_id = ?", [sessionId]);
        pushLog({ level: "info", message: "auth_sesion_remota_cerrada", correlationId: req.correlationId,
            context: { userId: req.user.userId, sessionId } });
        res.json({ ok: true, mensaje: "Sesión cerrada remotamente." });
    });

// ════════════════════════════════════════════════════════
    // RECUPERACIÓN DE CONTRASEÑA — solicitar token
    // ════════════════════════════════════════════════════════
    app.post("/auth/password/recuperar", authLimit, async (req, res) => {
        const { email } = req.body || {};
        if (!email) return res.status(400).json({ error: "Email requerido." });

        try {
            const [rows] = await db.query("SELECT id FROM usuarios WHERE email = ? AND activo = 1", [email.toLowerCase()]);
            if (!rows.length) return res.json({ ok: true, mensaje: "Si el correo existe, recibirás un enlace." });

            const token     = generateSecureToken();
            const tokenHash = hashToken(token);
            const exp       = new Date(Date.now() + 30 * 60_000); // 30 min

            await db.query(
                "INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
                [rows[0].id, tokenHash, exp]
            );

            // ¡Enviamos el enlace real!
            try {
                await enviarCorreoRecuperacion(email, token);
                pushLog({ level: "info", message: "auth_password_reset_enviado", correlationId: req.correlationId, context: { email } });
            } catch (mailError) {
                pushLog({ level: "error", message: "auth_password_reset_mail_fallo", correlationId: req.correlationId, context: { error: mailError.message } });
                // Seguimos respondiendo OK por seguridad (anti-enumeration), pero el log ya guardó el fallo.
            }

            res.json({ ok: true, mensaje: "Si el correo existe, recibirás un enlace." });
        } catch (err) {
            res.status(500).json({ error: "Error interno." });
        }
    });

    // ════════════════════════════════════════════════════════
    // RECUPERACIÓN — cambiar contraseña con token
    // ════════════════════════════════════════════════════════
    app.post("/auth/password/reset", async (req, res) => {
        const { token, password, confirm } = req.body || {};
        if (!token || !password || !confirm)
            return res.status(400).json({ error: "Faltan campos." });
        if (password !== confirm)
            return res.status(400).json({ error: "Las contraseñas no coinciden." });
        if (!/^(?=.*[A-Z])(?=.*\d).{8,}$/.test(password))
            return res.status(400).json({ error: "Contraseña insegura." });

        try {
            const tokenHash = hashToken(token);
            const [rows] = await db.query(
                "SELECT id, user_id FROM password_resets WHERE token_hash = ? AND usado = 0 AND expires_at > NOW()",
                [tokenHash]
            );
            if (!rows.length)
                return res.status(400).json({ error: "Token inválido o expirado." });

            const hash = await hashPassword(password);
            await db.query("UPDATE usuarios SET password = ?, login_attempts = 0 WHERE id = ?", [hash, rows[0].user_id]);
            await db.query("UPDATE password_resets SET usado = 1 WHERE id = ?", [rows[0].id]);

            // Revocar todas las sesiones activas (seguridad)
            await db.query("UPDATE sessions SET activa = 0 WHERE user_id = ?", [rows[0].user_id]);

            pushLog({ level: "info", message: "auth_password_reseteado", correlationId: req.correlationId, context: { user_id: rows[0].user_id } });
            res.json({ ok: true, mensaje: "Contraseña actualizada. Inicia sesión." });
        } catch (err) {
            res.status(500).json({ error: "Error interno." });
        }
    });

    // ════════════════════════════════════════════════════════
    // PERFIL — ver datos del usuario autenticado
    // ════════════════════════════════════════════════════════
    app.get("/auth/perfil", requireAuth(db), async (req, res) => {
        const [rows] = await db.query(
            "SELECT id, email, role, mfa_enabled, created_at FROM usuarios WHERE id = ?",
            [req.user.userId]
        );
        if (!rows.length) return res.status(404).json({ error: "Usuario no encontrado." });
        res.json(rows[0]);
    });

    // ════════════════════════════════════════════════════════
    // MFA — activar/desactivar
    // ════════════════════════════════════════════════════════
    app.post("/auth/mfa/toggle", requireAuth(db), async (req, res) => {
        try {
            const [rows] = await db.query("SELECT mfa_enabled FROM usuarios WHERE id = ?", [req.user.userId]);
            const nuevoEstado = rows[0].mfa_enabled ? 0 : 1;
            await db.query("UPDATE usuarios SET mfa_enabled = ? WHERE id = ?", [nuevoEstado, req.user.userId]);
            
            if (typeof pushLog === 'function') {
                pushLog({ level: "info", message: "auth_mfa_toggle", correlationId: req.correlationId,
                    context: { userId: req.user.userId, mfa_enabled: nuevoEstado } });
            }
            
            res.json({ ok: true, mfa_enabled: Boolean(nuevoEstado) });
        } catch (err) {
            console.error("🔴 Error en el backend al cambiar MFA:", err);
            res.status(500).json({ error: "Error interno: " + err.message });
        }
    });

    // ════════════════════════════════════════════════════════
    // ADMIN — listar usuarios (solo admin)
    // ════════════════════════════════════════════════════════
    app.get("/auth/admin/usuarios", requireAuth(db), requireRole("admin"), async (req, res) => {
        const [rows] = await db.query(
            "SELECT id, email, role, mfa_enabled, activo, login_attempts, locked_until, created_at FROM usuarios ORDER BY id"
        );
        res.json(rows);
    });


    // ════════════════════════════════════════════════════════
    // CAMBIAR CONTRASEÑA (usuario autenticado)
    // ════════════════════════════════════════════════════════
    app.post("/auth/password/cambiar", requireAuth(db), async (req, res) => {
        const { password_actual, password_nuevo, confirm } = req.body || {};
        const cid = req.correlationId;

        if (!password_actual || !password_nuevo || !confirm)
            return res.status(400).json({ error: "Faltan campos." });
        if (password_nuevo !== confirm)
            return res.status(400).json({ error: "Las contraseñas no coinciden." });
        if (!/^(?=.*[A-Z])(?=.*\d).{8,}$/.test(password_nuevo))
            return res.status(400).json({ error: "Contraseña insegura: mínimo 8 chars, 1 mayúscula, 1 número." });

        try {
            const [rows] = await db.query("SELECT password FROM usuarios WHERE id = ?", [req.user.userId]);
            const ok = await comparePassword(password_actual, rows[0].password);
            if (!ok) return res.status(401).json({ error: "Contraseña actual incorrecta." });

            const hash = await hashPassword(password_nuevo);
            await db.query("UPDATE usuarios SET password = ? WHERE id = ?", [hash, req.user.userId]);

            // Revocar todas las demás sesiones (seguridad)
            await db.query(
                "UPDATE sessions SET activa = 0 WHERE user_id = ? AND id != ?",
                [req.user.userId, req.user.sessionId]
            );

            pushLog({ level: "info", message: "auth_password_cambiado", correlationId: cid,
                context: { userId: req.user.userId } });
            res.json({ ok: true, mensaje: "Contraseña actualizada. Otras sesiones cerradas." });
        } catch (err) {
            res.status(500).json({ error: "Error interno." });
        }
    });

    // ════════════════════════════════════════════════════════
    // PREFERENCIAS — leer
    // ════════════════════════════════════════════════════════
    app.get("/auth/preferencias", requireAuth(db), async (req, res) => {
        const [rows] = await db.query("SELECT preferencias FROM usuarios WHERE id = ?", [req.user.userId]);
        const prefs = rows[0]?.preferencias || { tema: "claro", idioma: "es", notificaciones: true };
        res.json(typeof prefs === "string" ? JSON.parse(prefs) : prefs);
    });

    // ════════════════════════════════════════════════════════
    // PREFERENCIAS — actualizar
    // ════════════════════════════════════════════════════════
    app.put("/auth/preferencias", requireAuth(db), async (req, res) => {
        const { tema, idioma, notificaciones } = req.body || {};

        const TEMAS   = ["claro", "oscuro"];
        const IDIOMAS = ["es", "en"];
        if (tema && !TEMAS.includes(tema))
            return res.status(400).json({ error: "Tema inválido. Opciones: claro, oscuro." });
        if (idioma && !IDIOMAS.includes(idioma))
            return res.status(400).json({ error: "Idioma inválido. Opciones: es, en." });

        try {
            const [rows] = await db.query("SELECT preferencias FROM usuarios WHERE id = ?", [req.user.userId]);
            const actual = rows[0]?.preferencias || {};
            const actual_parsed = typeof actual === "string" ? JSON.parse(actual) : actual;

            const nuevas = {
                tema:           tema           ?? actual_parsed.tema           ?? "claro",
                idioma:         idioma         ?? actual_parsed.idioma         ?? "es",
                notificaciones: notificaciones ?? actual_parsed.notificaciones ?? true,
            };

            await db.query("UPDATE usuarios SET preferencias = ? WHERE id = ?",
                [JSON.stringify(nuevas), req.user.userId]);

            pushLog({ level: "info", message: "auth_preferencias_actualizadas", correlationId: req.correlationId,
                context: { userId: req.user.userId, preferencias: nuevas } });
            res.json({ ok: true, preferencias: nuevas });
        } catch (err) {
            res.status(500).json({ error: "Error interno." });
        }
    });

    // ════════════════════════════════════════════════════════
    // CERRAR TODAS LAS SESIONES excepto la actual
    // ════════════════════════════════════════════════════════
    app.post("/auth/sesiones/cerrar-todas", requireAuth(db), async (req, res) => {
        await db.query(
            "UPDATE sessions SET activa = 0 WHERE user_id = ? AND id != ?",
            [req.user.userId, req.user.sessionId]
        );
        await db.query(
            "UPDATE refresh_tokens SET revocado = 1 WHERE user_id = ? AND session_id != ?",
            [req.user.userId, req.user.sessionId]
        );
        pushLog({ level: "info", message: "auth_sesiones_cerradas_todas", correlationId: req.correlationId,
            context: { userId: req.user.userId } });
        res.json({ ok: true, mensaje: "Todas las otras sesiones han sido cerradas." });
    });

    // ════════════════════════════════════════════════════════
    // HELPER INTERNO — crear sesión + tokens
    // ════════════════════════════════════════════════════════
    async function emitirTokens(db, user, ip, ua) {
        const sessionId   = randomUUID();
        const refreshRaw  = generateSecureToken();
        const refreshHash = hashToken(refreshRaw);
        const refreshExp  = new Date(Date.now() + REFRESH_EXPIRES);

        await db.query(
            "INSERT INTO sessions (id, user_id, ip, user_agent) VALUES (?, ?, ?, ?)",
            [sessionId, user.id, ip, ua]
        );
        await db.query(
            "INSERT INTO refresh_tokens (id, user_id, session_id, token_hash, expires_at) VALUES (?, ?, ?, ?, ?)",
            [randomUUID(), user.id, sessionId, refreshHash, refreshExp]
        );

        const accessToken = await signAccessToken({
            userId: user.id, email: user.email,
            role: user.role, sessionId,
        });

        return { access_token: accessToken, refresh_token: refreshRaw, session_id: sessionId };
    }
}