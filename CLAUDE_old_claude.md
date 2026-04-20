# CLAUDE.md — PrototipoApp Enilive

Riferimento architetturale. Scritto in italiano.

---

## Panoramica del Progetto

Demo interattiva multi-pannello per **Telepedaggio + servizi ancillari Enilive**. Simula nel browser l'ecosistema digitale: app cliente, tablet operatore stazione, CRM back-office, flowchart backend.

**Scopo**: Demo/MVP per stakeholder interni (IT, UX, consulenza, management). Pannelli comunicano in tempo reale via event bus condiviso.

**No backend**: logica tutta client-side. Zero build process, zero package manager.

---

## Contesto di Business

Prodotto principale: **Telepedaggio**. Servizi opzionali:

| Servizio | Descrizione | Ruolo app |
|---|---|---|
| **Telepedaggio** | Contratto OBU + caselli autostradali | Selfcare, movimenti, sospensione/riattivazione |
| **Parcheggi in struttura** | Antenna Movyon alza sbarra | Selfcare, lista parcheggi → Google Maps, rendiconto |
| **Area C Milano** | Costo ZTL su fattura mensile | Attivazione/disattivazione, rendiconto |
| **RSA** | Assistenza stradale €2/mese illimitata | Chiamata soccorso (iframe), tessera con codice univoco |
| **Servizio Memo** | Scadenze veicolo nel Garage | Bollo (con pagamento), revisione, RCA — tutti con reminder |
| **Movimenti** | Sezione trasversale | Filtrabili per servizio, data, importo |

Onboarding/sottoscrizione: **in-app** o **canale fisico** tramite tablet Enilive Station.

---

## Struttura dei File

```
PrototipoApp/
├── index.html                   ← Hub/landing page demo (link a tutti i pannelli)
├── bus.js                       ← Event bus condiviso (BroadcastChannel + localStorage)
├── proto-app.html               ← App cliente (SPA, ~2900 righe)
├── proto-app.css                ← Stili app + design system
├── proto-app.js                 ← Placeholder (logica inline in proto-app.html)
├── protoConEmulatore.html       ← Shell emulatore con pannello scenari
├── protoConEmulatore.css        ← Stili emulatore (dark theme)
├── protoConEmulatore.js         ← Logica emulatore (bridge iframe + bus)
├── protoConEmulatore_old.html   ← Versione legacy, NON modificare
├── tablet.html                  ← Tablet operatore stazione (onboarding + firma, ~2200 righe)
├── crm.html                     ← CRM simulato (scheda cliente, log eventi live, ~1400 righe)
├── flows.html                   ← Flowchart backend swimlane per ogni servizio (~1230 righe)
└── requirements/
    ├── requirements_account.md
    ├── requirements_strisceblue.md
    ├── requirements_telepedaggio.md
    ├── requirements_parcheggi.md
    ├── requirements_areac.md
    ├── requirements_rsa.md
    └── requirements_memo.md
```

---

## Architettura Multi-Pannello

### I quattro componenti

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Tablet operatore│    │   App cliente   │    │  CRM simulato   │
│   tablet.html   │    │  proto-app.html  │    │   crm.html      │
│                 │    │  + emulatore    │    │                 │
│ • Onboarding    │    │ • Selfcare      │    │ • Scheda cliente│
│ • Firma contratto│   │ • Pannello scen.│    │ • Contratti     │
│ • Attiv. servizi│    │ • Tutti servizi │    │ • Log eventi    │
└────────┬────────┘    └────────┬────────┘    └────────┬────────┘
         │                     │                       │
         └─────────────────────┼───────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │      bus.js         │
                    │  BroadcastChannel   │
                    │  + localStorage     │
                    └─────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  flows.html  — flowchart backend (standalone, no bus)           │
