# Assistenza Tablet — Redesign Flussi e Coerenza — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendere i flussi di assistenza nel tablet coerenti — search contestuale per quick action, check anagrafica pre-azione, scrittura localStorage per tutte le operazioni, RSA check in cambio targa, demo button.

**Architecture:** Tutto in `tablet.html`. Le modifiche sono: (1) JS puro — nuovi metodi, fix a `confermaOperazione`, refactor `confermaProcediQuickObu`; (2) Template Alpine — rami quick-obu contestuali, toggle RSA in flusso cambio-targa, campo mandatoSdd in aggiorna-scheda, demo button; (3) Griglia — rimozione duplicato `modifica-pagamento`.

**Tech Stack:** Alpine.js 3.x, Tailwind CSS CDN, vanilla JS, localStorage. Zero build process.

---

## File modificato

- `tablet.html` — unico file, tutte le modifiche

---

### Task 1: Stato init — aggiungi variabili mancanti

**File:**
- Modify: `tablet.html` (assistForm ~riga 4584, aggiornaDatiForm ~riga 4562, resetAssistOp ~riga 6463)

- [ ] **Step 1: Aggiungi `aggiornaRsaConTarga` ad `assistForm`**

Trova il blocco `assistForm: {` (~riga 4584). Aggiungi dopo `rsaVeicoloIdSostituzione: null,`:

```js
      aggiornaRsaConTarga: true,
```

- [ ] **Step 2: Aggiungi `mandatoSdd` ad `aggiornaDatiForm`**

Trova (~riga 4562):
```js
    aggiornaDatiForm: { nome: '', cognome: '', telefono: '', email: '', privacy: false },
```
Sostituisci con:
```js
    aggiornaDatiForm: { nome: '', cognome: '', telefono: '', email: '', privacy: false, mandatoSdd: false },
```

- [ ] **Step 3: Reset `aggiornaRsaConTarga` in `resetAssistOp()`**

Trova `resetAssistOp()` (~riga 6463):
```js
    resetAssistOp() {
      this.assistOtpSent = false;
      this.assistOtpValue = '';
      this.assistOtpConfirmed = false;
      this.assistOpLoading = false;
      this.assistOpSuccess = false;
      this.assistForm.codicePolizzaRsa = '';
      this.assistForm.rsaVeicoloIdSostituzione = null;
    },
```
Aggiungi riga dopo `rsaVeicoloIdSostituzione: null;`:
```js
      this.assistForm.aggiornaRsaConTarga = true;
```

- [ ] **Step 4: Commit**

```bash
git add tablet.html
git commit -m "feat(tablet): add aggiornaRsaConTarga and mandatoSdd to assistForm init"
```

---

### Task 2: Estrai `_checkAnagraficaPreAzione()` e aggancia ad `avviaAzione()`

**File:**
- Modify: `tablet.html` (confermaProcediQuickObu ~riga 6611, avviaAzione ~riga 6421)

- [ ] **Step 1: Aggiungi metodo `_checkAnagraficaPreAzione(azione)` prima di `avviaAzione`**

Trova la riga:
```js
    avviaAzione(azione) {
```
Inserisci PRIMA di essa il nuovo metodo:
```js
    _checkAnagraficaPreAzione(azione) {
      const c = this.assistCliente;
      if (!c) return true;
      const rawRecord = this._getClientiDemo()[c.cf?.toUpperCase()];
      const missing = [];
      if (!c.nome?.trim())      missing.push('nome');
      if (!c.cognome?.trim())   missing.push('cognome');
      if (!c.cellulare?.trim()) missing.push('telefono');
      if (!c.email?.trim())     missing.push('email');
      if (!rawRecord?.consensi?.privacy) missing.push('privacy');
      if (!rawRecord?.consensi?.mandatoSdd) missing.push('mandatoSdd');
      if (['cambio-pagamento'].includes(azione)) {
        const primoContratto = (rawRecord?.contratti || [])[0];
        if (!primoContratto?.iban?.trim()) missing.push('iban');
      }
      if (missing.length === 0) return true;
      this.missingFields = missing;
      this.aggiornaDatiForm = {
        nome:       c.nome || '',
        cognome:    c.cognome || '',
        telefono:   c.cellulare || '',
        email:      c.email || '',
        privacy:    !!rawRecord?.consensi?.privacy,
        mandatoSdd: !!rawRecord?.consensi?.mandatoSdd,
      };
      this.quickObuNextStep = 'flusso';
      this.assistAzione = azione;
      this.assistStep = 'aggiorna-scheda';
      window.scrollTo(0, 0);
      this.showToastMsg('Dati obbligatori mancanti — compila il form per procedere', 'error', 4000);
      return false;
    },

```

- [ ] **Step 2: Modifica `avviaAzione()` per chiamare il check**

Trova:
```js
    avviaAzione(azione) {
      this.assistAzione = azione;
      this.assistStep = 'flusso';
      this.resetAssistOp();
      window.scrollTo(0, 0);
    },
```
Sostituisci con:
```js
    avviaAzione(azione) {
      if (!this._checkAnagraficaPreAzione(azione)) return;
      this.assistAzione = azione;
      this.assistStep = 'flusso';
      this.resetAssistOp();
      window.scrollTo(0, 0);
    },
```

- [ ] **Step 3: Semplifica `confermaProcediQuickObu()` togliendo il blocco validazione duplicato**

In `confermaProcediQuickObu()` (~riga 6611) trova e rimuovi il blocco:
```js
      // Validazione campi obbligatori scheda cliente
      const rawRecord = this._getClientiDemo()[c.cf?.toUpperCase()];
      const missing = [];
      if (!c.nome?.trim())      missing.push('nome');
      if (!c.cognome?.trim())   missing.push('cognome');
      if (!c.cellulare?.trim()) missing.push('telefono');
      if (!c.email?.trim())     missing.push('email');
      if (!rawRecord?.consensi?.privacy) missing.push('privacy');
      if (missing.length > 0) {
        this.missingFields = missing;
        this.aggiornaDatiForm = {
          nome:     c.nome || '',
          cognome:  c.cognome || '',
          telefono: c.cellulare || '',
          email:    c.email || '',
          privacy:  !!rawRecord?.consensi?.privacy,
        };
        this.quickObuNextStep = 'flusso';
        this.assistAzione = this.quickObuAction;
        this.quickObuAction = null;
        this.quickObuSearchStatus = null;
        this.quickPagamentoContrattoId = null;
        this.assistStep = 'aggiorna-scheda';
        window.scrollTo(0, 0);
        this.showToastMsg('Dati obbligatori mancanti — compila il form per procedere', 'error', 4000);
        return;
      }
```
E subito PRIMA della riga `this.assistAzione = this.quickObuAction;` (nel blocco dopo la rimozione) aggiungi:
```js
      this.assistCliente = this.quickObuSearchResult;
      const c = this.assistCliente;
      Object.assign(this.assistForm, {
        resVia: c.residenza.via,   resCap: c.residenza.cap,
        resCitta: c.residenza.citta, resProvincia: c.residenza.provincia,
        domVia: c.domicilio.via,   domCap: c.domicilio.cap,
        domCitta: c.domicilio.citta, domProvincia: c.domicilio.provincia,
        email: c.email, cellulare: c.cellulare,
        veicoli: JSON.parse(JSON.stringify(c.veicoli)),
      });
      if (this.quickObuAction === 'sostituisci-obu' && this.obuScannedCode) {
        this.assistForm.obuSelezionato = this.obuScannedCode;
        const obuEntry = (c.obu || []).find(o => o.codice === this.obuScannedCode) || (c.obu || [])[0];
        if (obuEntry) {
          const raws = this._getClientiDemo()[c.cf?.toUpperCase()];
          const rsaEntry = (raws?.contratti || []).flatMap(ct => ct.serviziRsa || [])
            .find(r => r.veicoloId === 'v_' + obuEntry.targa && r.stato === 'attivo');
          if (rsaEntry) {
            this.assistForm.codicePolizzaRsa = rsaEntry.codicePolizza || '';
            this.assistForm.rsaVeicoloIdSostituzione = rsaEntry.veicoloId;
          }
        }
      }
      if (this.quickObuAction === 'cambio-pagamento') {
        this.assistForm.contrattoSelezionato = this.quickPagamentoContrattoId;
        this.assistForm.iban = '';
      }
      if (!this._checkAnagraficaPreAzione(this.quickObuAction)) {
        this.quickObuAction = null;
        this.quickObuSearchStatus = null;
        this.quickPagamentoContrattoId = null;
        return;
      }
```

