const API_BASE = (window.API_BASE || "https://thermomania-project-production.up.railway.app");

export const Data = {
    async obtenerProductos() {
        const res = await fetch(`${API_BASE}/api/productos`);
        if (!res.ok) throw new Error(`Error ${res.status}`);
        return res.json();
    },
    async agregar(producto) {
        const res = await fetch(`${API_BASE}/api/productos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(producto),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
        return data;
    },
    async actualizar(producto) {
        const res = await fetch(`${API_BASE}/api/productos/${producto.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(producto),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
        return data;
    },
    async eliminar(id) {
        const res = await fetch(`${API_BASE}/api/productos/${id}`, { method: "DELETE" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
        return data;
    },
};