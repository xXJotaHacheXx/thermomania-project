// recovery.js — Thermomania AG — Parte 7
// Recuperación de contraseña por correo (token simulado en logs)

const RECOVERY_API = (window.API_BASE || "https://thermomania-project-production.up.railway.app");

const Recovery = {

    init() {
        // Detectar si hay ?reset=TOKEN en la URL
        const params = new URLSearchParams(location.search);
        const token  = params.get("reset");

        if (token) {
            this.mostrarPaso2(token);
        }

        // Enlace "Olvidé mi contraseña"
        document.getElementById("link-forgot")
            ?.addEventListener("click", e => { e.preventDefault(); this.mostrarRecovery(); });

        // Enlace volver al login
        document.getElementById("link-volver-login")
            ?.addEventListener("click", e => { e.preventDefault(); this.ocultarRecovery(); });

        // Form paso 1: solicitar enlace
        document.getElementById("form-recovery")
            ?.addEventListener("submit", e => this.solicitarEnlace(e));

        // Form paso 2: cambiar password con token
        document.getElementById("form-reset")
            ?.addEventListener("submit", e => this.cambiarPassword(e, token));
    },

    mostrarRecovery() {
        document.querySelector(".login-section")?.style.setProperty("display", "none");
        document.querySelector(".register-section")?.style.setProperty("display", "none");
        document.getElementById("recovery-section").style.display = "block";
    },

    ocultarRecovery() {
        document.getElementById("recovery-section").style.display = "none";
        document.querySelector(".login-section")?.style.setProperty("display", "block");
    },

    mostrarPaso2(token) {
        this.mostrarRecovery();
        document.getElementById("recovery-step1").style.display = "none";
        document.getElementById("recovery-step2").style.display = "block";
        // Guardar token para usarlo al enviar el form
        document.getElementById("form-reset").dataset.token = token;
    },

    // ── Paso 1: solicitar token de recuperación ────────────
    async solicitarEnlace(e) {
        e.preventDefault();
        const email = document.getElementById("recovery-email")?.value.trim();
        const msgEl = document.getElementById("msg-recovery");

        try {
            const res  = await fetch(`${RECOVERY_API}/auth/password/recuperar`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });
            const data = await res.json();

            msgEl.className   = "settings-msg settings-msg-exito";
            msgEl.textContent = data.mensaje || "Si el correo existe, recibirás un enlace.";
            msgEl.innerHTML  += `<br><small>💡 El enlace y token aparecen en <a href="logs.html" target="_blank">los logs del servidor</a> bajo el campo <code>token_simulado</code>.</small>`;

        } catch {
            msgEl.className   = "settings-msg settings-msg-error";
            msgEl.textContent = "Error al conectar con el servidor.";
        }
    },

    // ── Paso 2: cambiar contraseña con token ───────────────
    async cambiarPassword(e, tokenUrl) {
        e.preventDefault();
        const token   = tokenUrl || e.target.dataset.token;
        const password = document.getElementById("reset-password")?.value;
        const confirm  = document.getElementById("reset-confirm")?.value;
        const msgEl    = document.getElementById("msg-reset");

        try {
            const res  = await fetch(`${RECOVERY_API}/auth/password/reset`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, password, confirm }),
            });
            const data = await res.json();

            if (data.ok) {
                msgEl.className   = "settings-msg settings-msg-exito";
                msgEl.textContent = data.mensaje;
                setTimeout(() => {
                    // Limpiar token de la URL y mostrar login
                    history.replaceState({}, "", location.pathname);
                    this.ocultarRecovery();
                    document.getElementById("recovery-step1").style.display = "block";
                    document.getElementById("recovery-step2").style.display = "none";
                }, 2000);
            } else {
                msgEl.className   = "settings-msg settings-msg-error";
                msgEl.textContent = data.error;
            }
        } catch {
            msgEl.className   = "settings-msg settings-msg-error";
            msgEl.textContent = "Error al conectar con el servidor.";
        }
    },
};

document.addEventListener("DOMContentLoaded", () => Recovery.init());