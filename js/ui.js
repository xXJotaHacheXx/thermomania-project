export const UI = {

    renderizar(productos) {
        const lista = document.querySelector("#lista-productos");
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

    mostrarMensaje(texto, tipo) {
        const el = document.querySelector("#mensaje");
        el.textContent = texto;
        el.className   = tipo === "exito" ? "mensaje-exito" : "mensaje-error";
        setTimeout(() => { el.textContent = ""; el.className = ""; }, 2500);
    },

    mostrarNotificacion(texto) {
        const div = Object.assign(document.createElement("div"), { className: "notificacion", textContent: texto });
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 2500);
    },
};