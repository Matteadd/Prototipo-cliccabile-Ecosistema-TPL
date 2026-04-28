// EXTERNAL JS - SHELL

// Listener silenzioso per messaggi Chrome Extension (VS Code)
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    sendResponse({success: true});
    return true;
  });
}

function initializeShell() {
  const frame = document.getElementById('appFrame');
  const toastEl = document.getElementById('shellToast');
  let isFrameReady = false;
  let profiloAttivo = null;
  let pendingSmsPayload = null;
  
  // Impostazioni correnti session
  let currentSettings = {
    iframeUrl: 'proto-app.html',
    terminiServizio: false,
    terminiStricheBlu: false
  };

  function showShellToast(text) {
    toastEl.textContent = text;
    toastEl.style.display = 'block';
    clearTimeout(window.__shellToastT);
    window.__shellToastT = setTimeout(() => toastEl.style.display = 'none', 2000);
  }

  function loadAppFrame(url) {
    isFrameReady = false;
    console.log(`Caricamento iframe: ${url}`);
    
    // Carica l'iframe
    frame.src = url;
    
    // Attende che Alpine abbia completato l'inizializzazione
    frame.onload = () => {
      // Polling per verificare se APP è pronto
      let attempts = 0;
      const checkReady = setInterval(() => {
        attempts++;
        try {
          const w = frame.contentWindow;
          // Per proto-app, controlla DEMO e APP
          // Per onboarding, potrebbe non avere DEMO
          if (w && (w.DEMO || w.APP || w.document)) {
            isFrameReady = true;
            clearInterval(checkReady);
            console.log('Content pronto!');
            // Re-emette SMS pendente (dopo ritorno da android-home).
            // w.document è sempre truthy subito dopo il load, ma w.APP viene
            // impostato da Alpine nel suo init() — potrebbe non essere ancora pronto.
            // Quindi facciamo un secondo polling dedicato solo per w.APP.
            if (pendingSmsPayload) {
              const sms = pendingSmsPayload;
              pendingSmsPayload = null;
              let appWaitAttempts = 0;
              const waitForApp = setInterval(() => {
                appWaitAttempts++;
                try {
                  const w2 = frame.contentWindow;
                  if (w2 && w2.APP && typeof w2.APP.smsOpenWebview === 'function') {
                    clearInterval(waitForApp);
                    setTimeout(() => {
                      w2.APP.smsCurrentNotif = sms;
                      w2.APP.smsOpenWebview(sms);
                    }, 200);
                  }
                } catch(e) {}
                if (appWaitAttempts > 30) {
                  clearInterval(waitForApp);
                  console.warn('APP non pronto per SMS webview — timeout');
                }
              }, 100);
            }
          }
        } catch(e) {}
        
        // Timeout dopo 50 tentativi (5 secondi)
        if (attempts > 50) {
          clearInterval(checkReady);
          isFrameReady = true; // Forza ready comunque
          console.warn('Content timeout - forzato ready');
        }
      }, 100);
    };
  }

  // helper: chiama API nell'iframe
  function callInApp(fn, ...args) {
    if (!isFrameReady) {
      console.warn('iframe non è ancora caricato, tentativo comunque...');
    }
    const w = frame.contentWindow;
    if (w && w.DEMO && typeof w.DEMO[fn] === 'function') {
      console.log(`Chiamando DEMO.${fn}(${args})`);
      return w.DEMO[fn](...args);
    }
    console.error(`Funzione DEMO.${fn} non trovata`);
    return false;
  }

  // helper: verifica se c'è una sosta attiva
  function isSbActive() {
    try {
      const w = frame.contentWindow;
      if (w && w.APP && w.APP.sbActive === true) {
        return true;
      }
    } catch(e) {}
    return false;
  }

  // helper: apri la modal Strisce Blu nell'iframe
  function openBlueModalInApp() {
    try {
      const w = frame.contentWindow;
      if (w && w.APP && typeof w.APP.openBlue === 'function') {
        w.APP.openBlue();
        return true;
      }
    } catch(e) {}
    return false;
  }

  // helper: mostra notifica cliccabile (popup notification) DENTRO L'IFRAME
  function showClickableNotification(text, callback) {
    try {
      const w = frame.contentWindow;
      const doc = frame.contentDocument;
      
      if (!w || !doc) return;
      
      const notification = doc.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #117299 0%, #0d4f6f 100%);
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        z-index: 1000;
        max-width: 85%;
        text-align: center;
        animation: slideDown 0.3s ease-out;
      `;
      notification.textContent = text;
      notification.addEventListener('click', () => {
        notification.style.animation = 'slideUp 0.3s ease-in';
        setTimeout(() => notification.remove(), 300);
        if (callback) callback();
      });
      
      // Auto-remove dopo 5 secondi se non cliccato
      const removeTimeout = setTimeout(() => {
        if (notification.parentElement) {
          notification.style.animation = 'slideUp 0.3s ease-in';
          setTimeout(() => notification.remove(), 300);
        }
      }, 5000);
      
      notification.addEventListener('click', () => clearTimeout(removeTimeout));
      doc.body.appendChild(notification);
    } catch(e) {
      console.error('Errore nel mostrare notifica nell\'iframe:', e);
    }
  }

  // BOTTONE: notifica scadenza
  const btnNotify = document.getElementById('btnNotify');
  if (btnNotify) {
    btnNotify.addEventListener('click', () => {
      console.log('Bottone notifica cliccato');
      
      // Controlla se c'è una sosta attiva
      if (!isSbActive()) {
        showShellToast('Nessuna sosta attiva');
        return;
      }
      
      // Mostra notifica cliccabile
      showClickableNotification('Mancano 15 minuti alla scadenza 🛑', () => {
        console.log('Notifica cliccata - apro modal Strisce Blu');
        openBlueModalInApp();
      });
    });
  }

  // BOTTONE: blocca telefono
  const btnLockScreen = document.getElementById('btnLockScreen');
  if (btnLockScreen) {
    btnLockScreen.addEventListener('click', () => {
      console.log('Bottone lock screen cliccato');
      
      // Controlla se c'è una sosta attiva
      if (!isSbActive()) {
        showShellToast('Nessuna sosta attiva');
        return;
      }
      
      showShellToast('Schermo bloccato');
      // Chiama sbShowLockScreen senza parametri (usa il timer reale della sosta)
      const w = frame.contentWindow;
      if (w && w.APP && typeof w.APP.sbShowLockScreen === 'function') {
        w.APP.sbShowLockScreen();
      }
    });
  }

  // SEZIONE IMPOSTAZIONI SCENARI
  const iframeSelect = document.getElementById('iframeSelect');
  const chkTerminiServizio = document.getElementById('chkTerminiServizio');
  const chkTerminiStricheBlu = document.getElementById('chkTerminiStricheBlu');
  const btnLoadSettings = document.getElementById('btnLoadSettings');

  // Carica le impostazioni salvate
  function loadSavedSettings() {
    const saved = localStorage.getItem('scenarioSettings');
    if (saved) {
      try {
        const settings = JSON.parse(saved);
        currentSettings = settings;
        
        if (iframeSelect) iframeSelect.value = settings.iframeUrl;
        if (chkTerminiServizio) chkTerminiServizio.checked = settings.terminiServizio;
        if (chkTerminiStricheBlu) chkTerminiStricheBlu.checked = settings.terminiStricheBlu;
      } catch(e) {
        console.error('Errore nel caricamento impostazioni:', e);
      }
    }
  }

  // Salva le impostazioni in localStorage
  function saveSettings() {
    const settings = {
      iframeUrl: iframeSelect.value,
      terminiServizio: chkTerminiServizio.checked,
      terminiStricheBlu: chkTerminiStricheBlu.checked
    };
    currentSettings = settings;
    localStorage.setItem('scenarioSettings', JSON.stringify(settings));
    console.log('Impostazioni salvate:', settings);
  }

  // Selettore cliente da localStorage
  function loadClientiSelector() {
    const listEl  = document.getElementById('clienteList');
    const emptyEl = document.getElementById('clienteListEmpty');
    if (!listEl) return;

    let reg = {};
    try { reg = JSON.parse(localStorage.getItem('clientiDemo') || '{}'); } catch(_) {}

    const clienti = Object.values(reg);
    listEl.innerHTML = '';

    if (clienti.length === 0) {
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';

    const cfAttivo = (localStorage.getItem('clienteAttivo') || '').toUpperCase();

    try {
      const raw = localStorage.getItem('clienteProfile');
      if (raw) {
        const parsed = JSON.parse(raw);
        if ((parsed.cf || '').toUpperCase() === cfAttivo) profiloAttivo = parsed;
      }
    } catch(_) {}

    clienti.forEach(c => {
      const cf    = (c.cf || '').toUpperCase();
      const label = [c.nome, c.cognome].filter(Boolean).join(' ') || cf;
      const isActive = cf === cfAttivo;

      const btn = document.createElement('button');
      btn.textContent = label + (isActive ? ' \u2713' : '');
      btn.title = cf;
      if (isActive) btn.style.cssText = 'background:#117299;color:white;width:100%;margin-bottom:4px;';
      else btn.style.cssText = 'width:100%;margin-bottom:4px;';
      btn.addEventListener('click', () => selezionaCliente(cf));
      listEl.appendChild(btn);
    });
  }

  function selezionaCliente(cf) {
    if (!cf) return;
    localStorage.setItem('clienteAttivo', cf);

    let profilo = null;
    try {
      const raw = localStorage.getItem('clienteProfile');
      if (raw) {
        const parsed = JSON.parse(raw);
        if ((parsed.cf || '').toUpperCase() === cf.toUpperCase()) profilo = parsed;
      }
    } catch(_) {}

    if (!profilo) {
      try {
        const reg = JSON.parse(localStorage.getItem('clientiDemo') || '{}');
        const d   = reg[cf];
        if (d) {
          profilo = {
            nome: [d.nome, d.cognome].filter(Boolean).join(' '),
            cf: d.cf, email: d.email || '', telefono: d.telefono || '',
            targhe: d.targhe || [], // PATCH: era d._targa (campo inesistente nel ClienteRecord)
            contratto1: null, dataRegistrazione: new Date().toISOString(),
          };
          localStorage.setItem('clienteProfile', JSON.stringify(profilo));
        }
      } catch(_) {}
    }

    profiloAttivo = profilo;
    loadClientiSelector();
    busEmit('cliente:cambiato', { cf });

    setTimeout(() => {
      if (frame && frame.src) frame.src = frame.src;
    }, 150);

    showShellToast('Cliente: ' + (profilo?.nome || cf));
  }

  // BOTTONE: Carica Impostazioni
  if (btnLoadSettings) {
    btnLoadSettings.addEventListener('click', () => {
      saveSettings();
      showShellToast('Impostazioni caricate');
      loadAppFrame(currentSettings.iframeUrl);
    });
  }

  // helper: emetti evento bus (funziona anche se Bus è nell'iframe)
  function busEmit(event, payload) {
    if (typeof Bus !== 'undefined') {
      Bus.emit(event, payload);
    } else {
      // fallback: usa il Bus dentro l'iframe
      try {
        frame.contentWindow.Bus.emit(event, payload);
      } catch(e) {
        console.error('Bus non disponibile:', e);
      }
    }
  }

  // ── TELEPEDAGGIO — generatore transiti realistici ──────────────────────────

  /** Dataset tratte autostradali reali */
  const TRATTE_AUTOSTRADALI = [
    // A1 Milano-Napoli
    { id:'A1_MI_BO', concessionaria:"Autostrade per l'Italia", autostrada:'A1', da:'Milano Sud Ovest', a:'Bologna Arcoveggio',  km:210, prezzoBase:14.20 },
    { id:'A1_BO_FI', concessionaria:"Autostrade per l'Italia", autostrada:'A1', da:'Bologna Arcoveggio',  a:'Firenze Impruneta',  km:97,  prezzoBase:7.50  },
    { id:'A1_FI_RM', concessionaria:"Autostrade per l'Italia", autostrada:'A1', da:'Firenze Sud',         a:'Roma Nord',          km:274, prezzoBase:18.90 },
    { id:'A1_RM_NA', concessionaria:"Autostrade per l'Italia", autostrada:'A1', da:'Roma Sud',            a:'Napoli Nord',        km:212, prezzoBase:14.80 },
    // A4 Torino-Trieste
    { id:'A4_TO_MI', concessionaria:"Autostrade per l'Italia", autostrada:'A4', da:'Torino Est',          a:'Milano Est',         km:128, prezzoBase:8.60  },
    { id:'A4_MI_VR', concessionaria:"Autostrade per l'Italia", autostrada:'A4', da:'Milano Est',          a:'Verona Est',         km:158, prezzoBase:10.40 },
    { id:'A4_VR_VE', concessionaria:"Autostrade per l'Italia", autostrada:'A4', da:'Verona Est',          a:'Venezia Mestre',     km:113, prezzoBase:7.20  },
    { id:'A4_VE_TS', concessionaria:'Autovie Venete',          autostrada:'A4', da:'Venezia Est',         a:'Trieste Lisert',     km:151, prezzoBase:9.80  },
    // A7
    { id:'A7_MI_GE', concessionaria:"Autostrade per l'Italia", autostrada:'A7', da:'Milano Ovest',        a:'Genova Ovest',       km:142, prezzoBase:9.10  },
    // A8
    { id:'A8_MI_VA', concessionaria:"Autostrade per l'Italia", autostrada:'A8', da:'Milano Fieramilano',  a:'Varese',             km:48,  prezzoBase:2.90  },
    // A14
    { id:'A14_BO_AN', concessionaria:"Autostrade per l'Italia", autostrada:'A14', da:'Bologna San Lazzaro', a:'Ancona Nord',      km:213, prezzoBase:14.50 },
    { id:'A14_AN_BA', concessionaria:"Autostrade per l'Italia", autostrada:'A14', da:'Ancona Sud',           a:'Bari Nord',        km:384, prezzoBase:26.30 },
    // A22 Brennero
    { id:'A22_BR_TN', concessionaria:'Autostrada del Brennero', autostrada:'A22', da:'Brennero',           a:'Trento Nord',       km:101, prezzoBase:8.40  },
    { id:'A22_TN_VR', concessionaria:'Autostrada del Brennero', autostrada:'A22', da:'Trento Nord',        a:'Verona Nord',       km:118, prezzoBase:9.20  },
    // A26
    { id:'A26_VO_AL', concessionaria:"Autostrade per l'Italia", autostrada:'A26', da:'Voltri',             a:'Alessandria Nord',  km:100, prezzoBase:7.10  },
    // Tangenziali
    { id:'TANG_MI',   concessionaria:'Serravalle',              autostrada:'Tangenziale Milano', da:'Viale Certosa', a:'Viale Forlanini', km:32, prezzoBase:1.80 },
    { id:'A56_NA',    concessionaria:"Autostrade per l'Italia", autostrada:'A56 Tangenziale Napoli', da:'Capodichino', a:'Pozzuoli',       km:20, prezzoBase:1.20 },
  ];

  /**
   * Restituisce la targa del primo OBU attivo trovato nei contratti del cliente.
   * Itera contratti[] → dispositivi[] filtrando tipo==='obu' && stato==='attivo',
   * poi cerca il veicoloId corrispondente in veicoli[].
   * @param {object} cliente — ClienteRecord
   * @returns {string|null}
   */
  function primaTargaConObu(cliente) {
    if (!cliente) return null;
    for (const contratto of (cliente.contratti || [])) {
      for (const disp of (contratto.dispositivi || [])) {
        if (disp.tipo === 'obu' && disp.stato === 'attivo' && disp.veicoloId) {
          const veicolo = (cliente.veicoli || []).find(v => v.id === disp.veicoloId);
          if (veicolo && veicolo.targa) return veicolo.targa;
        }
      }
    }
    return null;
  }

  /**
   * Genera un movimento transito casello casuale basato su tratte reali.
   * @param {string} cf — codice fiscale cliente (UPPERCASE)
   * @returns {object} movimento pronto per clientiDemo[cf].movimenti[]
   */
  function generaTransitoRandom(cf) {
    const tratta = TRATTE_AUTOSTRADALI[Math.floor(Math.random() * TRATTE_AUTOSTRADALI.length)];
    const variazione = 0.80 + Math.random() * 0.40; // ±20%
    const importo = -(Math.round(tratta.prezzoBase * variazione * 100) / 100);
    const ora = new Date();
    ora.setMinutes(ora.getMinutes() - Math.floor(Math.random() * 180));

    let clientiReg = {};
    try { clientiReg = JSON.parse(localStorage.getItem('clientiDemo') || '{}'); } catch(_) {}
    const cliente = clientiReg[cf] || null;
    const targa = primaTargaConObu(cliente) || 'XX000XX';
    const veicoloId = targa !== 'XX000XX' ? ('v_' + targa.toUpperCase()) : null;

    return {
      id: 'TR_' + Date.now(),
      data: ora.toISOString(),
      tipo: 'casello',
      servizio: 'telepedaggio',
      importo: importo,
      targa: targa,
      veicoloId: veicoloId,
      stato: 'completato',
      descrizione: tratta.autostrada + ' ' + tratta.da + ' → ' + tratta.a,
      dettagli: {
        autostrada: tratta.autostrada,
        concessionaria: tratta.concessionaria,
        caselloIngresso: tratta.da,
        caselloUscita: tratta.a,
        km: tratta.km,
        classe: 'A',
      },
    };
  }

  /**
   * Mostra nel pannello emulatore un riepilogo visivo del transito appena generato.
   * @param {object} transito — movimento generato
   */
  function mostraRiepilogoTransito(transito) {
    const el = document.getElementById('tpTransitoResult');
    if (!el) return;
    const d = transito.dettagli || {};
    const ora = new Date(transito.data).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    const importoFmt = Math.abs(transito.importo).toFixed(2).replace('.', ',');
    el.innerHTML =
      '<strong>' + (d.autostrada || '') + '</strong> &nbsp;' + ora + '<br>' +
      (d.caselloIngresso || '') + ' &rarr; ' + (d.caselloUscita || '') + '<br>' +
      (d.km ? d.km + '&thinsp;km &nbsp;&bull;&nbsp; ' : '') +
      'Classe&thinsp;' + (d.classe || 'A') + '<br>' +
      '<span style="color:#4fc3f7;font-weight:700;">&#8722;&euro;&thinsp;' + importoFmt + '</span>' +
      ' &nbsp;| ' + (transito.targa || '') + '<br>' +
      '<span style="opacity:0.7;font-size:10px;">' + (d.concessionaria || '') + '</span>';
    el.style.display = 'block';
  }

  // BOTTONE: Simula transito casello (generatore realistico)
  const btnTpTransito = document.getElementById('btnTpTransito');
  if (btnTpTransito) {
    btnTpTransito.addEventListener('click', () => {
      // Recupera CF cliente attivo
      const cf = (localStorage.getItem('clienteAttivo') || '').toUpperCase();
      if (!cf) {
        showShellToast('Nessun cliente attivo selezionato');
        return;
      }

      // Genera transito casuale
      const transito = generaTransitoRandom(cf);

      // Persiste in clientiDemo[cf].movimenti[]
      let clientiReg = {};
      try { clientiReg = JSON.parse(localStorage.getItem('clientiDemo') || '{}'); } catch(_) {}
      if (!clientiReg[cf]) {
        showShellToast('Cliente non trovato in clientiDemo');
        return;
      }
      if (!Array.isArray(clientiReg[cf].movimenti)) clientiReg[cf].movimenti = [];
      clientiReg[cf].movimenti.unshift(transito);
      try { localStorage.setItem('clientiDemo', JSON.stringify(clientiReg)); } catch(_) {}

      // Emette pagamento:confermato verso CRM e altri listener
      busEmit('pagamento:confermato', {
        cf: cf,
        movimento: transito,
        servizio: 'telepedaggio',
        importo: transito.importo,
        metodo: 'obu',
        data: transito.data,
      });

      // Mostra riepilogo visivo nel pannello
      mostraRiepilogoTransito(transito);

      const trattaLabel = (transito.dettagli.autostrada || '') + ' ' +
                          (transito.dettagli.caselloIngresso || '') + ' → ' +
                          (transito.dettagli.caselloUscita || '');
      showShellToast('Transito ' + trattaLabel + ' simulato');
    });
  }

  // Listener disconoscimento transito: aggiorna stato movimento in clientiDemo.
  // Agganciato all'evento crm:movimento_aggiornato — emesso dal CRM quando operatore
  // contesta/disconosce un movimento (imposta stato='disconosciuto', contestato=true).
  // Il CRM dovrebbe emettere: Bus.emit('crm:movimento_aggiornato', { cf, id: movId, stato: 'disconosciuto', contestato: true })
  if (typeof Bus !== 'undefined') {
    Bus.on('crm:movimento_aggiornato', (p) => {
      if (!p || !p.cf || !p.id) return;
      const cf = (p.cf || '').toUpperCase();
      let clientiReg = {};
      try { clientiReg = JSON.parse(localStorage.getItem('clientiDemo') || '{}'); } catch(_) {}
      const cliente = clientiReg[cf];
      if (!cliente || !Array.isArray(cliente.movimenti)) return;
      const mov = cliente.movimenti.find(m => m.id === p.id);
      if (!mov) return;
      // Applica tutti i campi aggiornati dal CRM (stato, contestato, ecc.)
      Object.assign(mov, p);
      delete mov.cf; // cf non appartiene al singolo movimento
      try { localStorage.setItem('clientiDemo', JSON.stringify(clientiReg)); } catch(_) {}
    });
  }

  // AREA C — transito ZTL
  const btnAcTransito = document.getElementById('btnAcTransito');
  if (btnAcTransito) {
    btnAcTransito.addEventListener('click', () => {
      busEmit('scenario:trigger', { nome: 'ac:transito' });
      showShellToast('Transito Area C simulato');
    });
  }

  // PARCHEGGI — ingresso
  const btnPgAccesso = document.getElementById('btnPgAccesso');
  if (btnPgAccesso) {
    btnPgAccesso.addEventListener('click', () => {
      busEmit('scenario:trigger', { nome: 'pg:accesso', parcheggio: 'Parking Centro Milano' });
      showShellToast('Ingresso parcheggio simulato');
    });
  }

  // PARCHEGGI — uscita (aggiorna il primo accesso in_corso)
  const btnPgUscita = document.getElementById('btnPgUscita');
  if (btnPgUscita) {
    btnPgUscita.addEventListener('click', () => {
      busEmit('scenario:trigger', { nome: 'pg:uscita', durata: '1h 30m', importo: 3.00 });
      showShellToast('Uscita parcheggio simulata');
    });
  }

  // RSA — chiamata soccorso
  const btnRsaChiamata = document.getElementById('btnRsaChiamata');
  if (btnRsaChiamata) {
    btnRsaChiamata.addEventListener('click', () => {
      busEmit('rsa:chiamata', { targa: profiloAttivo?.targhe?.[0] || 'AB123CD', posizione: 'A8 km 12 direzione Milano', tipo: 'guasto meccanico' });
      showShellToast('Chiamata soccorso RSA inviata al CRM');
    });
  }

  // MEMO — scadenza imminente
  const btnMemoScadenza = document.getElementById('btnMemoScadenza');
  if (btnMemoScadenza) {
    btnMemoScadenza.addEventListener('click', () => {
      busEmit('memo:scadenza', { tipo: 'bollo', targa: profiloAttivo?.targhe?.[0] || 'AB123CD', data: '2026-05-31' });
      showShellToast('Scadenza bollo inviata al CRM');
    });
  }

  // SMS / Documenti — apre il webview direttamente nell'app senza passare per android-home
  function openSmsWebviewInApp(template) {
    const payload = {
      id: 'sms_demo_' + template.toLowerCase(),
      to: profiloAttivo?.telefono || '+39 333 0000000',
      template: template,
      preview: template === 'OTP_CONSENSI'
        ? 'Conferma i tuoi dati e accetta i documenti Enilive: [link mock]'
        : 'Firma il tuo contratto Enilive: [link mock]',
      documenti: template === 'OTP_CONSENSI'
        ? ['informativa_precontrattuale', 'norme_memo', 'privacy']
        : [],
      dati: template === 'FIRMA_CONTRATTO' ? {
        nome: profiloAttivo ? (profiloAttivo.nome + ' ' + profiloAttivo.cognome) : 'Cliente Demo',
        cf: profiloAttivo?.cf || 'DEMO0000000000',
        bundle: 'obu_standalone',
        totale: 4.50,
      } : undefined,
    };

    const callWebview = (w) => {
      w.APP.smsCurrentNotif = payload;
      w.APP.smsOpenWebview(payload);
      showShellToast('Webview ' + template + ' aperta');
    };

    const w = frame.contentWindow;
    if (w && w.APP && typeof w.APP.smsOpenWebview === 'function') {
      callWebview(w);
    } else {
      // proto-app non ancora caricata: carica e aspetta APP
      if (!frame.src || !frame.src.includes('proto-app')) {
        loadAppFrame('proto-app.html');
      }
      let attempts = 0;
      const wait = setInterval(() => {
        attempts++;
        try {
          const w2 = frame.contentWindow;
          if (w2 && w2.APP && typeof w2.APP.smsOpenWebview === 'function') {
            clearInterval(wait);
            setTimeout(() => callWebview(w2), 200);
          }
        } catch(e) {}
        if (attempts > 30) clearInterval(wait);
      }, 100);
    }
  }

  const btnSmsInformativa = document.getElementById('btnSmsInformativa');
  if (btnSmsInformativa) {
    btnSmsInformativa.addEventListener('click', () => openSmsWebviewInApp('OTP_CONSENSI'));
  }
  const btnSmsContratto = document.getElementById('btnSmsContratto');
  if (btnSmsContratto) {
    btnSmsContratto.addEventListener('click', () => openSmsWebviewInApp('FIRMA_CONTRATTO'));
  }

  // Torna all'app dopo aver visto la notifica su android-home
  // Chiamato da android-home.html via window.parent.tornaAllApp(payload)
  function tornaAllApp(smsPayload) {
    pendingSmsPayload = smsPayload || null;
    loadAppFrame('proto-app.html');
    showShellToast('Apertura app…');
  }
  // Espone la funzione al parent scope (android-home.html la chiama via window.parent)
  window.tornaAllApp = tornaAllApp;

  // Automaticamente: switch a android-home quando arriva un sms:outbound dal tablet
  if (typeof Bus !== 'undefined') {
    Bus.on('sms:outbound', (p) => {
      // Passa il payload via localStorage (android-home lo legge all'avvio)
      try { localStorage.setItem('androidPendingSms', JSON.stringify(p)); } catch(_) {}
      // Switcha l'iframe solo se siamo su proto-app (non su android-home già)
      if (frame && !frame.src.includes('android-home')) {
        loadAppFrame('android-home.html');
        showShellToast('SMS in arrivo — schermata Android');
      }
    });
  }

  // boot: carica impostazioni salvate e avvia app
  loadSavedSettings();
  loadClientiSelector();
  loadAppFrame(currentSettings.iframeUrl);

  // Aggiorna selettore se tablet registra un nuovo cliente in altro tab
  window.addEventListener('storage', (e) => {
    if (e.key === 'clientiDemo' || e.key === 'clienteProfile') loadClientiSelector();
  });
}


// Inizializza quando il DOM è pronto
document.addEventListener('DOMContentLoaded', initializeShell);