**NOTA:** Questo refactoring sostituisce il corpo originale di `confermaProcediQuickObu` — la logica che era prima del blocco di validazione (righe ~6581-6609) viene ora inserita direttamente prima del check. Assicurarsi che il metodo risultante sia:

```js
    confermaProcediQuickObu() {
      this.assistCliente = this.quickObuSearchResult;
      const c = this.assistCliente;
      Object.assign(this.assistForm, {
        resVia: c.residenza.via,   resCap: c.residenza.cap,
        resCitta: c.residenza.citta, resProvincia: c.residenza.provincia,
        domVia: c.domicilio.via,   domCap: c.domicilio.cap,
        domCitta: c.domicilio.citta, domProvincia: c.domicilio.provincia,
        email: c.email, cellulare: c.cellulare,
        veicoli: JSON.parse(JSON.stringify(c.veicoli)),
      });
      if (this.quickObuAction === 'sostituisci-obu' && this.obuScannedCode) {
        this.assistForm.obuSelezionato = this.obuScannedCode;
        const obuEntry = (c.obu || []).find(o => o.codice === this.obuScannedCode) || (c.obu || [])[0];
        if (obuEntry) {
          const raws = this._getClientiDemo()[c.cf?.toUpperCase()];
          const rsaEntry = (raws?.contratti || []).flatMap(ct => ct.serviziRsa || [])
            .find(r => r.veicoloId === 'v_' + obuEntry.targa && r.stato === 'attivo');
          if (rsaEntry) {
            this.assistForm.codicePolizzaRsa = rsaEntry.codicePolizza || '';
            this.assistForm.rsaVeicoloIdSostituzione = rsaEntry.veicoloId;
          }
        }
      }
      if (this.quickObuAction === 'cambio-pagamento') {
        this.assistForm.contrattoSelezionato = this.quickPagamentoContrattoId;
        this.assistForm.iban = '';
      }
      if (!this._checkAnagraficaPreAzione(this.quickObuAction)) {
        this.quickObuAction = null;
        this.quickObuSearchStatus = null;
        this.quickPagamentoContrattoId = null;
        return;
      }
      this.assistAzione = this.quickObuAction;
      this.assistStep = 'flusso';
      this.quickObuAction = null;
      this.quickObuSearchStatus = null;
      this.quickPagamentoContrattoId = null;
      this.resetAssistOp();
      window.scrollTo(0, 0);
      this.showToastMsg('Accesso rapido a: ' + this.assistAzioneLabel(this.assistAzione), 'info');
    },
```

- [ ] **Step 4: Verifica nel browser**

Apri `tablet.html`. Login operatore → Assistenza. Cerca un cliente esistente con dati completi → clicca "Procedi con assistenza" → clicca qualsiasi azione griglia → deve andare al flusso senza blocchi.

Poi: forza un cliente con email mancante in localStorage (`clientiDemo[CF].contatti.email = ''`) → ripeti → deve comparire `aggiorna-scheda` con solo il campo email.

- [ ] **Step 5: Commit**

```bash
git add tablet.html
git commit -m "refactor(tablet): extract _checkAnagraficaPreAzione, hook into avviaAzione and confermaProcediQuickObu"
```

---

### Task 3: Template `aggiorna-scheda` — aggiungi campo mandatoSdd

**File:**
- Modify: `tablet.html` (~riga 3086–3102)

- [ ] **Step 1: Aggiungi campo mandatoSdd dopo il campo privacy**

Trova nel template `aggiorna-scheda`:
```html
              <div x-show="missingFields.includes('privacy')" class="bg-gray-50 rounded-xl p-4">
                <label class="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" x-model="aggiornaDatiForm.privacy" class="accent-teal mt-1 flex-shrink-0" />
                  <span class="text-sm text-gray-700">
                    <span class="font-semibold">Consenso Privacy obbligatorio</span>
                    <span class="text-red-500"> *</span><br>
                    <span class="text-xs text-gray-500">Il cliente acconsente al trattamento dei dati personali ai sensi del GDPR</span>
                  </span>
                </label>
              </div>
```
Aggiungi DOPO:
```html
              <div x-show="missingFields.includes('mandatoSdd')" class="bg-gray-50 rounded-xl p-4">
                <label class="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" x-model="aggiornaDatiForm.mandatoSdd" class="accent-teal mt-1 flex-shrink-0" />
                  <span class="text-sm text-gray-700">
                    <span class="font-semibold">Mandato SDD obbligatorio</span>
                    <span class="text-red-500"> *</span><br>
                    <span class="text-xs text-gray-500">Autorizzazione addebito diretto SEPA per i contratti attivi</span>
                  </span>
                </label>
              </div>
```

- [ ] **Step 2: Aggiungi condizione di disabilitazione del pulsante "Salva e procedi" per mandatoSdd**

Trova il `:disabled` del pulsante nel template:
```html
              :disabled="(missingFields.includes('nome') && !aggiornaDatiForm.nome.trim())
                      || (missingFields.includes('cognome') && !aggiornaDatiForm.cognome.trim())
                      || (missingFields.includes('telefono') && !aggiornaDatiForm.telefono.trim())
                      || (missingFields.includes('email') && !aggiornaDatiForm.email.trim())
                      || (missingFields.includes('privacy') && !aggiornaDatiForm.privacy)">
```
Sostituisci con:
```html
              :disabled="(missingFields.includes('nome') && !aggiornaDatiForm.nome.trim())
                      || (missingFields.includes('cognome') && !aggiornaDatiForm.cognome.trim())
                      || (missingFields.includes('telefono') && !aggiornaDatiForm.telefono.trim())
                      || (missingFields.includes('email') && !aggiornaDatiForm.email.trim())
                      || (missingFields.includes('privacy') && !aggiornaDatiForm.privacy)
                      || (missingFields.includes('mandatoSdd') && !aggiornaDatiForm.mandatoSdd)">
```

- [ ] **Step 3: Salva mandatoSdd in `salvaAggiornaDati()`**

Trova `salvaAggiornaDati()` (~riga 6652). Dopo il blocco che salva privacy:
```js
      if (this.missingFields.includes('privacy')) {
        if (!r.consensi) r.consensi = {};
        r.consensi.privacy = !!this.aggiornaDatiForm.privacy;
      }
```
Aggiungi:
```js
      if (this.missingFields.includes('mandatoSdd')) {
        if (!r.consensi) r.consensi = {};
        r.consensi.mandatoSdd = !!this.aggiornaDatiForm.mandatoSdd;
      }
```

- [ ] **Step 4: Commit**

