/**
 * bus.js — Event Bus condiviso Enilive
 * Comunicazione cross-tab tramite BroadcastChannel + fallback localStorage.
 *
 * API:
 *   Bus.emit('evento:nome', payload)
 *   Bus.on('evento:nome', handler)
 *   Bus.off('evento:nome', handler)
 *
 * Utility:
 *   syncVeicoli(record)          — mantiene veicoli[] in sync con dispositivi[]/serviziRsa[]
 *   migrateClienteRecord(record) — migra old-schema → new-schema (idempotente)
 *
 * Catalogo eventi:
 *   cliente:registrato        | tablet → app, crm         | { nome, cf, targhe[], dataRegistrazione }
 *   servizio:attivato         | tablet, app → crm         | { servizio, targa, veicoloId, data }
 *   servizio:disattivato      | app → crm                 | { servizio, targa, veicoloId, data }
 *   pagamento:confermato      | app, emulatore → crm      | { cf, movimento, servizio, importo, metodo, data }
 *   sosta:avviata             | app → crm                 | { zona, targa, durata }
 *   sosta:terminata           | app → crm                 | { zona, targa, importo }
 *   rsa:chiamata              | app → crm                 | { targa, posizione, tipo }
 *   memo:scadenza             | app → crm                 | { tipo, targa, data }
 *   crm:aggiornato            | crm → app                 | { campo, valore }
 *   crm:movimento_aggiornato  | crm → app, emulatore      | { cf, id, ...campiAggiornati } — usato per disconoscimento transiti
 *   scenario:trigger          | emulatore → app           | { nome, params }
 *   sms:outbound              | tablet → emulatore        | { id, to, template, preview, documenti?, dati? }
 *   documento:firmato         | app (webview) → tablet    | { template }
 *   cliente:cambiato          | emulatore → app, crm      | { cf }
 *   cliente:profilo_aggiornato| tablet, emulatore → app   | profilo aggiornato (triggera reload iframe)
 *   email:outbound            | tablet → (mock)           | { id, to, template, subject, otpCode, nome, preview }
 *   dispositivo:sostituito    | tablet → crm              | { cf, obu_vecchio, obu_nuovo, motivo }
 *   fattura:emessa            | tablet → crm              | { cf, fattura }
 *   assistenza:caso_aperto    | tablet → crm              | { cf, caso }
 *
 * SMS template aggiuntivi (non-OTP):
 *   RESET_PASSWORD            | sms:outbound to: email    | link mock reset password
 */

/**
 * syncVeicoli — assicura che ogni veicoloId referenziato in contratti[].dispositivi[]
 * e serviziRsa[] abbia un corrispondente entry in veicoli[]. Mutates record in-place.
 * @param {object} record — ClienteRecord (new-schema)
 * @returns {object} record
 */
function syncVeicoli(record) {
  const referencedIds = new Set([
    ...(record.contratti || []).flatMap(c => [
      ...(c.dispositivi || []).map(d => d.veicoloId),
      ...(c.serviziRsa  || []).map(r => r.veicoloId),
    ].filter(Boolean)),
  ]);
  const existingIds = new Set((record.veicoli || []).map(v => v.id));
  referencedIds.forEach(id => {
    if (!existingIds.has(id)) {
      const targa = id.replace(/^v_/, '');
      if (!record.veicoli) record.veicoli = [];
      record.veicoli.push({ id, targa, tipo: 'Auto', marca: '', modello: '', scadenze: {} });
    }
  });
  return record;
}

/** @deprecated — usa syncVeicoli */
function syncTargheGlobali(record) { return syncVeicoli(record); }

/**
 * migrateClienteRecord — converte un ClienteRecord old-schema nel nuovo formato.
 * Idempotente: se record.veicoli è già un array, restituisce il record invariato.
 * @param {object} r — ClienteRecord (old o new schema)
 * @returns {object} r migrato (same reference, mutato in-place)
 */
