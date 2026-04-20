# Requirements: Assistenza Tablet (Gestore Enilive Station)

> Generato da BUR: ELV26-014 Telepedaggio BUR Assistenza v02 — Aprile 2026  
> Da implementare in: `tablet.html`  
> File coordinato con: `requirements_assistenza_app.md`  
> Dipendenze bus: emette eventi letti da `crm.html` e `proto-app.html`

---

## 1. Panoramica

Il tablet del gestore Enilive Station acquisisce una nuova modalità operativa: **Assistenza**. Dopo il login, il gestore sceglie se avviare un'operazione di vendita (flusso onboarding esistente, invariato) o un'operazione di assistenza. Nel flusso assistenza, il gestore cerca un cliente già registrato, visualizza una scheda riepilogativa, e seleziona l'azione da eseguire da una griglia di pulsantoni raggruppati per categoria.

---

## 2. Modifiche alla struttura esistente di tablet.html

### 2.1 Login (invariato)
Il login esistente non cambia. Dopo il login compare la schermata di selezione modalità.

### 2.2 Schermata selezione modalità (NUOVA)
Dopo il login, prima di qualsiasi flusso, mostrare una schermata con due CTA grandi:

- **VENDITA** — icona `fa-file-contract` — avvia il flusso onboarding esistente (as-is)
- **ASSISTENZA** — icona `fa-headset` — avvia il nuovo flusso assistenza

Variabile Alpine da aggiungere:
```javascript
tabletMode: null,  // null | 'vendita' | 'assistenza'
```

Quando `tabletMode === 'vendita'` → mostra il flusso multi-step esistente invariato.  
Quando `tabletMode === 'assistenza'` → mostra il flusso assistenza descritto di seguito.

---

## 3. Flusso Assistenza — Struttura generale

```
[Ricerca cliente] → [Scheda cliente] → [Griglia azioni] → [Flusso specifico] → [Conferma + bus event]
```

### 3.1 Step 1 — Ricerca cliente

Form di ricerca con tre campi alternativi (uno alla volta, con tab o radio):
- **Codice Fiscale** (input testo, uppercase automatico)
- **Targa veicolo** (input testo, uppercase automatico)
- **Email / Cellulare** (input testo)

Pulsante "Cerca cliente". Il sistema simula la ricerca con un `setTimeout` di 800ms e restituisce sempre un cliente mock (dati hardcoded — vedi sezione 9).

Se cliente non trovato → toast errore "Nessun cliente trovato con i dati inseriti".

Variabili Alpine:
```javascript
assistSearchQuery: '',
assistSearchType: 'cf',   // 'cf' | 'targa' | 'contatto'
assistSearchLoading: false,
assistCliente: null,       // null | oggetto cliente trovato
```

### 3.2 Step 2 — Scheda cliente (riepilogo rapido)

Una volta trovato il cliente, mostrare una card riepilogativa compatta con:
- Nome e Cognome + Codice Fiscale
- Email + Cellulare
- Veicoli registrati (lista targhe con tipo/marca)
- Servizi attivi (badge colorati: Telepedaggio, RSA, Area C, Memo, Strisce Blu, Parcheggi)
- OBU associati (codice OBU + targa)
- Metodo di pagamento attivo
- Badge alert se ci sono ticket aperti (numero ticket)

Pulsante "Procedi con assistenza" → mostra la griglia azioni.  
Pulsante "← Nuova ricerca" → torna allo step 1.

### 3.3 Step 3 — Griglia azioni assistenza

6 categorie, ciascuna con i relativi pulsantoni. Layout: griglia 2 colonne di categorie, ogni categoria ha i suoi pulsanti verticali.

#### Categoria 1 — 👤 Dati Cliente
- Aggiorna residenza / domicilio
- Aggiorna dati di contatto
- Aggiorna dati veicolo

#### Categoria 2 — 📱 Dispositivo OBU
- Sostituisci OBU (malfunzionamento)
- Cambio targa associata a OBU
- Furto / Smarrimento OBU
- Restituzione OBU