```bash
git add tablet.html
git commit -m "feat(tablet): add mandatoSdd field to aggiorna-scheda step"
```

---

### Task 4: localStorage writes — `aggiorna-residenza` e `aggiorna-contatti`

**File:**
- Modify: `tablet.html` — `confermaOperazione()` ~riga 6828

- [ ] **Step 1: Aggiungi scrittura localStorage per `aggiorna-residenza`**

Trova il case in `confermaOperazione`:
```js
          case 'aggiorna-residenza':
            Bus.emit('assistenza:dati_aggiornati', { cf, campo: 'indirizzo', valore: this.assistForm.resVia, canale: 'store' });
            this.showToastMsg('Dati aggiornati', 'success');
            break;
```
Sostituisci con:
```js
          case 'aggiorna-residenza': {
            try {
              const clienti = JSON.parse(localStorage.getItem('clientiDemo') || '{}');
              const rec = clienti[cf.toUpperCase()];
              if (rec) {
                if (!rec.indirizzo) rec.indirizzo = {};
                rec.indirizzo.via    = this.assistForm.resVia.trim();
                rec.indirizzo.comune = this.assistForm.resCitta.trim();
                rec.indirizzo.prov   = this.assistForm.resProvincia.trim().toUpperCase();
                rec.indirizzo.cap    = this.assistForm.resCap.trim();
                localStorage.setItem('clientiDemo', JSON.stringify(clienti));
                Bus.emit('cliente:profilo_aggiornato', rec);
              }
            } catch(e) { console.error('aggiorna-residenza write error', e); }
            Bus.emit('assistenza:dati_aggiornati', { cf, campo: 'indirizzo', valore: this.assistForm.resVia, canale: 'store' });
            this.showToastMsg('Dati aggiornati', 'success');
            break;
          }
```

- [ ] **Step 2: Aggiungi scrittura localStorage per `aggiorna-contatti`**

Trova:
```js
          case 'aggiorna-contatti':
            Bus.emit('assistenza:dati_aggiornati', { cf, campo: 'contatti', valore: { email: this.assistForm.email, cellulare: this.assistForm.cellulare }, canale: 'store' });
            this.showToastMsg('Dati di contatto aggiornati', 'success');
            break;
```
Sostituisci con:
```js
          case 'aggiorna-contatti': {
            try {
              const clienti = JSON.parse(localStorage.getItem('clientiDemo') || '{}');
              const rec = clienti[cf.toUpperCase()];
              if (rec) {
                if (!rec.contatti) rec.contatti = {};
                rec.contatti.email    = this.assistForm.email.trim();
                rec.contatti.telefono = this.assistForm.cellulare.trim();
                localStorage.setItem('clientiDemo', JSON.stringify(clienti));
                Bus.emit('cliente:profilo_aggiornato', rec);
              }
            } catch(e) { console.error('aggiorna-contatti write error', e); }
            Bus.emit('assistenza:dati_aggiornati', { cf, campo: 'contatti', valore: { email: this.assistForm.email, cellulare: this.assistForm.cellulare }, canale: 'store' });
            this.showToastMsg('Dati di contatto aggiornati', 'success');
            break;
          }
```

- [ ] **Step 3: Commit**

```bash
git add tablet.html
git commit -m "fix(tablet): write localStorage for aggiorna-residenza and aggiorna-contatti"
```

---

### Task 5: localStorage writes — `aggiorna-veicolo`, `furto-obu`, `restituzione-obu`

**File:**
- Modify: `tablet.html` — `confermaOperazione()`

- [ ] **Step 1: Aggiungi scrittura per `aggiorna-veicolo`**

Trova:
```js
          case 'aggiorna-veicolo':
            Bus.emit('assistenza:veicolo_aggiornato', { cf, targa: (this.assistForm.veicoli[0] || {}).targa, operazione: 'modifica' });
            this.showToastMsg('Veicolo aggiornato', 'success');
            break;
```
Sostituisci con:
```js
          case 'aggiorna-veicolo': {
            try {
              const clienti = JSON.parse(localStorage.getItem('clientiDemo') || '{}');
              const rec = clienti[cf.toUpperCase()];
              if (rec && Array.isArray(rec.veicoli)) {
                this.assistForm.veicoli.forEach(v => {
                  const idx = rec.veicoli.findIndex(rv => rv.targa === v.targa);
                  if (idx !== -1) {
                    rec.veicoli[idx].tipo    = v.tipo;
                    rec.veicoli[idx].marca   = v.marca;
                    rec.veicoli[idx].modello = v.modello;
                  }
                });
                localStorage.setItem('clientiDemo', JSON.stringify(clienti));
                Bus.emit('cliente:profilo_aggiornato', rec);
              }
            } catch(e) { console.error('aggiorna-veicolo write error', e); }
            Bus.emit('assistenza:veicolo_aggiornato', { cf, targa: (this.assistForm.veicoli[0] || {}).targa, operazione: 'modifica' });
            this.showToastMsg('Veicolo aggiornato', 'success');
            break;
          }
```

- [ ] **Step 2: Aggiungi scrittura per `furto-obu`**

Trova:
```js
          case 'furto-obu':
            Bus.emit('assistenza:obu_bloccato', { cf, obu: this.assistForm.obuSelezionato, targa: (this.assistCliente.obu[0] || {}).targa, motivo: 'furto' });
            this.showToastMsg('OBU inserito in blacklist entro 12 ore', 'success', 4000);
            break;
```
Sostituisci con:
```js
          case 'furto-obu': {
            const obuCodeFurto = this.assistForm.obuSelezionato;
            try {
              const clienti = JSON.parse(localStorage.getItem('clientiDemo') || '{}');
              const rec = clienti[cf.toUpperCase()];
              if (rec) {
                (rec.contratti || []).forEach(c =>
                  (c.dispositivi || []).forEach(d => {
                    if (d.tipo === 'obu' && d.codice === obuCodeFurto) {
                      d.furtoSmarrimento = true;
                      d.stato = 'smarrito';
                    }
                  })
                );
                localStorage.setItem('clientiDemo', JSON.stringify(clienti));
              }
            } catch(e) { console.error('furto-obu write error', e); }
            Bus.emit('assistenza:obu_bloccato', { cf, obu: obuCodeFurto, targa: (this.assistCliente.obu[0] || {}).targa, motivo: 'furto' });
            this.showToastMsg('OBU inserito in blacklist entro 12 ore', 'success', 4000);
            break;
          }
```

- [ ] **Step 3: Aggiungi scrittura per `restituzione-obu`**

Trova:
```js
          case 'restituzione-obu':
            Bus.emit('assistenza:obu_restituito', { cf, obu: this.assistForm.obuSelezionato, targa: (this.assistCliente.obu[0] || {}).targa });
            this.showToastMsg('Restituzione registrata. Stock aggiornato.', 'success');
            break;
```
Sostituisci con:
```js
          case 'restituzione-obu': {
            const obuCodeRest = this.assistForm.obuSelezionato;
            try {
              const clienti = JSON.parse(localStorage.getItem('clientiDemo') || '{}');
              const rec = clienti[cf.toUpperCase()];
              if (rec) {
                (rec.contratti || []).forEach(c => {
                  (c.dispositivi || []).forEach(d => {
                    if (d.tipo === 'obu' && d.codice === obuCodeRest) d.stato = 'restituito';
                  });
                  const obus = (c.dispositivi || []).filter(d => d.tipo === 'obu');
                  if (obus.length > 0 && obus.every(d => d.stato === 'restituito')) c.stato = 'cessato';
                });
                localStorage.setItem('clientiDemo', JSON.stringify(clienti));
              }
            } catch(e) { console.error('restituzione-obu write error', e); }
            Bus.emit('assistenza:obu_restituito', { cf, obu: obuCodeRest, targa: (this.assistCliente.obu[0] || {}).targa });
            this.showToastMsg('Restituzione registrata. Stock aggiornato.', 'success');
            break;
          }
```

