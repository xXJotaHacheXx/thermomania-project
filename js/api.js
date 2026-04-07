// api.js — Thermomania AG
// Responsabilidad única: comunicación con la API REST
// Importa Cache desde cache.js

import { Cache } from "./cache.js";

const API_BASE = "http://localhost:3000";

let activeController = null;

function cancelPending() {
    if (activeController) { activeController.abort(); activeController = null; }
}

// ── Fetch genérico con caché + AbortController ─────────────
async function apiFetch(url, options = {}) {
    if (options.method === undefined || options.method === "GET") {
        const cached = Cache.get(url);
        if (cached) {
            console.log(`[Cache HIT] ${url}`);
            return cached;
        }
        cancelPending();
        activeController = new AbortController();
    }

    console.time(`[API] ${url}`);
    try {
        const res = await fetch(url, {
            ...options,
            signal: activeController?.signal,
            headers: {
                "Content-Type": "application/json",
                "x-correlation-id": localStorage.getItem("cid") || "app",
                ...(options.headers || {}),
            },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        const data = await res.json();
        if (!options.method || options.method === "GET") Cache.set(url, data);
        console.timeEnd(`[API] ${url}`);
        return data;
    } catch (err) {
        if (err.name === "AbortError") return null;
        throw err;
    } finally {
        activeController = null;
    }
}

// ── Endpoints de productos ─────────────────────────────────
export const Api = {

    async getProductos(filtros = {}) {
        const qs  = new URLSearchParams(
            Object.fromEntries(Object.entries(filtros).filter(([, v]) => v))
        ).toString();
        const urlProductos  = `${API_BASE}/api/productos${qs ? "?" + qs : ""}`;
        const urlCategorias = `${API_BASE}/api/categorias`;

        console.time("[API] Promise.allSettled");
        const [resProductos, resCategorias] = await Promise.allSettled([
            apiFetch(urlProductos),
            apiFetch(urlCategorias),
        ]);
        console.timeEnd("[API] Promise.allSettled");

        if (resProductos.status === "rejected") throw resProductos.reason;

        if (resCategorias.status === "rejected") {
            console.warn("[API] Categorías no disponibles:", resCategorias.reason?.message);
        }

        return resProductos.value;
    },

    async getProducto(id) {
        return apiFetch(`${API_BASE}/api/productos/${id}`);
    },

    async crearProducto(data) {
        return apiFetch(`${API_BASE}/api/productos`, { method: "POST", body: JSON.stringify(data) });
    },

    async actualizarProducto(id, data) {
        Cache.clear(`${API_BASE}/api/productos`);
        return apiFetch(`${API_BASE}/api/productos/${id}`, { method: "PUT", body: JSON.stringify(data) });
    },

    async eliminarProducto(id) {
        Cache.clear(`${API_BASE}/api/productos`);
        return apiFetch(`${API_BASE}/api/productos/${id}`, { method: "DELETE" });
    },

    // ── Auth ───────────────────────────────────────────────
    async login(email, password, captchaToken) {
        return apiFetch(`${API_BASE}/login`, {
            method: "POST",
            headers: { "x-captcha-token": captchaToken },
            body: JSON.stringify({ email, password }),
        });
    },

    async registro(email, password, confirm, captchaToken) {
        return apiFetch(`${API_BASE}/registro`, {
            method: "POST",
            headers: { "x-captcha-token": captchaToken },
            body: JSON.stringify({ email, password, confirm }),
        });
    },

    // ── Health ─────────────────────────────────────────────
    async health() {
        return apiFetch(`${API_BASE}/health`);
    },

    cancelPending,
};