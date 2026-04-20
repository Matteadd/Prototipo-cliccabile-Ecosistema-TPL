# Requirements: Assistenza App (Self-service Cliente)

> Generato da BUR: ELV26-014 Telepedaggio BUR Assistenza v02 — Aprile 2026  
> Da implementare in: `proto-app.html`, `proto-app.css`  
> File coordinato con: `requirements_assistenza_tablet.md`  
> Dipendenze bus: ascolta eventi da `tablet.html`, emette eventi verso `crm.html`

---

## 1. Panoramica

L'app Enilive espone al cliente una serie di funzionalità di post-vendita self-service, accessibili prevalentemente dalla sezione **Profilo/Account** e dalla sezione **Garage**. Il cliente può aggiornare i propri dati, gestire il dispositivo OBU, consultare e contestare transiti, scaricare documenti fiscali, e ricevere assistenza guidata tramite chatbot. Alcune di queste funzionalità reagiscono anche agli eventi emessi dal tablet del gestore (es. se il gestore blocca un OBU in store, l'app lo mostra al cliente).

---

## 2. Funzionalità da aggiungere — mappa per sezione app

| Sezione app | Funzionalità nuova |
|---|---|
| Account → Profilo | Modifica residenza/domicilio, Modifica contatti (OTP), Esenzione IVA, Le mie fatture, Recupero password |
| Account → Metodi di pagamento | Aggiunta IBAN (OTP) + aggiunta carta (POS mock) |
| Garage | Modifica dati veicolo, Gestisci OBU (cambio targa + blocco) |
| Telepedaggio → Movimenti | Filtro transiti irregolari, Segnala mancata stazione, Disconosci transito, Scansione RMPP |
| Movimenti (trasversale) | Selezione multipla movimenti → Crea nota spese |
| Chatbot | FAQ mock + instradamento store + apertura ticket |

---

## 3. Stato Alpine da aggiungere in x-data

```javascript
// ── Profilo ──────────────────────────────────────────────
profiloEditMode: false,           // modifica dati anagrafici attiva
profiloOtpSent: false,            // OTP inviato per modifica contatti
profiloOtpValue: '',              // valore OTP inserito dal cliente
profiloOtpField: null,            // 'email' | 'cellulare' — quale campo si sta certificando
showIvaModal: false,              // modal esenzione IVA
ivaFormCompilato: false,          // form esenzione IVA compilato
ivaOtpSent: false,
showFattureModal: false,          // modal lista fatture
fattureList: [],                  // lista fatture mock

// ── Metodi di pagamento ───────────────────────────────────
showPagamentoModal: false,
pagamentoStep: 'selezione',       // 'selezione' | 'iban' | 'carta' | 'otp' | 'pos' | 'conferma'
nuovoPagamentoTipo: null,         // 'iban' | 'carta'
nuovoPagamentoIban: '',
nuovoPagamentoCarta: { intestatario: '', pan: '', scadenza: '', cvv: '' },

// ── Garage: gestione OBU ──────────────────────────────────
showGestisciObuModal: false,
gestisciObuVeicolo: null,         // veicolo selezionato per gestione OBU
gestisciObuStep: 'menu',          // 'menu' | 'cambia_targa' | 'blocco' | 'conferma'
gestisciObuNuovaTarga: '',
gestisciObuBloccoConfermato: false,
gestisciObuPolizzaAttiva: false,  // mock: false → mostra warning penale

// ── Transiti irregolari ───────────────────────────────────
showTransitiIrregolariModal: false,
transitiIrregolari: [],           // lista transiti filtrati come irregolari
transitoSelezionato: null,        // transito su cui si sta operando
transitoAzioneType: null,         // 'mancata_stazione' | 'disconoscimento'
transitoStazioneCorretta: '',
transitoMotivoDisconoscimento: null,

// ── RMPP ─────────────────────────────────────────────────
showRmppModal: false,
rmppStep: 'scan',                 // 'scan' | 'riepilogo' | 'pagamento' | 'conferma'
rmppCodice: '',
rmppImporto: null,

// ── Nota spese ────────────────────────────────────────────
movimentiSelezionati: [],         // id movimenti selezionati per nota spese
showNotaSpesModal: false,

// ── Chatbot / Assistenza ──────────────────────────────────
chatbotStep: 'faq',              // 'faq' | 'escalation'
chatbotQuery: '',
chatbotRisultati: [],
showTicketModal: false,
ticketForm: { categoria: '', sottocategoria: '', tipologia: '', note: '' },
ticketNumero: null,               // numero ticket generato dopo conferma

// ── Reazione a eventi bus da store ───────────────────────
assistenzaStoreBanner: null,      // messaggio banner da mostrare se arriva evento da tablet
```

