// EXTERNAL JS - SHELL

// Listener silenzioso per messaggi Chrome Extension (VS Code)
if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    sendResponse({success: true});
    return true;
  });
}

function initializeShell() {
  const frame = document.getElementById('appFrame');
  const toastEl = document.getElementById('shellToast');
  let isFrameReady = false;
  
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
      busEmit('rsa:chiamata', { targa: 'AB123CD', posizione: 'A8 km 12 direzione Milano', tipo: 'guasto meccanico' });
      showShellToast('Chiamata soccorso RSA inviata al CRM');
    });
  }

  // MEMO — scadenza imminente
  const btnMemoScadenza = document.getElementById('btnMemoScadenza');
  if (btnMemoScadenza) {
    btnMemoScadenza.addEventListener('click', () => {
      busEmit('memo:scadenza', { tipo: 'bollo', targa: 'AB123CD', data: '2026-05-31' });
      showShellToast('Scadenza bollo inviata al CRM');
    });
  }

  // boot: carica impostazioni salvate e avvia app
  loadSavedSettings();
  loadAppFrame(currentSettings.iframeUrl);
}


// Inizializza quando il DOM è pronto
document.addEventListener('DOMContentLoaded', initializeShell);