#### Categoria 3 — 💳 Contratto & Pagamenti
- Modifica metodo di pagamento
- Adesione rimodulazione tariffaria
- Revoca rimodulazione tariffaria
- Disattivazione servizio / Recesso

#### Categoria 4 — 🧾 Documenti
- Richiesta fattura
- Richiesta nota spese
- Scansione RMPP

#### Categoria 5 — 🔁 Transiti
- Mancata stazione d'ingresso
- Disconoscimento transito

#### Categoria 6 — 🎫 Ticket & Altro
- Apri ticket 2° livello
- Feedback post-assistenza
- Recupero credenziali cliente

Variabile Alpine:
```javascript
assistAzione: null,   // stringa identificativa dell'azione selezionata
```

Ogni pulsante setta `assistAzione` al proprio identificatore (es. `'sostituisci-obu'`) e mostra il relativo pannello di flusso.

---

## 4. Flussi specifici per ogni azione

Per ogni flusso: form contestuale + pulsante "Conferma operazione" + OTP simulato dove previsto + evento bus emesso a conferma.

### 4.1 Aggiorna residenza / domicilio
- Mostra campi precompilati: via, CAP, città, provincia — separati per residenza e domicilio
- Gestore modifica i campi necessari
- Conferma → toast "Dati aggiornati" → bus event `assistenza:dati_aggiornati`
- **No OTP** (autenticazione in store sufficiente)

### 4.2 Aggiorna dati di contatto
- Mostra email e cellulare attuali come campi editabili
- Se modificato almeno un campo → OTP simulato (toast "OTP inviato al nuovo contatto")
- Input "Inserisci OTP" → qualsiasi valore di 6 cifre accettato
- Conferma → toast "Dati di contatto aggiornati" → bus event `assistenza:dati_aggiornati`

### 4.3 Aggiorna dati veicolo
- Lista veicoli del cliente con pulsante "Modifica" per ciascuno
- Form: targa, tipo (Automobile/Moto/Furgone), marca, modello
- Possibilità di aggiungere nuovo veicolo
- Conferma → toast "Veicolo aggiornato" → bus event `assistenza:veicolo_aggiornato`

### 4.4 Sostituisci OBU (malfunzionamento)
- Mostra lista OBU associati al contratto con relativa targa
- Gestore seleziona l'OBU da sostituire
- Campo "Nuovo codice OBU" (input testo, simula scansione con pulsante icona scanner)
- Sistema verifica disponibilità stock (mock: sempre disponibile)
- OTP simulato per conferma cliente
- Conferma → toast "OBU sostituito. Aggiornamento whitelist avviato." → bus event `assistenza:obu_sostituito`
- **Nessun costo aggiuntivo** — mostrare nota informativa

### 4.5 Cambio targa associata a OBU
- Mostra lista OBU con targa attuale
- Gestore seleziona OBU e inserisce nuova targa
- Warning se targa già occupata da altro contratto (mock: mostra warning per targa "AA000AA")
- Se nuova targa libera → OTP simulato
- Conferma → toast "Targa aggiornata. Whitelist in aggiornamento." → bus event `assistenza:targa_cambiata`

### 4.6 Furto / Smarrimento OBU
- Mostra lista OBU del cliente
- Gestore seleziona OBU da bloccare
- Mostra info polizza furto/smarrimento: se assente → warning "Verrà applicata penale contrattuale"
- Toggle "Il cliente vuole un OBU sostitutivo?" → se sì, rimanda al flusso 4.4
- Pulsante "Blocca dispositivo"
- OTP simulato
- Conferma → toast "OBU inserito in blacklist entro 12 ore" → bus event `assistenza:obu_bloccato`

### 4.7 Restituzione OBU
- Mostra lista OBU del cliente
- Gestore seleziona OBU da restituire (scansione mock o selezione da lista)
- Mostra riepilogo: OBU, targa, stato contratto
- Checkbox "OBU ricevuto fisicamente dal cliente"
- OTP simulato per conferma
- Conferma → toast "Restituzione registrata. Stock aggiornato." → bus event `assistenza:obu_restituito`

