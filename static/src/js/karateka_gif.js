/** @odoo-module **/
/**
 * Karateka GIF – Econovex (entorno test)
 *
 * Triggers configurados:
 *  - sale.order / action_confirm              → "¡CONFIRMADO!" en verde
 *  - account.move.send.wizard / action_send_and_print → "¡ENVIADO!" en blanco
 *  - sale.order / action_quotation_send → wizard correo → "¡ENVIADO!" en blanco
 */

import { registry } from "@web/core/registry";

// ── Configuración ─────────────────────────────────────────────────────────────
const GIF_URL = "/econovex_karateka/static/src/img/karateka.gif";
const GIF_DURATION_MS = 3500;
const DEBUG = false;

function log(...args) {
    if (DEBUG) console.log("[🥋 Karateka]", ...args);
}

// ── Triggers ──────────────────────────────────────────────────────────────────
// Cada trigger lleva su propio texto y color de cartel.
const DIRECT_TRIGGERS = [
    {
        model: "sale.order",
        method: "action_confirm",
        label: "¡CONFIRMADO!",
        labelColor: "#ffd700",
    },
    {
        model: "account.move.send.wizard",
        method: "action_send_and_print",
        label: "¡ENVIADO!",
        labelColor: "#ffd700",
    },
];

const WIZARD_OPENERS = [
    { model: "sale.order", method: "action_quotation_send" },
];

const WIZARD_SENDERS = [
    {
        model: "mail.compose.message",
        method: "action_send_mail",
        label: "¡ENVIADO!",
        labelColor: "#ffd700",
    },
];

let pendingKarateka = false;

function findTrigger(list, model, method) {
    return list.find((t) => t.model === model && t.method === method) || null;
}

function handleTrigger(model, method) {
    log("acción detectada →", model, "::", method);

    const direct = findTrigger(DIRECT_TRIGGERS, model, method);
    if (direct) {
        showKaratekaGif(direct.label, direct.labelColor);
        return;
    }

    if (findTrigger(WIZARD_OPENERS, model, method)) {
        log("Bandera activada, esperando wizard...");
        pendingKarateka = true;
        return;
    }

    if (pendingKarateka) {
        const sender = findTrigger(WIZARD_SENDERS, model, method);
        if (sender) {
            pendingKarateka = false;
            showKaratekaGif(sender.label, sender.labelColor);
        }
    }
}

// ── CSS del overlay ───────────────────────────────────────────────────────────
const style = document.createElement("style");
style.textContent = `
    #karatekaOverlay {
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.82);
        z-index: 99999;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        cursor: pointer;
        animation: karatekaIn 0.2s ease;
    }
    @keyframes karatekaIn {
        from { opacity:0; transform:scale(0.88); }
        to   { opacity:1; transform:scale(1);    }
    }
    #karatekaOverlay img {
        max-width: 80vw; max-height: 72vh;
        border-radius: 12px;
        border: 3px solid #ffd700;
        box-shadow: 0 0 40px rgba(255,215,0,0.5), 0 24px 64px rgba(0,0,0,0.8);
    }
    #karatekaOverlay .karateka-fallback {
        font-size: 120px; line-height: 1;
        filter: drop-shadow(0 0 20px rgba(255,215,0,0.8));
        animation: karatekaKick 0.35s ease;
    }
    @keyframes karatekaKick {
        0%   { transform: rotate(-15deg) translateX(-40px) scale(0.8); }
        65%  { transform: rotate(10deg)  translateX(15px)  scale(1.1); }
        100% { transform: rotate(0deg)   translateX(0)     scale(1);   }
    }
    #karatekaOverlay .karateka-label {
        margin-top: 22px; font-size: 2.4rem; font-weight: 900;
        color: #ffd700;
        text-shadow: 0 0 20px rgba(255,215,0,0.7), 0 2px 8px rgba(0,0,0,1);
        letter-spacing: 4px;
    }
`;
document.head.appendChild(style);

// ── Mostrar overlay ───────────────────────────────────────────────────────────
function showKaratekaGif(label = "¡ENVIADO!", labelColor = "#ffffff") {
    if (document.getElementById("karatekaOverlay")) return;
    log("¡Mostrando overlay!", label);

    const overlay = document.createElement("div");
    overlay.id = "karatekaOverlay";

    const img = document.createElement("img");
    img.src = GIF_URL + "?t=" + Date.now();
    img.alt = "¡KARATEKA!";
    img.onerror = () => {
        img.remove();
        const kick = document.createElement("div");
        kick.className = "karateka-fallback";
        kick.textContent = "🥊";
        overlay.appendChild(kick);
    };

    const labelEl = document.createElement("div");
    labelEl.className = "karateka-label";
    labelEl.textContent = label;
    labelEl.style.color = labelColor;

    overlay.appendChild(img);
    overlay.appendChild(labelEl);
    document.body.appendChild(overlay);

    const timer = setTimeout(() => overlay.remove(), GIF_DURATION_MS);
    overlay.addEventListener("click", () => { clearTimeout(timer); overlay.remove(); });
}

// ── Atajo de teclado para probar ──────────────────────────────────────────────
document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === "K") {
        showKaratekaGif("¡CONFIRMADO!", "#4caf50");
    }
});

// ── Servicio Odoo ─────────────────────────────────────────────────────────────
const karatekaService = {
    dependencies: ["action", "orm"],
    start(env, { action, orm }) {

        if (typeof action.doActionButton === "function") {
            const _origDoAction = action.doActionButton.bind(action);
            action.doActionButton = async function (params, ...rest) {
                const result = await _origDoAction(params, ...rest);
                try {
                    const model  = params && params.resModel;
                    const method = params && params.name;
                    if (model && method) handleTrigger(model, method);
                } catch (e) {}
                return result;
            };
        }

        if (typeof orm.call === "function") {
            const _origOrmCall = orm.call.bind(orm);
            orm.call = async function (model, method, ...rest) {
                const result = await _origOrmCall(model, method, ...rest);
                try { handleTrigger(model, method); } catch (e) {}
                return result;
            };
        }
    },
};

registry.category("services").add("karateka_gif", karatekaService);
