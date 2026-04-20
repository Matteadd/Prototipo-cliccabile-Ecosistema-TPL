# Requirements: Tablet Operatore — Onboarding & Vendita Canale Fisico

> Generato da BUR: ELV26-014 Telepedaggio v0.4 — Marzo 2026  
> Da implementare in: **`tablet.html`** (file nuovo, standalone)  
> Riferimento architettura: CLAUDE.md — PrototipoApp Enilive

---

## 1. Panoramica

`tablet.html` simula il **portale in-store per l'operatore Enilive Station**. È un form wizard multi-step ottimizzato per tablet landscape (max-width 900px) che copre il processo completo di onboarding cliente, valutazione creditizia, scelta bundle, associazione OBU e firma contratto.

Al termine del flusso, pubblica l'evento `cliente:registrato` sul bus condiviso (`bus.js`), che aggiorna in real-time `crm.html` e `proto-app.html` (emulatore).

Il tablet è **standalone**: non è un iframe. Si apre in una tab separata del browser. Ha il proprio stato Alpine interno (non condivide x-data con proto-app.html).

---

## 2. Stack e Layout

- **Alpine.js 3.x** — tutto lo stato in un unico `x-data` root
- **Tailwind CSS CDN** — layout landscape
- **Font Awesome 6.4.0** — icone
- **bus.js** — comunicazione verso CRM e App
- **max-width: 900px**, font-size base 16px, touch-friendly (bottoni min 48px)
- **Dark header** con logo Enilive + nome operatore loggato (mock)
- Sfondo: grigio chiaro `#f3f4f6`, card bianche con ombra

---

## 3. Stato Alpine (x-data root di tablet.html)

```javascript
// === WIZARD NAVIGATION ===
currentStep: 1,           // 1..6
totalSteps: 6,

// === STEP 1 — LOGIN OPERATORE (mock) ===
operatorLoggedIn: false,
operatorName: 'Marco Ferretti',
operatorStation: 'Enilive Station Milano Lorenteggio',

// === STEP 2 — REGISTRAZIONE CLIENTE ===
// Documento
scanMode: 'manual',       // 'scan' | 'manual'
scanStatus: null,         // null | 'scanning' | 'done' | 'error'

// Anagrafica
cliente: {
  cf: '',
  nome: '',
  cognome: '',
  dataNascita: '',
  indirizzo: '',
  civico: '',
  comune: '',
  provincia: '',
  cap: '',
  stato: 'Italia',
  telefono: '',
  email: '',
},
cfVerifyStatus: null,     // null | 'checking' | 'ok' | 'ko'
cfAlreadyExists: false,   // true se CF trovato su altra app Gruppo Eni

// Targhe
targhe: [''],             // array di stringhe (min 1)

// OTP
otpSmsValue: '',
otpSmsStatus: null,       // null | 'sent' | 'confirmed' | 'error'
otpEmailValue: '',
otpEmailStatus: null,     // null | 'sent' | 'confirmed' | 'skipped'
otpSmsInput: '',          // quello che digita l'operatore
otpEmailInput: '',

// === STEP 3 — VALUTAZIONE CREDITIZIA ===
creditCheckStatus: null,  // null | 'checking' | 'ok_full' | 'ok_rsa_only' | 'ko'
// ok_full    = Stop List OK + Cerved OK → tutti i bundle
// ok_rsa_only = Stop List OK + Cerved KO → solo RSA Stand-Alone
// ko         = Stop List KO → bloccante

// === STEP 4 — SCELTA BUNDLE E CONFIGURAZIONE CARRELLO ===
selectedBundle: null,     // 'mobility' | 'obu_standalone' | 'rsa_standalone'

// Servizi nel carrello (flaggabili)
cart: {
  tolling: true,          // non deflaggabile
  rsa: true,
  polizzaFurto: true,
  parcheggi: true,        // OBU-driven, non deflaggabile
  areac: true,
  memo: true,
  dispositivoExtra: false,
},
codiceSconto: '',
scontoCodiceApplicato: false,

// Pricing mock
prezziNativi: {
  tolling: 2.50,
  rsa: 2.00,
  polizzaFurto: 1.50,
  parcheggi: 0.00,
  areac: 0.00,
  memo: 0.00,
},
scontoBundle: 0.50,       // sconto applicato se bundle completo

// IBAN
iban: '',
ibanVerifyStatus: null,   // null | 'checking' | 'ok' | 'ko'

// === STEP 5 — ASSOCIAZIONE TARGA-OBU ===
obuCode: '',
obuScanStatus: null,      // null | 'scanning' | 'ok' | 'error'
obuAssociazioneConfermata: false,
targaSelezionata: '',     // targa scelta dal menu a tendina

// === STEP 6 — FIRMA CONTRATTO ===
contrattoSmsInviato: false,
firmaOtpInput: '',
firmaStatus: null,        // null | 'pending' | 'signed' | 'error'
flowCompleted: false,

// === NOTIFICHE / TOAST ===
toastMessage: '',
toastType: 'info',        // 'info' | 'success' | 'error' | 'warning'
showToast: false,
```

