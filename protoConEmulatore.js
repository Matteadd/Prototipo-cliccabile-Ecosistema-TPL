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

  // TELEPEDAGGIO — transito A8
  const btnTpTransito = document.getElementById('btnTpTransito');
  if (btnTpTransito) {
    btnTpTransito.addEventListener('click', () => {
      busEmit('scenario:trigger', { nome: 'tp:transito', casello: 'Milano Nord', autostrada: 'A8', importo: 1.80 });
      showShellToast('Transito A8 Milano Nord simulato');
    });
  }

  // TELEPEDAGGIO — transito A9
  const btnTpTransitoA9 = document.getElementById('btnTpTransitoA9');
  if (btnTpTransitoA9) {
    btnTpTransitoA9.addEventListener('click', () => {
      busEmit('scenario:trigger', { nome: 'tp:transito', casello: 'Como Sud', autostrada: 'A9', importo: 2.40 });
      showShellToast('Transito A9 Como Sud simulato');
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
