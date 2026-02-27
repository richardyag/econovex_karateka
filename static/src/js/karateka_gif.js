/** @odoo-module **/
/**
 * Karateka GIF – Econovex (entorno test)
 *
 * Se registra como servicio Odoo para envolver orm.call y detectar:
 *  - sale.order / action_confirm           → GIF directo
 *  - sale.order / action_quotation_send    → abre wizard → GIF al enviar
 *  - account.move / action_send_and_print  → abre wizard → GIF al enviar
 */

import { registry } from "@web/core/registry";

// ── Configuración ─────────────────────────────────────────────────────────────
const GIF_URL = "/econovex_karateka/static/src/img/karateka.gif";
const GIF_DURATION_MS = 3500;
const DEBUG = true; // poner false cuando todo funcione

function log(...args) {
    if (DEBUG) console.log("[🥋 Karateka]", ...args);
}

// ── Triggers ──────────────────────────────────────────────────────────────────
const DIRECT_TRIGGERS = [
    { model: "sale.order", method: "action_confirm" },
];

const WIZARD_OPENERS = [
    { model: "sale.order",   method: "action_quotation_send" },
    { model: "account.move", method: "action_send_and_print" },
];

const WIZARD_SENDERS = [
    { model: "mail.compose.message", method: "action_send_mail" },
    { model: "account.move.send",    method: "action_send_and_print" },
    { model: "account.move.send",    method: "action_send" },
];

let pendingKarateka = false;

function matchesList(list, model, method) {
    return list.some((t) => t.model === model && t.method === method);
}

// ── CSS del overlay ───────────────────────────────────────────────────────────
const style = document.createElement("style");
style.textContent = `
    #karatekaOverlay {
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.65);
        z-index: 99999;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        cursor: pointer;
        animation: karatekaIn 0.25s ease;
    }
    @keyframes karatekaIn {
        from { opacity:0; transform:scale(0.85); }
        to   { opacity:1; transform:scale(1);    }
    }
    #karatekaOverlay img {
        max-width: 80vw; max-height: 75vh;
        border-radius: 12px;
        box-shadow: 0 24px 64px rgba(0,0,0,0.6);
    }
    #karatekaOverlay .karateka-fallback {
        font-size: 110px; line-height: 1;
        animation: karatekaKick 0.4s ease;
    }
    @keyframes karatekaKick {
        0%   { transform: rotate(-10deg) translateX(-30px); }
        60%  { transform: rotate(15deg)  translateX(20px);  }
        100% { transform: rotate(0deg)   translateX(0);     }
    }
    #karatekaOverlay .karateka-label {
        margin-top: 20px; font-size: 2rem; font-weight: 700;
        color: #fff; text-shadow: 0 2px 8px rgba(0,0,0,0.8);
        letter-spacing: 2px;
    }
`;
document.head.appendChild(style);

// ── Mostrar overlay ───────────────────────────────────────────────────────────
function showKaratekaGif() {
    if (document.getElementById("karatekaOverlay")) return;
    log("Mostrando overlay");

    const overlay = document.createElement("div");
    overlay.id = "karatekaOverlay";

    const img = document.createElement("img");
    img.src = GIF_URL + "?t=" + Date.now();
    img.alt = "¡KARATEKA!";
    img.onerror = () => {
        log("GIF no encontrado — mostrando emoji de fallback");
        img.remove();
        const kick = document.createElement("div");
        kick.className = "karateka-fallback";
        kick.textContent = "🥋";
        overlay.appendChild(kick);
    };

    const label = document.createElement("div");
    label.className = "karateka-label";
    label.textContent = "¡ENVIADO!";

    overlay.appendChild(img);
    overlay.appendChild(label);
    document.body.appendChild(overlay);

    const timer = setTimeout(() => overlay.remove(), GIF_DURATION_MS);
    overlay.addEventListener("click", () => { clearTimeout(timer); overlay.remove(); });
}

// ── Lógica de triggers ────────────────────────────────────────────────────────
function handleOrmCall(model, method) {
    log("orm.call →", model, "::", method);

    if (matchesList(DIRECT_TRIGGERS, model, method)) {
        showKaratekaGif();
    } else if (matchesList(WIZARD_OPENERS, model, method)) {
        log("Bandera activada, esperando wizard...");
        pendingKarateka = true;
    } else if (pendingKarateka && matchesList(WIZARD_SENDERS, model, method)) {
        pendingKarateka = false;
        showKaratekaGif();
    }
}

// ── Servicio Odoo ─────────────────────────────────────────────────────────────
// Al registrarlo en "services", Odoo lo inicia al arrancar la app.
// Envolvemos orm.call para interceptar todas las llamadas a métodos Python.
const karatekaService = {
    dependencies: ["orm"],
    start(env, { orm }) {
        if (!orm || typeof orm.call !== "function") {
            log("orm.call no disponible");
            return;
        }

        const _originalCall = orm.call.bind(orm);
        orm.call = async function (model, method, ...rest) {
            const result = await _originalCall(model, method, ...rest);
            try { handleOrmCall(model, method); } catch (e) { /* nunca romper Odoo */ }
            return result;
        };

        log("orm.call interceptado vía servicio Odoo ✓");
    },
};

registry.category("services").add("karateka_gif", karatekaService);