---

## 4. Funzioni Alpine da implementare

### Navigazione wizard

#### `goToStep(n)`
Cambia `currentStep` a `n`. Prima di avanzare, validare il form dello step corrente (vedi vincoli per step). Se validazione fallisce, mostrare toast di errore e non avanzare.

#### `nextStep()`
Chiama la logica di validazione/mock dello step corrente, poi `goToStep(currentStep + 1)`.

#### `prevStep()`
Torna allo step precedente senza validazioni.

---

### Step 2 — Biforcazione cliente nuovo / esistente

Dopo `verifyCF()`, se `cfAlreadyExists = true`:
- I campi anagrafici diventano **read-only** (`clienteReadonly = true`)
- Appare un pulsante **"Modifica"** nel banner alert che sblocca i campi (`clienteReadonly = false`)
- Prima di mostrare lo step 2c (OTP), chiama `consensiStatus()` per verificare i consensi CRM mock (`consensiCrm`):
  - `'completo'`: tutti i consensi presenti → salta SMS #1, vai diretto a step 3 con toast
  - `'optional_only'`: mancano solo consensi facoltativi (marketing/profilazione) → mostra SMS opzionale con pulsante "Salta" (`consensiSmsOpzionale = true`)
  - `'mancanti'`: mancano consensi obbligatori → mostra SMS #1 normalmente

Stato aggiunto:
```javascript
clienteReadonly: false,
consensiCrm: {
  privacy: true,
  informativaPrecontrattuale: false,
  nAndCMemo: false,
  marketing: false,    // facoltativo
  profilazione: false, // facoltativo
},
consensiSmsOpzionale: false,
otpSmsFieldEnabled: false, // campo OTP disabled finché non arriva documento:firmato
```

---

### Step 2 — Registrazione

#### `simulateScan()`
Simula la scansione OCR del documento. Imposta `scanStatus = 'scanning'`, dopo 1.5s imposta `scanStatus = 'done'` e pre-compila `cliente` con dati mock (es. Mario Rossi, CF RSSMRA80A01F205X, ecc.). Mostra toast "Documento acquisito con successo".  
**Cosa simula del BUR:** OCR + lettura CIE fronte-retro tramite fotocamera tablet.

#### `verifyCF()`
Chiamata quando l'operatore esce dal campo CF (blur). Imposta `cfVerifyStatus = 'checking'`, dopo 800ms:
- Se CF è valido (lunghezza 16, qualsiasi valore nel prototipo) → `cfVerifyStatus = 'ok'`
- Se CF = `'TSTKO0000000000A'` (codice di test errore) → `cfVerifyStatus = 'ko'`, toast bloccante "CF non valido — impossibile procedere"
- Se CF = `'TSTENI0000000000'` (codice di test cliente esistente) → `cfAlreadyExists = true`, toast informativo "Cliente già registrato su app Gruppo Eni — dati precompilati", pre-compila anagrafica
**Cosa simula del BUR:** chiamata Cerved per esistenza CF + check Cliente Unico di Gruppo.

#### `sendOtpSms()`
Imposta `otpSmsStatus = 'sent'`, `otpSmsFieldEnabled = false`.  
Emette sul bus:
```javascript
Bus.emit('sms:outbound', {
  id: 'sms_consensi',
  to: cliente.telefono,
  template: 'OTP_CONSENSI',
  preview: 'Conferma i tuoi dati e accetta i documenti Enilive: [link mock]',
  documenti: ['informativa_precontrattuale', 'norme_memo', 'privacy'],
})
```
Il campo OTP sul tablet resta **disabled** finché non arriva `Bus.on('documento:firmato', { template: 'OTP_CONSENSI' })`. Solo allora `otpSmsFieldEnabled = true` e l'operatore può inserire il codice.

