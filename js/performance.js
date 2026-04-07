// performance.js — Thermomania AG — Parte 5
// Optimización y rendimiento

// ══════════════════════════════════════════════════════════
// 1. THROTTLE
//    Limita la frecuencia máxima de ejecución de una función.
//    Diferencia con debounce: throttle garantiza ejecución
//    periódica; debounce espera a que el usuario pare.
//    Uso: scroll, resize, mousemove de alta frecuencia.
// ══════════════════════════════════════════════════════════
export function throttle(fn, limit) {
    let lastCall = 0;
    return function (...args) {
        const now = Date.now();
        if (now - lastCall >= limit) {
            lastCall = now;
            fn.apply(this, args);
        }
    };
}

// ══════════════════════════════════════════════════════════
// 2. DEBOUNCE
//    Centralizado aquí para importar desde un solo lugar.
// ══════════════════════════════════════════════════════════
export function debounce(fn, delay) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

// ══════════════════════════════════════════════════════════
// 3. requestAnimationFrame — SCROLL HANDLER
//    Usa rAF para que el callback de scroll corra en el
//    momento óptimo del ciclo de renderizado del navegador,
//    evitando trabajo redundante entre frames.
// ══════════════════════════════════════════════════════════
export function onScrollRAF(fn) {
    let ticking = false;
    window.addEventListener("scroll", () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            fn();
            ticking = false;
        });
    }, { passive: true });
}

// ══════════════════════════════════════════════════════════
// 4. requestAnimationFrame — RESIZE HANDLER
// ══════════════════════════════════════════════════════════
export function onResizeRAF(fn) {
    let ticking = false;
    window.addEventListener("resize", () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            fn();
            ticking = false;
        });
    }, { passive: true });
}

// ══════════════════════════════════════════════════════════
// 5. MINIMIZACIÓN DE REFLOWS — Batch DOM reads/writes
//    Regla: leer todo el DOM primero (reads), luego escribir
//    (writes). Mezclarlos fuerza reflow en cada operación.
//
//    Uso:
//      batchDOM(
//        () => [el1.offsetHeight, el2.getBoundingClientRect()],  // read
//        ([h, rect]) => { el1.style.height = h + "px"; }         // write
//      );
// ══════════════════════════════════════════════════════════
export function batchDOM(readFn, writeFn) {
    requestAnimationFrame(() => {
        const measurements = readFn();          // lectura — no fuerza reflow extra
        requestAnimationFrame(() => {
            writeFn(measurements);              // escritura — en el siguiente frame
        });
    });
}

// ══════════════════════════════════════════════════════════
// 6. LAZY LOADING MANUAL con IntersectionObserver
//    Para imágenes que no usan loading="lazy" nativo,
//    o para cualquier recurso que se carga bajo demanda.
//    Uso: <img data-src="imagen.jpg" class="lazy-img">
// ══════════════════════════════════════════════════════════
export function initLazyImages(selector = "img[data-src]") {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const img = entry.target;
            img.src = img.dataset.src;
            img.removeAttribute("data-src");
            img.classList.add("lazy-loaded");
            observer.unobserve(img);
        });
    }, { rootMargin: "200px" }); // precargar 200px antes de que sea visible

    document.querySelectorAll(selector).forEach(img => observer.observe(img));
}

// ══════════════════════════════════════════════════════════
// 7. MEDICIÓN DE RENDIMIENTO — console.time wrapper
//    Centraliza mediciones y opcionalmente las envía al log.
// ══════════════════════════════════════════════════════════
export const Perf = {
    marks: {},

    start(label) {
        this.marks[label] = performance.now();
        console.time(`[Perf] ${label}`);
    },

    end(label) {
        console.timeEnd(`[Perf] ${label}`);
        const ms = performance.now() - (this.marks[label] || 0);
        delete this.marks[label];
        if (ms > 100) {
            console.warn(`[Perf] ⚠ ${label} tardó ${ms.toFixed(1)}ms (>100ms)`);
            window._log?.warn("perf_slow_operation", { label, ms: Math.round(ms) });
        }
        return ms;
    },
};

// ══════════════════════════════════════════════════════════
// 8. APLICAR OPTIMIZACIONES GLOBALES AL INIT
// ══════════════════════════════════════════════════════════
export function initPerformance() {

    // ── Lazy loading de imágenes con data-src ──────────────
    initLazyImages();

    // ── Indicador de scroll con rAF + throttle ─────────────
    const header = document.querySelector("header");
    if (header) {
        // throttle: máximo 1 ejecución cada 100ms
        const onScroll = throttle(() => {
            batchDOM(
                () => window.scrollY,                               // read
                (scrollY) => {                                      // write
                    header.classList.toggle("scrolled", scrollY > 60);
                }
            );
        }, 100);
        onScrollRAF(onScroll);
    }

    // ── Resize: recalcular carousel si cambia viewport ─────
    onResizeRAF(debounce(() => {
        // Forzar recálculo de ancho sin causar reflow múltiple
        const track = document.querySelector(".carousel-track");
        if (!track) return;
        batchDOM(
            () => track.parentElement?.offsetWidth,
            () => { /* el carousel usa % así que se adapta solo */ }
        );
    }, 200));

    console.log("[Perf] Optimizaciones inicializadas");
}

document.addEventListener("DOMContentLoaded", initPerformance);