- [ ] **Step 4: Commit**

```bash
git add tablet.html
git commit -m "fix(tablet): write localStorage for aggiorna-veicolo, furto-obu, restituzione-obu"
```

---

### Task 6: localStorage write — `disattivazione-servizio`

**File:**
- Modify: `tablet.html` — `confermaOperazione()`

- [ ] **Step 1: Aggiungi scrittura per `disattivazione-servizio`**

Trova:
```js
          case 'disattivazione-servizio':
            this.assistForm.serviziDaDisattivare.forEach(s => {
              Bus.emit('assistenza:servizio_disattivato', { cf, servizio: s });
            });
            this.showToastMsg('Servizio disattivato', 'success');
            break;
```
Sostituisci con:
```js
          case 'disattivazione-servizio': {
            try {
              const clienti = JSON.parse(localStorage.getItem('clientiDemo') || '{}');
              const rec = clienti[cf.toUpperCase()];
              if (rec) {
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
                localStorage.setItem('clientiDemo', JSON.stringify(clienti));
              }
            } catch(e) { console.error('disattivazione-servizio write error', e); }
            this.assistForm.serviziDaDisattivare.forEach(s => {
              Bus.emit('assistenza:servizio_disattivato', { cf, servizio: s });
            });
            this.showToastMsg('Servizio disattivato', 'success');
            break;
          }
```

- [ ] **Step 2: Commit**

```bash
git add tablet.html
git commit -m "fix(tablet): write localStorage for disattivazione-servizio with service-type routing"
```

---

### Task 7: Bug fix — `sostituisci-obu` RSA a root

**File:**
- Modify: `tablet.html` — `confermaOperazione('sostituisci-obu')` ~riga 6852

- [ ] **Step 1: Fix ricerca RSA da root a contratti[].serviziRsa[]**

Trova nel case `sostituisci-obu`:
```js
                const rsaVid = this.assistForm.rsaVeicoloIdSostituzione;
                const codicePolizza = this.assistForm.codicePolizzaRsa.trim();
                if (rsaVid && codicePolizza) {
                  const rsaEntry = (rec.serviziRsa || []).find(r => r.veicoloId === rsaVid && r.stato === 'attivo');
                  if (rsaEntry) rsaEntry.codicePolizza = codicePolizza;
                }
```
Sostituisci con:
```js
                const rsaVid = this.assistForm.rsaVeicoloIdSostituzione;
                const codicePolizza = this.assistForm.codicePolizzaRsa.trim();
                if (rsaVid && codicePolizza) {
                  for (const ct of (rec.contratti || [])) {
                    const rsaEntry = (ct.serviziRsa || []).find(r => r.veicoloId === rsaVid && r.stato === 'attivo');
                    if (rsaEntry) { rsaEntry.codicePolizza = codicePolizza; break; }
                  }
                }
```

- [ ] **Step 2: Commit**

```bash
git add tablet.html
git commit -m "fix(tablet): sostituisci-obu RSA lookup in contratti[].serviziRsa[] not root"
```

---

### Task 8: Quick action — `restituzione-obu` → OBU scan

**File:**
- Modify: `tablet.html` — template `quick-obu` ~riga 2946

- [ ] **Step 1: Aggiungi ramo OBU scan per `restituzione-obu` nel template `quick-obu`**

Nel template `quick-obu` (dentro `<template x-if="assistStep === 'quick-obu'">`), trova la riga che apre il ramo generico:
```html
            <!-- ===== ALTRE AZIONI OBU: ricerca classica CF/targa ===== -->
            <template x-if="quickObuAction !== 'sostituisci-obu'">
```
Inserisci PRIMA di essa (e DOPO la chiusura del ramo `sostituisci-obu`) il nuovo ramo:
```html
            <!-- ===== RESTITUZIONE OBU: scan OBU ===== -->
            <template x-if="quickObuAction === 'restituzione-obu'">
              <div>
                <template x-if="quickObuSearchStatus === 'found' && quickObuSearchResult">
                  <div class="space-y-4">
                    <div class="bg-teal-light border border-teal rounded-xl p-4">
                      <p class="text-xs text-teal font-semibold uppercase tracking-wider mb-2">OBU e cliente identificati</p>
                      <div class="flex items-center gap-4">
                        <div class="w-12 h-12 bg-teal text-white rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-lg"
                          x-text="(quickObuSearchResult.nome || '?')[0]"></div>
                        <div class="flex-1 min-w-0">
                          <p class="font-bold text-gray-900" x-text="quickObuSearchResult.nome + ' ' + quickObuSearchResult.cognome"></p>
                          <p class="text-sm text-gray-500 font-mono" x-text="quickObuSearchResult.cf"></p>
                          <p class="text-xs text-gray-400 mt-1 font-mono" x-text="'OBU: ' + obuScannedCode"></p>
                        </div>
                      </div>
                      <button class="btn-primary w-full justify-center mt-4" @click="confermaProcediQuickObu()">
                        <i class="fas fa-arrow-right mr-2"></i> Conferma e procedi
                      </button>
                    </div>
                    <button class="btn-ghost text-sm" @click="quickObuSearchStatus = null; obuScannerStatus = null; obuScannedCode = ''; obuManualCode = ''; obuManualSearchStatus = null">
                      <i class="fas fa-redo mr-1"></i> Scansiona un altro OBU
                    </button>
                  </div>
                </template>
                <template x-if="quickObuSearchStatus !== 'found'">
                  <div class="space-y-6">
                    <div>
                      <p class="form-label mb-2">Scansiona il codice a barre dell'OBU da restituire</p>
                      <div class="relative bg-gray-900 rounded-2xl overflow-hidden flex items-center justify-center" style="height:180px;">
                        <template x-if="obuScannerStatus === null">
                          <div class="flex flex-col items-center gap-4 z-10">
                            <div class="relative" style="width:200px;height:60px;">
                              <div class="scanner-corner tl" style="top:0;bottom:auto;"></div>
                              <div class="scanner-corner tr" style="top:0;bottom:auto;"></div>
                              <div class="scanner-corner bl" style="bottom:0;top:auto;"></div>
                              <div class="scanner-corner br" style="bottom:0;top:auto;"></div>
                              <div class="absolute inset-0 flex items-center justify-center">
                                <div class="flex gap-0.5">
                                  <template x-for="i in [3,6,4,7,2,5,8,3,6,4,5,7,2,4,6,3,5,8,4,6]" :key="i">
                                    <div class="bg-gray-600 rounded-sm" :style="'width:2px;height:' + (i * 4) + 'px'"></div>
                                  </template>
                                </div>
                              </div>
                            </div>
                            <button class="btn-primary text-sm px-5 py-2" @click="simulaScansionObu()">
                              <i class="fas fa-barcode mr-2"></i> Avvia scansione
                            </button>
                          </div>
                        </template>
                        <template x-if="obuScannerStatus === 'scanning'">
                          <div class="absolute inset-0">
                            <div class="scanner-corner tl"></div><div class="scanner-corner tr"></div>
                            <div class="scanner-corner bl"></div><div class="scanner-corner br"></div>
                            <div class="scan-line"></div>
                            <div class="absolute inset-0 flex items-end justify-center pb-4">
                              <span class="text-teal text-xs font-semibold tracking-widest uppercase scanning-anim">Scansione in corso…</span>
                            </div>
                          </div>
                        </template>
                        <template x-if="obuScannerStatus === 'found'">
                          <div class="absolute inset-0 bg-emerald-900/80 flex flex-col items-center justify-center gap-2">
                            <i class="fas fa-check-circle text-emerald-400 text-3xl"></i>
                            <span class="text-white font-bold text-sm font-mono" x-text="obuScannedCode"></span>
                            <span class="text-emerald-300 text-xs">OBU riconosciuto</span>
                          </div>
                        </template>
                      </div>
                    </div>
                    <div class="flex items-center gap-3">
                      <div class="flex-1 h-px bg-gray-200"></div>
                      <span class="text-xs text-gray-400 font-medium uppercase tracking-wider">oppure inserisci codice OBU</span>
                      <div class="flex-1 h-px bg-gray-200"></div>
                    </div>
                    <div>
                      <label class="form-label mb-2">Codice OBU</label>
                      <div class="flex gap-2">
                        <input x-model="obuManualCode" type="text" class="form-input flex-1 uppercase font-mono"
                          placeholder="es. OBU-001-2024" @keydown.enter="cercaObuManuale()" />
                        <button class="btn-secondary px-5 flex-shrink-0" @click="cercaObuManuale()" :disabled="!obuManualCode.trim()">
                          <i class="fas fa-search"></i>
                        </button>
                      </div>
                      <template x-if="obuManualSearchStatus === 'notfound'">
                        <div class="bg-red-50 border border-red-200 rounded-lg p-3 mt-3 text-sm text-red-700">
                          <i class="fas fa-exclamation-circle mr-1"></i> OBU non trovato nel sistema.
                        </div>
                      </template>
                    </div>
                  </div>
                </template>
              </div>
            </template>
```

