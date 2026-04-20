# Requirements: Strisce Blu — Adeguamento al BUR v6

> Generato da BUR: ELV26-XXX v0.1 — Marzo 2026  
> Da implementare in: `proto-app.html`, `proto-app.css`, `protoConEmulatore.html`, `protoConEmulatore.js`

---

## ⚠️ ATTENZIONE CRITICA — LEGGERE PRIMA DI TUTTO

Il servizio Strisce Blu **è già implementato** nel prototipo con un flow funzionante (modalità wheel/standard/open, timer, lock screen, modal T&C, modal pagamento). Questo file descrive **esclusivamente gli adeguamenti e le integrazioni** da apportare rispetto a quanto già presente.

**Regola fondamentale**: Prima di modificare qualsiasi funzione `sb*` esistente, leggi attentamente l'implementazione corrente. Non spezzare il timer, non rimuovere scenari emulatore esistenti, non cambiare il comportamento di `openBlue()`, `sbStart()`, `confirmSbPayment()`, `sbStop()`, `sbTick()`.

Ogni modifica deve essere chirurgica: aggiungi o estendi, non sostituire blocchi interi.

---

## 1. Panoramica degli adeguamenti richiesti

Il BUR v6 introduce requisiti più dettagliati rispetto all'implementazione attuale su questi aspetti:

1. **Wizard informativo** alla prima apertura del servizio (dopo T&C)
2. **Selezione zona tariffata** con mappa simulata e tariffa dinamica
3. **Selezione veicolo integrata** nel flow di impostazione sosta (con riferimento al Garage)
4. **Selezione metodo di pagamento integrata** nel flow (con riferimento ai Pagamenti Account)
5. **Modifica durata durante sosta attiva** (proroga/riduzione)
6. **Notifica reminder pre-scadenza** già presente come scenario emulatore — verificare e raffinare
7. **Stato sosta "in cronologia"** — aggiungere la sosta appena chiusa alla lista `cronologiaItems`
8. **Feedback di errore pagamento** (carta scaduta, fondi insufficienti) nel modal di conferma

---

## 2. Stato Alpine — Variabili da aggiungere in `x-data`

Aggiungere le seguenti variabili **accanto alle variabili `sb*` esistenti**, non sostituirle:

```javascript
// Strisce Blu — Estensioni BUR v6
sbWizardSeen: false,           // true dopo la prima visualizzazione del wizard
sbShowWizard: false,           // visibilità modal wizard informativo
sbZoneSelected: false,         // flag: zona tariffata selezionata sulla mappa
sbZoneName: 'Zona A',          // nome zona mock (es. "Zona A — Centro")
sbZoneRate: 1.50,              // tariffa oraria mock (€/ora) — attualmente hardcoded in calculateSbPrice()
sbZoneHours: '08:00–20:00',    // orari attivazione zona mock
sbSelectedVehicle: null,       // veicolo selezionato per la sosta (oggetto da garageVehicles)
sbShowVehicleSelector: false,  // visibilità selector veicolo inline nel modal
sbShowExtendModal: false,      // modal modifica durata sosta attiva
sbExtendMinutes: 30,           // minuti aggiuntivi selezionati nel modal estensione
sbPaymentError: false,         // flag errore pagamento (carta scaduta / fondi insufficienti)
sbPaymentErrorMsg: '',         // messaggio errore pagamento da mostrare
```

> **Nota**: `sbZoneRate` sostituisce il valore hardcoded `1.50` in `calculateSbPrice()`. Aggiorna la formula per usare `this.sbZoneRate` invece del literal.

---

## 3. Modifiche alle funzioni Alpine esistenti

### `openBlue()` — Estendere con logica wizard
**Comportamento attuale**: verifica T&C → apre modal.  
**Comportamento nuovo**: dopo il check T&C (e solo se accettati), verificare `sbWizardSeen`:
- Se `false`: impostare `sbShowWizard = true` prima di aprire il flow principale
- Se `true`: procedere normalmente

Non modificare la logica T&C esistente.

### `calculateSbPrice()` — Usare tariffa dinamica
**Modifica**: sostituire il literal `1.50` con `this.sbZoneRate`. Il comportamento del calcolo non cambia.

### `sbStart()` — Aggiungere pre-check veicolo
**Comportamento attuale**: valida targa (min 5 caratteri) → apre payment modal.  
**Comportamento nuovo**: aggiungere pre-check aggiuntivo: se `sbSelectedVehicle === null` e `garageVehicles` è vuoto, mostrare toast "Aggiungi prima un veicolo dal Garage" e bloccare. Se `garageVehicles` ha veicoli ma `sbSelectedVehicle === null`, preselezionare `garageVehicles[0]` e procedere.

> **Non rimuovere** la validazione targa esistente (min 5 caratteri).

### `confirmSbPayment()` — Aggiungere simulazione errore pagamento
**Comportamento attuale**: avvia sempre il timer.  
**Comportamento nuovo**: se `sbPaymentError === true`, non avviare il timer e mostrare `sbPaymentErrorMsg`. Il flag `sbPaymentError` viene impostato dallo scenario emulatore (vedi sezione 6). In condizioni normali il comportamento è identico all'attuale.

