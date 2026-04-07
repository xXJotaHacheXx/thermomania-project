// rbac.js — Thermomania AG — Parte 4
// Control de acceso por rol (RBAC) en el frontend
// Roles: admin | editor | usuario

const API = (window.API_BASE || "https://thermomania-project-production.up.railway.app");

// ── Permisos por rol ───────────────────────────────────────
const PERMISOS = {
    admin:   ["productos:write", "productos:delete", "usuarios:read", "logs:read", "gestor:access"],
    editor:  ["productos:write"],
    usuario: [],
};

// ── Rutas protegidas — redirige si no tiene permiso ────────
const RUTAS_PROTEGIDAS = {
    "gestor.html":  { requiereAuth: true,  permiso: "gestor:access"  },
    "logs.html":    { requiereAuth: true,  permiso: "logs:read"      },
    "cuenta.html":  { requiereAuth: false                             },
};

// ══════════════════════════════════════════════════════════
// RBAC — módulo principal
// ══════════════════════════════════════════════════════════
const RBAC = {

    // ── Obtener rol del token almacenado ───────────────────
    getRole() {
        return localStorage.getItem("role") || "anonimo";
    },

    // ── Verificar permiso ──────────────────────────────────
    puede(permiso) {
        const role   = this.getRole();
        const perms  = PERMISOS[role] || [];
        return perms.includes(permiso);
    },

    // ── Verificar si está autenticado ──────────────────────
    estaAutenticado() {
        return Boolean(localStorage.getItem("access_token"));
    },

    // ── Proteger la página actual ──────────────────────────
    protegerRuta() {
        const pagina = location.pathname.split("/").pop() || "index.html";
        const regla  = RUTAS_PROTEGIDAS[pagina];
        if (!regla) return; // ruta pública

        if (regla.requiereAuth && !this.estaAutenticado()) {
            // No redirigir si ya estamos en cuenta.html
            const pagina = location.pathname.split("/").pop();
            if (pagina !== "cuenta.html") {
                location.href = `cuenta.html?redirect=${encodeURIComponent(location.href)}`;
            }
            return;
        }

        if (regla.permiso && !this.puede(regla.permiso)) {
            this.mostrarAccesoDenegado();
            return;
        }
    },

    // ── Mostrar bloqueo en pantalla ────────────────────────
    mostrarAccesoDenegado() {
        document.body.innerHTML = `
            <div style="
                display:flex; flex-direction:column; align-items:center;
                justify-content:center; height:100vh; font-family:Arial,sans-serif;
                background:#f8f9fa; color:#2c3e50; text-align:center; padding:2rem;
            ">
                <div style="font-size:4rem; margin-bottom:1rem;">🔒</div>
                <h1 style="font-size:2rem; margin-bottom:.5rem;">Acceso denegado</h1>
                <p style="color:#7f8c8d; margin-bottom:1.5rem;">
                    No tienes permisos para acceder a esta página.<br>
                    Rol actual: <strong>${this.getRole()}</strong>
                </p>
                <a href="index.html" style="
                    background:#3498db; color:#fff; padding:.75rem 1.5rem;
                    border-radius:6px; text-decoration:none; font-weight:bold;
                ">Volver al inicio</a>
            </div>`;
    },

    // ── Adaptar navegación según rol ───────────────────────
    adaptarNav() {
        const role = this.getRole();

        // Elementos que solo admin ve
        document.querySelectorAll("[data-rol-minimo]").forEach(el => {
            const minimo = el.dataset.rolMinimo;
            const visible = this._tieneRolMinimo(role, minimo);
            el.style.display = visible ? "" : "none";
        });

        // Elementos que requieren autenticación
        document.querySelectorAll("[data-requiere-auth]").forEach(el => {
            el.style.display = this.estaAutenticado() ? "" : "none";
        });

        // Elementos para NO autenticados
        document.querySelectorAll("[data-solo-anonimo]").forEach(el => {
            el.style.display = !this.estaAutenticado() ? "" : "none";
        });

        // Badge de rol en el nav
        const badge = document.getElementById("nav-rol-badge");
        if (badge && this.estaAutenticado()) {
            badge.textContent = role;
            badge.className   = `nav-rol-badge rol-${role}`;
            badge.style.display = "inline-block";
        }

        // Texto del enlace de cuenta
        const linkCuenta = document.querySelector('a[href="cuenta.html"]');
        if (linkCuenta && this.estaAutenticado()) {
            linkCuenta.textContent = "Mi cuenta";
        }
    },

    // ── Adaptar contenido del gestor ───────────────────────
    adaptarGestor() {
        const role = this.getRole();

        // Ocultar botón eliminar a editores
        if (!this.puede("productos:delete")) {
            document.querySelectorAll(".btn-eliminar").forEach(btn => {
                btn.style.display = "none";
            });
        }

        // Ocultar sección de usuarios a no-admin
        if (!this.puede("usuarios:read")) {
            const secUsuarios = document.getElementById("seccion-usuarios");
            if (secUsuarios) secUsuarios.style.display = "none";
        }

        // Mostrar banner de rol
        const banner = document.getElementById("gestor-rol-banner");
        if (banner) {
            banner.textContent = `Accediendo como: ${role}`;
            banner.className   = `gestor-banner rol-${role}`;
        }
    },

    // ── Helper: jerarquía de roles ─────────────────────────
    _tieneRolMinimo(rolActual, rolMinimo) {
        const jerarquia = { admin: 3, editor: 2, usuario: 1, anonimo: 0 };
        return (jerarquia[rolActual] || 0) >= (jerarquia[rolMinimo] || 0);
    },
};

// ══════════════════════════════════════════════════════════
// INIT — ejecutar al cargar cada página
// ══════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
    RBAC.protegerRuta();
    RBAC.adaptarNav();

    // Si estamos en gestor.html, adaptar controles
    if (location.pathname.includes("gestor")) {
        RBAC.adaptarGestor();
    }
});

// Exportar para uso en otros módulos
window.RBAC = RBAC;