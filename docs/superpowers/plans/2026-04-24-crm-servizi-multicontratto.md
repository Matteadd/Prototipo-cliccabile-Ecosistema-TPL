# CRM — Contratti & Servizi multi-contratto Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sostituire il panel "Servizi" flat del CRM con una vista per-contratto che mostra device OBU, servizi abilitati e RSA con azioni indipendenti; aggiungere scadenze Memo in colonna sinistra e un alert banner.

**Architecture:** Tutta la logica è in `crm.html` (Alpine.js inline). Il template itera `ac().contratti` direttamente per i servizi contrattuali invece di `serviziInfo`. Ogni azione scrive su `clientiDemo` localStorage (source of truth) + in-memory per reattività Alpine + Bus.emit per cross-panel sync. `serviziInfo` rimane vivo solo per `strisce_blu` e `memo`.

**Tech Stack:** Alpine.js 3.x, Tailwind CSS CDN, Font Awesome 6.4.0, bus.js (BroadcastChannel)

---

## File modificati

| File | Sezioni toccate |
|---|---|
| `crm.html` | `_emptyServiziInfo()`, `loadCliente()` mapping veicoli, metodi Alpine (`serviziList`, nuovi metodi azione, `alertList`, `scadenzaStato`, `scadenzaClass`), HTML colonna sinistra (card Scadenze), HTML colonna centrale (banner + card Contratti & Servizi) |

---

### Task 1: Aggiungi scadenze al mapping veicoli in loadCliente()

**File:** `crm.html` — funzione `loadCliente(d)` nel blocco `<script>` (~riga 547)

- [ ] **Trova la riga del mapping veicoli**

```js
return { targa: v.targa, veicoloId: v.id, tipo: v.tipo || 'auto', marca: v.marca || '', modello: v.modello || '', servizi };
```

- [ ] **Sostituisci con**

```js
return { targa: v.targa, veicoloId: v.id, tipo: v.tipo || 'auto', marca: v.marca || '', modello: v.modello || '', servizi, scadenze: v.scadenze || null };
```

- [ ] **Verifica manuale**

Apri `crm.html` nel browser. Seleziona un cliente con veicoli che hanno `scadenze` in `clientiDemo`. Apri devtools console:
```js
// Alpine 3.x: accedi allo stato dal root
document.querySelector('[x-data]')._x_dataStack[0].ac().veicoli[0].scadenze
// Expected: { bollo: "2026-12-01", revisione: "2027-05-01", rca: "2026-11-15" }  oppure null
```

- [ ] **Commit**

```bash
git add crm.html
git commit -m "feat(crm): includi scadenze nel mapping veicoli di loadCliente"
```

---

### Task 2: Aggiorna serviziList() + aggiungi helper scadenzaStato e scadenzaClass

**File:** `crm.html` — sezione computed/helpers in `crmData()` (~riga 1044)

- [ ] **Trova `serviziList()` e sostituisci con la versione filtrata**

Trova:
```js
serviziList() {
  return Object.entries(this.serviziInfo).map(([key, val]) => ({ key, ...val }));
},
```
Sostituisci con:
```js
serviziList() {
  return Object.entries(this.serviziInfo)
    .filter(([key]) => key === 'strisce_blu' || key === 'memo')
    .map(([key, val]) => ({ key, ...val }));
},
```

- [ ] **Aggiungi subito dopo serviziList() i due nuovi helper**

```js
scadenzaStato(dataStr) {
  if (!dataStr) return 'nd';
  const diff = (new Date(dataStr) - new Date()) / (1000 * 60 * 60 * 24);
  if (diff < 0) return 'scaduto';
  if (diff <= 30) return 'in_scadenza';
  return 'ok';
},
scadenzaClass(stato) {
  return {
    ok:          'bg-green-100 text-green-700',
    in_scadenza: 'bg-amber-100 text-amber-700',
    scaduto:     'bg-red-100 text-red-700',
    nd:          'bg-gray-100 text-gray-400',
  }[stato] || 'bg-gray-100 text-gray-400';
},
```

- [ ] **Verifica manuale**

