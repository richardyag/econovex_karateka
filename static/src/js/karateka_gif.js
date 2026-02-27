/** @odoo-module **/
/**
 * Karateka GIF – Econovex (entorno test)
 *
 * Intercepta action.doActionButton (el punto real donde Odoo 19 ejecuta
 * los botones de formulario type="object") para detectar:
 *  - sale.order / action_confirm           → GIF directo
 *  - sale.order / action_quotation_send    → abre wizard → GIF al confirmar el wizard
 *  - account.move / action_send_and_print  → abre wizard → GIF al confirmar el wizard
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
    { model: "sale.order",               method: "action_confirm" },
    // En Odoo 19 el wizard de envío de facturas usa este modelo y método
    { model: "account.move.send.wizard", method: "action_send_and_print" },
];

const WIZARD_OPENERS = [
    { model: "sale.order", method: "action_quotation_send" },
];

// Cuando el wizard de presupuesto envía el correo
const WIZARD_SENDERS = [
    { model: "mail.compose.message", method: "action_send_mail" },
];

let pendingKarateka = false;

function matchesList(list, model, method) {
    return list.some((t) => t.model === model && t.method === method);
}

function handleTrigger(model, method) {
    log("acción detectada →", model, "::", method);

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
    log("¡Mostrando overlay!");

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

// ── Atajo de teclado para probar el overlay ───────────────────────────────────
// Pulsa Ctrl+Shift+K en cualquier momento para forzar el overlay.
document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === "K") {
        log("Atajo Ctrl+Shift+K → forzando overlay de prueba");
        showKaratekaGif();
    }
});

// ── Servicio Odoo ─────────────────────────────────────────────────────────────
// En Odoo 19, todos los botones type="object" de formulario pasan por
// action.doActionButton({ name, resModel, type, ... }).
// Lo envolvemos aquí para detectar los triggers.
const karatekaService = {
    dependencies: ["action", "orm"],
    start(env, { action, orm }) {

        // — Interceptar action.doActionButton (botones de formulario) —
        if (typeof action.doActionButton === "function") {
            const _origDoAction = action.doActionButton.bind(action);
            action.doActionButton = async function (params, ...rest) {
                const result = await _origDoAction(params, ...rest);
                try {
                    const model  = params && params.resModel;
                    const method = params && params.name;
                    if (model && method) handleTrigger(model, method);
                } catch (e) { /* nunca romper Odoo */ }
                return result;
            };
            log("action.doActionButton interceptado ✓");
        } else {
            log("AVISO: action.doActionButton no encontrado. Métodos disponibles:", Object.keys(action));
        }

        // — Interceptar orm.call como red de seguridad (wizards internos) —
        if (typeof orm.call === "function") {
            const _origOrmCall = orm.call.bind(orm);
            orm.call = async function (model, method, ...rest) {
                const result = await _origOrmCall(model, method, ...rest);
                try { handleTrigger(model, method); } catch (e) {}
                return result;
            };
            log("orm.call interceptado ✓");
        }
    },
};

registry.category("services").add("karateka_gif", karatekaService);
