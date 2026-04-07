// dom.js — Thermomania AG
// Responsabilidad única: manipulación del DOM y renderizado de vistas

// ── Renderizado de catálogo ────────────────────────────────
export const Dom = {

    // Selector de referencia al grid del catálogo
    get grid() { return document.querySelector(".grid"); },

    showLoader() {
        this.grid.innerHTML = `
            <div class="catalogo-loader">
                <div class="loader-spinner"></div>
                <p>Cargando productos...</p>
            </div>`;
    },

    showError(msg) {
        this.grid.innerHTML = `
            <div class="catalogo-error">
                <span>&#9888;</span>
                <p>${msg}</p>
                <button onclick="App.cargarProductos()" class="btn-filtrar">Reintentar</button>
            </div>`;
    },

    renderProductos(productos) {
        const sinResultados = document.getElementById("sin-resultados");
        if (sinResultados) sinResultados.style.display = productos.length ? "none" : "block";

        if (!productos.length) { this.grid.innerHTML = ""; return; }

        this.grid.innerHTML = productos.map((p, i) => `
            <article class="producto observe-me"
                data-categoria="${p.categoria}"
                data-precio="${p.precio}"
                data-stock="${p.stock ? 1 : 0}"
                data-index="${i}">
                <img src="${p.imagen}" alt="${p.nombre}" loading="lazy" onerror="this.src='img/termo1.jpg'">
                <div class="producto-info">
                    <h3>${p.nombre}</h3>
                    <p class="precio">$${p.precio} MXN</p>
                    ${!p.stock ? '<span class="badge-agotado">Agotado</span>' : ""}
                    <p class="descripcion">${p.descripcion}</p>
                    <ul class="caracteristicas">
                        ${(p.caracteristicas || []).map(c => `<li>&#10003; ${c}</li>`).join("")}
                    </ul>
                    <button class="btn-personalizar" data-log="btn-personalizar" data-producto-id="${p.id}">
                        ${p.categoria === "personalizados" ? "Diseñar ahora" : "Personalizar"}
                    </button>
                </div>
            </article>`).join("");
    },

    // ── Gestor (tabla) ─────────────────────────────────────
    renderTabla(productos) {
        const lista = document.querySelector("#lista-productos");
        if (!lista) return;
        lista.innerHTML = productos.map(p => `
            <tr>
                <td>${p.nombre}</td>
                <td>$${p.precio}</td>
                <td>${p.categoria}</td>
                <td>
                    <button class="btn-editar"   data-id="${p.id}">Editar</button>
                    <button class="btn-eliminar" data-id="${p.id}">Eliminar</button>
                </td>
            </tr>`).join("");
    },

    // ── Mensajes ───────────────────────────────────────────
    mostrarMensaje(texto, tipo = "info") {
        const el = document.querySelector("#mensaje");
        if (!el) return;
        el.textContent = texto;
        el.className   = tipo === "exito" ? "mensaje-exito" : "mensaje-error";
        setTimeout(() => { el.textContent = ""; el.className = ""; }, 2500);
    },

    mostrarNotificacion(texto, tipo = "info") {
        const div = document.createElement("div");
        div.className   = `notificacion notificacion-${tipo}`;
        div.textContent = texto;
        document.body.appendChild(div);
        // Animar entrada
        requestAnimationFrame(() => div.classList.add("visible"));
        setTimeout(() => {
            div.classList.remove("visible");
            setTimeout(() => div.remove(), 400);
        }, 3000);
    },

    // ── Show / hide suave (sin display:none) ───────────────
    toggle(el, show) {
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
    },

    // ── URL helpers ────────────────────────────────────────
    getParams()       { return new URLSearchParams(window.location.search); },
    setParams(params) { history.replaceState({}, "", `${location.pathname}?${params}`); },
};