#### `confirmOtpSms()`
Controlla `otpSmsInput`. Nel prototipo qualsiasi valore a 4 cifre è valido (oppure il codice fisso `'1234'`). Se corretto → `otpSmsStatus = 'confirmed'`, toast "Numero certificato". Se errato → toast errore "OTP non valido".  
**Fallback:** pulsante "Rigenera OTP" che chiama di nuovo `sendOtpSms()`.

#### `sendOtpEmail()`
Se `cliente.email` è vuota → `otpEmailStatus = 'skipped'`, toast "Email non fornita — step saltato (facoltativo)".  
Altrimenti → `otpEmailStatus = 'sent'`, toast "Email di verifica inviata a [email]".  
**Simula:** invio email OTP (facoltativo nel BUR).

#### `confirmOtpEmail()`
Stesso pattern di `confirmOtpSms()`. Se email saltata, questo step si bypassa.

#### `addTarga()`
Aggiunge un campo vuoto all'array `targhe`. Max 5 targhe.

#### `removeTarga(i)`
Rimuove la targa all'indice `i` se l'array ha più di 1 elemento.

---

### Step 3 — Valutazione creditizia

#### `runCreditCheck()`
Imposta `creditCheckStatus = 'checking'`. Dopo 2s (simula latenza API):
- Se `cliente.cf` finisce con `'KO'` → `creditCheckStatus = 'ko'` (Stop List bloccante)
- Se `cliente.cf` finisce con `'KO2'` → `creditCheckStatus = 'ok_rsa_only'` (Cerved KO, solo RSA)
- Altrimenti → `creditCheckStatus = 'ok_full'`

Mostrare nell'UI solo l'**esito** (OK/KO), mai il punteggio numerico.  
**Cosa simula del BUR:** Stop List Enilive + chiamata Cerved merito creditizio.

---

### Step 4 — Carrello vero

Il sub-step 4b usa un paradigma a carrello vero:
- Ogni servizio disponibile è mostrato come riga con **pulsante `+`** per aggiungerlo
- Una volta aggiunto, il pulsante diventa **`×`** per rimuoverlo (disabilitato per `tolling` e `parcheggi`, OBU-driven)
- **Badge** nell'header wizard mostra il contatore degli item nel carrello in tempo reale
- Il secondo OBU (`cart.dispositivoExtra`) appare come riga separata con campo targa proprio e toggle servizi indipendenti
- **Totale mensile fisso** in fondo sempre visibile
- **Campo codice sconto** sotto il totale

---

### Step 4 — Logica carrello

#### `selectBundle(type)`
Imposta `selectedBundle = type`. Aggiorna automaticamente i flag `cart` in base al bundle:
- `'mobility'` → tutti i servizi attivi, `cart.dispositivoExtra` disponibile
- `'obu_standalone'` → tolling + parcheggi attivi, rsa/polizzaFurto deflaggabili
- `'rsa_standalone'` → solo rsa attivo, tolling/parcheggi/areac/memo/polizzaFurto = false e nascosti

#### `toggleCartItem(item)`
Toggle del flag `cart[item]`. Non deve poter disabilitare `tolling` e `parcheggi` (OBU-driven). Se bundle non è commerciale (pack chiuso = rsa_standalone) disabilita tutti i toggle.

#### `applySconto()`
Se `codiceSconto === 'ENILIVE2026'` → `scontoCodiceApplicato = true`, toast "Codice sconto applicato!". Altrimenti toast "Codice non valido".

#### `calcTotale()` (getter)
Restituisce il totale mensile sommando i prezzi nativi dei servizi flaggati, meno `scontoBundle` se il bundle è completo.

#### `verifyIban()`
Imposta `ibanVerifyStatus = 'checking'`, dopo 1s:
- Se IBAN inizia con `'IT'` e lunghezza ≥ 15 → `'ok'`, toast "IBAN verificato — mandato SDD attivato"
- Altrimenti → `'ko'`, toast errore "IBAN non valido o titolarità non verificata"  
**Cosa simula del BUR:** verifica titolarità IBAN (Cerved IBAN check) + attivazione mandato SDD.

---

### Step 5 — OBU

