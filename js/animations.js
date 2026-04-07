// animations.js — Thermomania AG — Parte 3

// ══════════════════════════════════════════════════════════
// 1. SCROLL ANIMATIONS — IntersectionObserver
//    Fade + translateY escalonado por data-index
// ══════════════════════════════════════════════════════════
function initScrollObserver() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const delay = (parseInt(entry.target.dataset.index) || 0) * 120;
            setTimeout(() => entry.target.classList.add("visible"), delay);
            observer.unobserve(entry.target);
        });
    }, { threshold: 0.12 });

    document.querySelectorAll(".observe-me").forEach(el => observer.observe(el));
}

// ══════════════════════════════════════════════════════════
// 2. SHOW / HIDE SUAVE — sin display:none
//    opacity + transform + height animada + pointer-events
// ══════════════════════════════════════════════════════════
function toggleVisibility(el, show) {
    if (show) {
        el.style.maxHeight     = el.scrollHeight + "px";
        el.style.opacity       = "1";
        el.style.transform     = "translateY(0)";
        el.style.pointerEvents = "auto";
    } else {
        el.style.maxHeight     = "0";
        el.style.opacity       = "0";
        el.style.transform     = "translateY(12px)";
        el.style.pointerEvents = "none";
    }
}

// ══════════════════════════════════════════════════════════
// 3A. PARALLAX EN HERO — mousemove
// ══════════════════════════════════════════════════════════
function initParallax() {
    const hero = document.querySelector(".hero");
    if (!hero) return;

    const layer = hero.querySelector(".hero-parallax-layer");

    hero.addEventListener("mousemove", e => {
        const { left, top, width, height } = hero.getBoundingClientRect();
        const x = ((e.clientX - left) / width  - 0.5) * 2;
        const y = ((e.clientY - top)  / height - 0.5) * 2;

        if (layer) layer.style.transform = `translate(${x * 20}px, ${y * 14}px)`;
        const title    = hero.querySelector("h1");
        const subtitle = hero.querySelector(".hero-subtitle");
        if (title)    title.style.transform    = `translate(${x * 7}px, ${y * 5}px)`;
        if (subtitle) subtitle.style.transform = `translate(${x * 4}px, ${y * 3}px)`;
    });

    hero.addEventListener("mouseleave", () => {
        if (layer) layer.style.transform = "translate(0,0)";
        const title    = hero.querySelector("h1");
        const subtitle = hero.querySelector(".hero-subtitle");
        if (title)    title.style.transform    = "translate(0,0)";
        if (subtitle) subtitle.style.transform = "translate(0,0)";
    });
}

// ══════════════════════════════════════════════════════════
// 3B. EFECTO MAGNÉTICO EN BOTONES (.btn-magnetic)
// ══════════════════════════════════════════════════════════
function initMagneticButtons() {
    document.querySelectorAll(".btn-magnetic").forEach(btn => {
        btn.addEventListener("mousemove", e => {
            const { left, top, width, height } = btn.getBoundingClientRect();
            const x = (e.clientX - left - width  / 2) * 0.38;
            const y = (e.clientY - top  - height / 2) * 0.38;
            btn.style.transform = `translate(${x}px, ${y}px) scale(1.06)`;
        });
        btn.addEventListener("mouseleave", () => {
            btn.style.transform = "translate(0,0) scale(1)";
        });
    });
}

// ══════════════════════════════════════════════════════════
// 4. CARRUSEL SIN LIBRERÍAS
//    Autoplay · controles · indicadores · loop · touch
// ══════════════════════════════════════════════════════════
function initCarousel(selector = ".carousel") {
    const carousel = document.querySelector(selector);
    if (!carousel) return;

    const track    = carousel.querySelector(".carousel-track");
    const slides   = Array.from(track.children);
    const dotsWrap = carousel.querySelector(".carousel-dots");
    const btnPrev  = carousel.querySelector(".carousel-prev");
    const btnNext  = carousel.querySelector(".carousel-next");
    const DELAY    = 4000;
    const DURATION = 500;

    let current  = 0;
    let timer    = null;
    let isMoving = false;

    // Crear indicadores dinámicos
    slides.forEach((_, i) => {
        const dot = document.createElement("button");
        dot.className = "carousel-dot";
        dot.setAttribute("aria-label", `Slide ${i + 1}`);
        dot.addEventListener("click", () => goTo(i));
        dotsWrap.appendChild(dot);
    });
    const dots = Array.from(dotsWrap.children);

    function goTo(index) {
        if (isMoving) return;
        isMoving = true;
        current = (index + slides.length) % slides.length;
        track.style.transition = `transform ${DURATION}ms cubic-bezier(0.4,0,0.2,1)`;
        track.style.transform  = `translateX(-${current * 100}%)`;
        slides.forEach((s, i) => s.classList.toggle("active", i === current));
        dots.forEach((d, i)   => d.classList.toggle("active", i === current));
        setTimeout(() => { isMoving = false; }, DURATION);
        resetTimer();
    }

    const next = () => goTo(current + 1);
    const prev = () => goTo(current - 1);

    // Autoplay
    const startTimer = () => { timer = setInterval(next, DELAY); };
    const resetTimer  = () => { clearInterval(timer); startTimer(); };
    carousel.addEventListener("mouseenter", () => clearInterval(timer));
    carousel.addEventListener("mouseleave", startTimer);

    // Controles manuales
    btnNext?.addEventListener("click", next);
    btnPrev?.addEventListener("click", prev);

    // Teclado
    carousel.setAttribute("tabindex", "0");
    carousel.addEventListener("keydown", e => {
        if (e.key === "ArrowRight") next();
        if (e.key === "ArrowLeft")  prev();
    });

    // Touch events
    let touchStartX = 0;
    carousel.addEventListener("touchstart", e => { touchStartX = e.touches[0].clientX; }, { passive: true });
    carousel.addEventListener("touchend",   e => {
        const diff = touchStartX - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 50) diff > 0 ? next() : prev();
    }, { passive: true });

    goTo(0);
    startTimer();
}

// ══════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
    initScrollObserver();
    initParallax();
    initMagneticButtons();
    initCarousel();
});

function highlightNew(selector) {
    document.querySelectorAll(selector).forEach((el, i) => {
        el.classList.remove("visible");
        setTimeout(() => el.classList.add("visible"), i * 80);
    });
}

// Export para uso como módulo ES (app.js lo importa)
export { initScrollObserver, initParallax, initMagneticButtons, toggleVisibility, highlightNew };

// Compatibilidad con scripts no-módulo (index.html sin type=module)
const Animations = { initScrollObserver, toggleVisibility, highlightNew };