---

## 4. Funzioni Alpine da implementare

### `apriProfiloEdit()`
Imposta `profiloEditMode = true`. Mostra i campi profilo come input editabili.

### `salvaResidenza()`
Salva i dati di residenza/domicilio modificati. No OTP. Toast "Dati aggiornati". Emette `assistenza:dati_aggiornati` con `canale: 'app'`.

### `avviaModificaContatto(field)`
Setta `profiloOtpField = field`, simula invio OTP (toast "OTP inviato a [contatto]", `profiloOtpSent = true`).

### `confermOtpContatto()`
Accetta qualsiasi valore di 6 cifre. Se valido: aggiorna il contatto, toast "Contatto aggiornato", emette `assistenza:dati_aggiornati`.

### `apriIvaModal()`
Apre `showIvaModal`. Mostra form autodichiarazione esenzione IVA.

### `inviaIvaForm()`
Simula invio OTP per firma. Dopo conferma: toast "Autodichiarazione registrata. Fatturazione aggiornata.", chiude modal.

### `apriPagamentoModal()`
Apre `showPagamentoModal`, step `'selezione'`.

### `selezionaTipoPagamento(tipo)`
Setta `nuovoPagamentoTipo` e avanza allo step corrispondente (`'iban'` o `'carta'`).

### `confermaIban()`
Simula verifica titolarità (delay 1s) → step `'otp'` → dopo OTP confermato: toast "IBAN aggiunto", emette `assistenza:pagamento_aggiornato`.

### `confermaCarta()`
Simula verifica POS (delay 1.5s) → toast "Carta aggiunta", emette `assistenza:pagamento_aggiornato`. **No OTP per carta.**

### `apriGestisciObu(veicolo)`
Setta `gestisciObuVeicolo = veicolo`, apre `showGestisciObuModal`, step `'menu'`.

### `avviaCambioTarga()`
Step `'cambia_targa'`. Se `gestisciObuNuovaTarga === 'AA000AA'` → mostra errore "Targa occupata da altro contratto. Recarsi in store con documentazione." Se targa libera → step `'conferma'`.

### `confermaCambioTarga()`
Toast "Targa aggiornata. Whitelist in aggiornamento.". Emette `assistenza:targa_cambiata`. Chiude modal.

### `avviaBloccaObu()`
Step `'blocco'`. Mostra `gestisciObuPolizzaAttiva` (false nel mock) → se false: warning penale.

### `confermaBloccoObu()`
Toast "OBU inserito in blacklist. Attivo entro 12 ore. Per un nuovo dispositivo recati in store." Emette `assistenza:obu_bloccato`. Chiude modal.

### `apriTransitiIrregolari()`
Popola `transitiIrregolari` con dati mock. Apre `showTransitiIrregolariModal`.

### `selezionaTransito(transito, tipo)`
Setta `transitoSelezionato` e `transitoAzioneType`.

### `confermaSegnalazioneTransito()`
Toast "Segnalazione inviata. Ticket aperto automaticamente." Emette `assistenza:transito_segnalato`. Chiude modal.

### `apriRmppModal()`
Apre `showRmppModal`, step `'scan'`.

### `simulaScanRmpp()`
Delay 1.5s (animazione scanner) → autofill `rmppCodice = 'RMPP-2026-00456'`, `rmppImporto = 12.40` → step `'riepilogo'`.

### `confermaRmpp()`
Se cliente Mobility (mock: sempre sì) → importo su prossima fattura → toast "RMPP registrato. Importo aggiunto alla prossima fattura." Emette `assistenza:rmpp_registrato`.

