/**
 * Karateka GIF – Econovex (entorno test)
 *
 * Muestra un GIF de karateka cuando:
 *  - Se confirma una venta       → sale.order / action_confirm
 *  - Se envía un presupuesto     → sale.order / action_quotation_send → wizard de correo
 *  - Se envía una factura        → account.move / action_send_and_print → wizard account.move.send
 */
(function () {
    'use strict';

    // ── Configuración ─────────────────────────────────────────────────────────
    var GIF_URL = '/econovex_karateka/static/src/img/karateka.gif';
    var GIF_DURATION_MS = 3500;

    // DEBUG: activar para ver logs en la consola del navegador.
    // Poner a false una vez que el módulo funcione correctamente.
    var DEBUG = true;

    function log() {
        if (DEBUG) console.log.apply(console, ['[🥋 Karateka]'].concat(Array.prototype.slice.call(arguments)));
    }

    // ── Triggers ──────────────────────────────────────────────────────────────

    // Acciones directas (sin wizard): el GIF aparece inmediatamente.
    var DIRECT_TRIGGERS = [
        { model: 'sale.order', method: 'action_confirm' },
    ];

    // Acciones que ABREN un wizard de envío: activan la bandera.
    var WIZARD_OPENERS = [
        { model: 'sale.order',   method: 'action_quotation_send' },
        { model: 'account.move', method: 'action_send_and_print' },
    ];

    // Acciones dentro del wizard que ejecutan el envío real.
    var WIZARD_SENDERS = [
        { model: 'mail.compose.message', method: 'action_send_mail' },
        { model: 'account.move.send',    method: 'action_send_and_print' },
        { model: 'account.move.send',    method: 'action_send' },
    ];

    var pendingKarateka = false;

    // ── CSS del overlay ───────────────────────────────────────────────────────
    var style = document.createElement('style');
    style.textContent = [
        '#karatekaOverlay {',
        '  position: fixed; inset: 0;',
        '  background: rgba(0,0,0,0.65);',
        '  z-index: 99999;',
        '  display: flex; flex-direction: column;',
        '  align-items: center; justify-content: center;',
        '  cursor: pointer;',
        '  animation: karatekaIn 0.25s ease;',
        '}',
        '@keyframes karatekaIn {',
        '  from { opacity:0; transform:scale(0.85); }',
        '  to   { opacity:1; transform:scale(1);    }',
        '}',
        '#karatekaOverlay img {',
        '  max-width:80vw; max-height:75vh;',
        '  border-radius:12px;',
        '  box-shadow:0 24px 64px rgba(0,0,0,0.6);',
        '}',
        '#karatekaOverlay .karateka-fallback {',
        '  font-size:110px; line-height:1; text-align:center;',
        '  animation: karatekaKick 0.4s ease;',
        '}',
        '@keyframes karatekaKick {',
        '  0%   { transform: rotate(-10deg) translateX(-30px); }',
        '  60%  { transform: rotate(15deg)  translateX(20px);  }',
        '  100% { transform: rotate(0deg)   translateX(0);     }',
        '}',
        '#karatekaOverlay .karateka-label {',
        '  margin-top:20px; font-size:2rem; font-weight:700;',
        '  color:#fff; text-shadow:0 2px 8px rgba(0,0,0,0.8);',
        '  letter-spacing:2px;',
        '}',
    ].join('\n');
    document.head.appendChild(style);

    // ── Mostrar overlay ───────────────────────────────────────────────────────
    function showKaratekaGif() {
        if (document.getElementById('karatekaOverlay')) return;
        log('Mostrando overlay');

        var overlay = document.createElement('div');
        overlay.id = 'karatekaOverlay';

        var img = document.createElement('img');
        img.src = GIF_URL + '?t=' + Date.now();
        img.alt = '¡KARATEKA!';

        // Fallback: emoji animado si el GIF no está disponible todavía
        img.onerror = function () {
            log('GIF no encontrado — mostrando fallback emoji');
            img.remove();
            var kick = document.createElement('div');
            kick.className = 'karateka-fallback';
            kick.textContent = '🥋';
            overlay.appendChild(kick);
        };

        var label = document.createElement('div');
        label.className = 'karateka-label';
        label.textContent = '¡ENVIADO!';

        overlay.appendChild(img);
        overlay.appendChild(label);
        document.body.appendChild(overlay);

        var timer = setTimeout(function () { overlay.remove(); }, GIF_DURATION_MS);
        overlay.addEventListener('click', function () { clearTimeout(timer); overlay.remove(); });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    function matchesList(list, model, method) {
        for (var i = 0; i < list.length; i++) {
            if (list[i].model === model && list[i].method === method) return true;
        }
        return false;
    }

    /**
     * Extrae modelo y método de la llamada fetch.
     * Odoo 17+ puede codificarlos en la URL (/web/dataset/call_kw/model/method)
     * o en el body JSON (params.model / params.method).
     */
    function extractModelMethod(url, rawBody) {
        // Intento 1: en la URL  →  /web/dataset/call_kw/sale.order/action_confirm
        var urlMatch = url.match(/\/web\/dataset\/call_kw\/([^/?#]+)\/([^/?#\s]+)/);
        if (urlMatch) return { model: urlMatch[1], method: urlMatch[2] };

        // Intento 2: en el body JSON
        if (rawBody && typeof rawBody === 'string') {
            try {
                var body = JSON.parse(rawBody);
                var p = body && body.params;
                if (p && p.model && p.method) return { model: p.model, method: p.method };
            } catch (e) { /* ignorar */ }
        }

        return null;
    }

    function checkSuccess(clonedResponse, callback) {
        clonedResponse.json().then(function (data) {
            if (data && data.result !== undefined) callback();
        }).catch(function () { /* ignorar */ });
    }

    // ── Interceptar window.fetch ──────────────────────────────────────────────
    var originalFetch = window.fetch;

    window.fetch = function () {
        var args = Array.prototype.slice.call(arguments);
        var promise = originalFetch.apply(this, args);

        promise.then(function (response) {
            try {
                var url = args[0] instanceof Request ? args[0].url : String(args[0] || '');
                if (url.indexOf('/web/dataset/call_kw') === -1) return;

                var rawBody = args[1] && args[1].body;
                var info = extractModelMethod(url, rawBody);
                if (!info) return;

                var model  = info.model;
                var method = info.method;

                log('call_kw →', model, '::', method);

                if (matchesList(DIRECT_TRIGGERS, model, method)) {
                    checkSuccess(response.clone(), showKaratekaGif);

                } else if (matchesList(WIZARD_OPENERS, model, method)) {
                    checkSuccess(response.clone(), function () {
                        log('Bandera activada, esperando wizard...');
                        pendingKarateka = true;
                    });

                } else if (pendingKarateka && matchesList(WIZARD_SENDERS, model, method)) {
                    checkSuccess(response.clone(), function () {
                        pendingKarateka = false;
                        showKaratekaGif();
                    });
                }
            } catch (e) {
                log('Error en interceptor:', e);
            }
        });

        return promise;
    };

    window.addEventListener('hashchange', function () { pendingKarateka = false; });

    log('Módulo cargado — fetch interceptado ✓');

})();
