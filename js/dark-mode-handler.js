// js/dark-mode-handler.js

function sincronizarModo() {
    const estado = localStorage.getItem("dark-mode") === "true";
    document.body.classList.toggle("dark-mode", estado);
}

// 1. Aplicar en cuanto cargue la página
sincronizarModo();

// 2. Si cambias el modo en OTRA pestaña, esta se actualiza sola
window.addEventListener('storage', (e) => {
    if (e.key === 'dark-mode') sincronizarModo();
});

// 3. Configurar el botón de la página actual (si existe)
document.addEventListener("DOMContentLoaded", () => {
    const btnLuna = document.querySelector("#btn-dark-mode") || document.querySelector(".dark-mode-toggle");
    
    if (btnLuna) {
        btnLuna.addEventListener("click", () => {
            const nuevoEstado = document.body.classList.toggle("dark-mode");
            localStorage.setItem("dark-mode", nuevoEstado);
        });
    }
});