### `sbStop()` — Aggiungere registrazione in cronologia
**Comportamento attuale**: ferma sosta, pulisce intervallo.  
**Comportamento nuovo**: dopo aver fermato la sosta, aggiungere in testa a `cronologiaItems` un nuovo record con:
```javascript
{
  id: Date.now(),
  tipo: 'Strisce Blu',
  data: new Date().toLocaleDateString('it-IT'),
  importo: this.sbPrice,
  stato: 'Completata',
  targa: this.sbPlate,
  zona: this.sbZoneName
}
```
Mantenere il resto della logica di cleanup invariato.

---

## 4. Nuove funzioni Alpine da implementare

### `dismissSbWizard()`
Chiude il wizard informativo e imposta `sbWizardSeen = true`. Salva il flag in `localStorage` con chiave `sbWizardSeen`. Poi apre il flow normale (imposta `sbStep = 1` e apre il modal Blue se non già aperto).

### `sbSelectVehicle(vehicle)`
Imposta `sbSelectedVehicle = vehicle` e `sbPlate = vehicle.targa`. Chiude il selector (`sbShowVehicleSelector = false`).

### `openSbExtend()`
Apre il modal di modifica durata (`sbShowExtendModal = true`). Disponibile solo durante sosta attiva (`sbActive === true`).

### `confirmSbExtend()`
Simula la proroga:
1. Calcola nuovo `sbEndTs = sbEndTs + (sbExtendMinutes * 60 * 1000)`
2. Ricalcola `sbPrice` in base alla durata totale aggiornata
3. Mostra toast "Sosta prorogata di X minuti — Nuovo importo: €Y"
4. Chiude modal (`sbShowExtendModal = false`)

> Il timer continua a girare senza interruzioni: `sbInterval` non va toccato.

### `sbSimulatePaymentError(msg)`
Imposta `sbPaymentError = true` e `sbPaymentErrorMsg = msg`. Chiamata dallo scenario emulatore per testare il flusso di errore. Dopo la visualizzazione dell'errore, l'utente può chiudere il modal e riprovare: aggiungere un pulsante "Riprova" nel modal pagamento che chiama `sbPaymentError = false; sbPaymentErrorMsg = ''`.

---

## 5. Struttura Modal — Modifiche e aggiunte

### Modal Blue (già esistente) — Step 1 Esteso
Aggiungere nella parte superiore dello Step 1 (impostazione sosta), prima dei controlli durata:

**Sezione Zona** (mockup):
- Label "Zona selezionata" con valore `sbZoneName`
- Sub-label con tariffa `€{{ sbZoneRate }}/ora` e orari `sbZoneHours`
- CTA piccola "Cambia zona" → mostra toast "Funzionalità mappa disponibile nella versione produzione"

**Sezione Veicolo** (mockup):
- Label "Veicolo"
- Se `sbSelectedVehicle !== null`: mostra badge targa (`sbSelectedVehicle.targa`) + nome veicolo
- Se `sbSelectedVehicle === null` e garage ha veicoli: mostra primo veicolo del garage come preselezionato
- Se garage vuoto: mostra placeholder "Nessun veicolo — " + link "Aggiungi dal Garage" che naviga ad `accountSection = 'garage'` e chiude il modal
- CTA "Cambia veicolo" → toggle `sbShowVehicleSelector`

**Selector veicolo inline** (x-show="sbShowVehicleSelector"):
- Lista dei veicoli da `garageVehicles` con badge targa e label
- Click su un veicolo → chiama `sbSelectVehicle(vehicle)`

> Non modificare i controlli di selezione durata (pillole 30m/1h/2h/3h) e le modalità esistenti.

### Modal Pagamento (già esistente) — Aggiungere stato errore
Aggiungere nel modal pagamento una sezione condizionale `x-show="sbPaymentError"`:
- Icona warning (fa-triangle-exclamation, colore rosso/arancio)
- Testo `sbPaymentErrorMsg`
- Pulsante "Riprova" → `sbPaymentError = false; sbPaymentErrorMsg = ''`

Quando `sbPaymentError === true`, il pulsante "Conferma pagamento" deve essere disabilitato.

### Nuovo Modal: Wizard Informativo (x-show="sbShowWizard")
Modal bottom-sheet con `slideUp`, seguire il pattern standard (vedi CLAUDE.md).

Contenuto:
- Titolo: "Benvenuto nelle Strisce Blu"
- Breve spiegazione: "Paga la sosta direttamente dall'app, senza biglietterie o parcometri."
- 3 bullet informativi (icone Font Awesome):
  - `fa-location-dot` — "Seleziona la zona di parcheggio sulla mappa"
  - `fa-car` — "Associa il tuo veicolo alla sosta"
  - `fa-clock` — "Scegli la durata e avvia: paghi solo ciò che usi"
- Nota su talloncino PDF: "Riceverai via email il talloncino da esporre sul veicolo"
- CTA primaria: "Inizia" → chiama `dismissSbWizard()`
- Variabile stato: `showSbWizard: false` (già inclusa nella sezione 2)

