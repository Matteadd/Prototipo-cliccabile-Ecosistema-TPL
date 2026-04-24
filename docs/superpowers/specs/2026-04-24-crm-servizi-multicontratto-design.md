# CRM — Servizi multi-contratto & gestione cliente completa

**Data:** 2026-04-24
**File modificato:** `crm.html`

---

## Problema

Il panel "Servizi" attuale usa `serviziInfo`, un oggetto flat che aggrega tutti i contratti in un unico boolean per tipo di servizio. Un cliente con 2 contratti OBU vede un solo badge "Telepedaggio", un solo bottone "Sospendi" che non sa quale contratto colpire. Le azioni `sospendiServizio(key)` / `riattivaServizio(key)` sono inutilizzabili in scenari multi-contratto.

Mancano inoltre: scadenze Memo nel CRM, flag furto/smarrimento OBU, codice tessera RSA, alert di attenzione cliente.

---

## Scope

Modifica **solo `crm.html`**. Nessun cambio a `bus.js`, `proto-app.html`, `tablet.html` o al data model `ClienteRecord`.

---

## Design

### 1. Card "Contratti & Servizi" — colonna centrale

Sostituisce la card "Servizi" (griglia flat 3 colonne). Itera `ac().contratti` direttamente.

**Struttura visiva per contratto:**

```
┌─ Contratto #1  [OBU]  attivo  ─────────────────────────────────────┐
│                                                                      │
│  📡 OBU-001234 · AB123CD    stato: attivo      [Sospendi] [Furto]  │
│     ├─ Telepedaggio    ● attivo   dal 22/04                         │
│     ├─ Area C          ○ off                   [Attiva]             │
│     └─ Parcheggi       ○ off                   [Attiva]             │
│                                                                      │
│  🚑 RSA · AB123CD  · RSA-2024-98765   attivo   [Sospendi]          │
│                                                                      │
│  IBAN ···6789  ·  € 4.50/mese                                       │
└──────────────────────────────────────────────────────────────────────┘
```

- Header contratto: badge tipo (OBU / RSA SA), id contratto, badge stato
- Per ogni `dispositivi[]`: codice OBU, targa, stato, flag furto/smarrimento, azioni
- Sotto il device: servizi abilitati (Telepedaggio derivato dallo stato device, Area C, Parcheggi)
- Per ogni `serviziRsa[]`: targa, codice tessera, stato, azione Sospendi/Riattiva
- Footer contratto: IBAN mascherato, totale €/mese

**Sezione standalone (sotto i contratti):**
Strisce Blu e Memo rimangono come griglia flat 2 card, identica a oggi.

---

### 2. Card "Scadenze veicoli" — colonna sinistra, sotto Garage

Itera `ac().contratti` per estrarre `veicoli[].scadenze` (bollo, revisione, RCA per ogni veicolo).

```
Garage veicoli
  AB123CD  Golf
    Bollo      22/04/2026   🟡 in scadenza
    Revisione  01/05/2027   🟢 ok
    RCA        15/11/2026   🟢 ok
  EF456GH  500
    ...
```

Usa la stessa logica colore già presente in `proto-app.html`:
- 🟢 ok: > 30 giorni
- 🟡 in_scadenza: ≤ 30 giorni
- 🔴 scaduto: data passata

Le scadenze vengono lette da `clientiDemo[cf].veicoli[].scadenze` via `ac()`.

---

### 3. Alert banner — cima colonna centrale

Banner condensato visibile solo quando ci sono condizioni di attenzione:

| Condizione | Messaggio |
|---|---|
| OBU con `stato === 'sospeso'` | "OBU sospeso: [targa]" |
| OBU con `furtoSmarrimento === true` | "Furto/smarrimento segnalato: [targa]" |
| Consenso `privacy === false` | "Consenso privacy mancante" |
| Scadenza veicolo `scaduto` | "Scadenza [tipo] su [targa]" |

Ogni alert è un pill colorato (arancio/rosso). Il banner scompare se non ci sono condizioni attive.

---

### 4. Nuovi metodi Alpine.js

```js
sospendiObu(contrattoId, veicoloId)
// → clientiDemo[cf].contratti[id].dispositivi[veicoloId].stato = 'sospeso'
// → Bus.emit('crm:servizio_sospeso', { servizio: 'telepedaggio', contrattoId, veicoloId })
// → _addLog(...)

riattivaObu(contrattoId, veicoloId)
// → stato = 'attivo', furtoSmarrimento = false
// → Bus.emit('crm:servizio_riattivato', ...)

segnalaFurtoObu(contrattoId, veicoloId)
// → dispositivo.furtoSmarrimento = true, stato = 'sospeso'
// → Bus.emit('crm:furto_smarrimento', { contrattoId, veicoloId })

sospendiRsa(contrattoId, rsaId)
// → clientiDemo[cf].contratti[id].serviziRsa[rsaId].stato = 'sospeso'
// → Bus.emit('crm:servizio_sospeso', { servizio: 'rsa', contrattoId, rsaId })

riattivaRsa(contrattoId, rsaId)
// → stato = 'attivo'
// → Bus.emit('crm:servizio_riattivato', ...)

toggleServizioDevice(contrattoId, veicoloId, servizio)
// servizio: 'areac' | 'parcheggi'
// → toggle serviziAbilitati[servizio].attivo
// → Bus.emit('servizio:attivato' | 'servizio:disattivato', { servizio, contrattoId, veicoloId })
```

Ogni metodo:
1. Legge/scrive `clientiDemo` in localStorage
2. Emette evento bus
3. Aggiunge riga al log CRM
4. Non tocca `serviziInfo` (che rimane solo per strisceBlu/memo)

---

### 5. Cosa rimane invariato

- `serviziInfo` — mantenuto, usato solo per strisceBlu e memo
- `sospendiServizio(key)` / `riattivaServizio(key)` — mantenuti ma chiamati solo per `strisceBlu` e `memo`
- Card Contratti in colonna sinistra — rimane read-only (metadata: IBAN, totale, stato)
- Colonna destra (log eventi) — invariata
- Tutto il resto del CRM — invariato

---

### 6. Flusso cross-panel

```
CRM sospende OBU
  → scrive clientiDemo[cf].contratti[].dispositivi[].stato = 'sospeso'
  → Bus.emit('crm:servizio_sospeso', { servizio: 'telepedaggio', contrattoId, veicoloId })
  → App ascolta → aggiorna UI telepedaggio

App riattiva OBU (futuro)
  → scrive clientiDemo[cf].contratti[].dispositivi[].stato = 'attivo'
  → Bus.emit('servizio:riattivato', { ... })
  → CRM ascolta → rilancia loadCliente() → panel si aggiorna
```

Nessuna nuova chiave localStorage. Nessun nuovo meccanismo di comunicazione.