#### `scanObu()`
Imposta `obuScanStatus = 'scanning'`, dopo 1s:
- Pre-compila `obuCode` con un codice mock (es. `'OBU-EN-2026-00421'`)
- `obuScanStatus = 'ok'`
- Toast "Dispositivo rilevato nel magazzino stazione"  
**Cosa simula del BUR:** scansione con pistola ottica + verifica magazzino Enilive Station.

#### `associaObu()`
Verifica che `obuCode` sia compilato e `targaSelezionata` non sia vuota. Imposta `obuAssociazioneConfermata = true`. Toast "Targa [X] associata a dispositivo [Y]".  
Emette evento bus: `Bus.emit('obu:associato', { targa: targaSelezionata, obu: obuCode })`.  
**Cosa simula del BUR:** associazione targa-OBU + check targa non già associata ad altro OBU. (Lo "scippo targa" non si implementa nel prototipo.)

---

### Step 6 — Firma contratto

#### `sendContrattoSms()`
Imposta `contrattoSmsInviato = true`, `firmaOtpFieldEnabled = false`.  
Emette sul bus:
```javascript
Bus.emit('sms:outbound', {
  id: 'sms_contratto',
  to: cliente.telefono,
  template: 'FIRMA_CONTRATTO',
  preview: 'Firma il tuo contratto Enilive: [link mock]',
  dati: { nome, cf, bundle, totale },
})
```
Il campo OTP firma resta **disabled** finché non arriva `Bus.on('documento:firmato', { template: 'FIRMA_CONTRATTO' })`. Solo allora `firmaOtpFieldEnabled = true`.  
**Cosa simula del BUR:** invio SMS con link alla firma FES.

#### `confirmFirma()`
Controlla `firmaOtpInput`. Qualsiasi valore a 4 cifre è valido. Se corretto:
- `firmaStatus = 'signed'`
- Chiama `completaOnboarding()`  
Se errato → toast "Codice OTP non valido — chiedi al cliente di riprovare".  
**Cosa simula del BUR:** firma FES completata con OTP + invio copia contratto.

#### `completaOnboarding()`
Funzione principale di chiusura flusso. Esegue in sequenza:

1. `flowCompleted = true`
2. Compone il payload cliente:
```javascript
const payload = {
  nome: cliente.nome + ' ' + cliente.cognome,
  cf: cliente.cf,
  email: cliente.email,
  telefono: cliente.telefono,
  targhe: targhe.filter(t => t.trim()),
  bundle: selectedBundle,
  servizi: Object.keys(cart).filter(k => cart[k]),
  obu: obuCode,
  dataRegistrazione: new Date().toISOString(),
}
```
3. Pubblica sul bus: `Bus.emit('cliente:registrato', payload)`
4. Pubblica attivazioni servizi uno per uno con delay 200ms tra l'uno e l'altro:
   - Se `cart.rsa` → `Bus.emit('servizio:attivato', { servizio: 'rsa', targa: targaSelezionata })`
   - Se `cart.memo` → `Bus.emit('servizio:attivato', { servizio: 'memo', targa: targaSelezionata })`
   - Se `cart.areac` → `Bus.emit('servizio:attivato', { servizio: 'areac', targa: targaSelezionata })`
   - Se `cart.parcheggi` → `Bus.emit('servizio:attivato', { servizio: 'parcheggi', targa: targaSelezionata })`
5. Simula invio email conferma: toast "Email di conferma inviata a [email cliente]" dopo 1.5s
6. Mostra schermata di riepilogo finale

**Cosa simula del BUR:** aggiornamento CRM, whitelist OBU verso merchant, attivazione sincrona servizi ancillari, invio mail/SMS di conferma.

---

### Notifiche simulate (bus → CRM)

Tutte le seguenti azioni devono emettere un evento bus che il CRM (`crm.html`) mostra nel log eventi live:

| Azione tablet | Evento bus | Payload |
|---|---|---|
| OTP SMS inviato | `sms:outbound` | `{ to: telefono, template: 'OTP_REGISTRAZIONE', preview: 'Il tuo codice OTP è: 1234' }` |
| OTP Email inviato | `email:outbound` | `{ to: email, subject: 'Verifica indirizzo email', preview: 'Clicca qui per verificare...' }` |
| Contratto inviato | `sms:outbound` | `{ to: telefono, template: 'LINK_CONTRATTO', preview: 'Firma il tuo contratto: [link mock]' }` |
| Firma completata | `email:outbound` | `{ to: email, subject: 'Copia contratto Enilive', preview: 'In allegato la tua copia...' }` |
| Onboarding completato | `cliente:registrato` | payload completo (vedi sopra) |
| Servizio attivato | `servizio:attivato` | `{ servizio, targa, data }` |

