import { Data } from "./data.js";
import { UI }   from "./ui.js";

document.addEventListener("DOMContentLoaded", () => {

    const form            = document.querySelector("#form-producto");
    const buscarInput     = document.querySelector("#buscar");
    const filtroCategoria = document.querySelector("#filtro-categoria");
    const ordenarSelect   = document.querySelector("#ordenar");
    const lista           = document.querySelector("#lista-productos");

    // ── Cargar y renderizar ────────────────────────────────
    async function cargarProductos() {
        let productos;
        try {
            productos = await Data.obtenerProductos();
        } catch (err) {
            UI.mostrarMensaje("Error al cargar productos: " + err.message, "error");
            return;
        }

        const busqueda  = buscarInput.value.toLowerCase();
        const categoria = filtroCategoria.value;
        const orden     = ordenarSelect.value;

        if (busqueda)              productos = productos.filter(p => p.nombre.toLowerCase().includes(busqueda));
        if (categoria !== "todos") productos = productos.filter(p => p.categoria === categoria);
        productos.sort((a, b) => orden === "asc" ? a.precio - b.precio : b.precio - a.precio);

        UI.renderizar(productos);
    }

    // ── Crear / actualizar ─────────────────────────────────
    form.addEventListener("submit", async e => {
        e.preventDefault();
        const id       = document.querySelector("#producto-id").value;
        const nombre   = document.querySelector("#nombre").value.trim();
        const precio   = parseFloat(document.querySelector("#precio").value);
        const categoria = document.querySelector("#categoria").value;

        if (!nombre || isNaN(precio) || precio <= 0) {
            UI.mostrarMensaje("Datos inválidos", "error");
            return;
        }

        try {
            if (id) {
                await Data.actualizar({ id, nombre, precio, categoria });
                UI.mostrarMensaje("Producto actualizado", "exito");
            } else {
                await Data.agregar({ nombre, precio, categoria });
                UI.mostrarMensaje("Producto agregado", "exito");
            }
        } catch (err) {
            UI.mostrarMensaje("Error: " + err.message, "error");
            return;
        }

        form.reset();
        document.querySelector("#producto-id").value = "";
        cargarProductos();
    });

    // ── Editar / eliminar ──────────────────────────────────
    lista.addEventListener("click", async e => {
        const id = e.target.dataset.id;

        if (e.target.classList.contains("btn-eliminar")) {
            if (!confirm("¿Eliminar este producto?")) return;
            try {
                await Data.eliminar(id);
                UI.mostrarMensaje("Producto eliminado", "exito");
                cargarProductos();
            } catch (err) {
                UI.mostrarMensaje("Error: " + err.message, "error");
            }
        }

        if (e.target.classList.contains("btn-editar")) {
            try {
                const productos = await Data.obtenerProductos();
                const p = productos.find(p => String(p.id) === String(id));
                if (!p) return;
                document.querySelector("#producto-id").value = p.id;
                document.querySelector("#nombre").value      = p.nombre;
                document.querySelector("#precio").value      = p.precio;
                document.querySelector("#categoria").value   = p.categoria;
            } catch (err) {
                UI.mostrarMensaje("Error al cargar producto: " + err.message, "error");
            }
        }
    });

    // ── Exportar JSON ──────────────────────────────────────
    document.querySelector("#exportar")?.addEventListener("click", async () => {
        try {
            const productos = await Data.obtenerProductos();
            const a = Object.assign(document.createElement("a"), {
                href: URL.createObjectURL(new Blob([JSON.stringify(productos, null, 2)], { type: "application/json" })),
                download: "productos.json",
            });
            a.click();
            URL.revokeObjectURL(a.href);
        } catch (err) {
            UI.mostrarMensaje("Error al exportar: " + err.message, "error");
        }
    });

    // ── Modo oscuro ────────────────────────────────────────
    document.querySelector("#modo-oscuro")?.addEventListener("click", () => {
        document.body.classList.toggle("dark-mode");
    });

    // ── Filtros ────────────────────────────────────────────
    buscarInput.addEventListener("input", cargarProductos);
    filtroCategoria.addEventListener("change", cargarProductos);
    ordenarSelect.addEventListener("change", cargarProductos);

    cargarProductos();
});