- [ ] **Step 2: Cambia condizione ramo generico per escludere anche `restituzione-obu`**

Trova:
```html
            <!-- ===== ALTRE AZIONI OBU: ricerca classica CF/targa ===== -->
            <template x-if="quickObuAction !== 'sostituisci-obu'">
```
Sostituisci con:
```html
            <!-- ===== ALTRE AZIONI OBU: cambio-targa, furto (ricerca contestuale) ===== -->
            <template x-if="quickObuAction !== 'sostituisci-obu' && quickObuAction !== 'restituzione-obu'">
```

- [ ] **Step 3: Verifica nel browser**

Assistenza → quick action "Restituzione OBU" → deve comparire lo scanner, non il campo CF/targa. Clicca "Avvia scansione" (simulata) → deve trovare il cliente → Conferma e procedi → va al flusso `restituzione-obu`.

- [ ] **Step 4: Commit**

```bash
git add tablet.html
git commit -m "feat(tablet): restituzione-obu quick action uses OBU scan instead of generic search"
```

---

### Task 9: Quick action — `cambio-targa-obu` → targa e `furto-obu` → CF

**File:**
- Modify: `tablet.html` — ramo generico quick-obu ~riga 2947

- [ ] **Step 1: Aggiorna `cercaClienteQuickObu()` per accettare un tipo di ricerca opzionale**

Trova `cercaClienteQuickObu()`:
```js
    cercaClienteQuickObu() {
      if (!this.quickObuSearchQuery.trim()) return;
      this.quickObuSearchLoading = true;
      this.quickObuSearchStatus = null;
      setTimeout(() => {
        this.quickObuSearchLoading = false;
        const raw = this._searchCfOTarga(this.quickObuSearchQuery);
        if (!raw) {
          this.quickObuSearchStatus = 'notfound';
          this.quickObuSearchResult = null;
        } else {
          this.quickObuSearchStatus = 'found';
          this.quickObuSearchResult = this._clienteDemoToAssist(raw);
          this.showToastMsg('Cliente trovato — verifica i dati e conferma', 'success');
        }
      }, 500);
    },
```
Sostituisci con:
```js
    cercaClienteQuickObu(searchType) {
      if (!this.quickObuSearchQuery.trim()) return;
      this.quickObuSearchLoading = true;
      this.quickObuSearchStatus = null;
      setTimeout(() => {
        this.quickObuSearchLoading = false;
        const tipo = searchType || 'cf';
        const raw = this._searchClientiDemo(this.quickObuSearchQuery, tipo);
        if (!raw) {
          this.quickObuSearchStatus = 'notfound';
          this.quickObuSearchResult = null;
        } else {
          this.quickObuSearchStatus = 'found';
          this.quickObuSearchResult = this._clienteDemoToAssist(raw);
          this.showToastMsg('Cliente trovato — verifica i dati e conferma', 'success');
        }
      }, 500);
    },
```

- [ ] **Step 2: Sostituisci il ramo generico con due rami contestuali**

Trova l'intero blocco del ramo generico (dalla riga con il commento `<!-- ===== ALTRE AZIONI OBU ... -->` alla chiusura `</template>` corrispondente ~riga 3045). Sostituisci con:

