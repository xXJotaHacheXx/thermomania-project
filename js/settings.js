// settings.js — Thermomania AG
// Módulo de configuración de usuario

const SETTINGS_API = "http://localhost:3000";

// ── Token helpers ──────────────────────────────────────────
const getToken    = ()        => localStorage.getItem("access_token");
const setTokens   = (data)    => {
    localStorage.setItem("access_token",  data.access_token);
    localStorage.setItem("refresh_token", data.refresh_token);
    localStorage.setItem("session_id",    data.session_id);
    localStorage.setItem("role",          data.role);
};
const clearTokens = ()        => {
    ["access_token","refresh_token","session_id","role"].forEach(k => localStorage.removeItem(k));
};

// ── Fetch autenticado con auto-refresh ─────────────────────
async function tryRefresh() {
    const rt = localStorage.getItem("refresh_token");
    if (!rt) return false;
    try {
        const req = await fetch(`${SETTINGS_API}/auth/refresh`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: rt })
        });
        const res = await req.json();
        if (req.ok && res.access_token) {
            localStorage.setItem("access_token", res.access_token);
            localStorage.setItem("refresh_token", res.refresh_token);
            return true;
        }
        return false;
    } catch { return false; }
}

async function authFetch(url, options = {}) {
    let token = getToken();
    let res = await fetch(url, {
        ...options,
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}`, ...(options.headers || {}) }
    });

    // Token expirado → intentar refresh automático
    if (res.status === 401) {
        const refreshed = await tryRefresh();
        if (!refreshed) { 
            clearTokens(); 
            window.location.href = "cuenta.html"; 
            return res; 
        }
        token = getToken();
        res = await fetch(url, {
            ...options,
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}`, ...(options.headers || {}) }
        });
    }
    return res;
}