### 4.8 Modifica metodo di pagamento
- Mostra metodo di pagamento attuale (IBAN mascherato o tipo carta)
- Radio: "IBAN" / "Carta di credito/debito"
- Se IBAN: input IBAN → OTP simulato per verifica titolarità
- Se carta: mostra form POS simulato (intestatario, PAN, scadenza, CVV) → conferma diretta
- Conferma → toast "Metodo di pagamento aggiornato" → bus event `assistenza:pagamento_aggiornato`

### 4.9 Adesione rimodulazione tariffaria
- Dropdown selezione tipo rimodulazione (es. "Sconto Moto", "Sconto Residenti", "Convenzione Aziendale")
- Mostra requisiti e % sconto associata
- Verifica requisiti cliente (mock: sempre idoneo)
- OTP simulato
- Conferma → toast "Rimodulazione attivata" → bus event `assistenza:rimodulazione_attivata`

### 4.10 Revoca rimodulazione tariffaria
- Mostra lista rimodulazioni attive
- Gestore seleziona quella da revocare
- Warning "La revoca è immediata e irreversibile"
- OTP simulato
- Conferma → toast "Rimodulazione revocata. Flusso Discounted List inviato." → bus event `assistenza:rimodulazione_revocata`

### 4.11 Disattivazione servizio / Recesso
- Checkbox list servizi attivi del cliente (Telepedaggio, RSA, Area C, ecc.)
- Gestore seleziona servizio da disattivare o recesso totale
- Warning "Il recesso dal Telepedaggio comporta la disattivazione di tutti i servizi collegati"
- OTP simulato
- Conferma → toast "Servizio disattivato" → bus event `assistenza:servizio_disattivato`

### 4.12 Richiesta fattura
- Lista fatture mock del cliente (mese, importo, stato: pagata/in attesa)
- Gestore seleziona fattura
- Pulsante "Invia PDF via email"
- Conferma → toast "Fattura inviata a [email cliente]" → bus event `assistenza:documento_inviato`

### 4.13 Richiesta nota spese
- Lista movimenti mock (ultimi 30 gg, filtrabili per servizio)
- Gestore seleziona uno o più movimenti (checkbox)
- Pulsante "Genera nota spese"
- Conferma → toast "Nota spese inviata a [email cliente]" → bus event `assistenza:documento_inviato`

### 4.14 Scansione RMPP
- Pulsante "Scansiona barcode" (simula apertura fotocamera — mostra icona scanner animata + delay 1.5s)
- In alternativa: input manuale codice RMPP
- Mostra riepilogo: importo, concessionaria, data
- Se cliente Mobility → importo aggiunto a prossima fattura
- Se cliente non Mobility → mostra form POS simulato
- Conferma → toast "RMPP registrato" → bus event `assistenza:rmpp_registrato`

### 4.15 Mancata stazione d'ingresso
- Lista transiti del cliente (mock) filtrabili per "irregolari"
- Gestore seleziona il transito
- Dropdown selezione stazione d'ingresso corretta
- Conferma → toast "Segnalazione inviata alla concessionaria. Ticket aperto." → bus event `assistenza:transito_segnalato`

### 4.16 Disconoscimento transito
- Lista transiti del cliente (mock)
- Gestore seleziona il transito
- Radio motivazione: "Errata classe veicolo" / "Doppio transito" / "Transito errato" / "Sconto mancante"
- Conferma → toast "Pratica inviata alla concessionaria. Ticket aperto." → bus event `assistenza:transito_segnalato`

### 4.17 Apri ticket 2° livello
- Form tripletta:
  - Dropdown "Categoria" (Telepedaggio / Parcheggi / Area C / RSA / Strisce Blu / Altro)
  - Dropdown "Sottocategoria" (dipendente dalla categoria)
  - Dropdown "Tipologia richiesta" (Reclamo / Informazione / Anomalia tecnica / Altro)
- Campo note libero (max 500 caratteri)
- Conferma → genera numero ticket mock (es. `TKT-2026-00123`) → toast "Ticket aperto. Email di conferma inviata al cliente." → bus event `assistenza:ticket_aperto`

