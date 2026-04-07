// cache.js — Thermomania AG
// Responsabilidad única: caché manual en memoria con TTL

const store = new Map();
const TTL   = 5 * 60 * 1000; // 5 minutos

export const Cache = {

    get(key) {
        const entry = store.get(key);
        if (!entry) return null;
        if (Date.now() > entry.exp) { store.delete(key); return null; }
        return entry.value;
    },

    set(key, value) {
        store.set(key, { value, exp: Date.now() + TTL });
    },

    // Sin argumento limpia todo; con key elimina esa entrada
    // Acepta prefijos: clear("http://localhost:3000/api/productos")
    // borra todas las claves que empiecen con ese string
    clear(key) {
        if (!key) { store.clear(); return; }
        for (const k of store.keys()) {
            if (k.startsWith(key)) store.delete(k);
        }
    },

    size() { return store.size; },

    keys() { return [...store.keys()]; },
};