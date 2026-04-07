// config.js — Thermomania AG
// URL del backend

const IS_PROD = location.hostname !== "localhost" && location.hostname !== "127.0.0.1";

const API_BASE = IS_PROD
    ? "https://thermomania-project-production.up.railway.app"
    : "http://localhost:3000";

// Disponible globalmente para el resto de la aplicación
window.API_BASE = API_BASE;
console.log(`[Config] API: ${API_BASE}`);