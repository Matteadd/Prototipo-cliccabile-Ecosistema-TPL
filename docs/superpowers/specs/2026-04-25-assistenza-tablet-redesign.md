# Assistenza Tablet — Redesign Flussi e Coerenza

**Data:** 2026-04-25  
**Scope:** `tablet.html` — sezione assistenza (tabletMode === 'assistenza')  
**Contesto:** Tutte le operazioni di assistenza avvengono fisicamente in store presso un gestore.

---

## Obiettivi

1. Quick actions con search entry point contestuale per azione (non generico)
2. Check anagrafica obbligatorio prima di ogni azione
3. Ogni `confermaOperazione` scrive su `clientiDemo` (localStorage)
4. Consolidamento `modifica-pagamento` → `cambio-pagamento`
5. Cambio targa con check RSA attiva sulla vecchia targa
6. Demo button (`?demo=1`) per testare il flusso dati incompleti

---

## Sezione 1 — Quick Actions: search entry point

### Mapping azione → tipo ricerca

| Action key | Ricerca entry | Input label | Note |
|---|---|---|---|
| `sostituisci-obu` | Scan OBU | — | Nessuna modifica |
| `restituzione-obu` | **Scan OBU** | — | Device restituito fisicamente; era CF/targa generico |
| `cambio-targa-obu` | **Solo targa** | "Vecchia targa associata all'OBU" | Placeholder "es. AB123CD"; era CF/targa generico |
| `furto-obu` | **Solo CF** | "Codice Fiscale cliente" | Device sparito; era CF/targa generico |
| `recupero-credenziali` | **Email o telefono** | "Email o cellulare" | Chi non ricorda credenziali di solito non sa il CF |
| `cambio-pagamento` | CF o targa | Nessuna modifica | Step dedicato già esistente |

### Modifiche al template `quick-obu`

Il ramo generico `x-if="quickObuAction !== 'sostituisci-obu'"` viene suddiviso in 4 rami espliciti:

1. `sostituisci-obu` → scan OBU (già esiste, nessuna modifica)
2. `restituzione-obu` → scan OBU (copia del ramo sostituisci, senza il form "nuovo OBU" dopo conferma)
3. `cambio-targa-obu` → input targa sola, uppercase, label contestuale
4. `furto-obu` → input CF solo, uppercase

### Step `recupero-credenziali`

Il campo di ricerca cambia da CF/targa a **email o telefono** (`assistSearchType = 'contatto'` nella funzione `cercaClienteRecupero`).

---

## Sezione 2 — Check anagrafica pre-azione

### Metodo `_checkAnagraficaPreAzione(azione)`

Nuovo metodo estratto da `confermaProcediQuickObu()`, richiamato da:
- `confermaProcediQuickObu()` (path quick actions) — usa `this.quickObuSearchResult` come raw record
- `avviaAzione(azione)` (path griglia) — usa `this.assistCliente` già caricato

Ritorna `true` se i dati sono completi (il chiamante procede). Ritorna `false` se ci sono campi mancanti (il metodo gestisce internamente il redirect ad `aggiorna-scheda`).

### Campi validati

| Campo | Sempre obbligatorio | Solo per azioni pagamento |
|---|---|---|
| `nome` + `cognome` | ✓ | — |
| `contatti.telefono` | ✓ | — |
| `contatti.email` | ✓ | — |
| `consensi.privacy` | ✓ | — |
| `contratti[0].iban` | — | ✓ solo per `cambio-pagamento` |

**Azioni pagamento** = `['cambio-pagamento']`

### Comportamento se campi mancanti