│  Swimlane per: Telepedaggio / Strisce Blu / RSA / Memo / Area C │
└─────────────────────────────────────────────────────────────────┘
```

### Stack tecnologico

| Tecnologia | Versione | Ruolo |
|---|---|---|
| Alpine.js | 3.x | Reattività dichiarativa (state + template) |
| Tailwind CSS | Latest CDN | Styling utility-first |
| Font Awesome | 6.4.0 CDN | Icone |
| DM Sans / DM Mono (Google Fonts) | — | Tipografia (index.html); Inter in proto-app |
| Leaflet.js | 1.9.4 CDN | Mappa interattiva zone Strisce Blu |
| BroadcastChannel API | nativa | Comunicazione cross-tab (bus.js) |

**No build process.** Tutto via CDN, no `package.json`, no bundler.

### bus.js — Event Bus

Modulo condiviso da tutti pannelli (eccetto `flows.html`). API minimale:

```javascript
// Pubblicare un evento
Bus.emit('cliente:registrato', { nome: 'Mario Rossi', cf: '...', servizi: ['rsa', 'memo'] })

// Ascoltare eventi
Bus.on('cliente:registrato', (payload) => { ... })

// Rimuovere listener
Bus.off('cliente:registrato', handler)
```

**Catalogo eventi:**

| Evento | Chi pubblica | Chi ascolta | Payload |
|---|---|---|---|
| `cliente:registrato` | tablet | app, crm | `{ nome, cf, targa, servizi[] }` |
| `servizio:attivato` | tablet, app | crm | `{ servizio, targa, data }` |
| `servizio:disattivato` | app | crm | `{ servizio, targa, data }` |
| `pagamento:confermato` | app | crm | `{ servizio, importo, metodo, data }` |
| `sosta:avviata` | app | crm | `{ zona, targa, durata }` |
| `sosta:terminata` | app | crm | `{ zona, targa, importo }` |
| `rsa:chiamata` | app | crm | `{ targa, posizione, tipo }` |
| `memo:scadenza` | app | crm | `{ tipo, targa, data }` |
| `crm:aggiornato` | crm | app | `{ campo, valore }` |
| `crm:movimento_aggiornato` | crm | app | `{ id, ...campi }` |
| `scenario:trigger` | emulatore | app | `{ nome, params }` |
| `sms:outbound` | tablet | app (emulatore) | `{ id, to, template, preview, documenti?, dati? }` |
| `documento:firmato` | app (emulatore) | tablet | `{ template }` |

---

## State Management

### proto-app.html (Alpine.js)

Tutto lo stato nell'oggetto `x-data` root.

```
/* Navigazione */
currentPage         ← home | loyalty | chatbot | account | bundle |
                       telepedaggio | rsa | areac | memo | parcheggi | movimenti

/* Strisce Blu (prefisso sb) */
sbActive, sbPage, sbPlate, sbMode, sbMinutes, sbEndTs, sbStartTs
sbTimerText, sbMetaText, sbPrice, sbPricePerHour
sbTermsAccepted, sbWizardSeen, sbShowWizard, sbZoneSelected
sbZoneName, sbZoneRate, sbZoneHours, sbSelectedVehicle
sbShowVehicleSelector, sbShowPaymentSelector, sbShowExtendModal
sbExtendMinutes, sbPaymentError, sbPaymentErrorMsg, sbShowZoneModal
sbMapSelectedZone, sbInterval

/* Garage / Account */
garageVehicles      ← [{ id, targa, tipo, marca }]

/* Telepedaggio */
tpActive            ← contratto attivo (bool)
tpObu               ← codice OBU dispositivo
tpSaldo             ← credito residuo (€)
tpSospeso           ← flag sospensione (bool)
tpMovimenti         ← [{ id, data, autostrada, casello, targa, importo }]
showTpSospendModal  ← modal conferma sospensione

/* Parcheggi in struttura */
pgList              ← [{ id, nome, indirizzo, lat, lng, tariffa }]
pgMovimenti         ← [{ id, data, parcheggio, targa, durata, importo, stato }]

/* Area C Milano */
acAttiva            ← servizio attivo (bool)
acTargaAbilitata    ← targa per cui è attiva Area C
acMovimenti         ← [{ id, data, targa, importo, stato, note }]