```html
            <!-- ===== CAMBIO TARGA OBU: ricerca per vecchia targa ===== -->
            <template x-if="quickObuAction === 'cambio-targa-obu'">
              <div>
                <template x-if="quickObuSearchStatus !== 'found'">
                  <div class="mb-5">
                    <label class="form-label">Vecchia targa associata all'OBU</label>
                    <div class="flex gap-2">
                      <input x-model="quickObuSearchQuery" type="text" class="form-input flex-1 uppercase"
                        placeholder="es. AB123CD"
                        @keydown.enter="cercaClienteQuickObu('targa')" />
                      <button class="btn-primary px-5 flex-shrink-0" @click="cercaClienteQuickObu('targa')"
                        :disabled="quickObuSearchLoading || !quickObuSearchQuery.trim()">
                        <span x-show="quickObuSearchLoading" class="spinner !w-4 !h-4"></span>
                        <i x-show="!quickObuSearchLoading" class="fas fa-search"></i>
                      </button>
                    </div>
                    <template x-if="quickObuSearchStatus === 'notfound'">
                      <div class="bg-red-50 border border-red-200 rounded-lg p-3 mt-3 text-sm text-red-700">
                        <i class="fas fa-exclamation-circle mr-1"></i>
                        Nessun cliente trovato per questa targa.
                        <button class="underline ml-1 font-semibold" @click="assistStep = 'ricerca'; assistSearchQuery = quickObuSearchQuery; quickObuAction = null">
                          Cerca con ricerca completa
                        </button>
                      </div>
                    </template>
                  </div>
                </template>
                <template x-if="quickObuSearchStatus === 'found' && quickObuSearchResult">
                  <div class="space-y-4">
                    <div class="bg-teal-light border border-teal rounded-xl p-4">
                      <p class="text-xs text-teal font-semibold uppercase tracking-wider mb-2">Cliente trovato</p>
                      <div class="flex items-center gap-4">
                        <div class="w-12 h-12 bg-teal text-white rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-lg"
                          x-text="(quickObuSearchResult.nome || '?')[0]"></div>
                        <div class="flex-1 min-w-0">
                          <p class="font-bold text-gray-900" x-text="quickObuSearchResult.nome + ' ' + quickObuSearchResult.cognome"></p>
                          <p class="text-sm text-gray-500 font-mono" x-text="quickObuSearchResult.cf"></p>
                          <div class="flex flex-wrap gap-1 mt-1">
                            <template x-for="v in quickObuSearchResult.veicoli" :key="v.targa">
                              <span class="text-xs bg-white border border-gray-200 rounded px-2 py-0.5 font-mono" x-text="v.targa"></span>
                            </template>
                          </div>
                        </div>
                      </div>
                      <button class="btn-primary w-full justify-center mt-4" @click="confermaProcediQuickObu()">
                        <i class="fas fa-arrow-right mr-2"></i> Conferma e procedi
                      </button>
                    </div>
                    <button class="btn-ghost text-sm" @click="quickObuSearchStatus = null; quickObuSearchQuery = ''">
                      <i class="fas fa-search mr-1"></i> Cerca un'altra targa
                    </button>
                  </div>
                </template>
              </div>
            </template>

            <!-- ===== FURTO / SMARRIMENTO OBU: ricerca per CF ===== -->
            <template x-if="quickObuAction === 'furto-obu'">
              <div>
                <template x-if="quickObuSearchStatus !== 'found'">
                  <div class="mb-5">
                    <label class="form-label">Codice Fiscale cliente</label>
                    <div class="flex gap-2">
                      <input x-model="quickObuSearchQuery" type="text" class="form-input flex-1 uppercase"
                        placeholder="es. RSSMRC80A01H501Z"
                        @keydown.enter="cercaClienteQuickObu('cf')" />
                      <button class="btn-primary px-5 flex-shrink-0" @click="cercaClienteQuickObu('cf')"
                        :disabled="quickObuSearchLoading || !quickObuSearchQuery.trim()">
                        <span x-show="quickObuSearchLoading" class="spinner !w-4 !h-4"></span>
                        <i x-show="!quickObuSearchLoading" class="fas fa-search"></i>
                      </button>
                    </div>
                    <template x-if="quickObuSearchStatus === 'notfound'">
                      <div class="bg-red-50 border border-red-200 rounded-lg p-3 mt-3 text-sm text-red-700">
                        <i class="fas fa-exclamation-circle mr-1"></i>
                        Cliente non trovato.
                        <button class="underline ml-1 font-semibold" @click="assistStep = 'ricerca'; assistSearchQuery = quickObuSearchQuery; quickObuAction = null">
                          Cerca con ricerca completa
                        </button>
                      </div>
                    </template>
                  </div>
                </template>
                <template x-if="quickObuSearchStatus === 'found' && quickObuSearchResult">
                  <div class="space-y-4">
                    <div class="bg-red-50 border border-red-200 rounded-xl p-4">
                      <p class="text-xs text-red-600 font-semibold uppercase tracking-wider mb-2">Cliente identificato — Furto / Smarrimento</p>
                      <div class="flex items-center gap-4">
                        <div class="w-12 h-12 bg-red-500 text-white rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-lg"
                          x-text="(quickObuSearchResult.nome || '?')[0]"></div>
                        <div class="flex-1 min-w-0">
                          <p class="font-bold text-gray-900" x-text="quickObuSearchResult.nome + ' ' + quickObuSearchResult.cognome"></p>
                          <p class="text-sm text-gray-500 font-mono" x-text="quickObuSearchResult.cf"></p>
                          <div class="flex flex-wrap gap-1 mt-1">
                            <template x-for="o in quickObuSearchResult.obu" :key="o.codice">
                              <span class="text-xs bg-white border border-red-200 rounded px-2 py-0.5 font-mono" x-text="o.codice + ' — ' + o.targa"></span>
                            </template>
                          </div>
                        </div>
                      </div>
                      <button class="btn-primary w-full justify-center mt-4" style="background-color:#dc2626" @click="confermaProcediQuickObu()">
                        <i class="fas fa-arrow-right mr-2"></i> Conferma e procedi al blocco
                      </button>
                    </div>
                    <button class="btn-ghost text-sm" @click="quickObuSearchStatus = null; quickObuSearchQuery = ''">
                      <i class="fas fa-search mr-1"></i> Cerca un altro cliente
                    </button>
                  </div>
                </template>
              </div>
            </template>

            <!-- ===== CAMBIO PAGAMENTO: ricerca CF/targa (invariato) ===== -->
            <template x-if="quickObuAction === 'cambio-pagamento'">
              <div>
                <template x-if="quickObuSearchStatus !== 'found'">
                  <div class="mb-5">
                    <label class="form-label">Codice Fiscale o Targa</label>
                    <div class="flex gap-2">
                      <input x-model="quickObuSearchQuery" type="text" class="form-input flex-1 uppercase"
                        placeholder="es. AB123CD o BNCMRC85M10F205Z"
                        @keydown.enter="cercaClienteQuickObu('cf')" />
                      <button class="btn-primary px-5 flex-shrink-0" @click="cercaClienteQuickObu('cf')"
                        :disabled="quickObuSearchLoading || !quickObuSearchQuery.trim()">
                        <span x-show="quickObuSearchLoading" class="spinner !w-4 !h-4"></span>
                        <i x-show="!quickObuSearchLoading" class="fas fa-search"></i>
                      </button>
                    </div>
                    <template x-if="quickObuSearchStatus === 'notfound'">
                      <div class="bg-red-50 border border-red-200 rounded-lg p-3 mt-3 text-sm text-red-700">
                        <i class="fas fa-exclamation-circle mr-1"></i>
                        Cliente non trovato.
                        <button class="underline ml-1 font-semibold" @click="assistStep = 'ricerca'; assistSearchQuery = quickObuSearchQuery; quickObuAction = null">
                          Cerca con ricerca completa
                        </button>
                      </div>
                    </template>
                  </div>
                </template>
                <template x-if="quickObuSearchStatus === 'found' && quickObuSearchResult">
                  <div class="space-y-4">
                    <div class="bg-teal-light border border-teal rounded-xl p-3 flex items-center gap-3">
                      <div class="w-9 h-9 bg-teal text-white rounded-lg flex items-center justify-center flex-shrink-0 font-bold"
                        x-text="(quickObuSearchResult.nome || '?')[0]"></div>
                      <div>
                        <p class="font-bold text-gray-900 text-sm" x-text="quickObuSearchResult.nome + ' ' + quickObuSearchResult.cognome"></p>
                        <p class="text-xs text-gray-500 font-mono" x-text="quickObuSearchResult.cf"></p>
                      </div>
                    </div>
                    <div>
                      <p class="form-label mb-2">Seleziona contratto da modificare</p>
                      <template x-for="c in (quickObuSearchResult.contratti || [])" :key="c.id">
                        <div class="border-2 rounded-xl p-3 mb-2 cursor-pointer transition-all"
                          :class="quickPagamentoContrattoId === c.id ? 'border-amber-400 bg-amber-50' : 'border-gray-100 hover:border-amber-200'"
                          @click="quickPagamentoContrattoId = c.id">
                          <div class="flex items-center gap-2">
                            <i class="fas fa-circle text-xs" :class="quickPagamentoContrattoId === c.id ? 'text-amber-500' : 'text-gray-300'"></i>
                            <div class="flex-1 min-w-0">
                              <p class="font-semibold text-sm text-gray-800" x-text="c.id"></p>
                              <p class="text-xs text-gray-400" x-text="(c.tipo === 'obu' ? 'Telepedaggio OBU' : 'RSA Stand-Alone') + ' — IBAN: ' + c.iban + ' — €' + (c.totale || 0).toFixed(2) + '/mese'"></p>
                            </div>
                          </div>
                        </div>
                      </template>
                    </div>
                    <button class="btn-primary w-full justify-center" @click="confermaProcediQuickObu()" :disabled="!quickPagamentoContrattoId">
                      <i class="fas fa-arrow-right mr-2"></i> Conferma e procedi
                    </button>
                  </div>
                </template>
              </div>
            </template>
```

