# requirements_movimenti.md — Sezione Movimenti (trasversale)

File di requisiti per l'implementazione della sezione Movimenti in `proto-app.html`.
Da leggere insieme a `CLAUDE.md` per il contesto architetturale completo.

---

## Scopo

La sezione Movimenti è la **vista trasversale di tutte le transazioni** del cliente, aggregando in un'unica lista i movimenti di tutti i servizi attivi: Strisce Blu, Telepedaggio, Area C, RSA, Parcheggi e Memo (pagamento bollo). Permette al cliente di avere una vista economica completa e filtrabile.

---

## Flussi Principali

### 1. Lista movimenti
- Lista cronologica (più recente in cima) di tutti i movimenti
- Ogni riga mostra:
  - Data e ora (formato "GG MMM YYYY — HH:MM")
  - Badge servizio colorato (es. "Strisce Blu" viola, "Telepedaggio" blu, "RSA" arancione)
  - Descrizione (es. "Sosta Zona A — 1h 30m", "Transito A8 Milano Nord")
  - Targa
  - Importo in € (con segno `-` per addebiti, `+` per eventuali rimborsi)
  - Stato: badge "Pagato" / "In corso" / "Da addebitare" / "Errore"

### 2. Filtri
- Filtro per **servizio**: dropdown multi-select (Tutti / Strisce Blu / Telepedaggio / Area C / RSA / Parcheggi / Memo)
- Filtro per **periodo**: selezione rapida (Oggi / Ultima settimana / Ultimo mese / Range personalizzato — due date input)
- Filtro per **stato**: Tutti / Pagato / In corso / Da addebitare / Errore
- Bottone "Reset filtri"
- Contatore risultati: "X movimenti trovati"

### 3. Riepilogo aggregato
- Card in testa alla sezione (sopra i filtri):
  - Totale speso nel mese corrente (somma importi pagati + da addebitare)
  - Numero totale movimenti del mese
  - Breakdown per servizio (piccola barra o lista: "Strisce Blu €X — Telepedaggio €Y — ...")

### 4. Dettaglio movimento (espansione inline o modal)
- Click su riga → espande o apre modal con:
  - Tutti i campi della riga
  - Eventuale riferimento (es. numero fattura, codice transazione mock)
  - CTA "Segnala problema" (apre form mock o rimanda al CRM)

---

## Variabili di Stato (Alpine.js)

```javascript
movimenti: [...],              // array completo tutti i servizi
movimentiFilter: {
  servizio: null,              // null = tutti
  stato: null,                 // null = tutti
  dateFrom: null,              // ISO string o null
  dateTo: null                 // ISO string o null
},
movimentiSelectedId: null      // ID del movimento espanso/in modal
```

---

## Dati Mock

La sezione Movimenti aggrega i mock già definiti negli altri requisiti. Elenco iniziale consolidato:

```javascript
movimenti = [
  // Strisce Blu
  { id: 'm001', data: '2026-04-09T09:15:00', servizio: 'strisce_blu', descrizione: 'Sosta Zona A — 1h 30m',             targa: 'AB123CD', importo: 2.25,  stato: 'pagato' },
  { id: 'm002', data: '2026-04-08T14:00:00', servizio: 'strisce_blu', descrizione: 'Sosta Zona B — 45 min',             targa: 'AB123CD', importo: 1.13,  stato: 'pagato' },

  // Telepedaggio
  { id: 'm003', data: '2026-04-09T08:22:00', servizio: 'telepedaggio', descrizione: 'Transito A8 — Milano Nord',        targa: 'AB123CD', importo: 1.80,  stato: 'pagato' },
  { id: 'm004', data: '2026-04-08T19:05:00', servizio: 'telepedaggio', descrizione: 'Transito A8 — Rho',                targa: 'AB123CD', importo: 1.20,  stato: 'pagato' },
  { id: 'm005', data: '2026-04-03T16:30:00', servizio: 'telepedaggio', descrizione: 'Transito A9 — Como Sud',           targa: 'AB123CD', importo: 2.40,  stato: 'pagato' },

  // Area C
  { id: 'm006', data: '2026-04-08T08:15:00', servizio: 'areac',        descrizione: 'Transito Area C Milano',           targa: 'AB123CD', importo: 7.50,  stato: 'da_addebitare' },
  { id: 'm007', data: '2026-04-07T09:02:00', servizio: 'areac',        descrizione: 'Transito Area C Milano',           targa: 'AB123CD', importo: 7.50,  stato: 'da_addebitare' },

  // RSA (canone)
  { id: 'm008', data: '2026-04-01T00:00:00', servizio: 'rsa',          descrizione: 'Canone mensile RSA — Aprile 2026', targa: 'AB123CD', importo: 2.00,  stato: 'pagato' },

  // Parcheggi
  { id: 'm009', data: '2026-04-09T09:00:00', servizio: 'parcheggi',    descrizione: 'Parking Centro Milano — 2h 30m',  targa: 'AB123CD', importo: 5.00,  stato: 'pagato' },
  { id: 'm010', data: '2026-04-07T14:15:00', servizio: 'parcheggi',    descrizione: 'Parking Garibaldi — 1h 45m',      targa: 'AB123CD', importo: 4.38,  stato: 'pagato' },

  // Memo (bollo)
  { id: 'm011', data: '2026-03-15T10:30:00', servizio: 'memo',         descrizione: 'Bollo auto AB123CD — 2026',       targa: 'AB123CD', importo: 187.50, stato: 'pagato' }
]
```

---

## Colori Badge Servizio

| Servizio | Classe Tailwind (bg + text) |
|---|---|
| `strisce_blu` | `bg-purple-100 text-purple-700` |
| `telepedaggio` | `bg-blue-100 text-blue-700` |
| `areac` | `bg-indigo-100 text-indigo-700` |
| `rsa` | `bg-orange-100 text-orange-700` |
| `parcheggi` | `bg-teal-100 text-teal-700` |
| `memo` | `bg-amber-100 text-amber-700` |

---

## Integrazione Bus

| Evento | Ascoltato da | Effetto |
|---|---|---|
| `pagamento:confermato` | app | Aggiunge movimento in cima alla lista con stato "pagato" |
| `sosta:avviata` | app | Aggiunge movimento con stato "in corso" |
| `sosta:terminata` | app | Aggiorna il movimento "in corso" → "pagato" con importo finale |
| `crm:movimento_aggiornato` | app | Aggiorna o aggiunge il movimento corrispondente nella lista |

---

## Vincoli UI

- I movimenti devono essere **sempre ordinati per data discendente** (più recente in cima), anche dopo aggiornamenti via bus
- Lo stato "in corso" deve essere visivamente distinto (badge animato o colore diverso)
- Il filtro per periodo deve aggiornare la lista in tempo reale (no submit)
- La sezione Movimenti è **trasversale**: non è la lista di un singolo servizio, ma l'aggregato di tutti
- Max-width container: 420px (standard app)
- La sezione è accessibile dal menu principale con icona `fa-receipt` o `fa-list`
- Paginazione: mostrare gli ultimi 20 movimenti di default, con bottone "Carica altri" (mock: mostra tutti)

---

*Creato: 2026-04-10*