/* RSA */
rsaAttiva           ← contratto attivo (bool)
rsaCodiceTessera    ← codice univoco tessera operatore
rsaCallActive       ← chiamata soccorso in corso (bool)
showRsaModal        ← modal iframe chiamata soccorso

/* Memo */
memoVeicoli         ← [{ targa, bollo: {scadenza, importo, pagato}, revisione: {scadenza}, rca: {scadenza} }]
showMemoModal       ← modal dettaglio scadenze veicolo
memoSelectedVeicolo ← veicolo selezionato nel modal
memoPayTargetVeicolo← veicolo selezionato per pagamento bollo

/* Movimenti (trasversale) */
movimenti           ← [{ id, data, servizio, importo, targa, stato, descrizione }]
movimentiFilter     ← { servizio: null, stato: null, dateFrom: null, dateTo: null }
movimentiSelectedId ← id movimento selezionato per dettaglio
```

**Computed:**
- `movimentiFiltrati()` — filtra per servizio, stato, range date
- `movimentiTotaleMese()` — somma importi mese corrente
- `memoScadenzaStato(dataStr)` → `'ok' | 'in_scadenza' | 'scaduto'`
- `memoScadenzaLabel(dataStr)`, `memoScadenzaText(dataStr)`

**Persistenza localStorage:**
- `currentPage`, `sbTermsAccepted`, `sbWizardSeen` — invariati
- `scenarioSettings` — impostazioni pannello emulatore
- `clienteProfile` — profilo cliente (scritto da tablet via bus, letto da app)
- `serviziAttivi` — array servizi attivi `['rsa', 'areac', 'memo', 'parcheggi']`

---

## Stato delle Funzionalità

### proto-app.html

| Funzionalità | Stato | Note |
|---|---|---|
| Strisce Blu | **COMPLETO** | Mappa Leaflet, sosta a tempo/rotatoria, wizard onboarding |
| Telepedaggio | **COMPLETO** | OBU + saldo, movimenti caselli, sospensione/riattivazione |
| Parcheggi in struttura | **COMPLETO** | Lista con link Maps, storico accessi, importi |
| Area C Milano | **COMPLETO** | Toggle on/off, lista transiti addebitati |
| RSA | **COMPLETO** | Chiamata soccorso (modal), tessera digitale con codice |
| Servizio Memo | **COMPLETO** | Scadenze bollo/revisione/RCA, stati, pagamento bollo mock |
| Movimenti | **COMPLETO** | Lista aggregata, filtri servizio+stato+date, totale mese |
| SMS Emulatore | **COMPLETO** | Banner notifica iOS + webview documenti/firma; emette `documento:firmato` |
| Loyalty Program | display only | Punti hardcoded (4.520 pt, Gold Member), progress bar |
| Bundle/Abbonamenti | display only | 3 piani hardcoded: Standard, Premium, Telepedaggio |
| Chatbot | display only | UI chat mock, nessuna logica AI |
| Account / Garage | **COMPLETO** | Profilo, lista veicoli CRUD |

### tablet.html — COMPLETO

Form multi-step per operatore stazione:
1. Login operatore (mock)
2. Registrazione cliente — **biforcazione nuovo/esistente**:
   - Esistente: campi read-only + "Modifica" + check consensi CRM mock (`consensiCrm`)
   - Routing OTP: completo → skip SMS, solo opzionali → SMS skippabile, obbligatori mancanti → SMS normale
3. Valutazione creditizia (Stop List + Cerved mock)
4. **Configurazione contratto** (step 4a + 4b):
   - **4a**: slot OBU #1 (targa + toggle RSA + toggle Furto/Smarrimento), slot OBU #2 opzionale, RSA Standalone aggiuntive (max 2), IBAN verifica mock, totale real-time
   - Se `creditCheckStatus === 'ok_rsa_only'`: solo RSA Standalone, nessun slot OBU
   - **4b — Upsell**: recap contratto + "aggiungere altro?"; opzione "RSA per altre targhe" o "Nuovo contratto OBU" con IBAN separato; contratto 2 max 2 OBU + max 2 RSA standalone
5. Associazione OBU (1 o 2 dispositivi, condizionato da `hasObu2`)
6. **Firma contratto** — SMS #2 con `template: 'FIRMA_CONTRATTO'`; OTP disabilitato fino a `documento:firmato`; documento include entrambi contratti se configurati

**Prezzi contratto:**
| Prodotto | Prezzo |
|---|---|
| OBU Stand-Alone (telepedaggio) | €2.50/mese |
| RSA (aggiunto a OBU) | +€2.00/mese |
| Furto/Smarrimento OBU | addebito mensile |
| RSA Standalone | €2.00/mese |

**Flusso SMS:**
- `sms:outbound` con `template: 'OTP_CONSENSI'` → tablet attende `documento:firmato` per abilitare OTP
- `sms:outbound` con `template: 'FIRMA_CONTRATTO'` → tablet attende `documento:firmato` per abilitare OTP firma

**Stati chiave contratto:** `obu1Targa`, `obu1Rsa`, `obu1Furto`, `hasObu2`, `obu2Targa`, `obu2Rsa`, `obu2Furto`, `rsaStandalone[]`, `iban`, `ibanVerifyStatus`; contratto 2: `contratto2Attivo`, `c2obu1Targa`, `c2obu1Rsa`, `c2obu1Furto`, `c2hasObu2`, `c2rsaStandalone[]`, `c2iban`, `c2ibanVerifyStatus`

**Altri stati:** `clienteReadonly`, `consensiCrm`, `consensiSmsOpzionale`, `otpSmsFieldEnabled`, `firmaOtpFieldEnabled`, `upsellMode`, `upsellRsaTarghe`

**Metodi calcolo:** `calcContratto1Total()`, `calcContratto2Total()`, `addUpsellRsa()`, `confermaContratto2()`, `verifyIban2()`

UI: layout tablet landscape, font grandi, ottimizzato touch.

### Flusso ASSISTENZA — aggiornato

Homepage Assistenza (step `ricerca`) a **due colonne**:
- **Sinistra**: ricerca per CF/targa/contatto; errore esplicito se non trovato
- **Destra**: 4 card "Azioni rapide OBU" — Sostituisci OBU, Cambio targa, Furto/Smarrimento, Restituzione

**Flusso azione rapida OBU** (step `quick-obu`):
1. Campo ricerca inline con label contestuale
2. Se trovato: mini-recap cliente (nome, CF, targhe, OBU) + "Conferma e procedi" → salta a `flusso` con azione pre-impostata, saltando `scheda` e `griglia`
3. Se non trovato: errore + link "Cerca con ricerca completa" che pre-compila campo ricerca classica

**Nuovi stati:** `quickObuAction`, `quickObuSearchQuery`, `quickObuSearchLoading`, `quickObuSearchStatus`, `quickObuSearchResult`, `assistSearchNotFound`

**Nuovi metodi:** `avviaQuickObu(azione)`, `cercaClienteQuickObu()`, `confermaProcediQuickObu()`

### crm.html — COMPLETO

Dashboard back-office tre colonne:
- **Sinistra**: scheda cliente attiva (anagrafica, veicoli, contratti)
- **Centro**: stato servizi con badge attivo/inattivo
- **Destra**: log eventi live (feed real-time dal bus, con timestamp)

Aggiornamento reattivo: ogni evento bus appare nel log. Supporta `crm:movimento_aggiornato`.

### flows.html — COMPLETO

Standalone (no bus), flowchart per ogni servizio. Sidebar + pannello dettaglio, swimlane per processo. Attori: Cliente, Gestore, App, Sistema Enilive, Partner.

### bus.js — COMPLETO

88 righe. BroadcastChannel cross-tab + localStorage fallback.

---

## Design System

Definito in `proto-app.css`:

```css
--color-primary:        #117299   /* ENI Teal */
--color-primary-dark:   #0d4f6f
--color-primary-light:  #e6f0f6
--color-primary-lighter:#1e9fd8
--color-bg:             #ffffff
--color-text:           #111827
--color-text-muted:     #6b7280
--color-border:         #e5e7eb
```

**App**: max-width 420px. Non aumentare.
**Tablet**: landscape, max-width 900px, font-size base 16px.
**CRM**: desktop full-width, 3 colonne.

---

## Convenzioni di Codice

| Contesto | Convenzione | Esempio |
|---|---|---|
| Prefisso `tp` | variabili Telepedaggio | `tpActive`, `tpSaldo` |
| Prefisso `pg` | variabili Parcheggi | `pgList`, `pgMovimenti` |
| Prefisso `ac` | variabili Area C | `acAttiva`, `acMovimenti` |
| Prefisso `rsa` | variabili RSA | `rsaAttiva`, `rsaCallActive` |
| Prefisso `memo` | variabili Memo | `memoVeicoli`, `memoSelectedVeicolo` |
| Nomi eventi bus | `entità:azione` kebab | `cliente:registrato`, `sosta:avviata` |

---

## Data Model — Direttive Architetturali (vincolanti)

### `clientiDemo` è il single source of truth

**`localStorage.clientiDemo`** è unica fonte di verità per tutti dati persistenti. Tutte modifiche a dati condivisi (anagrafica, contratti, servizi, movimenti, consensi) passano da qui. `clienteProfile` e `crmClienti` sono layer derivati, non fonti alternative.

### Schema `ClienteRecord`

```js
// localStorage: "clientiDemo"  →  { [CF_UPPERCASE]: ClienteRecord }

