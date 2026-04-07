// productos_routes.js — Thermomania AG

export function setupProductosRoutes(app, db) {
    
    // Obtener los productos destacados para el inicio (máximo 6)
    app.get('/api/productos/destacados', async (req, res) => {
        try {
            const [rows] = await db.query("SELECT id, nombre, precio, imagen_url, categoria FROM productos WHERE activo = 1 LIMIT 6");
            res.json(rows);
        } catch (err) {
            console.error("Error al obtener productos destacados:", err);
            res.status(500).json({ error: "Error interno al cargar el catálogo" });
        }
    });

}