- [ ] **Step 3: Verifica nel browser**

- Quick action "Cambio targa OBU": deve mostrare campo "Vecchia targa", ricerca per targa, trovare il cliente, andare al flusso.
- Quick action "Furto/Smarrimento OBU": deve mostrare campo "Codice Fiscale", ricerca per CF, trovare il cliente con card rossa.

- [ ] **Step 4: Commit**

```bash
git add tablet.html
git commit -m "feat(tablet): cambio-targa-obu uses targa search, furto-obu uses CF search"
```

---

### Task 10: Quick action `recupero-credenziali` → ricerca email/telefono

**File:**
- Modify: `tablet.html` — step `recupero-credenziali` template ~riga 3117 e `cercaClienteRecupero()` ~riga 6693

- [ ] **Step 1: Cambia il label/placeholder nel template `recupero-credenziali`**

Trova nel template:
```html
                  <label class="form-label">Codice Fiscale cliente</label>
                  <div class="flex gap-2">
                    <input x-model="recuperoSearchQuery" type="text" class="form-input flex-1 uppercase"
                      placeholder="RSSMRC80A01H501Z" @keydown.enter="cercaClienteRecupero()" />
```
Sostituisci con:
```html
                  <label class="form-label">Email o cellulare</label>
                  <div class="flex gap-2">
                    <input x-model="recuperoSearchQuery" type="text" class="form-input flex-1"
                      placeholder="es. mario@email.it o +39 333 1234567" @keydown.enter="cercaClienteRecupero()" />
```

- [ ] **Step 2: Cambia `cercaClienteRecupero()` per usare ricerca per contatto**

Trova:
```js
    cercaClienteRecupero() {
      if (!this.recuperoSearchQuery.trim()) return;
      this.recuperoSearchStatus = null;
      const raw = this._searchCfOTarga(this.recuperoSearchQuery);
```
Sostituisci con:
```js
    cercaClienteRecupero() {
      if (!this.recuperoSearchQuery.trim()) return;
      this.recuperoSearchStatus = null;
      const raw = this._searchClientiDemo(this.recuperoSearchQuery, 'contatto');
```

- [ ] **Step 3: Verifica nel browser**

Quick action "Reset credenziali": deve mostrare campo "Email o cellulare", ricerca per email/telefono, trovare il cliente.

- [ ] **Step 4: Commit**

```bash
git add tablet.html
git commit -m "feat(tablet): recupero-credenziali quick action searches by email/phone instead of CF"
```

---

### Task 11: Cambio targa — metodo `cambioTargaHasRsa()` + toggle RSA nel form

**File:**
- Modify: `tablet.html` — flusso `cambio-targa-obu` ~riga 3727 e JS ~riga 6455

- [ ] **Step 1: Aggiungi metodo `cambioTargaHasRsa()`**

Trova il metodo `_obuRsaEntry()` (~riga 6455):
```js
    _obuRsaEntry() {
```
Inserisci PRIMA di esso:
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
    },

```

- [ ] **Step 2: Aggiungi toggle RSA nel form `cambio-targa-obu`**

Nel template flusso `cambio-targa-obu`, trova il div con `assistForm.nuovaTarga` (il campo "Nuova targa"):
```html
                <div>
                  <label class="form-label">Nuova targa</label>
                  <input x-model="assistForm.nuovaTarga" class="form-input uppercase" placeholder="es. CD789EF" @input="checkTarga()" />
                </div>
```
Aggiungi DOPO (prima del `template x-if="assistForm.targaWarning"`):
```html
                <template x-if="cambioTargaHasRsa() && assistForm.obuSelezionato">
                  <div class="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <div class="flex items-start justify-between gap-3">
                      <div class="flex-1">
                        <p class="font-semibold text-blue-800 text-sm">
                          <i class="fas fa-ambulance mr-1"></i> Servizio RSA attivo su questa targa
                        </p>
                        <p class="text-xs text-blue-600 mt-1">Aggiornare la targa anche per il servizio RSA?</p>
                      </div>
                      <label class="toggle-switch flex-shrink-0 mt-0.5">
                        <input type="checkbox" x-model="assistForm.aggiornaRsaConTarga" />
                        <span class="toggle-slider"></span>
                      </label>
                    </div>
                  </div>
                </template>
```

- [ ] **Step 3: Verifica nel browser**

Crea (o usa) un cliente con OBU + RSA attiva sulla stessa targa. Vai al flusso `cambio-targa-obu`. Seleziona l'OBU → deve comparire il banner con il toggle RSA.

- [ ] **Step 4: Commit**

```bash
git add tablet.html
git commit -m "feat(tablet): cambioTargaHasRsa check and RSA update toggle in cambio-targa-obu flow"
```

---

### Task 12: Scrivi RSA in `confermaOperazione('cambio-targa-obu')`

**File:**
- Modify: `tablet.html` — `confermaOperazione` case `cambio-targa-obu` ~riga 6865

- [ ] **Step 1: Aggiungi aggiornamento RSA veicoloId**

Trova nel case `cambio-targa-obu`, subito PRIMA di `syncVeicoli(rec)`:
```js
                syncVeicoli(rec);
                localStorage.setItem('clientiDemo', JSON.stringify(clienti));
```
Sostituisci con:
```js
                if (this.assistForm.aggiornaRsaConTarga) {
                  const vecchioId = 'v_' + (targaVecchia || '').toUpperCase();
                  const nuovoId   = 'v_' + nuovaTarga.toUpperCase();
                  (rec.contratti || []).forEach(c =>
                    (c.serviziRsa || []).forEach(r => {
                      if (r.veicoloId === vecchioId) r.veicoloId = nuovoId;
                    })
                  );
                }
                syncVeicoli(rec);
                localStorage.setItem('clientiDemo', JSON.stringify(clienti));
```

- [ ] **Step 2: Verifica nel browser**

Esegui cambio targa con toggle RSA attivo → controlla in DevTools `localStorage.getItem('clientiDemo')` che `contratti[].serviziRsa[].veicoloId` sia aggiornato alla nuova targa.

Ripeti con toggle RSA disattivo → il veicoloId RSA deve rimanere quello vecchio.

- [ ] **Step 3: Commit**

```bash
git add tablet.html
git commit -m "feat(tablet): cambio-targa-obu updates RSA veicoloId when toggle is enabled"
```

---

### Task 13: Griglia — consolida `modifica-pagamento` → `cambio-pagamento`

**File:**
- Modify: `tablet.html` — griglia ~riga 3473, flusso ~riga 3887, labels dict ~riga 6438

- [ ] **Step 1: Cambia il pulsante in griglia**

Trova in CAT 3 della griglia:
```html
                  <button class="w-full text-left px-4 py-3 rounded-lg bg-gray-50 hover:bg-green-50 hover:text-green-700 transition-all text-sm font-medium" @click="avviaAzione('modifica-pagamento')">
                    <i class="fas fa-wallet mr-2 text-gray-400"></i>Modifica metodo di pagamento
                  </button>
```
Sostituisci con:
```html
                  <button class="w-full text-left px-4 py-3 rounded-lg bg-gray-50 hover:bg-green-50 hover:text-green-700 transition-all text-sm font-medium" @click="avviaAzione('cambio-pagamento')">
                    <i class="fas fa-wallet mr-2 text-gray-400"></i>Modifica metodo di pagamento
                  </button>