---

### Utility

#### `showToastMsg(message, type = 'info', duration = 3000)`
Imposta `toastMessage`, `toastType`, `showToast = true`. Dopo `duration` ms → `showToast = false`.  
Tipo `'success'` → verde, `'error'` → rosso, `'warning'` → arancione, `'info'` → teal.

#### `resetForm()`
Riporta tutto allo stato iniziale (step 1). Utile per il pulsante "Nuovo cliente" nella schermata finale.

---

## 5. Struttura Wizard — Step per Step

### Step 1 — Login Operatore
- Schermata di benvenuto con logo Enilive
- Campo username + password mock (accetta qualsiasi valore non vuoto)
- Pulsante "Accedi" → `operatorLoggedIn = true`, avanza allo step 2
- Header dopo login: mostra `operatorName` + `operatorStation`
- **Nota**: in demo il login è automatico se si aggiunge `?autologin=1` all'URL

### Step 2 — Registrazione Cliente (3 sotto-step)

**2a — Acquisizione documento**
- Due pulsanti: "📷 Scansiona documento" (chiama `simulateScan()`) e "✏️ Inserimento manuale"
- Se scan: mostra animazione loading 1.5s, poi dati precompilati con badge verde "Documento acquisito"
- Se manuale: mostra direttamente il form anagrafica

**2b — Dati anagrafici**
- Campo CF in cima con indicatore di verifica (spinning/verde/rosso)
- Se `cfAlreadyExists`: banner giallo "⚠️ Cliente già presente nel Gruppo Eni — dati precompilati"
- Campi: nome, cognome, data nascita, indirizzo + civico, comune (con geolocalizzazione mock), provincia, CAP, stato
- Campi contatto: telefono (obbligatorio), email (facoltativo)
- Sezione targhe: lista dinamica con `+` per aggiungere, `×` per rimuovere

**2c — Verifica contatti (OTP)**
- Blocco SMS: numero mostrato in chiaro, pulsante "Invia OTP" → campo 4 cifre → "Conferma" / "Rigenera"
- Blocco Email: se email fornita → stesso pattern; se assente → badge grigio "Passaggio facoltativo — saltato"
- Avanza solo se `otpSmsStatus === 'confirmed'`

### Step 3 — Valutazione Creditizia
- Pulsante "Avvia verifica" (grande, centrato)
- Loading 2s con testo animato "Verifica in corso..."
- Esiti:
  - ✅ **OK_FULL**: badge verde "Cliente idoneo — tutti i bundle disponibili"
  - ⚠️ **OK_RSA_ONLY**: badge arancione "Bundle Mobility non disponibile — proporre RSA Stand-Alone"
  - ❌ **KO**: badge rosso "Cliente non idoneo — impossibile procedere con la vendita" + pulsante "Chiudi sessione"

### Step 4 — Configurazione Offerta (3 sotto-step)

**4a — Scelta bundle**
- 3 card cliccabili (disabilita quelle non disponibili in base a `creditCheckStatus`):
  - 🏆 **Bundle Mobility** — tutti i servizi, prezzo scontato
  - 📡 **OBU Stand-Alone** — solo telepedaggio + servizi OBU-driven
  - 🚗 **RSA Stand-Alone** — solo assistenza stradale (sempre disponibile se Stop List OK)
- Card selezionata: bordo teal + check

**4b — Personalizzazione carrello**
- Lista servizi con toggle checkbox (disabilitati per servizi non deflaggabili)
- Mostra prezzo nativo per ogni servizio
- Totale in fondo: "€X.XX/mese" con eventuale sconto evidenziato
- Campo "Codice sconto / convenzione" + pulsante "Applica"
- Se `selectedBundle === 'rsa_standalone'`: nasconde toggle, mostra solo rsa

**4c — Metodo di pagamento**
- Campo IBAN con indicatore verifica
- Nota: "Carta di credito disponibile in fase post-MVP"
- Pulsante "Verifica IBAN" → spinner → esito

### Step 5 — Associazione OBU

