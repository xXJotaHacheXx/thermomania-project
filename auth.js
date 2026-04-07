// auth.js — Thermomania AG — Unidad 3
// JWT + bcrypt + MFA + Multisesiones + RBAC + Rate limiting

import { createHash, randomBytes, randomUUID } from "crypto";
import { SignJWT, jwtVerify }                  from "jose";
import bcrypt                                   from "bcrypt";

// ── Constantes ─────────────────────────────────────────────
const JWT_SECRET      = new TextEncoder().encode(process.env.JWT_SECRET || "thermomania_dev_secret_min32chars!!");
const ACCESS_EXPIRES  = "15m";
const REFRESH_EXPIRES = 7 * 24 * 60 * 60 * 1000; // 7 días en ms
const BCRYPT_ROUNDS   = 12;
const MAX_ATTEMPTS    = 5;
const LOCK_MINUTES    = 15;

// ── JWT helpers ────────────────────────────────────────────
export async function signAccessToken(payload) {
    return new SignJWT(payload)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(ACCESS_EXPIRES)
        .sign(JWT_SECRET);
}

export async function verifyAccessToken(token) {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload;
}

// ── Bcrypt helpers ─────────────────────────────────────────
export const hashPassword   = (pw)       => bcrypt.hash(pw, BCRYPT_ROUNDS);
export const comparePassword = (pw, hash) => bcrypt.compare(pw, hash);

// ── Token seguro para refresh / reset / MFA ───────────────
export function generateSecureToken() {
    return randomBytes(32).toString("hex"); // 64 chars hex
}
export function hashToken(token) {
    return createHash("sha256").update(token).digest("hex");
}

// ── MFA: generar código OTP 6 dígitos ────────────────────
export function generateOTP() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

// ── Middleware: verificar JWT en header Authorization ──────
export function requireAuth(db) {
    return async (req, res, next) => {
        const header = req.headers["authorization"];
        if (!header?.startsWith("Bearer "))
            return res.status(401).json({ error: "Token requerido." });

        const token = header.slice(7);
        try {
            const payload = await verifyAccessToken(token);

            // Verificar que la sesión siga activa en BD
            const [rows] = await db.query(
                "SELECT id FROM sessions WHERE id = ? AND activa = 1",
                [payload.sessionId]
            );
            if (!rows.length)
                return res.status(401).json({ error: "Sesión revocada." });

            req.user = payload;
            // Actualizar last_seen
            db.query("UPDATE sessions SET last_seen = NOW() WHERE id = ?", [payload.sessionId]).catch(() => {});
            next();
        } catch {
            return res.status(401).json({ error: "Token inválido o expirado." });
        }
    };
}

// ── Middleware: verificar rol (RBAC) ───────────────────────
export function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user)
            return res.status(401).json({ error: "No autenticado." });
        if (!roles.includes(req.user.role))
            return res.status(403).json({ error: "Acceso denegado. Rol insuficiente." });
        next();
    };
}

// ── Rate limiting por IP (brute force) ────────────────────
const attempts = new Map(); // ip → { count, resetAt }

export function rateLimitAuth(maxPerMin = 10) {
    return (req, res, next) => {
        const ip  = req.ip || "unknown";
        const now = Date.now();
        const rec = attempts.get(ip) || { count: 0, resetAt: now + 60_000 };

        if (now > rec.resetAt) { rec.count = 0; rec.resetAt = now + 60_000; }
        rec.count++;
        attempts.set(ip, rec);

        if (rec.count > maxPerMin) {
            return res.status(429).json({ error: "Demasiados intentos. Espera un momento." });
        }
        next();
    };
}

export { REFRESH_EXPIRES, MAX_ATTEMPTS, LOCK_MINUTES, BCRYPT_ROUNDS };