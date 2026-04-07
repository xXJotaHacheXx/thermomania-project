// js/catalogo.js — Thermomania AG

document.addEventListener("DOMContentLoaded", () => {
    // 1. Enganchamos todos tus elementos del HTML
    const gridProductos = document.querySelector(".grid");
    const msgSinResultados = document.getElementById("sin-resultados");
    const formAvanzada = document.getElementById("form-avanzada");
    const btnLimpiar = document.getElementById("btn-limpiar");
    const botonesFiltro = document.querySelectorAll(".filtro-btn");
    const inputBuscar = document.getElementById("buscar-texto");

    if (!gridProductos) return;

    // 2. Función principal que va al backend por los termos
    async function cargarCatalogo(queryString = "") {
        gridProductos.innerHTML = "<p style='text-align:center; width:100%; grid-column: 1 / -1; color: #7f8c8d;'>Buscando termos...</p>";
        msgSinResultados.style.display = "none";

        try {
            const res = await fetch(`http://localhost:3000/api/productos${queryString}`);
            const productos = await res.json();

            gridProductos.innerHTML = ""; // Limpiamos

            // Si no hay productos, mostramos tu mensaje
            if (productos.length === 0) {
                msgSinResultados.style.display = "block";
                return;
            }

            // Si hay productos, creamos sus tarjetas
            productos.forEach(prod => {
                const card = document.createElement("div");
                card.style.cssText = "background: white; border-radius: 12px; padding: 1rem; box-shadow: 0 4px 15px rgba(0,0,0,0.05); transition: transform 0.3s ease; cursor: pointer; display: flex; flex-direction: column;";
                card.onmouseover = () => card.style.transform = "translateY(-5px)";
                card.onmouseout = () => card.style.transform = "translateY(0)";

                const imgUrl = prod.imagen_url || prod.imagen || 'img/termo1.jpg';

                card.innerHTML = `
                    <div style="height: 250px; overflow: hidden; border-radius: 8px; margin-bottom: 1rem;">
                        <img src="${imgUrl}" alt="${prod.nombre}" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>
                    <h3 style="font-size: 1.1rem; color: #34495e; margin-bottom: 0.5rem; flex-grow: 1;">${prod.nombre}</h3>
                    <p style="color: #3498db; font-weight: bold; font-size: 1.2rem; margin-bottom: 1rem;">$${prod.precio} MXN</p>
                    <button onclick="window.location.href='producto.html?id=${prod.id}'" class="btn-submit" style="padding: 0.5rem; width: 100%; margin-top: auto; background-color: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer;">Ver Detalles</button>
                `;
                gridProductos.appendChild(card);
            });

        } catch (error) {
            console.error("Error:", error);
            gridProductos.innerHTML = "<p style='color: crimson; text-align:center; grid-column: 1 / -1;'>Error al conectar con el servidor.</p>";
        }
    }

    // ─── 3. ACTIVAR LOS CONTROLES (Versión actualizada) ────────────

    // A) Formulario de Búsqueda Avanzada
    if (formAvanzada) {
        formAvanzada.addEventListener("submit", (e) => {
            e.preventDefault(); // Evita recargar la página

            const categoria = document.getElementById("categoria").value;
            const min = document.getElementById("min").value;
            const max = document.getElementById("max").value;

            const params = new URLSearchParams();
            if (categoria && categoria !== "todas") params.append("categoria", categoria);
            if (min) params.append("min", min);
            if (max) params.append("max", max);

            cargarCatalogo(`?${params.toString()}`);
        });
    }

    // B) Botón Limpiar Filtros
    if (btnLimpiar) {
        btnLimpiar.addEventListener("click", () => {
            formAvanzada.reset();
            if (inputBuscar) inputBuscar.value = "";
            cargarCatalogo(); // Carga todo de nuevo sin filtros
        });
    }

    // C) Botones rápidos ("Todos", "Stanley", "Yeti")
    botonesFiltro.forEach(btn => {
        btn.addEventListener("click", (e) => {
            // Efecto visual: quitar la clase 'active' a todos y ponérsela al que le dimos clic
            botonesFiltro.forEach(b => b.classList.remove("active"));
            e.target.classList.add("active");

            const cat = e.target.getAttribute("data-categoria");
            const params = new URLSearchParams();
            if (cat && cat !== "todos") {
                params.append("categoria", cat);
            }
            cargarCatalogo(`?${params.toString()}`);
        });
    });

    // D) Buscador de texto en tiempo real
    if (inputBuscar) {
        let timeout = null;
        inputBuscar.addEventListener("input", (e) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                const val = e.target.value.trim();
                const params = new URLSearchParams();
                if (val) params.append("q", val);
                cargarCatalogo(`?${params.toString()}`);
            }, 500); 
        });
    }

    // 4. Cargar el catálogo al iniciar la página
    cargarCatalogo();
});