### 4.18 Feedback post-assistenza
- Rating a stelle (1-5)
- Checkbox motivazioni (Tempi rapidi / Personale cortese / Problema risolto / Altro)
- Campo note opzionale
- Conferma → toast "Feedback registrato" → bus event `assistenza:feedback_registrato`
- **Nessun OTP necessario**

### 4.19 Recupero credenziali cliente
- Mostra email e cellulare certificati del cliente (mascherati: `m***@gmail.com`, `+39 3** *** 1234`)
- Gestore seleziona canale di invio (email o SMS)
- Sistema invia OTP simulato al contatto selezionato
- Cliente comunica OTP all'operatore → operatore lo inserisce
- Conferma → toast "Link di reset password inviato al cliente" → bus event `assistenza:credenziali_recuperate`
- Se cliente non ha contatti certificati → mostra warning "Il cliente deve aggiornare i dati di contatto prima di procedere" e rimanda al flusso 4.2

---

## 5. Stato Alpine da aggiungere in tablet.html

```javascript
// Modalità tablet
tabletMode: null,                  // null | 'vendita' | 'assistenza'

// Ricerca cliente
assistSearchQuery: '',
assistSearchType: 'cf',            // 'cf' | 'targa' | 'contatto'
assistSearchLoading: false,
assistCliente: null,               // oggetto cliente trovato (mock)
assistStep: 'ricerca',             // 'ricerca' | 'scheda' | 'griglia' | 'flusso'
assistAzione: null,                // identificatore azione selezionata

// OTP simulato (trasversale)
assistOtpSent: false,
assistOtpValue: '',
assistOtpConfirmed: false,

// Stato operazione corrente
assistOpLoading: false,
assistOpSuccess: false,
```

---

## 6. Evento bus da emettere (catalogo completo)

Tutti gli eventi vanno emessi via `Bus.emit(...)` al termine di ogni operazione confermata.

| Evento | Payload | Chi ascolta |
|---|---|---|
| `assistenza:dati_aggiornati` | `{ cf, campo, valore, canale: 'store' }` | crm |
| `assistenza:veicolo_aggiornato` | `{ cf, targa, operazione: 'modifica'\|'aggiunta' }` | crm, app |
| `assistenza:obu_sostituito` | `{ cf, obu_vecchio, obu_nuovo, targa }` | crm |
| `assistenza:targa_cambiata` | `{ cf, obu, targa_vecchia, targa_nuova }` | crm, app |
| `assistenza:obu_bloccato` | `{ cf, obu, targa, motivo: 'furto'\|'smarrimento' }` | crm, app |
| `assistenza:obu_restituito` | `{ cf, obu, targa }` | crm |
| `assistenza:pagamento_aggiornato` | `{ cf, tipo: 'iban'\|'carta' }` | crm |
| `assistenza:rimodulazione_attivata` | `{ cf, tipo_rimodulazione }` | crm |
| `assistenza:rimodulazione_revocata` | `{ cf, tipo_rimodulazione }` | crm, app |
| `assistenza:servizio_disattivato` | `{ cf, servizio }` | crm, app |
| `assistenza:documento_inviato` | `{ cf, tipo: 'fattura'\|'nota_spese', email }` | crm |
| `assistenza:rmpp_registrato` | `{ cf, codice_rmpp, importo }` | crm |
| `assistenza:transito_segnalato` | `{ cf, transito_id, tipo: 'mancata_stazione'\|'disconoscimento', motivo? }` | crm |
| `assistenza:ticket_aperto` | `{ cf, numero_ticket, categoria, tipologia }` | crm, app |
| `assistenza:feedback_registrato` | `{ cf, rating, note }` | crm |
| `assistenza:credenziali_recuperate` | `{ cf, canale: 'email'\|'sms' }` | crm |

---

## 7. Dati mock cliente (hardcoded)

