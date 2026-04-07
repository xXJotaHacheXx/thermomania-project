const _cid = localStorage.getItem("cid") || crypto.randomUUID();
localStorage.setItem("cid", _cid);

const LOG_ENDPOINT = "http://localhost:3000/logs";
const _env         = location.hostname === "localhost" ? "dev" : "prod";
const _getUserId   = () => { try { return localStorage.getItem("userId") || "anonymous"; } catch { return "anonymous"; } };

function sendLog(payload) {
    const ctx = { ...(payload.context || {}) };
    ["password", "token", "secret", "cvv", "pin"].forEach(k => { if (ctx[k]) ctx[k] = "***"; });

    const entry = {
        timestamp:     new Date().toISOString(),
        level:         payload.level   || "info",
        service:       "thermomania-frontend",
        env:           _env,
        message:       payload.message || "",
        correlationId: _cid,
        userId:        _getUserId(),
        url:           location.pathname,
        ...(Object.keys(ctx).length       && { context: ctx }),
        ...(payload.method                && { method: payload.method }),
        ...(payload.status                && { status: payload.status }),
        ...(payload.responseTimeMs != null && { responseTimeMs: payload.responseTimeMs }),
    };

    const body = JSON.stringify(entry);
    if (navigator.sendBeacon) {
        navigator.sendBeacon(LOG_ENDPOINT, new Blob([body], { type: "application/json" }));
    } else {
        fetch(LOG_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body }).catch(() => {});
    }
}

// ── Errores globales ───────────────────────────────────────
window.addEventListener("error", e => sendLog({
    level: "error", message: "window_error",
    context: { msg: e.message, src: e.filename, line: e.lineno, stack: e.error?.stack?.slice(0, 400) },
}));
window.addEventListener("unhandledrejection", e => sendLog({
    level: "error", message: "unhandled_rejection",
    context: { reason: String(e.reason).slice(0, 400) },
}));

// ── Carga de página ────────────────────────────────────────
window.addEventListener("load", () => {
    const nav = performance.getEntriesByType("navigation")[0];
    sendLog({
        level: "info", message: "page_loaded",
        context: nav ? {
            domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd),
            loadMs:             Math.round(nav.loadEventEnd),
            transferSizeKB:     Math.round((nav.transferSize || 0) / 1024),
        } : {},
    });
});

// ── Clics con data-log ─────────────────────────────────────
document.addEventListener("click", e => {
    const btn = e.target.closest("[data-log]");
    if (btn) sendLog({ level: "info", message: "ui_click", context: { element: btn.dataset.log, text: btn.innerText?.slice(0, 60) } });
}, true);

// ── Fetch con logging automático ───────────────────────────
async function fetchLog(url, options = {}) {
    const t0     = Date.now();
    const method = (options.method || "GET").toUpperCase();
    try {
        const res = await fetch(url, { ...options, headers: { ...(options.headers || {}), "x-correlation-id": _cid } });
        const ms  = Date.now() - t0;
        sendLog({ level: res.status >= 500 ? "error" : res.status >= 400 ? "warn" : "info",
                  message: "http_request", method, status: res.status, responseTimeMs: ms,
                  context: { url, slow: ms > 500 } });
        return res;
    } catch (err) {
        sendLog({ level: "error", message: "http_request_failed", method, responseTimeMs: Date.now() - t0,
                  context: { url, error: err.message } });
        throw err;
    }
}

// ── API pública ────────────────────────────────────────────
window._log = {
    cid:   _cid,
    info:  (msg, ctx = {}) => sendLog({ level: "info",  message: msg, context: ctx }),
    warn:  (msg, ctx = {}) => sendLog({ level: "warn",  message: msg, context: ctx }),
    error: (msg, ctx = {}) => sendLog({ level: "error", message: msg, context: ctx }),
    fetch: fetchLog,
    event: {
        productoVisto:   (id, nombre) => sendLog({ level: "info", message: "negocio_producto_visto",   context: { productoId: id, nombre } }),
        carritoAgregado: (id, nombre) => sendLog({ level: "info", message: "negocio_carrito_agregado", context: { productoId: id, nombre } }),
        loginExitoso:    (email)      => sendLog({ level: "info", message: "negocio_login_exitoso",    context: { email } }),
        registroExitoso: (email)      => sendLog({ level: "info", message: "negocio_registro_exitoso", context: { email } }),
        busqueda:        (query)      => sendLog({ level: "info", message: "negocio_busqueda",         context: { query } }),
    },
};