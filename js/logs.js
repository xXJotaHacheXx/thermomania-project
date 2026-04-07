const API        = (window.API_BASE || "https://thermomania-project-production.up.railway.app");
const list       = document.getElementById("loglist");
const statusEl   = document.getElementById("status");
const pauseBtn   = document.getElementById("pauseBtn");
const clearBtn   = document.getElementById("clearBtn");
const exportBtn  = document.getElementById("exportBtn");
const levelSel   = document.getElementById("level");
const serviceSel = document.getElementById("service");
const searchInp  = document.getElementById("search");
const applyBtn   = document.getElementById("apply");

let paused   = false;
const dataAll    = [];
let dataShown    = [];

// ── Renderizar fila ────────────────────────────────────────
function renderRow(l) {
    const row   = document.createElement("div");
    row.className = "row";
    const meta  = [l.method, l.path, l.status, l.responseTimeMs != null ? `${l.responseTimeMs}ms` : null]
        .filter(Boolean).join(" · ");
    row.innerHTML = `
        <div>${l.timestamp || ""}</div>
        <div><span class="lvl ${(l.level || "info").toLowerCase()}">${l.level || ""}</span></div>
        <div><div>${l.service || ""}</div><div class="service">${l.correlationId || ""}</div></div>
        <div class="msg"><strong>${l.message || ""}</strong>${meta ? `<div class="meta">${meta}</div>` : ""}</div>`;
    return row;
}

// ── Filtros ────────────────────────────────────────────────
function matchFilter(l) {
    const lvl = levelSel.value.trim().toLowerCase();
    const svc = serviceSel.value.trim().toLowerCase();
    const q   = searchInp.value.trim().toLowerCase();
    if (lvl && l.level?.toLowerCase()   !== lvl) return false;
    if (svc && l.service?.toLowerCase() !== svc) return false;
    if (q   && !JSON.stringify(l).toLowerCase().includes(q)) return false;
    return true;
}

function redraw() {
    list.querySelectorAll(".row:not(.header)").forEach(n => n.remove());
    const frag = document.createDocumentFragment();
    dataShown.slice(-500).forEach(l => frag.appendChild(renderRow(l)));
    list.appendChild(frag);
}

function applyFilters() {
    dataShown = dataAll.filter(matchFilter);
    redraw();
}

function push(l) {
    dataAll.push(l);
    if (paused || !matchFilter(l)) return;
    dataShown.push(l);
    list.appendChild(renderRow(l));
    requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }));
}

// ── Carga histórica ────────────────────────────────────────
fetch(`${API}/logs/recent?limit=200`)
    .then(r => r.json())
    .then(arr => { arr.reverse().forEach(l => dataAll.push(l)); applyFilters(); })
    .catch(() => {});

// ── SSE en tiempo real ─────────────────────────────────────
function connectSSE() {
    const es = new EventSource(`${API}/logs/sse`);
    es.onopen    = () => { statusEl.textContent = "Conectado";    statusEl.style.color = "#16a34a"; };
    es.onmessage = e  => { try { push(JSON.parse(e.data)); } catch {} };
    es.onerror   = () => {
        statusEl.textContent = "Reconectando…";
        statusEl.style.color = "#a16207";
        es.close();
        setTimeout(connectSSE, 1500);
    };
}
connectSSE();

// ── Controles ──────────────────────────────────────────────
pauseBtn.addEventListener("click", () => {
    paused = !paused;
    pauseBtn.textContent = paused ? "Reanudar" : "Pausar";
    if (!paused) applyFilters();
});

clearBtn.addEventListener("click", () => {
    dataAll.length = dataShown.length = 0;
    redraw();
});

exportBtn.addEventListener("click", () => {
    const blob = new Blob([dataShown.map(o => JSON.stringify(o)).join("\n")], { type: "application/json" });
    const a    = Object.assign(document.createElement("a"), {
        href:     URL.createObjectURL(blob),
        download: `logs-${new Date().toISOString().slice(0, 10)}.jsonl`,
    });
    a.click();
    URL.revokeObjectURL(a.href);
});

applyBtn.addEventListener("click", applyFilters);
searchInp.addEventListener("keydown", e => { if (e.key === "Enter") applyFilters(); });