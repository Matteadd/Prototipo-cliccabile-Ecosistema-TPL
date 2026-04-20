# Requirements: Sezione Account

> Generato da: analisi diretta (nessun BUR formale — componente infrastrutturale)
> Riferimento visivo: screenshot app MyCicero (struttura Account con Garage, Cronologia, Pagamenti)
> Da implementare in: proto-app.html, proto-app.css, protoConEmulatore.html

---

## 1. Panoramica

Aggiungere una sezione **Account** nella bottom bar al posto di Chatbot.
La sezione raccoglie i dati dell'utente, il garage veicoli, la cronologia dei servizi usati
e i metodi di pagamento. È la pagina "profilo" dell'app — accessibile sempre dalla tab bar.

Il chatbot viene rimosso dalla navigazione principale. Se necessario in futuro
potrà essere reinserito come voce "Assistenza" dentro la pagina Account.

---

## 2. Modifica navigazione — Bottom Bar

**Rimuovere** la tab Chatbot (`currentPage === 'chatbot'`).
**Aggiungere** la tab Account.

Nuovo ordine tab bar (da sinistra a destra):
1. Home — `fa-home`
2. Loyalty — `fa-star` (invariata)
3. Account — `fa-user`
4. Bundle — `fa-box` (invariata)

Modifica in `proto-app.html`, sezione `<nav>`:
```html
<!-- RIMUOVERE questo bottone: -->
<button @click="currentPage = 'chatbot'" ...>Chatbot</button>

<!-- AGGIUNGERE al suo posto: -->
<button @click="currentPage = 'account'" ...>
  <i class="fa fa-user text-xl"></i>
  <span class="text-xs mt-1">Account</span>
</button>
```

---

## 3. Stato Alpine da aggiungere in x-data

```javascript
/* ========================
   ACCOUNT
   ======================== */

// --- Navigazione interna Account ---
accountSection: 'main',        // 'main' | 'garage' | 'cronologia' | 'pagamenti'

// --- Dati utente mock ---
userProfile: {
  nome: 'Mario Rossi',
  email: 'mario.rossi@email.it',
  telefono: '+39 333 1234567'
},

// --- GARAGE ---
garageVehicles: [
  { id: 1, targa: 'AB123CD', tipo: 'Auto', marca: 'Fiat', modello: 'Panda', nickname: 'La Panda' },
  { id: 2, targa: 'EF456GH', tipo: 'Auto', marca: 'Volkswagen', modello: 'Golf', nickname: 'Golf Nera' }
],
showGarageAddModal: false,      // modal aggiunta veicolo
showGarageDeleteConfirm: false, // conferma eliminazione
garageDeleteTarget: null,       // veicolo da eliminare
garageNewVehicle: {             // form aggiunta veicolo
  targa: '',
  tipo: 'Auto',
  marca: '',
  modello: '',
  nickname: ''
},

// --- CRONOLOGIA ---
cronologiaItems: [
  { id: 1, servizio: 'Strisce Blu', data: '2026-03-28', importo: 2.50, targa: 'AB123CD', stato: 'completato' },
  { id: 2, servizio: 'Strisce Blu', data: '2026-03-15', importo: 1.50, targa: 'EF456GH', stato: 'completato' },
  { id: 3, servizio: 'Rifornimento', data: '2026-03-10', importo: 45.00, targa: 'AB123CD', stato: 'completato' },
  { id: 4, servizio: 'Memo', data: '2026-03-01', importo: 0.00, targa: 'AB123CD', stato: 'attivo' }
],

// --- METODI DI PAGAMENTO ---
paymentMethods: [
  { id: 1, tipo: 'Carta di credito', label: 'Visa •••• 4242', icona: 'fa-credit-card', predefinito: true },
  { id: 2, tipo: 'PayPal', label: 'mario.rossi@email.it', icona: 'fa-paypal', predefinito: false }
],
showPaymentAddModal: false,     // modal aggiunta metodo pagamento
showPaymentDeleteConfirm: false,
paymentDeleteTarget: null,
```

**Init — aggiungere in `init()`:**
```javascript
// Reset sezione account quando si naviga via
this.$watch('currentPage', (val) => {
  if (val !== 'account') this.accountSection = 'main';
});
```

---

## 4. Funzioni Alpine da implementare

### Navigazione interna Account
```javascript
goAccountSection(section) {
  this.accountSection = section;
},
backToAccountMain() {
  this.accountSection = 'main';
}
```

### Garage

```javascript
openGarageAdd() {
  this.garageNewVehicle = { targa: '', tipo: 'Auto', marca: '', modello: '', nickname: '' };
  this.showGarageAddModal = true;
},

confirmGarageAdd() {
  if (!this.garageNewVehicle.targa || this.garageNewVehicle.targa.length < 5) {
    // mostra toast: "Inserisci una targa valida"
    return;
  }
  const newId = Date.now();
  this.garageVehicles.push({ id: newId, ...this.garageNewVehicle });
  this.showGarageAddModal = false;
  // mostra toast: "Veicolo aggiunto al garage"
},

confirmGarageDelete() {
  this.garageVehicles = this.garageVehicles.filter(v => v.id !== this.garageDeleteTarget.id);
  this.showGarageDeleteConfirm = false;
  this.garageDeleteTarget = null;
  // mostra toast: "Veicolo rimosso dal garage"
}
```