1. Popola `missingFields[]` con i nomi dei campi mancanti
2. Popola `aggiornaDatiForm` con valori correnti (pre-fill)
3. Imposta `quickObuNextStep = 'flusso'` e `assistAzione = azione` (sia per path quick che griglia — dopo salvataggio si rientra sempre nel flusso dell'azione)
4. Va a `assistStep = 'aggiorna-scheda'`
5. Dopo `salvaAggiornaDati()`, riprende il flusso con `assistAzione` già impostata

Lo step `aggiorna-scheda` già esistente gestisce il form — modifica minore al template: aggiunta del campo `consensi.mandatoSdd` se presente in `missingFields`.

---

## Sezione 2b — Consolidamento griglia

- **Rimuove** il pulsante `avviaAzione('modifica-pagamento')` dalla CAT 3 (Contratto & Pagamenti)
- **Sostituisce** con `avviaAzione('cambio-pagamento')`, stesso label "Modifica metodo di pagamento"
- **Rimuove** `'modifica-pagamento'` dal dict `assistAzioneLabel`
- Il flusso `x-if="assistAzione === 'modifica-pagamento'"` nel template `flusso` viene rimosso — il form `cambio-pagamento` già esistente copre lo stesso caso

---

## Sezione 2c — Demo button `?demo=1`

### Attivazione

```js
isDemoMode() {
  return new URLSearchParams(window.location.search).get('demo') === '1';
}
```

Alpine.js non supporta getter ES6 class — metodo ordinario, chiamato come `isDemoMode()` nel template.

### Pulsante

Visibile solo se `isDemoMode` nella schermata `assistStep === 'ricerca'` (sopra o sotto la griglia delle quick actions).

### Logica generazione cliente incompleto

```js
generaClienteDemo() {
  // 1. Genera CF e targa fake deterministici (timestamp-based)
  // 2. Crea ClienteRecord base con contratto OBU + RSA
  // 3. Rimuove casualmente 1-3 campi tra:
  //    - contatti.telefono
  //    - contatti.email
  //    - consensi.privacy (false)
  //    - consensi.mandatoSdd (false)
  //    - contratti[0].iban (stringa vuota)
  // 4. Salva in clientiDemo
  // 5. assistCliente = _clienteDemoToAssist(record)
  // 6. assistStep = 'scheda'
}
```

I campi rimossi sono scelti con `Math.random()`, almeno 1 sempre mancante.

---

## Sezione 3a — localStorage writes mancanti

Tutte le scritture seguono il pattern:

```js
const clienti = JSON.parse(localStorage.getItem('clientiDemo') || '{}');
const rec = clienti[cf.toUpperCase()];
if (rec) {
  // ... modifica rec ...
  localStorage.setItem('clientiDemo', JSON.stringify(clienti));
}
```

### `aggiorna-residenza`

```js
if (!rec.indirizzo) rec.indirizzo = {};
rec.indirizzo.via      = this.assistForm.resVia.trim();
rec.indirizzo.comune   = this.assistForm.resCitta.trim();
rec.indirizzo.prov     = this.assistForm.resProvincia.trim().toUpperCase();
rec.indirizzo.cap      = this.assistForm.resCap.trim();
```

### `aggiorna-contatti`

```js
if (!rec.contatti) rec.contatti = {};
rec.contatti.email    = this.assistForm.email.trim();
rec.contatti.telefono = this.assistForm.cellulare.trim();
```

### `aggiorna-veicolo`

```js
this.assistForm.veicoli.forEach(v => {
  const idx = (rec.veicoli || []).findIndex(rv => rv.targa === v.targa);
  if (idx !== -1) {
    rec.veicoli[idx].tipo    = v.tipo;
    rec.veicoli[idx].marca   = v.marca;
    rec.veicoli[idx].modello = v.modello;
  }
});
```

### `furto-obu`

```js
const obuCode = this.assistForm.obuSelezionato;
(rec.contratti || []).forEach(c =>
  (c.dispositivi || []).forEach(d => {
    if (d.tipo === 'obu' && d.codice === obuCode) {
      d.furtoSmarrimento = true;
      d.stato = 'smarrito';
    }
  })
);
```

### `restituzione-obu`

```js
const obuCode = this.assistForm.obuSelezionato;
(rec.contratti || []).forEach(c => {
  (c.dispositivi || []).forEach(d => {
    if (d.tipo === 'obu' && d.codice === obuCode) d.stato = 'restituito';
  });
  const obus = (c.dispositivi || []).filter(d => d.tipo === 'obu');
  if (obus.length > 0 && obus.every(d => d.stato === 'restituito')) c.stato = 'cessato';
});
```

### `disattivazione-servizio`

Routing per tipo di servizio:

```js
this.assistForm.serviziDaDisattivare.forEach(s => {
  if (['strisceBlu', 'memo'].includes(s)) {
    if (!rec.serviziAttivi) rec.serviziAttivi = {};
    if (!rec.serviziAttivi[s]) rec.serviziAttivi[s] = {};
    rec.serviziAttivi[s].attivo = false;
  } else if (['areac', 'parcheggi'].includes(s)) {
    (rec.contratti || []).forEach(c =>
      (c.dispositivi || []).forEach(d => {
        if (d.serviziAbilitati?.[s]) d.serviziAbilitati[s].attivo = false;
      })
    );
  } else if (s === 'rsa') {
    (rec.contratti || []).forEach(c =>
      (c.serviziRsa || []).forEach(r => { if (r.stato === 'attivo') r.stato = 'cessato'; })
    );
  }
});
```

---

## Sezione 3b — Bug fix: `sostituisci-obu` RSA a root

**Problema:** `confermaOperazione('sostituisci-obu')` cerca `rec.serviziRsa` a livello root del record — non esiste in schema v3, RSA è dentro `contratti[].serviziRsa[]`.

**Fix:**

```js
// Prima (errato):
const rsaEntry = (rec.serviziRsa || []).find(r => r.veicoloId === rsaVid && r.stato === 'attivo');
if (rsaEntry) rsaEntry.codicePolizza = codicePolizza;

// Dopo (corretto):
for (const c of (rec.contratti || [])) {
  const rsaEntry = (c.serviziRsa || []).find(r => r.veicoloId === rsaVid && r.stato === 'attivo');
  if (rsaEntry) { rsaEntry.codicePolizza = codicePolizza; break; }
}
```

---

## Sezione 3c — Cambio targa: check RSA attiva

### Detection nel flusso `cambio-targa-obu`

Dopo identificazione cliente, la vecchia targa si ricava dall'OBU selezionato (non hardcoded a `[0]`):

```js
cambioTargaHasRsa() {
  if (!this.assistCliente) return false;
  const obu = (this.assistCliente.obu || []).find(o => o.codice === this.assistForm.obuSelezionato)
    || (this.assistCliente.obu || [])[0];
  if (!obu) return false;
  const vecchiaTargaId = 'v_' + (obu.targa || '').toUpperCase();
  return (this.assistCliente.contratti || []).some(c =>
    (c.serviziRsa || []).some(r => r.veicoloId === vecchiaTargaId && r.stato === 'attivo')
  );
}
```

Metodo ordinario (non getter ES6).

### UI nel form `cambio-targa-obu`

Se `cambioTargaHasRsa`: appare un banner informativo + toggle:

> "È presente un servizio RSA attivo su questa targa. Aggiornare la targa anche per il servizio RSA?"
> Toggle `x-model="assistForm.aggiornaRsaConTarga"` — default `true`

### Scrittura in `confermaOperazione('cambio-targa-obu')`

```js
if (this.assistForm.aggiornaRsaConTarga) {
  const vecchioId = 'v_' + targaVecchia.toUpperCase();
  const nuovoId   = 'v_' + nuovaTarga.toUpperCase();
  (rec.contratti || []).forEach(c =>
    (c.serviziRsa || []).forEach(r => {
      if (r.veicoloId === vecchioId) r.veicoloId = nuovoId;
    })
  );
}
```

`syncVeicoli(rec)` già chiamata dopo — aggiorna `veicoli[]` automaticamente.

---

## Stato variabili nuove / modificate

```js
// Già esistenti, nessuna modifica
missingFields[]              // già esiste in aggiorna-scheda

// Nuovi (da aggiungere a assistForm e init)
assistForm.aggiornaRsaConTarga = true   // toggle RSA in cambio-targa, reset a true in resetAssistOp()

// Nuovi metodi
isDemoMode()                 // legge URLSearchParams, usato come metodo nel template
cambioTargaHasRsa()          // check RSA attiva sulla vecchia targa selezionata
_checkAnagraficaPreAzione()  // validazione anagrafica pre-azione, estratto da confermaProcediQuickObu
generaClienteDemo()          // genera cliente con dati incompleti randomici
```

---

## File modificati

| File | Tipo modifica |
|---|---|
| `tablet.html` | Template: rami quick-obu, form cambio-targa RSA toggle, demo button |
| `tablet.html` | JS: `_checkAnagraficaPreAzione()`, `avviaAzione()`, `confermaOperazione()`, `generaClienteDemo()`, `cercaClienteRecupero()` |
