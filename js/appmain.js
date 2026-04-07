// app.js — Thermomania AG
// Orquestador principal — Patrón Pub/Sub (Observer)
// Conecta: Api ↔ Dom ↔ Animations ↔ Carousel

import { Api }          from "./api.js";
import { initPerformance, throttle, Perf } from "./performance.js";
import { Dom }          from "./dom.js";
import { Cache }        from "./cache.js";
import { initCarousel } from "./carousel.js";
import { initScrollObserver, initParallax, initMagneticButtons } from "./animations.js";

// ══════════════════════════════════════════════════════════
// PATRÓN PUB/SUB (Observer)
// Desacopla los módulos: uno publica un evento,
// otros se suscriben sin conocerse entre sí.
// ══════════════════════════════════════════════════════════
const PubSub = (() => {
    const subs = {};
    return {
        // Suscribirse a un evento
        on(event, fn) {
            (subs[event] = subs[event] || []).push(fn);
        },
        // Publicar un evento con datos opcionales
        emit(event, data) {
            (subs[event] || []).forEach(fn => fn(data));
        },
        // Desuscribirse
        off(event, fn) {
            subs[event] = (subs[event] || []).filter(f => f !== fn);
        },
    };
})();

// debounce importado de performance.js
const debounce = (fn, delay) => { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); }; };

// ══════════════════════════════════════════════════════════
// CATÁLOGO — carga y filtros
// ══════════════════════════════════════════════════════════
async function cargarProductos() {
    const p = Dom.getParams();
    const filtros = {
        categoria: p.get("categoria") || "",
        min:       p.get("min")       || "",
        max:       p.get("max")       || "",
        stock:     p.get("stock")     || "",
        q:         p.get("q")         || "",
    };

    // Sincronizar controles con URL
    const sel      = document.getElementById("categoria");
    const inputMin = document.getElementById("min");
    const inputMax = document.getElementById("max");
    const chkStock = document.getElementById("stock");
    const buscar   = document.getElementById("buscar-texto");
    if (sel)      sel.value      = filtros.categoria;
    if (inputMin) inputMin.value = filtros.min;
    if (inputMax) inputMax.value = filtros.max;
    if (chkStock) chkStock.checked = filtros.stock === "1";
    if (buscar)   buscar.value   = filtros.q;
    document.querySelectorAll(".filtro-btn").forEach(btn =>
        btn.classList.toggle("active", (filtros.categoria || "todos") === btn.dataset.categoria)
    );

    Dom.showLoader();

    Perf.start("cargarProductos");
    const [result] = await Promise.allSettled([Api.getProductos(filtros)]);
    Perf.end("cargarProductos");

    if (result.status === "rejected") {
        Dom.showError("No se pudo conectar al servidor. Verifica que esté activo con <code>node server.js</code>.");
        PubSub.emit("productos:error", result.reason);
        return;
    }
    if (result.value === null) return;

    Dom.renderProductos(result.value);
    PubSub.emit("productos:cargados", result.value);

    // Reanimar cards con scroll observer
    initScrollObserver();
}

// ══════════════════════════════════════════════════════════
// SUSCRIPCIONES PUB/SUB
// ══════════════════════════════════════════════════════════

// Cuando cargan productos → log de negocio
PubSub.on("productos:cargados", productos => {
    window._log?.info("negocio_catalogo_cargado", { total: productos.length });
});

// Cuando hay error → log de error
PubSub.on("productos:error", err => {
    window._log?.error("catalogo_error", { error: err?.message });
});

// Cuando llegan nuevos datos en tiempo real (Parte 6)
PubSub.on("productos:nuevos", () => {
    Cache.clear();
    cargarProductos();
    Dom.mostrarNotificacion("Catálogo actualizado", "info");
});

// ══════════════════════════════════════════════════════════
// EVENTOS DE FILTROS
// ══════════════════════════════════════════════════════════
function initFiltros() {
    const buscarInput = document.getElementById("buscar-texto");
    const form        = document.getElementById("form-avanzada");
    const btnLimpiar  = document.getElementById("btn-limpiar");

    // Buscador con debounce
    buscarInput?.addEventListener("input", debounce(e => {
        const p = Dom.getParams();
        e.target.value.trim() ? p.set("q", e.target.value.trim()) : p.delete("q");
        Dom.setParams(p);
        cargarProductos();
    }, 350));

    // Botones de categoría
    document.querySelectorAll(".filtro-btn").forEach(btn => btn.addEventListener("click", e => {
        e.preventDefault();
        const p = Dom.getParams();
        p.set("categoria", btn.dataset.categoria);
        ["min", "max", "stock", "q"].forEach(k => p.delete(k));
        Dom.setParams(p);
        const sel = document.getElementById("categoria");
        if (sel) sel.value = btn.dataset.categoria === "todos" ? "" : btn.dataset.categoria;
        ["min","max"].forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
        const chk = document.getElementById("stock"); if (chk) chk.checked = false;
        if (buscarInput) buscarInput.value = "";
        cargarProductos();
    }));

    // Formulario avanzado
    form?.addEventListener("submit", e => {
        e.preventDefault();
        const p         = Dom.getParams();
        const categoria = document.getElementById("categoria")?.value || "";
        const min       = document.getElementById("min")?.value.trim() || "";
        const max       = document.getElementById("max")?.value.trim() || "";
        const stock     = document.getElementById("stock")?.checked ? "1" : "";
        categoria ? p.set("categoria", categoria) : p.delete("categoria");
        min   ? p.set("min",   min)   : p.delete("min");
        max   ? p.set("max",   max)   : p.delete("max");
        stock ? p.set("stock", "1")   : p.delete("stock");
        Dom.setParams(p);
        cargarProductos();
    });

    // Limpiar
    btnLimpiar?.addEventListener("click", () => {
        ["categoria","min","max","stock"].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.type === "checkbox" ? (el.checked = false) : (el.value = "");
        });
        if (buscarInput) buscarInput.value = "";
        Cache.clear();
        const p = Dom.getParams();
        ["categoria","min","max","stock","q"].forEach(k => p.delete(k));
        Dom.setParams(p);
        cargarProductos();
    });
}

// ══════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
    // Optimizaciones Parte 5
    initPerformance();

    // Animaciones
    initScrollObserver();
    initParallax();
    initMagneticButtons();
    initCarousel();

    // Catálogo (si estamos en catalogo.html)
    if (document.querySelector(".grid")) {
        initFiltros();
        cargarProductos();
    }
});

// Exponer para uso global (botón Reintentar en showError)
window.App = { cargarProductos, PubSub };