### Nuovo Modal: Modifica Durata (x-show="sbShowExtendModal")
Modal bottom-sheet, stile coerente con il modal Blue esistente.

Contenuto:
- Titolo: "Modifica durata sosta"
- Sosta in corso: mostra `sbTimerText` e orario fine corrente
- Pillole selezione minuti aggiuntivi: +15 min, +30 min, +1 ora, +2 ore
  - Click su pillola → imposta `sbExtendMinutes`
- Importo aggiornato stimato (calcolato live)
- CTA "Conferma proroga" → chiama `confirmSbExtend()`
- CTA secondaria "Annulla" → `sbShowExtendModal = false`

---

## 6. Scenari Emulatore da aggiungere

Aggiungere i seguenti scenari nel pannello di `protoConEmulatore.html`, nella sezione Strisce Blu (accanto agli scenari già presenti).

### Scenario: "Errore Pagamento"
- Descrizione muted: "Simula carta scaduta al momento del pagamento"
- Precondizione: modal pagamento aperto (sosta in configurazione)
- Funzione DEMO: `DEMO.sbSimulatePaymentError('Carta scaduta. Seleziona un metodo alternativo.')`
- Effetto: mostra il messaggio di errore nel modal pagamento e disabilita "Conferma"

### Scenario: "Proroga Sosta"
- Descrizione muted: "Apre il modal di modifica durata durante sosta attiva"
- Precondizione: `sbActive === true`
- Funzione DEMO: `DEMO.sbOpenExtend()`
- Effetto: apre `sbShowExtendModal` nell'iframe

Esporre su `window.DEMO`:
```javascript
sbSimulatePaymentError(msg) {
  try { window.APP.sbSimulatePaymentError(msg); } catch(e) {}
},
sbOpenExtend() {
  try {
    if (window.APP.sbActive) window.APP.openSbExtend();
    else alert('Attiva prima una sosta');
  } catch(e) {}
}
```

---

## 7. Persistenza localStorage

Aggiungere al blocco di init esistente:
- `sbWizardSeen` → booleano, `true` dopo prima visualizzazione wizard

Non modificare le chiavi già presenti (`sbTermsAccepted`, `currentPage`, `scenarioSettings`).

---

## 8. Vincoli e note implementative

- **Non toccare** `sbTick()`, `sbNotifyExpiry()`, `sbShowLockScreen()` — funzionano correttamente e sono usati dall'emulatore
- **Non toccare** la logica `sbTermsAccepted` / `rejectSbTerms()` / `acceptSbTerms()`
- **Non aumentare** il max-width del container (420px)
- Il wizard va mostrato **dopo** l'accettazione T&C, non prima
- La selezione zona è **mock**: nessuna mappa reale, nessuna geolocalizzazione — usare dati hardcoded `sbZoneName`, `sbZoneRate`, `sbZoneHours`
- La funzione `calculateSbPrice()` usa già la formula corretta (tariffa × ore) — basta parametrizzare `sbZoneRate`
- I veicoli del Garage sono già in `garageVehicles` — non duplicare lo stato
- I metodi di pagamento sono già in `paymentMethods` — non duplicare
- Il modal Blue usa già `sbStep` per distinguere setup (1) da timer (2): le nuove sezioni vanno nello Step 1

---

## 9. Cosa NON implementare nel prototipo

| Funzionalità BUR | Trattamento nel prototipo |
|---|---|
| Geolocalizzazione GPS reale | Mock: zona fissa "Zona A — Centro" con dati hardcoded |
| Layer mappa zone tariffate (MyCicero) | CTA "Cambia zona" → toast "disponibile in produzione" |
| Chiamata API MyCicero per apertura/chiusura sosta | Simulata da `confirmSbPayment()` con timer locale |
| Preaddebito e tokenizzazione carta | Simulato: click "Conferma" → avvia sosta (eccetto scenario errore) |
| Email con talloncino PDF | Nota informativa nel wizard, nessuna email reale |
| OTP o autenticazione aggiuntiva | Non prevista nel prototipo |
| Riconciliazione con MyCicero | Non prevista nel prototipo |
| Meccanismi di retry su anomalia chiusura | Non previsti nel prototipo |
| Abbonamenti mensili (Fase 2) | Non in scope MVP |
| Funzionalità "Stai quanto vuoi" (Fase 3) | Non in scope MVP |
| Aggiornamento CRM (tutti i campi) | Simulato: `cronologiaItems` come proxy dello storico CRM |

---

## Come usare questo file con Claude Code

1. Apri Claude Code in VS Code sul progetto `PrototipoApp`
2. Assicurati che `CLAUDE.md` sia presente nella root del progetto
3. Avvia una nuova sessione
4. Scrivi:

```
Leggi il file requirements/requirements_strisceblue.md e adegua l'implementazione 
delle Strisce Blu nel prototipo seguendo esattamente le istruzioni. 
Fai molta attenzione a non rompere nulla di quanto già implementato: 
il timer, gli scenari emulatore esistenti, la logica T&C e il lock screen 
devono continuare a funzionare esattamente come prima.
```

5. Claude Code leggerà questo file + il `CLAUDE.md` e procederà con modifiche chirurgiche