Console browser:
```js
const d = document.querySelector('[x-data]')._x_dataStack[0];
d.serviziList().map(s => s.key)
// Expected: ['strisce_blu', 'memo']

d.scadenzaStato('2020-01-01')   // Expected: 'scaduto'
d.scadenzaStato('2099-01-01')   // Expected: 'ok'
d.scadenzaClass('in_scadenza')  // Expected: 'bg-amber-100 text-amber-700'
```

- [ ] **Commit**

```bash
git add crm.html
git commit -m "feat(crm): filtra serviziList a strisce_blu/memo, aggiungi helper scadenze"
```

---

### Task 3: Aggiungi i 6 metodi di azione contrattuale

**File:** `crm.html` — dopo `riattivaServizio()` nel blocco `crmData()` (~riga 1023)

- [ ] **Inserisci i 6 metodi dopo la chiusura di `riattivaServizio()`**

```js
sospendiObu(contrattoId, veicoloId) {
  const c = this.ac();
  const ct = (c.contratti || []).find(x => x.id === contrattoId);
  if (!ct) return;
  const dev = (ct.dispositivi || []).find(d => d.veicoloId === veicoloId);
  if (!dev) return;
  dev.stato = 'sospeso';
  const reg = JSON.parse(localStorage.getItem('clientiDemo') || '{}');
  const rec = reg[(c.anagrafica.cf || '').toUpperCase()];
  if (rec) {
    const rct = (rec.contratti || []).find(x => x.id === contrattoId);
    if (rct) {
      const rd = (rct.dispositivi || []).find(d => d.veicoloId === veicoloId);
      if (rd) rd.stato = 'sospeso';
    }
    localStorage.setItem('clientiDemo', JSON.stringify(reg));
  }
  const targa = veicoloId.replace('v_', '');
  Bus.emit('crm:servizio_sospeso', { servizio: 'telepedaggio', contrattoId, veicoloId, targa });
  this._addLog('crm:servizio_sospeso', { servizio: 'telepedaggio', targa });
},

riattivaObu(contrattoId, veicoloId) {
  const c = this.ac();
  const ct = (c.contratti || []).find(x => x.id === contrattoId);
  if (!ct) return;
  const dev = (ct.dispositivi || []).find(d => d.veicoloId === veicoloId);
  if (!dev) return;
  dev.stato = 'attivo';
  dev.furtoSmarrimento = false;
  const reg = JSON.parse(localStorage.getItem('clientiDemo') || '{}');
  const rec = reg[(c.anagrafica.cf || '').toUpperCase()];
  if (rec) {
    const rct = (rec.contratti || []).find(x => x.id === contrattoId);
    if (rct) {
      const rd = (rct.dispositivi || []).find(d => d.veicoloId === veicoloId);
      if (rd) { rd.stato = 'attivo'; rd.furtoSmarrimento = false; }
    }
    localStorage.setItem('clientiDemo', JSON.stringify(reg));
  }
  const targa = veicoloId.replace('v_', '');
  Bus.emit('crm:servizio_riattivato', { servizio: 'telepedaggio', contrattoId, veicoloId, targa });
  this._addLog('crm:servizio_riattivato', { servizio: 'telepedaggio', targa });
},

segnalaFurtoObu(contrattoId, veicoloId) {
  const c = this.ac();
  const ct = (c.contratti || []).find(x => x.id === contrattoId);
  if (!ct) return;
  const dev = (ct.dispositivi || []).find(d => d.veicoloId === veicoloId);
  if (!dev) return;
  dev.stato = 'sospeso';
  dev.furtoSmarrimento = true;
  const reg = JSON.parse(localStorage.getItem('clientiDemo') || '{}');
  const rec = reg[(c.anagrafica.cf || '').toUpperCase()];
  if (rec) {
    const rct = (rec.contratti || []).find(x => x.id === contrattoId);
    if (rct) {
      const rd = (rct.dispositivi || []).find(d => d.veicoloId === veicoloId);
      if (rd) { rd.stato = 'sospeso'; rd.furtoSmarrimento = true; }
    }
    localStorage.setItem('clientiDemo', JSON.stringify(reg));
  }
  const targa = veicoloId.replace('v_', '');
  Bus.emit('crm:furto_smarrimento', { contrattoId, veicoloId, targa });
  this._addLog('crm:furto_smarrimento', { targa });
},

sospendiRsa(contrattoId, rsaId) {
  const c = this.ac();
  const ct = (c.contratti || []).find(x => x.id === contrattoId);
  if (!ct) return;
  const rsa = (ct.serviziRsa || []).find(r => r.id === rsaId);
  if (!rsa) return;
  rsa.stato = 'sospeso';
  const reg = JSON.parse(localStorage.getItem('clientiDemo') || '{}');
  const rec = reg[(c.anagrafica.cf || '').toUpperCase()];
  if (rec) {
    const rct = (rec.contratti || []).find(x => x.id === contrattoId);
    if (rct) {
      const rr = (rct.serviziRsa || []).find(r => r.id === rsaId);
      if (rr) rr.stato = 'sospeso';
    }
    localStorage.setItem('clientiDemo', JSON.stringify(reg));
  }
  const targa = (rsa.veicoloId || '').replace('v_', '');
  Bus.emit('crm:servizio_sospeso', { servizio: 'rsa', contrattoId, rsaId, targa });
  this._addLog('crm:servizio_sospeso', { servizio: 'rsa', targa });
},

riattivaRsa(contrattoId, rsaId) {
  const c = this.ac();
  const ct = (c.contratti || []).find(x => x.id === contrattoId);
  if (!ct) return;
  const rsa = (ct.serviziRsa || []).find(r => r.id === rsaId);
  if (!rsa) return;
  rsa.stato = 'attivo';
  const reg = JSON.parse(localStorage.getItem('clientiDemo') || '{}');
  const rec = reg[(c.anagrafica.cf || '').toUpperCase()];
  if (rec) {
    const rct = (rec.contratti || []).find(x => x.id === contrattoId);
    if (rct) {
      const rr = (rct.serviziRsa || []).find(r => r.id === rsaId);
      if (rr) rr.stato = 'attivo';
    }
    localStorage.setItem('clientiDemo', JSON.stringify(reg));
  }
  const targa = (rsa.veicoloId || '').replace('v_', '');
  Bus.emit('crm:servizio_riattivato', { servizio: 'rsa', contrattoId, rsaId, targa });
  this._addLog('crm:servizio_riattivato', { servizio: 'rsa', targa });
},

toggleServizioDevice(contrattoId, veicoloId, servizio) {
  const c = this.ac();
  const ct = (c.contratti || []).find(x => x.id === contrattoId);
  if (!ct) return;
  const dev = (ct.dispositivi || []).find(d => d.veicoloId === veicoloId);
  if (!dev) return;
  if (!dev.serviziAbilitati) dev.serviziAbilitati = { areac: { attivo: false }, parcheggi: { attivo: false } };
  if (!dev.serviziAbilitati[servizio]) dev.serviziAbilitati[servizio] = { attivo: false };
  const nuovoStato = !dev.serviziAbilitati[servizio].attivo;
  dev.serviziAbilitati[servizio].attivo = nuovoStato;
  const reg = JSON.parse(localStorage.getItem('clientiDemo') || '{}');
  const rec = reg[(c.anagrafica.cf || '').toUpperCase()];
  if (rec) {
    const rct = (rec.contratti || []).find(x => x.id === contrattoId);
    if (rct) {
      const rd = (rct.dispositivi || []).find(d => d.veicoloId === veicoloId);
      if (rd) {
        if (!rd.serviziAbilitati) rd.serviziAbilitati = { areac: { attivo: false }, parcheggi: { attivo: false } };
        if (!rd.serviziAbilitati[servizio]) rd.serviziAbilitati[servizio] = { attivo: false };
        rd.serviziAbilitati[servizio].attivo = nuovoStato;
      }
    }
    localStorage.setItem('clientiDemo', JSON.stringify(reg));
  }
  const targa = veicoloId.replace('v_', '');
  const evento = nuovoStato ? 'servizio:attivato' : 'servizio:disattivato';
  Bus.emit(evento, { servizio, contrattoId, veicoloId, targa });
  this._addLog(evento, { servizio, targa });
},
```