### `toggleMovimentoSelezionato(id)`
Aggiunge/rimuove `id` da `movimentiSelezionati`.

### `apriNotaSpese()`
Richiede almeno un movimento selezionato. Apre `showNotaSpesModal`.

### `generaNotaSpese()`
Toast "Nota spese generata e inviata via email." Emette `assistenza:documento_inviato` con `tipo: 'nota_spese'`.

### `cercaFaq(query)`
Filtra array FAQ mock per keyword. Popola `chatbotRisultati`.

### `escalateChatbot()`
Step `'escalation'`: mostra store più vicino (hardcoded), numero telefono, pulsante "Apri ticket".

### `apriTicketModal()`
Apre `showTicketModal`.

### `confermaTicket()`
Genera `ticketNumero = 'TKT-2026-' + Math.floor(Math.random()*90000+10000)`. Toast "Ticket aperto. Riceverai conferma via email." Emette `assistenza:ticket_aperto`. Chiude modal.

### `ascoltaEventiBusStore()`
Da chiamare in `init()`. Registra `Bus.on` per tutti gli eventi `assistenza:*` emessi dal tablet. Per gli eventi rilevanti per il cliente, imposta `assistenzaStoreBanner` con un messaggio contestuale (es. per `assistenza:obu_bloccato` → "Il tuo dispositivo OBU è stato bloccato. Per richiederne uno nuovo recati in store.").

---

## 5. Struttura componenti UI

### 5.1 Sezione Profilo — modifiche

Nella pagina Account, sotto i dati anagrafici già presenti, aggiungere:

**Blocco "Dati di contatto"** con pulsante "Modifica" per email e cellulare separatamente → attiva OTP per ciascuno.

**Blocco "Residenza / Domicilio"** con pulsante "Modifica" → form inline, no OTP.

**Blocco "Le mie fatture"** → lista fatture mock con pulsante "Scarica PDF" (simula download con toast) e "Invia via email".

**Blocco "Esenzione IVA"** → CTA "Richiedi esenzione IVA" → apre `showIvaModal`.

### 5.2 Garage — nuova CTA per OBU

Per ogni veicolo nel Garage che ha un OBU associato (mock: primo veicolo), mostrare pulsante aggiuntivo **"Gestisci OBU"** → apre `showGestisciObuModal`.

Il modal ha struttura bottom-sheet con:
- **Step menu**: due opzioni grandi — "Cambia targa associata" / "Blocca dispositivo (furto/smarrimento)"
- **Step cambia_targa**: input nuova targa + warning occupata + riepilogo
- **Step blocco**: warning polizza + info "Per nuovo dispositivo vai in store" + pulsante conferma
- **Step conferma**: animazione successo + riepilogo operazione

### 5.3 Telepedaggio — sezione Transiti irregolari

Nella pagina Telepedaggio, sotto la lista movimenti/transiti esistente, aggiungere un pulsante **"Transiti irregolari"** → apre `showTransitiIrregolariModal`.

Il modal mostra:
- Lista transiti mock con badge "IRREGOLARE" per quelli segnalabili
- Click su transito → scelta: "Mancata stazione d'ingresso" o "Disconoscimento transito"
- Se mancata stazione: dropdown selezione stazione corretta
- Se disconoscimento: radio motivazione (errata classe / doppio transito / transito errato / sconto mancante)
- Pulsante "Invia segnalazione"

### 5.4 Movimenti — nota spese

Nella lista movimenti (sezione Movimenti esistente), aggiungere:
- Checkbox su ogni movimento (visibili solo in "modalità selezione")
- Pulsante **"Seleziona movimenti"** che attiva la modalità selezione
- Quando almeno un movimento è selezionato: FAB (floating button) **"Crea nota spese"** → apre `showNotaSpesModal`
- Il modal mostra il riepilogo dei movimenti selezionati + pulsante "Genera e invia PDF"

### 5.5 Telepedaggio — scansione RMPP

Nella pagina Telepedaggio, aggiungere CTA **"Paga un RMPP"** (rapporto mancato pagamento pedaggio).

