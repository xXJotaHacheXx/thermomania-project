document.addEventListener("DOMContentLoaded", () => {
    // --- 0. SEGURIDAD: VERIFICAR SESIÓN ---
    const token = localStorage.getItem("access_token");
    if (!token) {
        alert("🔒 Acceso denegado. Debes iniciar sesión como Administrador.");
        window.location.href = "cuenta.html";
        return;
    }

    // --- 1. MODO OSCURO SINCRONIZADO ---
    const themeToggle = document.getElementById('theme-toggle');
    
    function aplicarTema() {
        const esOscuro = localStorage.getItem('dark-mode') === 'true';
        document.body.classList.toggle('dark-mode', esOscuro);
        if (themeToggle) {
            themeToggle.textContent = esOscuro ? '☀️' : '🌙';
        }
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const ahoraEsOscuro = document.body.classList.toggle('dark-mode');
            localStorage.setItem('dark-mode', ahoraEsOscuro);
            themeToggle.textContent = ahoraEsOscuro ? '☀️' : '🌙';
        });
    }

    // Escuchar si el tema cambia en otra pestaña (Inicio, Catálogo, etc.)
    window.addEventListener('storage', (e) => {
        if (e.key === 'dark-mode') aplicarTema();
    });
    aplicarTema(); // Carga inicial del tema


    // --- 2. LÓGICA DE PESTAÑAS (Tabs) ---
    document.querySelectorAll('.gestor-menu .tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            // Quitar clase active de todos los botones
            document.querySelectorAll('.gestor-menu .tab-btn').forEach(b => b.classList.remove('active'));
            // Ocultar todos los contenidos
            document.querySelectorAll('.gestor-content .tab-content').forEach(c => c.style.display = 'none');
            
            // Activar el actual
            this.classList.add('active');
            const targetId = this.getAttribute('data-tab');
            document.getElementById(targetId).style.display = 'block';

            // Cargar datos según la pestaña activa
            if(targetId === 'tab-productos') cargarProductosAdmin();
            if(targetId === 'tab-pedidos') cargarPedidosAdmin();
            if(targetId === 'tab-usuarios') cargarUsuariosAdmin();
        });
    });


    // --- 3. FORMULARIO: CATEGORÍA NUEVA ---
    const selectCat = document.getElementById("prod-categoria");
    const inputNuevaCat = document.getElementById("prod-categoria-nueva");
    
    if (selectCat && inputNuevaCat) {
        selectCat.addEventListener("change", function() {
            if (this.value === "nueva") {
                inputNuevaCat.style.display = "block";
                inputNuevaCat.required = true;
            } else {
                inputNuevaCat.style.display = "none";
                inputNuevaCat.required = false;
                inputNuevaCat.value = "";
            }
        });
    }

    // --- 4. EVENTO GUARDAR PRODUCTO ---
    const formProd = document.getElementById("form-producto");
    if(formProd) {
        formProd.addEventListener("submit", guardarProducto);
    }

    // --- 5. CARGA INICIAL DE DATOS ---
    cargarProductosAdmin();
    cargarPedidosAdmin();
    cargarUsuariosAdmin();
});

// ==========================================
// CRUD DE PRODUCTOS
// ==========================================