- [ ] **Verifica manuale**

Console browser:
```js
const d = document.querySelector('[x-data]')._x_dataStack[0];
typeof d.sospendiObu      // Expected: 'function'
typeof d.riattivaObu      // Expected: 'function'
typeof d.segnalaFurtoObu  // Expected: 'function'
typeof d.sospendiRsa      // Expected: 'function'
typeof d.riattivaRsa      // Expected: 'function'
typeof d.toggleServizioDevice  // Expected: 'function'
```

- [ ] **Commit**

```bash
git add crm.html
git commit -m "feat(crm): aggiungi metodi sospendiObu, riattivaObu, segnalaFurtoObu, sospendiRsa, riattivaRsa, toggleServizioDevice"
```

---

### Task 4: Aggiungi alertList() computed

**File:** `crm.html` — dopo `scadenzaClass()` nel blocco `crmData()`

- [ ] **Inserisci `alertList()` dopo `scadenzaClass()`**

```js
alertList() {
  const c = this.ac();
  if (!c || !c.anagrafica) return [];
  const alerts = [];
  (c.contratti || []).forEach(ct => {
    (ct.dispositivi || []).forEach(dev => {
      const targa = (dev.veicoloId || '').replace('v_', '');
      if (dev.furtoSmarrimento) {
        alerts.push({ tipo: 'danger', msg: `Furto/smarrimento: ${targa}` });
      } else if (dev.stato === 'sospeso') {
        alerts.push({ tipo: 'warning', msg: `OBU sospeso: ${targa}` });
      }
    });
  });
  if (c.tcFlags && c.tcFlags.privacy && !c.tcFlags.privacy.accettato) {
    alerts.push({ tipo: 'warning', msg: 'Consenso privacy mancante' });
  }
  (c.veicoli || []).forEach(v => {
    if (!v.scadenze) return;
    ['bollo', 'revisione', 'rca'].forEach(tipo => {
      const stato = this.scadenzaStato(v.scadenze[tipo]);
      if (stato === 'scaduto') {
        alerts.push({ tipo: 'danger', msg: `${tipo.charAt(0).toUpperCase() + tipo.slice(1)} scaduto: ${v.targa}` });
      } else if (stato === 'in_scadenza') {
        alerts.push({ tipo: 'warning', msg: `${tipo.charAt(0).toUpperCase() + tipo.slice(1)} in scadenza: ${v.targa}` });
      }
    });
  });
  return alerts;
},
```