```

- [ ] **Step 2: Rimuovi il template flusso `modifica-pagamento` (lines ~3887-3945)**

Trova e rimuovi l'intero blocco:
```html
            <!-- ========== 4.8 — Modifica metodo di pagamento ========== -->
            <template x-if="assistAzione === 'modifica-pagamento'">
              ...
            </template>
```
(tutto il blocco dal commento fino al `</template>` incluso)

- [ ] **Step 3: Rimuovi `modifica-pagamento` dal dict `assistAzioneLabel`**

Trova:
```js
        'modifica-pagamento':      'Modifica metodo di pagamento',
```
Rimuovi la riga.

- [ ] **Step 4: Verifica nel browser**

Griglia azioni → Contratto & Pagamenti → "Modifica metodo di pagamento" → deve andare al flusso `cambio-pagamento` con selezione contratto. Nessun loop o errore Alpine.

- [ ] **Step 5: Commit**

```bash
git add tablet.html
git commit -m "refactor(tablet): consolidate modifica-pagamento into cambio-pagamento, remove duplicate"
```

---

### Task 14: Demo button `?demo=1`

**File:**
- Modify: `tablet.html` — ricerca assistenza template ~riga 2600, JS data section

- [ ] **Step 1: Aggiungi metodo `isDemoMode()` e `generaClienteDemo()`**

Trova `selectMode(mode)` (~riga 6265). Inserisci PRIMA di esso:

```js
    isDemoMode() {
      return new URLSearchParams(window.location.search).get('demo') === '1';
    },

    generaClienteDemo() {
      const ts = Date.now();
      const cf = 'DMOTST' + String(ts).slice(-10).padStart(10, '0').slice(0, 10);
      const targa = 'DM' + String(Math.floor(Math.random() * 900) + 100) + 'EN';
      const veicoloId = 'v_' + targa;
      const record = {
        cf: cf.toUpperCase(),
        nome: 'Cliente',
        cognome: 'Demo ' + targa,
        dataNascita: '1985-06-15',
        contatti: { telefono: '+39 333 1234567', email: 'demo@enilive.it' },
        indirizzo: { via: 'Via Demo', civico: '1', comune: 'Milano', prov: 'MI', cap: '20100' },
        dataRegistrazione: new Date().toISOString(),
        canale: 'stazione',
        _v3migrated: true,
        veicoli: [{ id: veicoloId, targa, tipo: 'Auto', marca: 'Demo', modello: 'Test' }],
        consensi: { informativaPrecontrattuale: true, privacy: true, marketing: false, profilazione: false, mandatoSdd: true, dataFirma: new Date().toISOString() },
        contratti: [{
          id: 'c_' + targa, tipo: 'obu', stato: 'attivo', dataAttivazione: new Date().toISOString(),
          iban: 'IT60X0542811101000000123456', totale: 4.50,
          dispositivi: [{ tipo: 'obu', codice: 'OBU-DEMO-' + targa, veicoloId, furtoSmarrimento: false, stato: 'attivo', serviziAbilitati: { areac: { attivo: false }, parcheggi: { attivo: false } } }],
          serviziRsa: [{ id: 'rsa_' + targa, veicoloId, stato: 'attivo', costo: 2.00 }],
        }],
        serviziAttivi: { strisceBlu: { attivo: false }, memo: { attivo: false } },
        movimenti: [],
      };
      // Rimuovi casualmente 1-3 campi tra quelli obbligatori
      const campiRimuovibili = [
        () => { record.contatti.telefono = ''; },
        () => { record.contatti.email = ''; },
        () => { record.consensi.privacy = false; },
        () => { record.consensi.mandatoSdd = false; },
        () => { record.contratti[0].iban = ''; },
      ];
      const shuffled = campiRimuovibili.sort(() => Math.random() - 0.5);
      const quanti = Math.floor(Math.random() * 2) + 1; // 1 o 2 campi mancanti
      shuffled.slice(0, quanti).forEach(fn => fn());

      const clienti = JSON.parse(localStorage.getItem('clientiDemo') || '{}');
      clienti[record.cf] = record;
      localStorage.setItem('clientiDemo', JSON.stringify(clienti));

      this.assistCliente = this._clienteDemoToAssist(record);
      Object.assign(this.assistForm, {
        resVia: record.indirizzo.via,
        resCap: record.indirizzo.cap,
        resCitta: record.indirizzo.comune,
        resProvincia: record.indirizzo.prov,
        domVia: record.indirizzo.via,
        domCap: record.indirizzo.cap,
        domCitta: record.indirizzo.comune,
        domProvincia: record.indirizzo.prov,
        email: record.contatti.email,
        cellulare: record.contatti.telefono,
        veicoli: JSON.parse(JSON.stringify(this.assistCliente.veicoli)),
      });
      this.assistStep = 'scheda';
      this.showToastMsg('Cliente demo generato con dati incompleti — CF: ' + record.cf, 'warning', 5000);
    },

```

- [ ] **Step 2: Aggiungi il pulsante demo nel template `ricerca`**

Nel template `assistStep === 'ricerca'`, trova la chiusura del div esterno (`</div>` finale del `grid grid-cols-2 gap-6`). Aggiungi DOPO:
```html
          <!-- Demo button: visibile solo con ?demo=1 -->
          <template x-if="isDemoMode()">
            <div class="mt-4 flex justify-center">
              <button class="flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-dashed border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-all text-sm font-semibold"
                @click="generaClienteDemo()">
                <i class="fas fa-flask"></i>
                Genera cliente demo con dati incompleti
              </button>
            </div>
          </template>
```

- [ ] **Step 3: Verifica nel browser**

Apri `tablet.html?demo=1` → login → Assistenza → deve comparire il pulsante arancione tratteggiato. Cliccalo → deve aprire la scheda del cliente demo con alcuni campi mancanti → "Procedi con assistenza" → deve comparire `aggiorna-scheda` con i campi mancanti da compilare.

Apri `tablet.html` (senza `?demo=1`) → il pulsante NON deve comparire.

- [ ] **Step 4: Commit**

```bash
git add tablet.html
git commit -m "feat(tablet): add demo button (?demo=1) that generates incomplete client for testing check flow"
```

---

## Self-review checklist

- [x] **Spec coverage:**
  - Sez. 1 quick action search entry point → Task 8, 9, 10 ✓
  - Sez. 2 check anagrafica → Task 2, 3 ✓
  - Sez. 2b consolidamento griglia → Task 13 ✓
  - Sez. 2c demo button → Task 14 ✓
  - Sez. 3a localStorage writes → Task 4, 5, 6 ✓
  - Sez. 3b bug fix RSA sostituisci-obu → Task 7 ✓
  - Sez. 3c cambio targa RSA → Task 11, 12 ✓
  - Variabili nuove (`aggiornaRsaConTarga`, `mandatoSdd`) → Task 1 ✓

- [x] **No placeholder:** tutti i task hanno codice completo ✓

- [x] **Type consistency:**
  - `cambioTargaHasRsa()` metodo (Task 11) → usato come `cambioTargaHasRsa()` nel template (Task 11) ✓
  - `cercaClienteQuickObu(searchType)` firma (Task 9) → chiamate con `'targa'`, `'cf'` (Task 9) ✓
  - `assistForm.aggiornaRsaConTarga` (Task 1) → usato in template (Task 11) e `confermaOperazione` (Task 12) ✓
  - `aggiornaDatiForm.mandatoSdd` (Task 1) → usato in template (Task 3) e `salvaAggiornaDati` (Task 3) ✓
  - `_checkAnagraficaPreAzione(azione)` (Task 2) → chiamato in `avviaAzione(azione)` (Task 2) e `confermaProcediQuickObu` (Task 2) ✓