{
  // ANAGRAFICA
  cf: "RSSMRC80A01H501Z",
  nome: "Mario", cognome: "Rossi",
  dataNascita: "1980-01-01",
  indirizzo: "Via Roma", civico: "1",
  comune: "Milano", provincia: "MI", cap: "20100", stato: "IT",
  telefono: "+39 333 1234567",
  email: "mario.rossi@email.com",

  // META
  dataRegistrazione: "2026-04-13T10:30:00.000Z",
  canale: "stazione",  // "stazione" | "app" | "web"

  // VEICOLI
  targhe: ["AB123CD", "EF456GH"],

  // CONSENSI
  consensi: {
    informativaPrecontrattuale: true,
    privacyMarketing: false,
    privacyTerzi: false,
    mandatoSdd: true,
    dataFirma: "2026-04-13T10:30:00.000Z"
  },

  // CONTRATTI
  contratti: [
    {
      id: "c1_RSSMRC80",
      tipo: "obu",           // "obu" | "rsa_standalone"
      stato: "attivo",       // "attivo" | "sospeso" | "chiuso"
      dataCreazione: "2026-04-13T10:30:00.000Z",
      iban: "IT60X0542811101000000123456",
      totale: 6.50,
      obu: [
        { codice: "OBU-001234", targa: "AB123CD", rsa: true, furto: false, stato: "attivo" }
      ],
      rsaStandalone: []      // [{ targa }], max 2 per contratto
    }
  ],

  // SERVIZI ATTIVI — snapshot aggiornato dai Bus events
  serviziAttivi: {
    telepedaggio: { attivo: true,  dataAttivazione: "2026-04-13T10:30:00.000Z", targa: "AB123CD", obu: "OBU-001234" },
    rsa:          { attivo: true,  dataAttivazione: "2026-04-13T10:30:00.000Z", targhe: ["AB123CD"] },
    areac:        { attivo: false },
    parcheggi:    { attivo: false },
    strisceBlu:   { attivo: false },
    memo:         { attivo: false }
  },

  // MOVIMENTI — persistiti immediatamente ad ogni evento, non solo a fine sessione
  movimenti: [
    {
      id: "mov_001",
      data: "2026-04-13T11:00:00.000Z",
      servizio: "telepedaggio",  // "telepedaggio"|"rsa"|"areac"|"parcheggi"|"strisce_blu"|"memo"
      importo: -3.20,            // negativo = addebito, positivo = accredito
      targa: "AB123CD",
      stato: "completato",       // "completato" | "in_corso" | "annullato"
      descrizione: "Casello A1 Milano Nord",
      dettagli: {}               // oggetto libero per dati servizio-specifici
    }
  ]
}
```

### Regole di persistenza

1. **Movimenti: scritti immediatamente** — ogni evento che genera movimento (casello, sosta, transito AreaC, ecc.) scrive subito in `clientiDemo[cf].movimenti`. State Alpine è proiezione in-memory derivata da `clientiDemo` all'init.

2. **Servizi attivi: aggiornati dai Bus events** — su `servizio:attivato` o `servizio:disattivato`, tutti componenti aggiornano `clientiDemo[cf].serviziAttivi` prima di aggiornare state Alpine.

3. **CRM: layer ibrido** — CRM legge `clientiDemo` come base, estende con dati solo-CRM (`casiAssistenza`, note operatore) persistiti in `crmClienti`. Al caricamento: `{ ...clientiDemo[cf], ...crmClienti[cf] }`. Dati condivisi → scrive su `clientiDemo` + emette Bus event; dati solo-CRM → scrive solo su `crmClienti`.

4. **`clienteProfile` è alias** — retrocompatibilità, sempre derivato da `clientiDemo[clienteAttivo]`. Non fonte autonoma.

### Chiavi localStorage — mappa completa

| Chiave | Struttura | Scope | Note |
|---|---|---|---|
| `clientiDemo` | `{ [CF]: ClienteRecord }` | **condiviso** | source of truth |
| `clienteAttivo` | `"CF_STRING"` | condiviso | cliente selezionato in emulatore/app |
| `clienteProfile` | `ClienteRecord` | alias | derivato da `clientiDemo[clienteAttivo]` |
| `crmClienti` | array clienti CRM | solo-CRM | estende `clientiDemo`, non sostituisce |
| `tabletOperator` | `{ nome, stazione }` | solo-tablet | stato login operatore |
| `scenarioSettings` | `{ iframeUrl, ... }` | solo-emulatore | impostazioni UI demo |
| `enilive-bus-last-event` | `{ event, payload, _t }` | bus.js | fallback BroadcastChannel, non toccare |

---

## Cosa NON Fare

- **Non modificare `protoConEmulatore_old.html`** — file legacy
- **Non aumentare max-width oltre 420px** nell'app mobile
- **Non introdurre package manager o build process**
- **Non aggiungere nuovi CDN** senza motivo
- **Non hardcodare colori hex** nel markup — usare custom properties
- **Non usare `postMessage` diretto** tra tab — usare sempre `bus.js`
- **Non scrivere su `localStorage` direttamente** per comunicare tra pannelli — passare sempre dal bus
- **Non persistere movimenti solo a fine sessione** — ogni movimento va scritto subito in `clientiDemo[cf].movimenti`
- **Non creare chiavi localStorage alternative** per dati già coperti da `clientiDemo` — estendere schema esistente

---

## Aree di Potenziale Sviluppo Futuro

- **Chatbot**: collegare a logica reale (es. Claude API) per risposte contestuali
- **Loyalty**: punti dinamici basati su movimenti reali
- **Bundle**: collegare attivazione piano ai servizi app
- **flows.html**: aggiungere swimlane per Parcheggi e Strisce Blu
- **tablet.html**: aggiungere step Strisce Blu (attivazione targa)
- **Notifiche push mock**: simulare reminder Memo con timer/badge in-app

---

**Nuovi stati proto-app.html (SMS emulatore):**
- `smsInbox`, `showSmsWebview`, `smsCurrentDoc`, `showSmsNotification`, `smsCurrentNotif`, `smsOtpShown`

**Metodi SMS:** `smsOpenNotif()`, `smsDismissNotif()`, `smsOpenWebview()`, `smsCloseWebview()`, `smsConfirmDoc(template)`

**Codici OTP mock nel webview:** `OTP_CONSENSI` → `1234` | `FIRMA_CONTRATTO` → `5678`

---

*Ultimo aggiornamento: 2026-04-13 (nuovo modello contrattuale multi-contratto + azioni rapide OBU assistenza + data model unificato clientiDemo)*
