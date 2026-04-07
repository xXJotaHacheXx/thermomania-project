import "dotenv/config";
// mailer.js — Thermomania AG
import nodemailer from 'nodemailer';

// ── Configuración del Transporter ──────────────────────────
// 💡 TIP: En producción, NUNCA pongas tus contraseñas aquí directamente.
// Usa variables de entorno (process.env.SMTP_USER, etc.)
const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com", // Ejemplo usando Gmail
    port: 465,
    secure: true,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// ── Plantilla para código MFA ──────────────────────────────
export async function enviarCorreoMFA(email, codigo) {
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #2c3e50; text-align: center;">Tu código de seguridad</h2>
            <p style="color: #555;">Hola,</p>
            <p style="color: #555;">Alguien ha intentado iniciar sesión en tu cuenta de <strong>Thermomania AG</strong>. Ingresa el siguiente código de 6 dígitos para continuar:</p>
            
            <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; background: #ecf0f1; color: #3498db; padding: 20px; text-align: center; border-radius: 8px; margin: 30px 0;">
                ${codigo}
            </div>
            
            <p style="color: #7f8c8d; font-size: 0.9rem;">Este código expirará en 10 minutos.</p>
            <p style="color: #7f8c8d; font-size: 0.9rem;">Si no fuiste tú, por favor ignora este correo y te recomendamos cambiar tu contraseña.</p>
        </div>
    `;

    await transporter.sendMail({
        from: '"Thermomania AG" <no-reply@thermomania.com>',
        to: email,
        subject: "Código de Verificación MFA - Thermomania",
        html: html
    });
}

// ── Plantilla para Recuperar Contraseña ────────────────────
export async function enviarCorreoRecuperacion(email, token) {
    // ⚠️ Cambia el puerto 5500 por el puerto donde corra tu frontend (Live Server, etc.)
    const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost";
    const enlace = `${FRONTEND_URL}/cuenta.html?reset=${token}`;

    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #2c3e50; text-align: center;">Recuperación de contraseña</h2>
            <p style="color: #555;">Hola,</p>
            <p style="color: #555;">Recibimos una solicitud para restablecer tu contraseña en <strong>Thermomania AG</strong>. Haz clic en el botón de abajo para crear una nueva:</p>
            
            <div style="text-align: center; margin: 35px 0;">
                <a href="${enlace}" style="background-color: #3498db; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Restablecer mi contraseña</a>
            </div>
            
            <p style="color: #555; font-size: 0.9rem;">O copia y pega este enlace en tu navegador:</p>
            <p style="word-break: break-all;"><a href="${enlace}" style="color: #3498db;">${enlace}</a></p>
            
            <p style="color: #7f8c8d; font-size: 0.9rem; margin-top: 30px;">Este enlace expirará en 30 minutos.</p>
        </div>
    `;

    await transporter.sendMail({
        from: '"Thermomania AG" <no-reply@thermomania.com>',
        to: email,
        subject: "Restablecer tu contraseña - Thermomania",
        html: html
    });
}