async function cargarProductosAdmin() {
    const tbody = document.getElementById('tabla-productos-body');
    if(!tbody) return;

    try {
        const res = await fetch("http://localhost:3000/api/productos");
        const productos = await res.json();

        if (productos.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No hay productos registrados.</td></tr>`;
            return;
        }

        let html = '';
        productos.forEach(p => {
            const badgeStock = p.stock 
                ? `<span style="background:#27ae60; color:white; padding: 2px 8px; border-radius:12px; font-size:0.8rem;">Disponible</span>` 
                : `<span style="background:#e74c3c; color:white; padding: 2px 8px; border-radius:12px; font-size:0.8rem;">Agotado</span>`;

            html += `
                <tr>
                    <td>#${p.id}</td>
                    <td><img src="${p.imagen_url || 'img/termo1.jpg'}" alt="Foto" style="width:50px; border-radius:4px;"></td>
                    <td style="font-weight:bold;">${p.nombre}</td>
                    <td style="color:#3498db; font-weight:bold;">$${Number(p.precio).toFixed(2)}</td>
                    <td>${badgeStock}</td>
                    <td>
                        <button class="btn-accion btn-editar" onclick="abrirModal(${p.id})">✏️ Editar</button>
                        <button class="btn-accion btn-eliminar" onclick="eliminarProducto(${p.id})">🗑️ Borrar</button>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">Error de conexión.</td></tr>`;
    }
}

async function abrirModal(id = null) {
    document.getElementById("modal-producto").style.display = "flex";
    document.getElementById("form-producto").reset();
    document.getElementById("prod-id").value = id || "";
    document.getElementById("modal-titulo").textContent = id ? "Editar Termo" : "Nuevo Termo";
    
    const inputNuevaCat = document.getElementById("prod-categoria-nueva");
    if(inputNuevaCat) inputNuevaCat.style.display = "none";

    if(id) {
        const res = await fetch(`http://localhost:3000/api/productos/${id}`);
        const p = await res.json();
        
        document.getElementById("prod-nombre").value = p.nombre;
        document.getElementById("prod-categoria").value = p.categoria;
        document.getElementById("prod-precio").value = p.precio;
        document.getElementById("prod-imagen").value = p.imagen_url || '';
        document.getElementById("prod-stock").value = p.stock ? "1" : "0";
    }
}

function cerrarModal() {
    document.getElementById("modal-producto").style.display = "none";
}

async function guardarProducto(e) {
    e.preventDefault();
    const token = localStorage.getItem("access_token");
    const id = document.getElementById("prod-id").value;
    
    let categoriaFinal = document.getElementById("prod-categoria").value;
    if (categoriaFinal === "nueva") {
        categoriaFinal = document.getElementById("prod-categoria-nueva").value;
    }
    
    const datos = {
        nombre: document.getElementById("prod-nombre").value,
        categoria: categoriaFinal,
        precio: document.getElementById("prod-precio").value,
        imagen: document.getElementById("prod-imagen").value,
        stock: document.getElementById("prod-stock").value === "1"
    };

    const url = id ? `http://localhost:3000/api/productos/${id}` : `http://localhost:3000/api/productos`;
    const metodo = id ? "PUT" : "POST";

    try {
        const res = await fetch(url, {
            method: metodo,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(datos)
        });

        if(res.ok) {
            cerrarModal();
            cargarProductosAdmin();
        } else {
            alert("⚠️ Error al guardar. Revisa que todos los campos sean correctos.");
        }
    } catch(error) { console.error(error); }
}

async function eliminarProducto(id) {
    if(!confirm("¿Seguro que deseas eliminar este producto?")) return;
    const token = localStorage.getItem("access_token");
    try {
        const res = await fetch(`http://localhost:3000/api/productos/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if(res.ok) cargarProductosAdmin();
    } catch(e) { console.error(e); }
}

// ==========================================
// CARGAR PEDIDOS Y USUARIOS
// ==========================================

async function cargarPedidosAdmin() {
    const tbody = document.getElementById('tabla-pedidos-body');
    if(!tbody) return;
    const token = localStorage.getItem("access_token");

    try {
        const res = await fetch("http://localhost:3000/api/admin/pedidos", {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const pedidos = await res.json();
        
        let html = '';
        pedidos.forEach(p => {
            const fecha = p.created_at ? new Date(p.created_at).toLocaleDateString() : 'N/A';
            html += `<tr>
                <td><strong>#${p.id}</strong></td>
                <td>ID Usuario: ${p.user_id}</td>
                <td>${fecha}</td>
                <td style="color:#3498db; font-weight:bold;">$${Number(p.total).toFixed(2)}</td>
                <td><span style="background:#f39c12; color:white; padding: 2px 8px; border-radius:12px;">${p.estado_pago}</span></td>
                <td><button class="btn-accion btn-editar" style="background:#2ecc71;">📦 Enviar</button></td>
            </tr>`;
        });
        tbody.innerHTML = html || "<tr><td colspan='6'>No hay pedidos.</td></tr>";
    } catch(e) { console.error(e); }
}

async function cargarUsuariosAdmin() {
    const tbody = document.getElementById('tabla-usuarios-body');
    if(!tbody) return;
    const token = localStorage.getItem("access_token");

    try {
        const res = await fetch("http://localhost:3000/auth/admin/usuarios", {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const usuarios = await res.json();

        let html = '';
        usuarios.forEach(u => {
            const colorRol = u.role === 'admin' ? '#e74c3c' : '#95a5a6';
            html += `<tr>
                <td><strong>#${u.id}</strong></td>
                <td>${u.email}</td>
                <td><span style="background:${colorRol}; color:white; padding: 2px 8px; border-radius:12px; text-transform:uppercase;">${u.role}</span></td>
                <td>${u.mfa_enabled ? '✅ Sí' : '❌ No'}</td>
                <td>${u.activo ? '🟢 Activo' : '🔴 Bloqueado'}</td>
            </tr>`;
        });
        tbody.innerHTML = html || "<tr><td colspan='5'>No hay usuarios.</td></tr>";
    } catch(e) { console.error(e); }
}