document.addEventListener("DOMContentLoaded", () => {

    // ── Botón hamburguesa ──────────────────────────────────
    const header = document.querySelector("header");
    const nav    = document.querySelector("nav");

    if (header && nav && !document.querySelector(".menu-toggle")) {
        const btn = Object.assign(document.createElement("button"), {
            className: "menu-toggle",
            innerHTML: "☰",
        });
        btn.setAttribute("aria-label", "Abrir menú de navegación");
        btn.setAttribute("aria-expanded", "false");
        header.insertBefore(btn, nav);

        btn.addEventListener("click", () => {
            const open = nav.classList.toggle("active");
            btn.setAttribute("aria-expanded", open);
            btn.innerHTML = open ? "✕" : "☰";
            if (open) nav.querySelector("a")?.focus();
        });
    }

    // ── Cerrar con ESC ─────────────────────────────────────
    document.addEventListener("keydown", e => {
        if (e.key !== "Escape") return;
        const btn = document.querySelector(".menu-toggle");
        if (nav?.classList.contains("active")) {
            nav.classList.remove("active");
            btn?.setAttribute("aria-expanded", "false");
            btn && (btn.innerHTML = "☰");
            btn?.focus();
        }
    });

    // ── Cerrar al hacer clic en enlace (móvil) ─────────────
    nav?.querySelectorAll("a").forEach(a => a.addEventListener("click", () => {
        if (window.innerWidth > 768) return;
        const btn = document.querySelector(".menu-toggle");
        nav.classList.remove("active");
        btn?.setAttribute("aria-expanded", "false");
        btn && (btn.innerHTML = "☰");
    }));

    // ── Página activa ──────────────────────────────────────
    const currentPage = location.pathname.split("/").pop() || "index.html";
    nav?.querySelectorAll("a").forEach(a => {
        if (a.getAttribute("href") === currentPage) {
            a.classList.add("active");
            a.setAttribute("aria-current", "page");
        }
    });

    // ── Submenú de catálogo ────────────────────────────────
    const catalogoLink = nav?.querySelector('a[href="catalogo.html"]');
    if (catalogoLink && !catalogoLink.parentElement.classList.contains("menu-item")) {
        const item = document.createElement("div");
        item.className = "menu-item";
        catalogoLink.parentNode.insertBefore(item, catalogoLink);
        item.appendChild(catalogoLink);
        const sub = document.createElement("div");
        sub.className = "submenu";
        sub.innerHTML = `
            <a href="catalogo.html?categoria=stanley">Stanley</a>
            <a href="catalogo.html?categoria=yeti">Yeti</a>
            <a href="catalogo.html?categoria=personalizados">Personalizados</a>`;
        item.appendChild(sub);
    }

    // ── Breadcrumbs ────────────────────────────────────────
    const breadcrumbsOl = document.querySelector(".breadcrumbs ol");
    if (breadcrumbsOl) {
        const pageMap = {
            "index.html":    { title: "Inicio",     parent: null },
            "catalogo.html": { title: "Catálogo",   parent: "index.html" },
            "carrito.html":  { title: "Carrito",    parent: "catalogo.html" },
            "cuenta.html":   { title: "Mi Cuenta",  parent: "index.html" },
            "contacto.html": { title: "Contacto",   parent: "index.html" },
        };
        const crumbs = [];
        let page = currentPage;
        while (page && pageMap[page]) { crumbs.unshift({ page, title: pageMap[page].title }); page = pageMap[page].parent; }
        breadcrumbsOl.innerHTML = crumbs.map((c, i) =>
            i < crumbs.length - 1
                ? `<li><a href="${c.page}">${c.title}</a><span class="separator" aria-hidden="true">›</span></li>`
                : `<li><span class="current" aria-current="page">${c.title}</span></li>`
        ).join("");
    }

    // ════════════════════════════════════════════════════════
    // ── MODO OSCURO (Dark Mode) ─────────────────────────────
    // ════════════════════════════════════════════════════════
    const themeToggleBtn = document.getElementById("theme-toggle");
    const body = document.body;

    if (themeToggleBtn) {
        // 1. Cargar preferencia guardada
        const modoOscuroGuardado = localStorage.getItem("thermomania_theme");
        if (modoOscuroGuardado === "dark") {
            body.classList.add("dark-mode");
            themeToggleBtn.textContent = "☀️";
        } else {
            themeToggleBtn.textContent = "🌙";
        }

        // 2. Escuchar el clic
        themeToggleBtn.addEventListener("click", () => {
            body.classList.toggle("dark-mode");
            
            if (body.classList.contains("dark-mode")) {
                localStorage.setItem("thermomania_theme", "dark");
                themeToggleBtn.textContent = "☀️"; 
            } else {
                localStorage.setItem("thermomania_theme", "light");
                themeToggleBtn.textContent = "🌙"; 
            }
        });
    }
});