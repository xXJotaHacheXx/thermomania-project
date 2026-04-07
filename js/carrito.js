// js/carrito.js — Thermomania AG

document.addEventListener("DOMContentLoaded", () => {
    // Leemos la memoria
    let carrito = JSON.parse(localStorage.getItem("carrito_thermomania")) || [];

    // 2. Enlazar con el HTML
    const contenedorItems = document.getElementById("contenedor-items");
    const carritoContenido = document.querySelector(".carrito-contenido");
    const carritoVacio = document.querySelector(".carrito-vacio");
    const resumenSubtotal = document.getElementById("resumen-subtotal");
    const resumenTotal = document.getElementById("resumen-total");
    const btnFinalizar = document.getElementById("btn-checkout");

    if (!contenedorItems) return; 

    // 3. Dibujar el carrito
    function renderCarrito() {
        if (carrito.length === 0) {
            carritoContenido.style.display = "none";
            carritoVacio.style.display = "block";
            return;
        } else {
            carritoContenido.style.display = "flex";
            carritoVacio.style.display = "none";
        }

        contenedorItems.innerHTML = ""; 
        let total = 0;

        carrito.forEach((prod, index) => {
            total += prod.precio * prod.cantidad;

            const article = document.createElement("article");
            article.className = "item";
            
            // Si el cliente escribió un texto, lo mostramos debajo del nombre
            const textoPersonalizacion = prod.texto_personalizado 
                ? `Grabado: "${prod.texto_personalizado}"` 
                : (prod.categoria === "personalizados" ? "Diseño personalizado" : "Modelo original");

            article.innerHTML = `
                <img src="${prod.imagen_url || 'img/termo1.jpg'}" alt="${prod.nombre}">
                <div class="item-info">
                    <h3>${prod.nombre}</h3>
                    <p class="personalizacion" style="color: #e67e22; font-style: italic;">${textoPersonalizacion}</p>
                </div>
                <div class="item-cantidad">
                    <button class="btn-menos" data-index="${index}" aria-label="Disminuir cantidad" style="cursor:pointer;">-</button>
                    <input type="number" value="${prod.cantidad}" min="1" readonly aria-label="Cantidad" style="text-align:center; width:40px; border:1px solid #ddd; border-radius:4px; margin: 0 5px;">
                    <button class="btn-mas" data-index="${index}" aria-label="Aumentar cantidad" style="cursor:pointer;">+</button>
                </div>
                <span class="item-precio">$${(prod.precio * prod.cantidad).toFixed(2)} MXN</span>
                <button class="btn-eliminar" data-index="${index}" aria-label="Eliminar producto" style="background:none; border:none; cursor:pointer; font-size:1.2rem;">🗑️</button>
            `;
            contenedorItems.appendChild(article);
        });

        resumenSubtotal.textContent = `$${total.toFixed(2)} MXN`;
        resumenTotal.textContent = `$${total.toFixed(2)} MXN`;
    }

    // 4. Botones (+, -, 🗑️)
    contenedorItems.addEventListener("click", (e) => {
        const btn = e.target;
        const index = btn.getAttribute("data-index");
        
        if (index === null) return; 

        if (btn.classList.contains("btn-mas")) {
            carrito[index].cantidad++;
        } else if (btn.classList.contains("btn-menos")) {
            if (carrito[index].cantidad > 1) carrito[index].cantidad--;
        } else if (btn.classList.contains("btn-eliminar")) {
            carrito.splice(index, 1); 
        }

        localStorage.setItem("carrito_thermomania", JSON.stringify(carrito));
        renderCarrito();
    });

    // 5. Conexión con Stripe (AQUÍ ESTÁ LA MAGIA LIMPIADORA)
    if (btnFinalizar) {
        btnFinalizar.addEventListener("click", async () => {
            if (carrito.length === 0) return alert("Tu carrito está vacío.");

            const token = localStorage.getItem("access_token");
            if (!token) {
                alert("⚠️ Por favor, inicia sesión para poder finalizar tu compra.");
                window.location.href = "cuenta.html";
                return;
            }

            const textoOriginal = btnFinalizar.textContent;
            btnFinalizar.textContent = "Conectando con Stripe...";
            btnFinalizar.disabled = true;

            try {
                // 🛑 EL FILTRO: Preparamos los datos limpios para que Stripe no se asuste 🛑
                const itemsParaStripe = carrito.map(item => {
                    let nombreFinal = item.nombre;
                    // Si trae texto personalizado, se lo pegamos al nombre para el ticket
                    if (item.texto_personalizado) {
                        nombreFinal += ` (Grabado: ${item.texto_personalizado})`;
                    }
                    return {
                        id: item.id_producto_real || item.id, // Aseguramos que lleve un ID
                        nombre: nombreFinal,
                        precio: item.precio,
                        cantidad: item.cantidad
                        // NO enviamos la imagen_url para que Stripe no rechace el Base64
                    };
                });

                const res = await fetch("http://localhost:3000/api/checkout", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    // Enviamos nuestra lista limpia
                    body: JSON.stringify({ items: itemsParaStripe }) 
                });

                const data = await res.json();

                if (res.ok && data.url) {
                    window.location.href = data.url; 
                } else {
                    throw new Error(data.error || "Error al generar el link de pago");
                }

            } catch (error) {
                console.error("🔴 Error en checkout:", error);
                alert("Hubo un problema al procesar tu pedido: " + error.message);
                btnFinalizar.textContent = textoOriginal;
                btnFinalizar.disabled = false;
            }
        });
    }

    renderCarrito();
});