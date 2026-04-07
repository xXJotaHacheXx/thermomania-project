// js/producto.js — Thermomania AG

document.addEventListener("DOMContentLoaded", async () => {
    // 1. Obtener el ID del producto desde la URL (ej. producto.html?id=2)
    const params = new URLSearchParams(window.location.search);
    const idProducto = params.get("id");

    if (!idProducto) {
        alert("No se seleccionó ningún producto.");
        window.location.href = "catalogo.html";
        return;
    }

    // Elementos del HTML
    const divCargando = document.getElementById("cargando");
    const divContenido = document.getElementById("contenido-producto");
    
    const prodImg = document.getElementById("prod-img");
    const prodNombre = document.getElementById("prod-nombre");
    const prodPrecio = document.getElementById("prod-precio");
    const prodDesc = document.getElementById("prod-desc");
    
    const inputTexto = document.getElementById("custom-texto");
    const inputImg = document.getElementById("custom-img");
    const previewImg = document.getElementById("preview-imagen");
    const btnAddCarrito = document.getElementById("btn-add-carrito");

    let productoData = null; // Aquí guardaremos lo que responda la BD
    let imagenPersonalizadaBase64 = null; // Para guardar la foto del cliente

    // 2. Traer la información del backend
    try {
        const res = await fetch(`http://localhost:3000/api/productos/${idProducto}`);
        if (!res.ok) throw new Error("Producto no encontrado");
        
        productoData = await res.json();

        // Llenar el HTML con los datos
        prodNombre.textContent = productoData.nombre;
        prodPrecio.textContent = `$${productoData.precio} MXN`;
        prodDesc.textContent = productoData.descripcion || "Un termo excelente para mantener tus bebidas a la temperatura ideal durante horas.";
        prodImg.src = productoData.imagen_url || productoData.imagen || 'img/termo1.jpg';

        // Mostrar la pantalla
        divCargando.style.display = "none";
        divContenido.style.display = "grid";

    } catch (error) {
        console.error("Error:", error);
        divCargando.innerHTML = "❌ Hubo un error al cargar el producto. <br><br> <a href='catalogo.html'>Volver al catálogo</a>";
    }

    // 3. Sistema para previsualizar la imagen que sube el cliente
    inputImg.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(evento) {
                // Guardamos la imagen en memoria como un texto largo (Base64)
                imagenPersonalizadaBase64 = evento.target.result; 
                // La mostramos en la vista previa
                previewImg.src = imagenPersonalizadaBase64;
                previewImg.style.display = "block";
            };
            reader.readAsDataURL(file);
        } else {
            imagenPersonalizadaBase64 = null;
            previewImg.style.display = "none";
        }
    });

    // 4. Botón "Agregar al carrito"
    btnAddCarrito.addEventListener("click", () => {
        if (!productoData) return;

        // Leemos el carrito actual de la memoria (o creamos uno vacío)
        let carrito = JSON.parse(localStorage.getItem("carrito_thermomania")) || [];

        // Armamos el "Paquete" que va al carrito
        // Usamos Date.now() como ID único en el carrito para que no se junten termos con diseños diferentes
        const nuevoItem = {
            id_carrito: Date.now(), 
            id_producto_real: productoData.id,
            nombre: productoData.nombre,
            precio: productoData.precio,
            cantidad: 1,
            // Si el cliente subió foto, la ponemos en el carrito, si no, usamos la del producto
            imagen_url: imagenPersonalizadaBase64 || productoData.imagen_url || productoData.imagen || 'img/termo1.jpg',
            categoria: productoData.categoria,
            texto_personalizado: inputTexto.value.trim()
        };

        // Lo metemos al carrito y guardamos en memoria
        carrito.push(nuevoItem);
        localStorage.setItem("carrito_thermomania", JSON.stringify(carrito));

        // Efecto visual de éxito
        const textoOriginal = btnAddCarrito.textContent;
        btnAddCarrito.textContent = "¡Agregado! ✔️";
        btnAddCarrito.style.background = "#2c3e50";
        
        // Redirigimos al carrito después de 1 segundo
        setTimeout(() => {
            window.location.href = "carrito.html";
        }, 1000);
    });
});