function migrateClienteRecord(r) {
  if (!r) return r;

  // v1→v2: solo se veicoli non è ancora un array
  if (!Array.isArray(r.veicoli)) {
    // 1. Raccoglie targhe RSA PRIMA di mutare i contratti
    const rsaTarghe = new Set([
      ...(r.serviziAttivi?.rsa?.targhe || []).map(t => t.toUpperCase()),
      ...(r.contratti || []).flatMap(c => (c.obu || []).filter(o => o.rsa).map(o => (o.targa || '').toUpperCase()).filter(Boolean)),
      ...(r.contratti || []).flatMap(c => (c.rsaStandalone || []).map(s => (s.targa || '').toUpperCase()).filter(Boolean)),
    ].filter(Boolean));

    // 2. Costruisce veicoli[] da targhe[]
    r.veicoli = (r.targhe || []).filter(Boolean).map(t => ({
      id: 'v_' + t.toUpperCase(),
      targa: t.toUpperCase(),
      tipo: 'Auto', marca: '', modello: '', scadenze: {},
    }));

    // 3. Migra contratti: obu[] + rsaStandalone[] → dispositivi[]
    (r.contratti || []).forEach(c => {
      c.dispositivi = [
        ...(c.obu || []).map(o => ({
          tipo: 'obu',
          codice: o.codice || '',
          veicoloId: 'v_' + (o.targa || '').toUpperCase(),
          furtoSmarrimento: !!o.furto,
          stato: o.stato || 'attivo',
        })),
        ...(c.rsaStandalone || []).map(s => ({
          tipo: 'rsa_standalone',
          codice: '',
          veicoloId: 'v_' + (s.targa || '').toUpperCase(),
          furtoSmarrimento: false,
          stato: 'attivo',
        })),
      ];
      c.dataAttivazione = c.dataCreazione || r.dataRegistrazione || new Date().toISOString();
      delete c.obu; delete c.rsaStandalone; delete c.dataCreazione;
    });

    // 4. Costruisce serviziRsa[] temporaneo (verrà spostato in contratti da v2→v3 subito sotto)
    let rsaIdx = 1;
    r.serviziRsa = [...rsaTarghe].map(t => ({
      id: 'rsa_' + String(rsaIdx++).padStart(3, '0'),
      veicoloId: 'v_' + t,
      tipo: 'assistenza_stradale',
      stato: 'attivo',
      costo: 2.00,
    }));

    // 5. Nidifica contatti e indirizzo
    r.contatti = { telefono: r.telefono || '', email: r.email || '' };
    const oldInd = r.indirizzo;
    r.indirizzo = {
      via:    (typeof oldInd === 'string' ? oldInd : '') || '',
      civico: r.civico    || '',
      comune: r.comune    || '',
      prov:   r.provincia || '',
      cap:    r.cap       || '',
    };
    delete r.telefono; delete r.email;
    delete r.civico; delete r.comune; delete r.provincia; delete r.cap; delete r.stato;

    // 6. Riduce serviziAttivi (areac/parcheggi rimossi da v2→v3 subito sotto)
    r.serviziAttivi = {
      areac:      r.serviziAttivi?.areac      || { attivo: false },
      parcheggi:  r.serviziAttivi?.parcheggi  || { attivo: false },
      strisceBlu: r.serviziAttivi?.strisceBlu || { attivo: false },
      memo:       r.serviziAttivi?.memo       || { attivo: false },
    };

    // 7. Aggiunge veicoloId ai movimenti (mantiene targa per display)
    (r.movimenti || []).forEach(m => {
      if (m.targa && !m.veicoloId) m.veicoloId = 'v_' + m.targa.toUpperCase();
    });

    // 8. Rimuove targhe[] (rimpiazzata da veicoli[])
    delete r.targhe;
  }

  // v2→v3: sposta serviziRsa[] root → contratti[].serviziRsa[], areac/parcheggi → dispositivi[].serviziAbilitati
  if (!r._v3migrated) {
    const rsaRoot = r.serviziRsa || [];
    (r.contratti || []).forEach(c => {
      if (!c.serviziRsa) c.serviziRsa = [];
      rsaRoot.forEach(rsa => {
        const inObu    = (c.dispositivi || []).some(d => d.veicoloId === rsa.veicoloId);
        const inRsaDev = (c.dispositivi || []).some(d => d.tipo === 'rsa_standalone' && d.veicoloId === rsa.veicoloId);
        if (inObu || inRsaDev) {
          c.serviziRsa.push({ id: rsa.id, veicoloId: rsa.veicoloId, stato: rsa.stato, costo: rsa.costo });
        }
      });
      const rsaDev = (c.dispositivi || []).filter(d => d.tipo === 'rsa_standalone');
      rsaDev.forEach(d => {
        const alreadyPresent = c.serviziRsa.some(rs => rs.veicoloId === d.veicoloId);
        if (!alreadyPresent) {
          c.serviziRsa.push({ id: 'rsa_mig_' + d.veicoloId, veicoloId: d.veicoloId, stato: d.stato || 'attivo', costo: 2.00 });
        }
      });
      c.dispositivi = (c.dispositivi || []).filter(d => d.tipo !== 'rsa_standalone');
      const acVal = r.serviziAttivi?.areac?.attivo     || false;
      const pgVal = r.serviziAttivi?.parcheggi?.attivo || false;
      (c.dispositivi || []).forEach(d => {
        if (!d.serviziAbilitati) {
          d.serviziAbilitati = { areac: { attivo: acVal }, parcheggi: { attivo: pgVal } };
        }
      });
    });
    delete r.serviziRsa;
    if (r.serviziAttivi) {
      delete r.serviziAttivi.areac;
      delete r.serviziAttivi.parcheggi;
    }
    r._v3migrated = true;
  }

  // Default telefonoVerificato per record esistenti (idempotente)
  if (!r.telefonoVerificato || typeof r.telefonoVerificato !== 'object') {
    r.telefonoVerificato = { verificato: false, numero: null, data: null };
  }

  // Default emailVerificata per record esistenti (idempotente)
  if (!r.emailVerificata || typeof r.emailVerificata !== 'object') {
    r.emailVerificata = { verificata: false, email: null, data: null };
  }

  return r;
}

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

    // Fallback: rileva eventi da localStorage SOLO se BroadcastChannel non è disponibile
    // o non ha ancora consegnato l'evento (browser legacy). Se BroadcastChannel funziona
    // questo handler NON deve scattare per evitare dispatch doppi cross-tab.
    let _bcSupported = true; // BroadcastChannel è nativo in tutti i browser target
    window.addEventListener('storage', (e) => {
        if (_bcSupported) return; // BroadcastChannel gestisce la consegna — skip fallback
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
