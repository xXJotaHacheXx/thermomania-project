// js/index.js — Thermomania AG

document.addEventListener("DOMContentLoaded", async () => {
    const gridDestacados = document.getElementById("grid-destacados");
    if (!gridDestacados) return;

    try {
        // 1. Pedimos los datos a la base de datos a través del backend
        const res = await fetch(`${window.API_BASE || "https://thermomania-project-production.up.railway.app"}/api/productos/destacados`);
        const productos = await res.json();

        // 2. Limpiamos el mensaje de "Cargando..."
        gridDestacados.innerHTML = "";

        if (productos.length === 0) {
            gridDestacados.innerHTML = "<p>Próximamente nuevos termos increíbles.</p>";
            return;
        }

        // 3. Construimos el HTML por cada producto que llegó
        productos.forEach(prod => {
            const card = document.createElement("div");
            // Un poco de CSS rápido para que se vean como tarjetas hermosas
            card.style.cssText = "background: white; border-radius: 12px; padding: 1rem; box-shadow: 0 4px 15px rgba(0,0,0,0.05); transition: transform 0.3s ease; cursor: pointer;";
            card.onmouseover = () => card.style.transform = "translateY(-5px)";
            card.onmouseout = () => card.style.transform = "translateY(0)";
            
            card.innerHTML = `
                <div style="height: 250px; overflow: hidden; border-radius: 8px; margin-bottom: 1rem;">
                    <img src="${prod.imagen_url}" alt="${prod.nombre}" style="width: 100%; height: 100%; object-fit: cover;">
                </div>
                <h3 style="font-size: 1.1rem; color: #34495e; margin-bottom: 0.5rem;">${prod.nombre}</h3>
                <p style="color: #3498db; font-weight: bold; font-size: 1.2rem; margin-bottom: 1rem;">$${prod.precio} MXN</p>
                <button onclick="window.location.href='catalogo.html?id=${prod.id}'" class="btn btn-primary btn-magnetic" style="padding: 0.5rem; width: 100%;">Ver Detalles</button>
            `;
            gridDestacados.appendChild(card);
        });

    } catch (error) {
        console.error("Error al cargar productos:", error);
        gridDestacados.innerHTML = "<p style='color: crimson;'>Ocurrió un error al cargar el catálogo.</p>";
    }
});