Modal con:
- **Step scan**: pulsante "Scansiona barcode" (animazione mock camera) + alternativa inserimento manuale codice
- **Step riepilogo**: dettaglio RMPP (concessionaria, data, importo)
- **Step pagamento**: se cliente Mobility → messaggio "Importo aggiunto alla prossima fattura" | se no → form POS simulato
- **Step conferma**: ricevuta mock

### 5.6 Chatbot — potenziamento

La sezione Chatbot (già presente come mock) viene arricchita:

**Step FAQ**: input di ricerca + lista di 6 FAQ mock:
1. "Come funziona il telepedaggio?" 
2. "Come cambio la targa associata al mio OBU?"
3. "Ho perso l'OBU, cosa faccio?"
4. "Come contesto un transito?"
5. "Come cambio il metodo di pagamento?"
6. "Come disattivo un servizio?"

Ogni FAQ espandibile mostra risposta sintetica + link alla funzionalità diretta (es. FAQ cambio targa → pulsante "Vai al Garage → Gestisci OBU").

**Step escalation** (se FAQ non risolutiva): pulsante "Non ho trovato risposta" → mostra:
- Card "Trova uno store" con indirizzo hardcoded Milano + pulsante "Apri in Maps"
- Card "Chiama l'assistenza" con numero mock `800 XXX XXX`
- Card "Apri una segnalazione" → apre form ticket

### 5.7 Banner eventi da store

In cima all'app (sotto la topbar), se `assistenzaStoreBanner !== null`, mostrare un banner informativo dismissibile con `x-show` e stile `bg-amber-50 border-amber-200`. Il banner scompare al click sulla X o dopo 10 secondi.

---

## 6. Dati mock da aggiungere in x-data

```javascript
// FAQ chatbot
chatbotFaq: [
  { id: 1, domanda: 'Come funziona il telepedaggio?', risposta: 'Il dispositivo OBU installato sul veicolo permette il transito automatico ai caselli autostradali. Gli importi vengono addebitati sulla fattura mensile.' },
  { id: 2, domanda: 'Come cambio la targa associata al mio OBU?', risposta: 'Puoi cambiare la targa direttamente dal Garage → Gestisci OBU, oppure recandoti in una Enilive Station.' },
  { id: 3, domanda: 'Ho perso il dispositivo OBU, cosa faccio?', risposta: 'Puoi bloccarlo subito dal Garage → Gestisci OBU → Blocca dispositivo. Per richiederne uno nuovo recati in store.' },
  { id: 4, domanda: 'Come contesto un transito?', risposta: 'Vai nella sezione Telepedaggio → Transiti irregolari, seleziona il transito e scegli il tipo di contestazione.' },
  { id: 5, domanda: 'Come cambio il metodo di pagamento?', risposta: 'Dal profilo → Metodi di pagamento puoi aggiungere un nuovo IBAN o carta di credito/debito.' },
  { id: 6, domanda: 'Come disattivo un servizio?', risposta: 'Ogni servizio ha una CTA di disattivazione nella propria sezione. Per il recesso dal Telepedaggio è necessario recarsi in store.' }
],

// Transiti irregolari mock
transitiIrregolariMock: [
  { id: 'TRX-001', data: '2026-04-02', autostrada: 'A1 Milano-Bologna', uscita: 'Bologna Fiera', importo: 8.40, stato: 'irregolare', tipo: 'mancata_ingresso' },
  { id: 'TRX-002', data: '2026-03-28', autostrada: 'A4 Milano-Torino', uscita: 'Torino Est', importo: 6.20, stato: 'irregolare', tipo: 'doppio_transito' }
],

// Fatture mock
fattureMock: [
  { id: 'F2026-001', mese: 'Marzo 2026', importo: 42.50, stato: 'pagata' },
  { id: 'F2026-002', mese: 'Aprile 2026', importo: 38.00, stato: 'in attesa' }
],

// Store più vicino (mock per chatbot)
storeVicino: {
  nome: 'Enilive Station Milano Certosa',
  indirizzo: 'Via Certosa 42, 20155 Milano',
  mapsUrl: 'https://maps.google.com/?q=Via+Certosa+42+Milano'
}
```

---

## 7. Ascolto eventi bus da tablet (in init())

