// carousel.js — Thermomania AG
// Responsabilidad única: carrusel sin librerías
// Autoplay · controles · indicadores · loop · touch

export function initCarousel(selector = ".carousel") {
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

    // ── Indicadores dinámicos ──────────────────────────────
    slides.forEach((_, i) => {
        const dot = document.createElement("button");
        dot.className = "carousel-dot";
        dot.setAttribute("aria-label", `Slide ${i + 1}`);
        dot.setAttribute("role", "tab");
        dot.addEventListener("click", () => goTo(i));
        dotsWrap.appendChild(dot);
    });
    const dots = Array.from(dotsWrap.children);

    // ── Ir a slide (loop infinito simulado con módulo) ─────
    function goTo(index) {
        if (isMoving) return;
        isMoving = true;

        current = (index + slides.length) % slides.length;

        // Transición con transform + translateX
        track.style.transition = `transform ${DURATION}ms cubic-bezier(0.4,0,0.2,1)`;
        track.style.transform  = `translateX(-${current * 100}%)`;

        slides.forEach((s, i) => s.classList.toggle("active", i === current));
        dots.forEach((d, i)   => d.classList.toggle("active", i === current));

        setTimeout(() => { isMoving = false; }, DURATION);
        resetTimer();
    }

    const next = () => goTo(current + 1);
    const prev = () => goTo(current - 1);

    // ── Autoplay ───────────────────────────────────────────
    const startTimer = () => { timer = setInterval(next, DELAY); };
    const resetTimer  = () => { clearInterval(timer); startTimer(); };

    // Pausar al hover (UX: permite leer el slide)
    carousel.addEventListener("mouseenter", () => clearInterval(timer));
    carousel.addEventListener("mouseleave", startTimer);

    // ── Controles manuales ─────────────────────────────────
    btnNext?.addEventListener("click", next);
    btnPrev?.addEventListener("click", prev);

    // ── Teclado ────────────────────────────────────────────
    carousel.setAttribute("tabindex", "0");
    carousel.addEventListener("keydown", e => {
        if (e.key === "ArrowRight") next();
        if (e.key === "ArrowLeft")  prev();
    });

    // ── Touch events ───────────────────────────────────────
    let touchStartX = 0;
    carousel.addEventListener("touchstart", e => {
        touchStartX = e.touches[0].clientX;
    }, { passive: true });
    carousel.addEventListener("touchend", e => {
        const diff = touchStartX - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 50) diff > 0 ? next() : prev();
    }, { passive: true });

    // ── Init ───────────────────────────────────────────────
    goTo(0);
    startTimer();

    // Exponer control externo (para polling/Parte 6)
    return { goTo, next, prev, current: () => current };
}