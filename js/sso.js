// sso.js — Thermomania AG — Parte 6
// SSO simulado: token compartido entre apps del mismo dominio
// App A = gestor.html / App B = logs.html
// El usuario se autentica una vez y accede a ambas sin re-login

const SSO = (() => {

    // ── Clave compartida en localStorage (mismo dominio) ───
    const KEY_TOKEN   = "access_token";
    const KEY_REFRESH = "refresh_token";
    const KEY_ROLE    = "role";
    const KEY_SESSION = "session_id";

    // ── Verificar si tiene sesión SSO activa ───────────────
    function tieneSesion() {
        return Boolean(localStorage.getItem(KEY_TOKEN));
    }

    // ── Leer token SSO ─────────────────────────────────────
    function getToken() {
        return localStorage.getItem(KEY_TOKEN);
    }

    // ── Guardar sesión SSO (llamado tras login exitoso) ────
    function guardarSesion(data) {
        localStorage.setItem(KEY_TOKEN,   data.access_token);
        localStorage.setItem(KEY_REFRESH, data.refresh_token);
        localStorage.setItem(KEY_ROLE,    data.role);
        localStorage.setItem(KEY_SESSION, data.session_id);
        console.log("[SSO] Sesión guardada para todas las apps del dominio");
    }

    // ── Cerrar sesión SSO en todas las apps ────────────────
    async function cerrarSesionGlobal() {
        const token = getToken();
        if (token) {
            // Notificar al backend
            await fetch(`${window.API_BASE || "https://thermomania-project-production.up.railway.app"}/auth/logout`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
            }).catch(() => {});
        }
        [KEY_TOKEN, KEY_REFRESH, KEY_ROLE, KEY_SESSION].forEach(k => localStorage.removeItem(k));
        console.log("[SSO] Sesión global cerrada");
        location.href = "cuenta.html";
    }

    // ── Proteger app: redirige al login si no hay sesión ───
    function protegerApp(nombreApp) {
        if (!tieneSesion()) {
            console.log(`[SSO] ${nombreApp}: sin sesión activa → redirigiendo a login`);
            location.href = `cuenta.html?sso_redirect=${encodeURIComponent(location.href)}&app=${encodeURIComponent(nombreApp)}`;
            return false;
        }
        console.log(`[SSO] ${nombreApp}: sesión SSO válida ✓ (no requiere re-login)`);
        mostrarBannerSSO(nombreApp);
        return true;
    }

    // ── Banner visual que confirma el SSO ──────────────────
    function mostrarBannerSSO(nombreApp) {
        const banner = document.createElement("div");
        banner.id    = "sso-banner";
        banner.innerHTML = `
            <span>🔗 SSO activo</span>
            <span>Sesión compartida · ${nombreApp}</span>
            <button onclick="SSO.cerrarSesionGlobal()" style="
                background:transparent; border:1px solid rgba(255,255,255,.5);
                color:#fff; padding:.2rem .6rem; border-radius:4px; cursor:pointer; font-size:.8rem;
            ">Cerrar sesión global</button>`;
        banner.style.cssText = `
            position:fixed; top:0; left:0; right:0; z-index:9999;
            background:#1a1a2e; color:#a8d8ea;
            display:flex; align-items:center; justify-content:space-between;
            padding:.4rem 1.5rem; font-size:.82rem; font-family:Arial,sans-serif;
            box-shadow:0 2px 8px rgba(0,0,0,.3);`;
        document.body.prepend(banner);
    }

    // ── Redirigir de vuelta tras login SSO ─────────────────
    function manejarRedirectPostLogin() {
        const params   = new URLSearchParams(location.search);
        const redirect = params.get("sso_redirect");
        if (redirect && tieneSesion()) {
            console.log(`[SSO] Redirigiendo de vuelta a: ${redirect}`);
            location.href = redirect;
        }
    }

    return { tieneSesion, getToken, guardarSesion, cerrarSesionGlobal, protegerApp, manejarRedirectPostLogin };
})();

window.SSO = SSO;

// ── Init automático según la página actual ─────────────────
document.addEventListener("DOMContentLoaded", () => {
    const pagina = location.pathname.split("/").pop();

    if (pagina === "gestor.html") {
        SSO.protegerApp("Gestor de Productos");
    }
    if (pagina === "logs.html") {
        SSO.protegerApp("Panel de Logs");
    }
    if (pagina === "cuenta.html") {
        SSO.manejarRedirectPostLogin();
    }
});