```javascript
// Cliente mock restituito dalla ricerca
{
  nome: 'Marco',
  cognome: 'Bianchi',
  cf: 'BNCMRC85T10H501Z',
  email: 'marco.bianchi@email.it',
  cellulare: '+39 347 123 4567',
  residenza: { via: 'Via Roma 12', cap: '20100', citta: 'Milano', provincia: 'MI' },
  domicilio: { via: 'Via Torino 5', cap: '20123', citta: 'Milano', provincia: 'MI' },
  veicoli: [
    { targa: 'AB123CD', tipo: 'Automobile', marca: 'Fiat', modello: 'Panda' },
    { targa: 'EF456GH', tipo: 'Moto', marca: 'Honda', modello: 'CB500' }
  ],
  obu: [
    { codice: 'OBU-001-2024', targa: 'AB123CD', stato: 'attivo' }
  ],
  serviziAttivi: ['telepedaggio', 'rsa', 'areac'],
  metodoPagamento: { tipo: 'iban', valore: 'IT60 **** **** **** **** 1234' },
  rimodulazioni: [],
  ticketAperti: 1,
  fatture: [
    { id: 'F2026-001', mese: 'Marzo 2026', importo: 42.50, stato: 'pagata' },
    { id: 'F2026-002', mese: 'Aprile 2026', importo: 38.00, stato: 'in attesa' }
  ],
  movimenti: [
    { id: 'M001', data: '2026-04-08', servizio: 'Telepedaggio', descrizione: 'Casello A1 Milano Nord', importo: 4.20 },
    { id: 'M002', data: '2026-04-05', servizio: 'Parcheggi', descrizione: 'Parcheggio Centrale', importo: 8.00 }
  ]
}
```

---

## 8. Scenari Emulatore da aggiungere in protoConEmulatore.js

### Scenario: "Assistenza: OBU bloccato in store"
- Descrizione: Il gestore ha appena bloccato l'OBU del cliente per furto
- Precondizione: nessuna
- Funzione DEMO: `DEMO.simulaObuBloccatoDaStore()`
- Effetto: emette `assistenza:obu_bloccato` sul bus → app mostra banner "Il tuo dispositivo è stato bloccato" → CRM aggiorna stato

### Scenario: "Assistenza: servizio disattivato in store"
- Descrizione: Il gestore ha disattivato un servizio per recesso del cliente
- Funzione DEMO: `DEMO.simulaServizioDisattivatoDaStore()`
- Effetto: emette `assistenza:servizio_disattivato` → app aggiorna badge servizio → CRM log evento

### Scenario: "Assistenza: ticket aperto in store"
- Descrizione: Il gestore ha aperto un ticket di 2° livello
- Funzione DEMO: `DEMO.simulaTicketApertoDaStore()`
- Effetto: emette `assistenza:ticket_aperto` → CRM mostra nuovo ticket nel log

---

## 9. Cosa NON implementare nel prototipo tablet

- Scansione reale barcode/CF con fotocamera → simulare con pulsante "Scansiona" + delay + autofill mock
- Verifica stock OBU reale → sempre disponibile nel mock
- Invio OTP reale → qualsiasi 6 cifre inserite vengono accettate dopo 1.5s delay
- Flussi informativi verso Movyon/concessionarie → simulare con toast "Flusso inviato a [destinatario]"
- Riconoscimento delegato (documenti fisici) → mostrare solo checklist "Documenti verificati" da flaggare
- Integrazione CRM reale → solo bus events verso crm.html
- Gestione multi-OBU complessa → mostrare sempre il primo OBU del mock
- Processi B2B/flotte (fase 2 e 3 del BUR) → fuori scope MVP

---

## Come usare questo file con Claude Code

1. Apri Claude Code in VS Code sul progetto PrototipoApp
2. Avvia una nuova sessione
3. Scrivi: "Leggi il file `requirements/requirements_assistenza_tablet.md` e implementa il modulo Assistenza nel `tablet.html` seguendo esattamente le istruzioni. Leggi anche il `CLAUDE.md` per il contesto architetturale."
4. Claude Code leggerà questo file + il CLAUDE.md e procederà all'implementazione