- [ ] **Commit**

```bash
git add crm.html
git commit -m "feat(crm): aggiungi computed alertList per banner attenzione cliente"
```

---

### Task 5: Aggiungi alert banner HTML — cima colonna centrale

**File:** `crm.html` — colonna centrale, subito prima del commento `<!-- Servizi ──...`

- [ ] **Trova il commento `<!-- Servizi ────────────────────────────────────────────── -->` nella colonna centrale (~riga 1442)**

- [ ] **Inserisci il banner HTML PRIMA di quel commento**

```html
<!-- Alert banner ───────────────────────────────────────── -->
<template x-if="alertList().length > 0">
  <div class="rounded-lg px-3 py-2 mb-3 flex flex-wrap gap-1.5 items-center"
       style="background:#fff7ed;border:1px solid #fed7aa;">
    <i class="fa-solid fa-triangle-exclamation text-orange-500 text-xs mr-0.5 flex-shrink-0"></i>
    <template x-for="(alert, idx) in alertList()" :key="idx">
      <span class="badge"
            :class="alert.tipo==='danger'?'bg-red-100 text-red-700':'bg-orange-100 text-orange-700'"
            x-text="alert.msg"></span>
    </template>
  </div>
</template>
```

- [ ] **Verifica manuale**

1. Apri `crm.html` — con cliente senza problemi: il banner non deve essere visibile (nessun elemento DOM renderizzato grazie a `x-if`)
2. Da devtools console, simula un OBU sospeso:
```js
const d = document.querySelector('[x-data]')._x_dataStack[0];
// Se il cliente attivo ha contratti con dispositivi:
d.alertList()  // deve restituire array vuoto per cliente "normale"
```
3. Usa `segnalaFurtoObu()` da console su un contratto reale e verifica che il banner rosso appaia