### Cronologia
Nessuna funzione specifica — la cronologia è display-only, lista statica mock.

### Metodi di Pagamento

```javascript
setDefaultPayment(id) {
  this.paymentMethods = this.paymentMethods.map(p => ({
    ...p, predefinito: p.id === id
  }));
  // mostra toast: "Metodo predefinito aggiornato"
},

confirmPaymentDelete() {
  if (this.paymentMethods.length <= 1) {
    // mostra toast: "Devi avere almeno un metodo di pagamento"
    return;
  }
  this.paymentMethods = this.paymentMethods.filter(p => p.id !== this.paymentDeleteTarget.id);
  this.showPaymentDeleteConfirm = false;
  this.paymentDeleteTarget = null;
  // mostra toast: "Metodo rimosso"
}
```

---

## 5. Struttura pagina Account

La pagina Account usa navigazione interna tramite `accountSection`.
NON usare modal overlay per le sottosezioni — navigare inline nella stessa pagina
(l'header mostra una freccia "indietro" quando si è in una sottosezione).

### `accountSection === 'main'` — Pagina principale

Struttura identica allo screenshot di riferimento:

**Banner superiore** (opzionale, stile card teal):
- Icona + "Enilive Mobility+" come label app

**Sezione "Il tuo account"**:
- Card profilo: avatar `fa-user-circle` + nome utente + "Dati personali e pagamento" → `goAccountSection('profilo')` (stub, mostra toast "Funzione in arrivo")

**Griglia 3 voci**:
- Voucher — `fa-ticket` → stub toast
- Cronologia — `fa-history` → `goAccountSection('cronologia')`
- Assistenza — `fa-headset` → stub toast

**Sezione "La tua mobilità"**:
- Garage → `goAccountSection('garage')`
- Metodi di pagamento → `goAccountSection('pagamenti')`

**Sezione "Impostazioni"** (stub):
- Documenti e privacy → stub toast "Funzione in arrivo"
- Disconnetti → stub toast "Disconnessione simulata"

---

### `accountSection === 'garage'` — Garage

**Header**: freccia indietro (`backToAccountMain()`) + titolo "Il tuo Garage"

**Lista veicoli** — per ogni veicolo in `garageVehicles`:
- Card con: badge targa (teal), nickname in grassetto, marca + modello, tipo
- Tasto elimina (icona `fa-trash`, colore rosso) → imposta `garageDeleteTarget` + `showGarageDeleteConfirm = true`

**Stato vuoto** (se `garageVehicles.length === 0`):
- Icona `fa-car` grande opaca + testo "Nessun veicolo nel garage"

**Pulsante fisso in fondo**: "+ Aggiungi veicolo" (primario) → `openGarageAdd()`

**Modal aggiunta veicolo** (`showGarageAddModal`):
- Bottom-sheet con form: targa (required), tipo (select: Auto/Moto/Furgone), marca, modello, nickname
- Pulsante "Aggiungi" → `confirmGarageAdd()`
- Pulsante "Annulla" → `showGarageAddModal = false`

**Overlay conferma eliminazione** (`showGarageDeleteConfirm`):
- Testo: "Rimuovere [nickname] dal garage?"
- "Sì, rimuovi" (rosso) → `confirmGarageDelete()`
- "Annulla" → `showGarageDeleteConfirm = false`

---

### `accountSection === 'cronologia'` — Cronologia

**Header**: freccia indietro + titolo "Cronologia"

**Lista transazioni** — per ogni item in `cronologiaItems` (ordinate per data desc):
- Icona servizio (mapping: Strisce Blu → `fa-square`, Rifornimento → `fa-gas-pump`, Memo → `fa-bell`)
- Nome servizio + data formattata (gg/mm/aaaa)
- Targa associata (badge piccolo)
- Importo a destra (verde se €0.00, altrimenti teal). Se `importo === 0` mostrare "Gratuito"
- Badge stato: "completato" (grigio) / "attivo" (verde)

**Stato vuoto**: icona + "Nessuna transazione"

---

### `accountSection === 'pagamenti'` — Metodi di Pagamento

**Header**: freccia indietro + titolo "Metodi di Pagamento"

**Lista metodi** — per ogni metodo in `paymentMethods`:
- Icona tipo (`fa-credit-card`, `fa-paypal`, ecc.)
- Label metodo
- Badge "Predefinito" (teal) se `predefinito === true`
- Azioni: stella per impostare come predefinito (`setDefaultPayment(id)`) + cestino per eliminare

**Overlay conferma eliminazione** (`showPaymentDeleteConfirm`):
- Testo: "Rimuovere questo metodo di pagamento?"
- "Sì, rimuovi" (rosso) → `confirmPaymentDelete()`
- "Annulla" → `showPaymentDeleteConfirm = false`

**Pulsante fisso in fondo**: "+ Aggiungi metodo" → `showPaymentAddModal = true`

**Modal aggiunta** (`showPaymentAddModal`):
- Bottom-sheet con select tipo (Carta di credito / PayPal / Apple Pay / Google Pay)
- Campo label (es. numero carta o email)
- Pulsante "Aggiungi" → push mock in `paymentMethods` + chiudi modal + toast "Metodo aggiunto"
- Pulsante "Annulla"

---

## 6. Scenari Emulatore da aggiungere

Aggiungere sezione "Account" nel pannello sinistro di `protoConEmulatore.html`.

### Scenario: "Vai a Garage"
- Descrizione muted: `Apre direttamente la sezione Garage`
- Funzione DEMO: `DEMO.openGarage()`
- Effetto: `currentPage = 'account'` + `accountSection = 'garage'`

### Scenario: "Vai a Pagamenti"
- Descrizione muted: `Apre direttamente la sezione Metodi di Pagamento`
- Funzione DEMO: `DEMO.openPayments()`
- Effetto: `currentPage = 'account'` + `accountSection = 'pagamenti'`

**Aggiungere in `window.DEMO`:**
```javascript
openGarage() {
  if (window.APP) {
    window.APP.currentPage = 'account';
    window.APP.accountSection = 'garage';
  }
},
openPayments() {
  if (window.APP) {
    window.APP.currentPage = 'account';
    window.APP.accountSection = 'pagamenti';
  }
}
```

---

## 7. CSS da aggiungere in proto-app.css

```css
/* === ACCOUNT === */

.account-section-card {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 16px;
  margin-bottom: 12px;
}

.account-section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 8px;
}

.account-row {
  display: flex;
  align-items: center;
  padding: 14px 0;
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  gap: 12px;
}

.account-row:last-child {
  border-bottom: none;
}

.account-row-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  background: var(--color-primary-light);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-primary);
  font-size: 16px;
  flex-shrink: 0;
}

.account-row-label {
  flex: 1;
  font-size: 15px;
  font-weight: 500;
  color: var(--color-text);
}

.account-row-chevron {
  color: var(--color-text-muted);
  font-size: 13px;
}

/* Garage vehicle card */
.garage-card {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 14px 16px;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.targa-badge {
  background: var(--color-primary);
  color: white;
  font-size: 13px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  letter-spacing: 0.05em;
}

/* Cronologia item */
.cronologia-item {
  display: flex;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid var(--color-border);
  gap: 12px;
}

.cronologia-item:last-child {
  border-bottom: none;
}

/* Payment method card */
.payment-card {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 14px 16px;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.badge-predefinito {
  background: var(--color-primary-light);
  color: var(--color-primary);
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: var(--radius-xl);
}
```

---

## 8. Vincoli e note implementative

- La navigazione interna Account usa `accountSection` — NON aprire modal overlay per Garage/Cronologia/Pagamenti, sono sezioni full-page inline
- L'header delle sottosezioni deve mostrare `<` freccia indietro che chiama `backToAccountMain()`
- Il contenuto dell'Account va wrappato in `<div x-show="currentPage === 'account'">` esattamente come le altre pagine
- La tab Chatbot va rimossa completamente dalla bottom bar e dal markup (`x-show="currentPage === 'chatbot'"`) — commentare il blocco con `<!-- CHATBOT RIMOSSO -->` invece di cancellarlo, per sicurezza
- I `garageVehicles` mock devono usare le stesse targhe dei `memoVehicles` già presenti nello stato (AB123CD, EF456GH) — coerenza dati tra servizi
- La cronologia è display-only: nessuna logica, solo rendering della lista mock
- Il modal aggiunta veicolo deve validare la targa (minimo 5 caratteri) — stesso pattern di `sbStart()` in Strisce Blu
- Non toccare il blocco `x-show="currentPage === 'chatbot'"` nel markup senza prima commentarlo

---

## 9. Cosa NON implementare

- **Autenticazione reale**: il profilo utente è mock hardcoded
- **Persistenza garage in localStorage**: i veicoli aggiunti si resettano al reload (ok per prototipo)
- **Storico transazioni reale**: cronologia completamente mock e statica
- **Aggiunta carta reale**: il form pagamento è solo UI mock, nessuna validazione numero carta
- **Voucher e Assistenza**: stub con toast "Funzione in arrivo"
- **Impostazioni**: stub con toast "Funzione in arrivo"
- **Disconnessione reale**: stub con toast "Disconnessione simulata"

---

## Come usare questo file con Claude Code

1. Salva questo file come `requirements/requirements_account.md` nella root del progetto
2. Apri Claude Code in VS Code
3. Avvia una nuova sessione
4. Scrivi:
   > "Leggi requirements/requirements_account.md e implementa la sezione Account nel prototipo seguendo esattamente le istruzioni. Leggi anche CLAUDE.md prima di iniziare."
5. Claude Code leggerà entrambi i file e procederà all'implementazione