```javascript
// Ascolta eventi emessi dal tablet del gestore
Bus.on('assistenza:obu_bloccato', (payload) => {
  this.assistenzaStoreBanner = `Il tuo dispositivo OBU (${payload.targa}) è stato bloccato. Per richiedere un nuovo dispositivo recati in una Enilive Station.`;
  // Aggiorna stato OBU nel garage se presente
});

Bus.on('assistenza:targa_cambiata', (payload) => {
  this.assistenzaStoreBanner = `La targa associata al tuo OBU è stata aggiornata a ${payload.targa_nuova}.`;
  // Aggiorna garage veicoli
});

Bus.on('assistenza:servizio_disattivato', (payload) => {
  this.assistenzaStoreBanner = `Il servizio ${payload.servizio} è stato disattivato.`;
  // Aggiorna serviziAttivi
});

Bus.on('assistenza:ticket_aperto', (payload) => {
  this.assistenzaStoreBanner = `Ticket ${payload.numero_ticket} aperto. Riceverai aggiornamenti via email.`;
});

Bus.on('assistenza:rimodulazione_revocata', (payload) => {
  this.assistenzaStoreBanner = `La rimodulazione tariffaria ${payload.tipo_rimodulazione} è stata revocata.`;
});
```

---

## 8. Nuovi eventi bus emessi dall'app

| Evento | Payload | Chi ascolta |
|---|---|---|
| `assistenza:dati_aggiornati` | `{ campo, canale: 'app' }` | crm |
| `assistenza:pagamento_aggiornato` | `{ tipo: 'iban'\|'carta', canale: 'app' }` | crm |
| `assistenza:targa_cambiata` | `{ obu, targa_vecchia, targa_nuova, canale: 'app' }` | crm |
| `assistenza:obu_bloccato` | `{ obu, targa, motivo, canale: 'app' }` | crm |
| `assistenza:transito_segnalato` | `{ transito_id, tipo, motivo?, canale: 'app' }` | crm |
| `assistenza:rmpp_registrato` | `{ codice_rmpp, importo, canale: 'app' }` | crm |
| `assistenza:documento_inviato` | `{ tipo: 'fattura'\|'nota_spese', canale: 'app' }` | crm |
| `assistenza:ticket_aperto` | `{ numero_ticket, categoria, canale: 'app' }` | crm |

---

## 9. Aggiornamento crm.html — nuovi eventi da loggare

Il CRM deve registrare nel log eventi live tutti gli eventi `assistenza:*` provenienti da entrambi i canali (`canale: 'store'` e `canale: 'app'`), mostrando nel feed:
- Icona diversa per canale store (🏪) vs app (📱)
- Tipo operazione + dettagli payload
- Timestamp

Nessuna modifica strutturale al CRM — solo aggiunta dei listener `Bus.on('assistenza:*', ...)` nel catalogo eventi esistente.

---

## 10. Cosa NON implementare nel prototipo app

- OTP reale via SMS/email → qualsiasi 6 cifre accettate dopo delay 1s
- Integrazione Motorizzazione Civile per scadenze → dati mock già in Memo
- POS online reale per carta → form mock con delay + conferma
- Download PDF fattura/nota spese reale → toast "PDF inviato via email"
- Geolocalizzazione reale store → indirizzo hardcoded
- Scansione barcode RMPP reale → animazione mock + autofill
- Verifica targa occupata reale → solo targa "AA000AA" restituisce errore nel mock
- Notifiche push → banner in-app come `assistenzaStoreBanner`

---

## Come usare questo file con Claude Code

1. Apri Claude Code in VS Code sul progetto PrototipoApp
2. Avvia una nuova sessione
3. Scrivi: "Leggi il file `requirements/requirements_assistenza_app.md` e implementa le funzionalità di assistenza self-service in `proto-app.html` seguendo esattamente le istruzioni. Leggi anche il `CLAUDE.md` per il contesto architetturale."
4. Claude Code leggerà questo file + il CLAUDE.md e procederà all'implementazione
5. **Nota**: implementare questo file DOPO `requirements_assistenza_tablet.md`, poiché gli eventi bus emessi dal tablet devono già essere definiti