- [ ] **Commit**

```bash
git add crm.html
git commit -m "feat(crm): aggiungi alert banner in cima colonna centrale"
```

---

### Task 6: Sostituisci card "Servizi" con card "Contratti & Servizi"

**File:** `crm.html` — colonna centrale (~riga 1443–1517)

- [ ] **Individua l'intera card "Servizi" da sostituire**

Inizia da:
```html
<!-- Servizi ────────────────────────────────────────────── -->
<div class="card">
```
Finisce alla `</div>` corrispondente della card (dopo l'ultimo `</template>` dei service-card). Rimuovi tutto questo blocco.

- [ ] **Inserisci al suo posto la nuova card**

```html
<!-- Contratti & Servizi ────────────────────────────────── -->
<div class="card">
  <div class="card-header">
    <span class="card-title"><i class="fa-solid fa-layer-group mr-1.5"></i>Contratti & Servizi</span>
    <span class="text-xs text-gray-400"
          x-text="(ac().contratti||[]).length + ' contratt'+((ac().contratti||[]).length===1?'o':'i')"></span>
  </div>
  <div class="card-body" style="padding-top:8px;padding-bottom:8px;">

    <div x-show="!(ac().contratti||[]).length"
         class="text-xs text-gray-400 italic text-center py-3">Nessun contratto</div>

    <template x-for="ct in (ac().contratti||[])" :key="ct.id">
      <div class="rounded-lg mb-3 last:mb-0 overflow-hidden" style="border:1px solid #e5e7eb;">

        <!-- Header contratto -->
        <div class="flex items-center gap-2 px-3 py-2 bg-gray-50">
          <span class="badge"
                :class="ct.tipo==='obu'?'bg-blue-100 text-blue-700':'bg-orange-100 text-orange-700'"
                x-text="ct.tipo==='obu'?'OBU':'RSA SA'"></span>
          <span class="text-xs font-mono text-gray-400 flex-1 truncate" x-text="ct.id"></span>
          <span class="badge"
                :class="ct.stato==='attivo'?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'"
                x-text="ct.stato"></span>
        </div>

        <!-- Dispositivi e RSA -->
        <div class="px-3 pt-2 pb-1 space-y-3">

          <template x-for="dev in (ct.dispositivi||[])" :key="dev.veicoloId">
            <div>
              <!-- Riga device OBU -->
              <div class="flex items-center gap-1.5 mb-1.5 flex-wrap">
                <i class="fa-solid fa-broadcast-tower text-blue-400" style="font-size:11px;"></i>
                <span class="font-mono text-xs font-bold text-gray-700"
                      x-text="(dev.veicoloId||'').replace('v_','')"></span>
                <span class="text-xs text-gray-400 font-mono" x-text="dev.codice"></span>
                <span x-show="dev.furtoSmarrimento"
                      class="badge bg-red-100 text-red-700" style="font-size:10px;">
                  <i class="fa-solid fa-triangle-exclamation mr-0.5"></i>Furto/Smarr.
                </span>
                <span class="badge ml-auto" style="font-size:10px;"
                      :class="dev.stato==='attivo'?'bg-green-100 text-green-700':(dev.stato==='sospeso'?'bg-orange-100 text-orange-700':'bg-gray-100 text-gray-500')"
                      x-text="dev.stato||'—'"></span>
                <button x-show="dev.stato==='attivo' && !dev.furtoSmarrimento"
                        @click="sospendiObu(ct.id, dev.veicoloId)"
                        class="text-xs px-2 py-0.5 rounded border border-orange-200 text-orange-600 hover:bg-orange-50 transition">
                  Sospendi
                </button>
                <button x-show="dev.stato==='sospeso' && !dev.furtoSmarrimento"
                        @click="riattivaObu(ct.id, dev.veicoloId)"
                        class="text-xs px-2 py-0.5 rounded border border-green-200 text-green-600 hover:bg-green-50 transition">
                  Riattiva
                </button>
                <button x-show="!dev.furtoSmarrimento"
                        @click="segnalaFurtoObu(ct.id, dev.veicoloId)"
                        class="text-xs px-2 py-0.5 rounded border border-red-200 text-red-600 hover:bg-red-50 transition">
                  Furto
                </button>
              </div>

              <!-- Servizi sotto il device -->
              <div class="ml-4 space-y-1 pb-1 border-l-2 border-blue-100 pl-2">
                <div class="flex items-center gap-2">
                  <i class="fa-solid fa-road text-gray-300" style="font-size:10px;"></i>
                  <span class="text-xs text-gray-600">Telepedaggio</span>
                  <span class="badge ml-auto" style="font-size:10px;"
                        :class="dev.stato==='attivo'?'bg-green-100 text-green-700':'bg-orange-100 text-orange-700'"
                        x-text="dev.stato==='attivo'?'attivo':'sospeso'"></span>
                </div>
                <div class="flex items-center gap-2">
                  <i class="fa-solid fa-city text-gray-300" style="font-size:10px;"></i>
                  <span class="text-xs text-gray-600">Area C</span>
                  <span class="badge ml-auto" style="font-size:10px;"
                        :class="dev.serviziAbilitati?.areac?.attivo?'bg-purple-100 text-purple-700':'bg-gray-100 text-gray-400'"
                        x-text="dev.serviziAbilitati?.areac?.attivo?'on':'off'"></span>
                  <button @click="toggleServizioDevice(ct.id, dev.veicoloId, 'areac')"
                          class="text-xs px-2 py-0.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 transition"
                          x-text="dev.serviziAbilitati?.areac?.attivo?'Disattiva':'Attiva'"></button>
                </div>
                <div class="flex items-center gap-2">
                  <i class="fa-solid fa-square-parking text-gray-300" style="font-size:10px;"></i>
                  <span class="text-xs text-gray-600">Parcheggi</span>
                  <span class="badge ml-auto" style="font-size:10px;"
                        :class="dev.serviziAbilitati?.parcheggi?.attivo?'bg-teal-100 text-teal-700':'bg-gray-100 text-gray-400'"
                        x-text="dev.serviziAbilitati?.parcheggi?.attivo?'on':'off'"></span>
                  <button @click="toggleServizioDevice(ct.id, dev.veicoloId, 'parcheggi')"
                          class="text-xs px-2 py-0.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 transition"
                          x-text="dev.serviziAbilitati?.parcheggi?.attivo?'Disattiva':'Attiva'"></button>
                </div>
              </div>
            </div>
          </template>

          <!-- RSA per questo contratto -->
          <template x-for="rsa in (ct.serviziRsa||[])" :key="rsa.id">
            <div class="flex items-center gap-1.5 flex-wrap pb-1">
              <i class="fa-solid fa-truck-medical text-orange-400" style="font-size:11px;"></i>
              <span class="font-mono text-xs font-bold text-gray-700"
                    x-text="(rsa.veicoloId||'').replace('v_','')"></span>
              <span x-show="rsa.codice" class="text-xs text-gray-400 font-mono" x-text="rsa.codice"></span>
              <span class="badge" style="font-size:10px;"
                    :class="rsa.stato==='attivo'?'bg-green-100 text-green-700':'bg-orange-100 text-orange-700'"
                    x-text="rsa.stato"></span>
              <button x-show="rsa.stato==='attivo'"
                      @click="sospendiRsa(ct.id, rsa.id)"
                      class="text-xs px-2 py-0.5 rounded border border-orange-200 text-orange-600 hover:bg-orange-50 transition ml-auto">
                Sospendi
              </button>
              <button x-show="rsa.stato!=='attivo'"
                      @click="riattivaRsa(ct.id, rsa.id)"
                      class="text-xs px-2 py-0.5 rounded border border-green-200 text-green-600 hover:bg-green-50 transition ml-auto">
                Riattiva
              </button>
            </div>
          </template>

        </div>

        <!-- Footer contratto -->
        <div class="flex items-center justify-between px-3 py-1.5 border-t border-gray-100">
          <span class="text-xs text-gray-400 font-mono"
                x-text="ct.iban?'···'+ct.iban.slice(-4):'—'"></span>
          <span class="text-xs font-bold text-blue-700"
                x-text="'€ '+(ct.totale||0).toFixed(2)+'/mese'"></span>
        </div>
      </div>
    </template>

    <!-- Standalone: strisce_blu + memo -->
    <template x-if="serviziList().length > 0">
      <div class="mt-3">
        <div class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">
          Servizi standalone
        </div>
        <div class="grid grid-cols-2 gap-2">
          <template x-for="s in serviziList()" :key="s.key">
            <div class="service-card"
                 :class="s.sospeso?'sospeso':(s.attivo?'attivo':'inattivo')">
              <div class="flex items-center gap-1.5 mb-1.5">
                <i class="fa-solid text-xs" :class="s.icon"
                   :style="s.attivo?'color:var(--color-primary)':'color:#9ca3af'"></i>
                <span class="text-xs font-semibold leading-tight truncate" x-text="s.nome"></span>
              </div>
              <div class="mb-2">
                <span x-show="s.attivo && !s.sospeso" class="badge bg-green-100 text-green-700">
                  <i class="fa-solid fa-circle text-green-500" style="font-size:6px;"></i> Attivo
                </span>
                <span x-show="s.sospeso" class="badge bg-orange-100 text-orange-700">Sospeso</span>
                <span x-show="!s.attivo && !s.sospeso" class="badge bg-gray-100 text-gray-500">Inattivo</span>
              </div>
              <div class="mt-2" x-show="s.attivo">
                <button x-show="!s.sospeso" @click="sospendiServizio(s.key)"
                  class="text-xs px-2 py-0.5 rounded border border-orange-200 text-orange-600 hover:bg-orange-50 transition w-full">
                  Sospendi
                </button>
                <button x-show="s.sospeso" @click="riattivaServizio(s.key)"
                  class="text-xs px-2 py-0.5 rounded border border-green-200 text-green-600 hover:bg-green-50 transition w-full">
                  Riattiva
                </button>
              </div>
            </div>
          </template>
        </div>
      </div>
    </template>

  </div>
</div>
```

- [ ] **Verifica manuale**

1. Apri `crm.html` nel browser
2. Seleziona cliente con contratti OBU — ogni contratto deve essere un blocco separato con device, Telepedaggio/Area C/Parcheggi e RSA
3. Clicca "Sospendi" su OBU → badge diventa arancio "sospeso", bottone Sospendi sparisce → appare Riattiva
4. Clicca "Riattiva" → badge torna verde, bottoni ripristinati
5. Clicca "Furto" → badge rosso "Furto/Smarr." appare, bottoni Sospendi/Riattiva spariscono, alert banner si aggiorna
6. Ricarica pagina → tutte le modifiche persistono da localStorage
7. Strisce Blu e Memo appaiono nella sezione "Servizi standalone" sotto i contratti

- [ ] **Commit**

```bash
git add crm.html
git commit -m "feat(crm): sostituisci panel Servizi flat con Contratti & Servizi per-contratto"
```

---

### Task 7: Aggiungi card "Scadenze Memo" in colonna sinistra

**File:** `crm.html` — colonna sinistra, prima del commento `<!-- Contratti ──...` (~riga 1350)

- [ ] **Trova il commento `<!-- Contratti ──────────────────────────────────────────────── -->`**

- [ ] **Inserisci la nuova card PRIMA di quel commento**

```html
<!-- Scadenze Memo ─────────────────────────────────────── -->
<template x-if="veicoli.some(v => v.scadenze)">
  <div class="card">
    <div class="card-header">
      <span class="card-title"><i class="fa-solid fa-calendar-days mr-1.5"></i>Scadenze Memo</span>
      <span class="text-xs font-semibold"
            :class="veicoli.some(v => v.scadenze && ['bollo','revisione','rca'].some(t => scadenzaStato(v.scadenze[t])==='scaduto')) ? 'text-red-500' : 'text-gray-400'"
            x-text="veicoli.filter(v => v.scadenze).length + ' veicol' + (veicoli.filter(v => v.scadenze).length===1?'o':'i')"></span>
    </div>
    <div class="card-body" style="padding-top:8px;padding-bottom:8px;">
      <template x-for="v in veicoli.filter(v => v.scadenze)" :key="v.targa">
        <div class="mb-3 last:mb-0">
          <div class="flex items-center gap-1.5 mb-1">
            <i class="fa-solid fa-car text-gray-400 text-xs"></i>
            <span class="font-mono font-bold text-sm" x-text="v.targa"></span>
          </div>
          <div class="space-y-1 ml-4">
            <template x-for="tipo in ['bollo','revisione','rca']" :key="tipo">
              <div x-show="v.scadenze[tipo]" class="flex items-center gap-2">
                <span class="w-16 text-xs text-gray-500 capitalize" x-text="tipo"></span>
                <span class="text-xs font-mono text-gray-600"
                      x-text="formatDate(v.scadenze[tipo])"></span>
                <span class="badge" style="font-size:10px;"
                      :class="scadenzaClass(scadenzaStato(v.scadenze[tipo]))"
                      x-text="scadenzaStato(v.scadenze[tipo])==='ok'?'ok':(scadenzaStato(v.scadenze[tipo])==='in_scadenza'?'in scad.':'scaduto')"></span>
              </div>
            </template>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
```

- [ ] **Verifica manuale**

1. Con cliente che ha veicoli con `scadenze` in `clientiDemo`: la card appare tra Garage e Contratti
2. Date formattate `gg/mm/aaaa`, badge colorati per stato
3. Con cliente senza `scadenze` sui veicoli: la card non appare (nessun elemento DOM)
4. Se c'è almeno una scadenza `scaduto`: il counter nel header diventa rosso

- [ ] **Commit**

```bash
git add crm.html
git commit -m "feat(crm): aggiungi card Scadenze Memo in colonna sinistra"
```

---

### Task 8: Pulizia _emptyServiziInfo + verifica integrazione finale

**File:** `crm.html` — funzione `_emptyServiziInfo()` (~riga 349)

- [ ] **Rimuovi da `_emptyServiziInfo()` le chiavi `telepedaggio`, `rsa`, `areac`, `parcheggi`**

Il risultato deve essere esattamente (copia le righe `strisce_blu` e `memo` verbatim dall'originale, rimuovi le altre):
```js
function _emptyServiziInfo() {
  return {
    strisce_blu: { nome: 'Strisce Blu', icon: 'fa-parking',  attivo: false, sospeso: false, dataAttivazione: null },
    memo:        { nome: 'Memo',        icon: 'fa-bell',      attivo: false, sospeso: false, dataAttivazione: null, scadenzeImminenti: 0 },
  };
}
```

Non toccare `_mockServiziInfo()` — rimane invariata (usata solo per il cliente mock precaricato; `serviziList()` filtrerà comunque).

- [ ] **Verifica integrazione end-to-end**

1. Apri `tablet.html`, registra un nuovo cliente con 2 contratti OBU (ognuno con RSA)
2. Apri `crm.html` → il cliente deve apparire nel roster
3. Seleziona il cliente: deve mostrare 2 blocchi contratto nel panel "Contratti & Servizi"
4. Sospendi OBU del contratto 1 → alert banner mostra "OBU sospeso: [targa]", log CRM registra l'evento
5. Attiva Area C sul contratto 2 → badge Area C diventa "on", localStorage aggiornato
6. Apri il cliente nell'app (se attivo via emulatore) → le modifiche devono riflettersi nell'app via bus
7. Verifica che Strisce Blu e Memo nella sezione standalone funzionino ancora con Sospendi/Riattiva

- [ ] **Commit finale**

```bash
git add crm.html
git commit -m "feat(crm): pulizia _emptyServiziInfo, rimuovi chiavi servizi contrattuali"
```
