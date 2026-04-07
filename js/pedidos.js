// Función para cargar los pedidos
async function cargarHistorialPedidos() {
    const contenedor = document.getElementById("contenedor-pedidos");
    const token = localStorage.getItem("access_token");

    if (!token || !contenedor) return;

    try {
        const res = await fetch(`${window.API_BASE || "https://thermomania-project-production.up.railway.app"}/api/mis-pedidos`, {
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (!res.ok) throw new Error("Error al cargar pedidos");
        
        const pedidos = await res.json();
        
        // Revisar qué datos llegaron del servidor
        console.log("Datos que llegaron del servidor:", pedidos);

        // Si no hay pedidos
        if (pedidos.length === 0) {
            contenedor.innerHTML = `
                <div style="text-align:center; padding: 2rem; background: var(--bg-hover); border-radius: 8px;">
                    <p style="font-size: 1.2rem; color: var(--texto-secundario);">Aún no has realizado ninguna compra.</p>
                    <a href="catalogo.html" class="btn btn-primary" style="margin-top: 1rem; display: inline-block;">Ir al catálogo</a>
                </div>
            `;
            return;
        }

        // Si hay pedidos, dibujamos una tabla
        let html = `
            <table style="width: 100%; border-collapse: collapse; text-align: left;">
                <thead>
                    <tr style="border-bottom: 2px solid var(--borde-color);">
                        <th style="padding: 10px;">Pedido #</th>
                        <th style="padding: 10px;">Fecha</th>
                        <th style="padding: 10px;">Total</th>
                        <th style="padding: 10px;">Estado</th>
                    </tr>
                </thead>
                <tbody>
        `;

        pedidos.forEach(p => {
            // Dar formato a la fecha (si tu BD la regresa)
            const fecha = p.created_at ? new Date(p.created_at).toLocaleDateString() : 'Reciente';
            
            // Colores para el estado
            let colorEstado = '#95a5a6'; // Gris por defecto
            if (p.estado_pago === 'pagado' || p.estado_pago === 'completado') colorEstado = '#27ae60'; // Verde
            if (p.estado_pago === 'pendiente') colorEstado = '#f39c12'; // Naranja

            html += `
                <tr style="border-bottom: 1px solid var(--borde-color);">
                    <td style="padding: 15px 10px; font-weight: bold;">#${p.id}</td>
                    <td style="padding: 15px 10px;">${fecha}</td>
                    <td style="padding: 15px 10px;">$${Number(p.total).toFixed(2)} MXN</td>
                    <td style="padding: 15px 10px;">
                        <span style="background-color: ${colorEstado}; color: white; padding: 4px 8px; border-radius: 12px; font-size: 0.85rem; text-transform: capitalize;">
                            ${p.estado_pago}
                        </span>
                    </td>
                </tr>
            `;
        });

        html += `</tbody></table>`;
        contenedor.innerHTML = html;

    } catch (error) {
        contenedor.innerHTML = `<p style="color: #e74c3c;">Hubo un problema al cargar tu historial. Intenta más tarde.</p>`;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    cargarHistorialPedidos();
});