// ── Objeto Principal Settings ──────────────────────────────
const Settings = {
    async init() {
        if (!getToken()) return; // Si no hay sesión, no hace nada
        this.bindEventos();
        this.cargarPerfil();
        this.cargarSesiones();
    },

    bindEventos() {
        document.getElementById("form-password")?.addEventListener("submit", e => this.cambiarPassword(e));
        document.getElementById("form-preferencias")?.addEventListener("submit", e => this.guardarPreferencias(e));
        document.getElementById("mfa-toggle")?.addEventListener("change", () => this.toggleMFA());
        document.getElementById("btn-cerrar-todas")?.addEventListener("click", () => this.cerrarTodasSesiones());
        document.getElementById("btn-logout")?.addEventListener("click", () => this.logout());

        // ¡MAGIA! Preview en vivo del tema oscuro al hacer clic
        document.querySelectorAll('input[name="tema"]').forEach(radio => {
            radio.addEventListener('change', e => aplicarTema(e.target.value));
        });
    },

    async cargarPerfil() {
        try {
            // Cargar MFA
            const res = await authFetch(`${SETTINGS_API}/auth/perfil`);
            if (res.ok) {
                const user = await res.json();
                const mfaToggle = document.getElementById("mfa-toggle");
                const mfaEstado = document.getElementById("mfa-estado");
                if (mfaToggle) mfaToggle.checked = (user.mfa_enabled === 1);
                if (mfaEstado) {
                    mfaEstado.textContent = user.mfa_enabled ? "Activo" : "Inactivo";
                    mfaEstado.style.color = user.mfa_enabled ? "#27ae60" : "inherit";
                }
            }

            // Cargar Preferencias desde la BD
            const prefRes = await authFetch(`${SETTINGS_API}/auth/preferencias`);
            if (prefRes.ok) {
                const prefs = await prefRes.json();
                
                // Marcar las tarjetas correctas
                const radioTema = document.querySelector(`input[name="tema"][value="${prefs.tema || 'claro'}"]`);
                const radioIdioma = document.querySelector(`input[name="idioma"][value="${prefs.idioma || 'es'}"]`);
                if (radioTema) radioTema.checked = true;
                if (radioIdioma) radioIdioma.checked = true;
                
                // Aplicar el tema que venía de la BD
                aplicarTema(prefs.tema || "claro");
            }
        } catch (e) { console.error("Error cargando perfil", e); }
    },

    async cargarSesiones() {
        try {
            const res = await authFetch(`${SETTINGS_API}/auth/sesiones`);
            if (!res.ok) return;
            const sesiones = await res.json();
            const lista = document.getElementById("lista-sesiones");
            if (!lista) return;

            lista.innerHTML = sesiones.map(s => `
                <div class="sesion-item ${s.es_actual ? 'sesion-actual' : ''}">
                    <div class="sesion-info">
                        <strong>${s.es_actual ? 'Esta sesión' : 'Otra sesión'}</strong>
                        <span>IP: ${s.ip}</span>
                        <span>${s.user_agent}</span>
                        <span>Última vez: ${new Date(s.last_seen).toLocaleString()}</span>
                    </div>
                    ${!s.es_actual ? `<button class="btn-cerrar-sesion" onclick="Settings.cerrarSesion('${s.id}')">Cerrar</button>` : ''}
                </div>
            `).join('');
        } catch (e) { console.error("Error cargando sesiones", e); }
    },

    async cambiarPassword(e) {
        e.preventDefault();
        const actual = document.getElementById("password-actual").value;
        const nuevo = document.getElementById("password-nuevo").value;
        const confirm = document.getElementById("password-confirmar").value;

        try {
            const res = await authFetch(`${SETTINGS_API}/auth/password/cambiar`, {
                method: "POST",
                body: JSON.stringify({ password_actual: actual, password_nuevo: nuevo, confirm })
            });
            const data = await res.json();
            if (res.ok) {
                mostrarMensaje("msg-password", data.mensaje, "exito");
                e.target.reset();
            } else { throw new Error(data.error); }
        } catch (err) { mostrarMensaje("msg-password", err.message, "error"); }
    },

    async guardarPreferencias(e) {
        e.preventDefault();
        // Así se leen las nuevas tarjetas!
        const tema = document.querySelector('input[name="tema"]:checked').value;
        const idioma = document.querySelector('input[name="idioma"]:checked').value;

        try {
            const res = await authFetch(`${SETTINGS_API}/auth/preferencias`, {
                method: "PUT",
                body: JSON.stringify({ tema, idioma })
            });
            const data = await res.json();
            if (res.ok) {
                mostrarMensaje("msg-preferencias", "¡Preferencias guardadas en la nube!", "exito");
                aplicarTema(tema);
            } else { throw new Error(data.error); }
        } catch (err) { mostrarMensaje("msg-preferencias", err.message, "error"); }
    },

    async toggleMFA() {
        try {
            const res = await authFetch(`${SETTINGS_API}/auth/mfa/toggle`, { method: "POST" });
            
            // Extraer respuesta como texto primero para atrapar colapsos del servidor
            const textData = await res.text(); 
            let data;
            try {
                data = JSON.parse(textData);
            } catch (e) {
                throw new Error("El servidor devolvió HTML (crasheo): " + textData.substring(0, 80));
            }

            if (res.ok) {
                const estado = document.getElementById("mfa-estado");
                estado.textContent = data.mfa_enabled ? "Activo" : "Inactivo";
                estado.style.color = data.mfa_enabled ? "#27ae60" : "inherit";
                mostrarMensaje("msg-mfa", "Configuración de MFA actualizada", "exito");
            } else {
                throw new Error(data.error || "Error desconocido devuelto por la API");
            }
        } catch (err) { 
            console.error("🔴 Detalle del error del MFA:", err);
            mostrarMensaje("msg-mfa", "Error: " + err.message, "error"); 
            
            // Regresar el interruptor a su estado original si falló
            const toggle = document.getElementById("mfa-toggle");
            if (toggle) toggle.checked = !toggle.checked;
        }
    },

    async cerrarTodasSesiones() {
        try {
            const res = await authFetch(`${SETTINGS_API}/auth/sesiones/cerrar-todas`, { method: "POST" });
            const data = await res.json();
            if (res.ok) {
                mostrarMensaje("msg-sesiones", data.mensaje, "exito");
                this.cargarSesiones();
            }
        } catch (err) { mostrarMensaje("msg-sesiones", "Error al cerrar", "error"); }
    },

    async cerrarSesion(id) {
        try {
            const res = await authFetch(`${SETTINGS_API}/auth/sesiones/${id}`, { method: "DELETE" });
            if (res.ok) this.cargarSesiones();
        } catch (e) { console.error(e); }
    },

    async logout() {
        try {
            await authFetch(`${SETTINGS_API}/auth/logout`, { method: "POST" });
        } finally {
            clearTokens();
            window.location.href = "cuenta.html";
        }
    }
};

window.Settings = Settings;

// ── Helpers ────────────────────────────────────────────────
function mostrarMensaje(id, texto, tipo) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = texto;
    el.style.color = tipo === "exito" ? "#27ae60" : "#e74c3c";
    setTimeout(() => { el.textContent = ""; }, 3500);
}

function aplicarTema(tema) {
    document.documentElement.setAttribute("data-tema", tema);
    localStorage.setItem("tema", tema);
}

// ── Iniciar ────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => Settings.init());