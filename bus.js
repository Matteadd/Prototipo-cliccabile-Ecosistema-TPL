/**
 * bus.js — Event Bus condiviso Enilive
 * Comunicazione cross-tab tramite BroadcastChannel + fallback localStorage.
 *
 * API:
 *   Bus.emit('evento:nome', payload)
 *   Bus.on('evento:nome', handler)
 *   Bus.off('evento:nome', handler)
 *
 * Catalogo eventi:
 *   cliente:registrato    | tablet → app, crm  | { nome, cf, targa, servizi[] }
 *   servizio:attivato     | tablet, app → crm  | { servizio, targa, data }
 *   servizio:disattivato  | app → crm          | { servizio, targa, data }
 *   pagamento:confermato  | app → crm          | { servizio, importo, metodo, data }
 *   sosta:avviata         | app → crm          | { zona, targa, durata }
 *   sosta:terminata       | app → crm          | { zona, targa, importo }
 *   rsa:chiamata          | app → crm          | { targa, posizione, tipo }
 *   memo:scadenza         | app → crm          | { tipo, targa, data }
 *   crm:aggiornato        | crm → app          | { campo, valore }
 *   scenario:trigger      | emulatore → app    | { nome, params }
 */

const Bus = (() => {
    const CHANNEL_NAME = 'enilive-bus';
    const LS_KEY = 'enilive-bus-last-event';

    // Map<evento, Set<handler>>
    const listeners = new Map();

    // BroadcastChannel per comunicazione cross-tab
    const channel = new BroadcastChannel(CHANNEL_NAME);

    // Ricevi messaggi dall'altro tab
    channel.addEventListener('message', (e) => {
        _dispatch(e.data.event, e.data.payload);
    });

    // Fallback: rileva eventi da localStorage (per browser senza BroadcastChannel)
    window.addEventListener('storage', (e) => {
        if (e.key !== LS_KEY || !e.newValue) return;
        try {
            const { event, payload } = JSON.parse(e.newValue);
            _dispatch(event, payload);
        } catch (_) {}
    });

    /** Notifica i listener locali di questo tab */
    function _dispatch(event, payload) {
        if (!listeners.has(event)) return;
        listeners.get(event).forEach(fn => fn(payload));
    }

    return {
        /**
         * Pubblica un evento su tutti i tab (incluso quello corrente).
         * @param {string} event
         * @param {object} payload
         */
        emit(event, payload = {}) {
            // Notifica altri tab
            channel.postMessage({ event, payload });
            // Fallback localStorage
            localStorage.setItem(LS_KEY, JSON.stringify({ event, payload, _t: Date.now() }));
            // Notifica tab corrente
            _dispatch(event, payload);
        },

        /**
         * Registra un handler per un evento.
         * @param {string} event
         * @param {function} handler
         */
        on(event, handler) {
            if (!listeners.has(event)) listeners.set(event, new Set());
            listeners.get(event).add(handler);
        },

        /**
         * Rimuove un handler.
         * @param {string} event
         * @param {function} handler
         */
        off(event, handler) {
            if (!listeners.has(event)) return;
            listeners.get(event).delete(handler);
        },
    };
})();
