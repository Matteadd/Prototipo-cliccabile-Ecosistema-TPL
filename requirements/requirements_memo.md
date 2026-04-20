# requirements_memo.md — Servizio Memo (Scadenze Veicolo)

File di requisiti per l'implementazione della sezione Memo in `proto-app.html`.
Da leggere insieme a `CLAUDE.md` per il contesto architetturale completo.

---

## Scopo

Il Servizio Memo gestisce le **scadenze amministrative del veicolo**: bollo auto, revisione periodica e scadenza RCA (assicurazione RC Auto). Per ogni veicolo nel garage del cliente, l'app mostra lo stato di ciascuna scadenza e, quando si avvicina la data, invia un reminder in-app. Il bollo è pagabile direttamente dall'app (flusso mock).

---

## Flussi Principali

### 1. Vista elenco veicoli
- Schermata principale: lista veicoli del garage
- Per ogni veicolo: targa, marca/modello, e una riga compatta con indicatori colorati per bollo / revisione / RCA
- Click su veicolo → dettaglio scadenze

### 2. Dettaglio scadenze veicolo (modal o pagina dedicata)
- Tre card, una per tipo di scadenza:

  **Bollo auto**
  - Data scadenza
  - Importo stimato (mock)
  - Stato: pagato / in scadenza / scaduto
  - CTA "Paga ora" se non pagato (vedi flusso 3)

  **Revisione**
  - Data scadenza
  - Centro revisione consigliato (placeholder)
  - Stato: ok / in scadenza / scaduta
  - CTA "Prenota revisione" (link esterno placeholder)

  **RCA (assicurazione)**
  - Data scadenza
  - Compagnia assicurativa (mock)
  - Stato: ok / in scadenza / scaduta
  - CTA "Rinnova RCA" (link esterno placeholder)

### 3. Pagamento bollo (mock)
- CTA "Paga ora" → modal pagamento
- Modal mostra: targa, periodo di validità, importo
- Metodo di pagamento: carta già salvata (mock) o nuova carta
- Bottone "Conferma pagamento" → cambia stato bollo a "pagato", pubblica `pagamento:confermato` e `memo:scadenza` (per log CRM)
- Animazione di successo post-pagamento

### 4. Reminder scadenze
- Nel dettaglio veicolo, ogni scadenza ha un toggle "Attiva reminder"
- Se attivo: la scadenza appare nella home con un banner "In scadenza entro 30 giorni"
- Stato reminder salvato in localStorage

---

## Logica Stato Scadenze

```
data scadenza > oggi + 30gg  → stato: 'ok'         (verde)
oggi < data scadenza ≤ oggi + 30gg → stato: 'in_scadenza'  (arancione)
data scadenza ≤ oggi         → stato: 'scaduto'     (rosso)
pagato recentemente          → stato: 'pagato'      (blu/grigio)
```

---

## Variabili di Stato (Alpine.js)

```javascript
memoVeicoli: [...],               // array veicoli con scadenze
showMemoModal: false,             // visibilità modal dettaglio
memoSelectedVeicolo: null,        // veicolo selezionato
showMemoPayModal: false,          // visibilità modal pagamento bollo
memoPayTargetVeicolo: null        // veicolo su cui si sta pagando il bollo
```

---

## Dati Mock

```javascript
memoVeicoli = [
  {
    targa: 'AB123CD',
    tipo: 'auto',
    marca: 'Volkswagen',
    modello: 'Golf',
    bollo: {
      scadenza: '2026-05-31',
      importo: 187.50,
      stato: 'in_scadenza',   // entro 30gg
      reminderAttivo: true
    },
    revisione: {
      scadenza: '2026-09-15',
      stato: 'ok',
      reminderAttivo: false
    },
    rca: {
      scadenza: '2026-07-22',
      compagnia: 'Generali',
      stato: 'ok',
      reminderAttivo: false
    }
  },
  {
    targa: 'EF456GH',
    tipo: 'auto',
    marca: 'Fiat',
    modello: '500',
    bollo: {
      scadenza: '2026-03-31',
      importo: 120.00,
      stato: 'scaduto',       // già scaduto
      reminderAttivo: false
    },
    revisione: {
      scadenza: '2026-11-30',
      stato: 'ok',
      reminderAttivo: false
    },
    rca: {
      scadenza: '2026-04-30',
      compagnia: 'UnipolSai',
      stato: 'in_scadenza',
      reminderAttivo: true
    }
  }
]
```

---

## Integrazione Bus

| Evento | Pubblicato da | Payload | Trigger |
|---|---|---|---|
| `pagamento:confermato` | app | `{ servizio: 'memo', importo, metodo, data, tipo: 'bollo', targa }` | Pagamento bollo completato |
| `memo:scadenza` | app | `{ tipo: 'bollo'\|'revisione'\|'rca', targa, data }` | Scadenza si avvicina (reminder) o pagamento eseguito |

| Evento | Ascoltato da | Effetto |
|---|---|---|
| `cliente:registrato` | app | Se `servizi` include `memo`, attiva la sezione e popola `memoVeicoli` dai veicoli registrati |
| `scenario:trigger` | app | Se `nome === 'memo:scadenza_imminente'`, mostra banner reminder in home |

---

## Vincoli UI

- Ogni veicolo del garage deve avere le scadenze Memo — non è un servizio per veicolo specifico, vale per tutto il garage
- Il pagamento del bollo è **completamente mock**: non integra PagoPA o sistemi ACI reali
- Il CTA "Prenota revisione" e "Rinnova RCA" sono link placeholder — nessun flusso interno
- Gli stati sono ricalcolati a runtime rispetto alla data corrente (usare `new Date()`)
- Max-width container: 420px (standard app)
- La sezione è accessibile dal menu principale con icona `fa-bell` o `fa-calendar-check`
- Il banner scadenze imminenti nella home mostra al massimo 2 voci più urgenti

---

*Creato: 2026-04-10*
