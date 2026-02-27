/**
 * Karateka GIF – Econovex (entorno test)
 *
 * Muestra un GIF de karateka cuando:
 *  - Se envía una factura de cliente (account.move → send wizard)
 *  - Se envía un presupuesto de ventas (sale.order → mail wizard)
 *  - Se confirma una venta (sale.order → action_confirm)
 *
 * Estrategia: interceptar window.fetch para detectar llamadas RPC a los
 * métodos Odoo relevantes (/web/dataset/call_kw) sin tocar componentes OWL.
 */
(function () {
    'use strict';

    // ── Ruta del GIF ──────────────────────────────────────────────────────────
    var GIF_URL = '/econovex_karateka/static/src/img/karateka.gif';
    var GIF_DURATION_MS = 3500;

    // ── Acciones que ABREN un wizard de envío (activan la bandera) ────────────
    //    El GIF se mostrará cuando el wizard confirme el envío.
    var WIZARD_OPENERS = [
        { model: 'sale.order',    method: 'action_quotation_send' },
        { model: 'account.move',  method: 'action_send_and_print' },
    ];

    // ── Acciones dentro del wizard que ejecutan el envío real ─────────────────
    var WIZARD_SENDERS = [
        // Wizard de redacción de correo (presupuestos de venta)
        { model: 'mail.compose.message', method: 'action_send_mail' },
        // Wizard de envío de facturas (Odoo 17+: account.move.send)
        { model: 'account.move.send',    method: 'action_send_and_print' },
        { model: 'account.move.send',    method: 'action_send' },
    ];

    // ── Acciones directas (sin wizard) ────────────────────────────────────────
    var DIRECT_TRIGGERS = [
        { model: 'sale.order', method: 'action_confirm' },
    ];

    // Bandera para saber si se abrió un wizard de envío
    var pendingKarateka = false;

    // ── Inyectar CSS del overlay ──────────────────────────────────────────────
    var style = document.createElement('style');
    style.textContent = [
        '#karatekaOverlay {',
        '  position: fixed;',
        '  inset: 0;',
        '  background: rgba(0, 0, 0, 0.6);',
        '  z-index: 99999;',
        '  display: flex;',
        '  align-items: center;',
        '  justify-content: center;',
        '  cursor: pointer;',
        '  animation: karatekaFadeIn 0.25s ease;',
        '}',
        '@keyframes karatekaFadeIn {',
        '  from { opacity: 0; transform: scale(0.9); }',
        '  to   { opacity: 1; transform: scale(1);   }',
        '}',
        '#karatekaOverlay img {',
        '  max-width: 80vw;',
        '  max-height: 80vh;',
        '  border-radius: 12px;',
        '  box-shadow: 0 24px 64px rgba(0,0,0,0.6);',
        '}',
    ].join('\n');
    document.head.appendChild(style);

    // ── Mostrar el GIF ────────────────────────────────────────────────────────
    function showKaratekaGif() {
        if (document.getElementById('karatekaOverlay')) return;

        var overlay = document.createElement('div');
        overlay.id = 'karatekaOverlay';

        var img = document.createElement('img');
        // ?t= fuerza al navegador a recargar el GIF desde el inicio cada vez
        img.src = GIF_URL + '?t=' + Date.now();
        img.alt = '¡KARATEKA!';
        img.onerror = function () { overlay.remove(); };

        overlay.appendChild(img);
        document.body.appendChild(overlay);

        var timer = setTimeout(function () { overlay.remove(); }, GIF_DURATION_MS);
        overlay.addEventListener('click', function () {
            clearTimeout(timer);
            overlay.remove();
        });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    function matchesList(list, model, method) {
        for (var i = 0; i < list.length; i++) {
            if (list[i].model === model && list[i].method === method) return true;
        }
        return false;
    }

    function checkSuccess(clonedResponse, callback) {
        clonedResponse.json().then(function (data) {
            // Odoo devuelve { result: ... } en éxito y { error: ... } en fallo
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
                if (!rawBody || typeof rawBody !== 'string') return;

                var body   = JSON.parse(rawBody);
                var model  = body && body.params && body.params.model;
                var method = body && body.params && body.params.method;
                if (!model || !method) return;

                if (matchesList(DIRECT_TRIGGERS, model, method)) {
                    // Confirmación de venta: mostrar GIF al completar
                    checkSuccess(response.clone(), showKaratekaGif);

                } else if (matchesList(WIZARD_OPENERS, model, method)) {
                    // El botón abre un wizard: activar bandera si el RPC tiene éxito
                    checkSuccess(response.clone(), function () {
                        pendingKarateka = true;
                    });

                } else if (pendingKarateka && matchesList(WIZARD_SENDERS, model, method)) {
                    // El wizard confirma el envío: mostrar GIF y limpiar bandera
                    checkSuccess(response.clone(), function () {
                        pendingKarateka = false;
                        showKaratekaGif();
                    });
                }
            } catch (e) {
                // Nunca interrumpir el funcionamiento normal de Odoo
            }
        });

        return promise;
    };

    // Resetear bandera si el usuario navega (por si cierra el wizard sin enviar)
    window.addEventListener('hashchange', function () { pendingKarateka = false; });

})();