- Pulsante "📷 Scansiona codice OBU" + campo manuale affiancati
- Menu a tendina "Seleziona targa" con le targhe registrate allo step 2 + opzione "Inserisci manualmente"
- Card riepilogo: "OBU [codice] → Targa [X]" con badge verde quando associato
- Pulsante "Associa" abilitato solo quando entrambi i campi sono compilati

### Step 6 — Firma Contratto

- Anteprima contratto (box scrollabile con testo mock del contratto: intestazione dinamica con nome/CF/bundle)
- Pulsante "📨 Invia link contratto via SMS" → diventa grigio dopo invio con testo "SMS inviato ✓"
- Sezione OTP firma: campo 4 cifre + "Conferma firma"
- Spinner durante elaborazione
- **Schermata finale** (dopo firma completata):
  - ✅ Grande check verde
  - "Onboarding completato!"
  - Riepilogo: nome cliente, bundle, targhe, servizi attivati
  - "📱 Email di conferma inviata a [email]" (appare dopo 1.5s)
  - Pulsante "Nuovo cliente" → `resetForm()`
  - Link "Apri CRM →" (apre `crm.html` in nuova tab)

---

## 6. Barra di Progresso Wizard

Header fisso con:
- Numero step "Passo X di 6"
- Barra progressiva (larghezza `(currentStep/6)*100%`) colore teal
- Etichette step cliccabili (solo step già completati)
- Pulsante "‹ Indietro" (disabilitato allo step 1)

---

## 7. Scenari rapidi (shortcuts per demo)

Aggiungere in fondo alla pagina (collassabile, visibile solo in modalità demo) un pannello con pulsanti che saltano direttamente a scenari preconfigurati:

| Pulsante | Cosa fa |
|---|---|
| "Demo: cliente nuovo OK" | Pre-compila tutto con dati mock validi, skippa a step 3 con esito `ok_full` |
| "Demo: solo RSA (Cerved KO)" | Pre-compila, creditCheck → `ok_rsa_only`, skippa a step 4 bundle RSA |
| "Demo: cliente bloccato" | Pre-compila CF terminante in KO, creditCheck → `ko` |
| "Demo: completa tutto" | Esegue `completaOnboarding()` direttamente con payload mock completo |

Il pannello demo è attivato aggiungendo `?demo=1` all'URL.

---

## 8. Persistenza localStorage

- `tabletOperator` → `{ nome, stazione }` — ricordare operatore loggato tra sessioni
- **Non persistere** dati cliente (ogni apertura = nuovo cliente)

---

## 9. Integrazione bus.js

`tablet.html` deve includere `bus.js` con tag `<script src="bus.js"></script>` e usare `Bus.emit()` per tutti gli eventi. Non deve ascoltare eventi (è solo publisher nel flusso di onboarding).

Eccezione: può ascoltare `crm:aggiornato` per mostrare un toast "CRM aggiornato" come feedback visivo di conferma durante la demo.

---

## 10. Cosa NON implementare nel prototipo

| Elemento BUR reale | Come si simula nel prototipo |
|---|---|
| OCR reale documento | `simulateScan()` pre-compila dati mock dopo 1.5s |
| Chiamata Cerved verifica CF | `verifyCF()` con regex lunghezza + codici speciali di test |
| Stop List Enilive reale | Suffisso CF speciale → esito KO |
| Verifica merito creditizio Cerved | `runCreditCheck()` con delay 2s + codici CF di test |
| Verifica IBAN titolarità (Cerved) | `verifyIban()` → controlla prefisso IT |
| Mandato SDD reale | Toast "Mandato SDD attivato" |
| Firma FES reale | Qualsiasi OTP a 4 cifre viene accettato |
| Invio SMS reale | Toast in-app + evento bus `sms:outbound` visibile nel CRM log |
| Invio email reale | Toast in-app + evento bus `email:outbound` visibile nel CRM log |
| Aggiornamento CRM reale | `Bus.emit('cliente:registrato', payload)` letto da crm.html |
| Whitelist OBU su merchant | `Bus.emit('servizio:attivato', ...)` per ogni servizio |
| Autenticazione MFA operatore | Campo username+password mock, qualsiasi valore accettato |
| Geolocalizzazione indirizzo | Campo manuale normale |
| Cliente Unico di Gruppo (Plenitude/Enjoy) | CF speciale `TSTENI*` pre-compila dati |


