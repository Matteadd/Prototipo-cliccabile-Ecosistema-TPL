# requirements_parcheggi.md — Servizio Parcheggi in Struttura

File di requisiti per l'implementazione della sezione Parcheggi in `proto-app.html`.
Da leggere insieme a `CLAUDE.md` per il contesto architetturale completo.

---

## Scopo

Il servizio Parcheggi in struttura permette al cliente Enilive di accedere a parcheggi convenzionati (partner Movyon) senza barriera: l'antenna Movyon riconosce la targa e **alza la sbarra automaticamente**, addebitando la sosta sulla fattura mensile Enilive. L'app mostra i parcheggi convenzionati vicini, il loro indirizzo con link a Google Maps, e lo storico degli accessi con gli importi addebitati.

---

## Flussi Principali

### 1. Lista parcheggi convenzionati
- Schermata principale: lista di parcheggi con:
  - Nome struttura
  - Indirizzo
  - Orari (es. "24h" o "Lun-Dom 07:00-23:00")
  - Tariffa (es. "€2,00/h — max €15,00/giorno")
  - Badge "Movyon" per indicare la tecnologia di riconoscimento targa
  - Bottone "Mostra su Maps" → apre Google Maps con le coordinate (link esterno)
- La lista è mock (non usa geolocalizzazione reale)
- Filtro opzionale per zona/città (mock, non interattivo)

### 2. Come funziona (informativa)
- Banner o card informativa nella parte alta:
  "Accedi con la tua targa: l'antenna riconosce il tuo veicolo e alza la sbarra. Il costo viene addebitato sulla tua fattura mensile Enilive."
- Link a FAQ (placeholder)

### 3. Storico accessi
- Tab o sezione "I miei accessi": lista accessi passati con:
  - Nome parcheggio
  - Data/ora ingresso e uscita
  - Durata
  - Importo addebitato
  - Targa
- Aggregato mensile: "X accessi questo mese — €Y,YY da addebitare"

---

## Variabili di Stato (Alpine.js)

```javascript
pgList: [...],          // array parcheggi convenzionati
pgMovimenti: [...],     // array accessi/transazioni
pgActiveTab: 'lista'    // 'lista' | 'storico'
```

---

## Dati Mock

```javascript
pgList = [
  {
    id: 'p001',
    nome: 'Parking Centro Milano',
    indirizzo: 'Via Melchiorre Gioia 55, Milano',
    lat: 45.4847,
    lng: 9.1990,
    orari: '24h',
    tariffa: '€2,00/h — max €18,00/giorno',
    posti: 320,
    movyon: true
  },
  {
    id: 'p002',
    nome: 'Parking Garibaldi',
    indirizzo: 'Piazza Freud 1, Milano',
    lat: 45.4830,
    lng: 9.1877,
    orari: 'Lun-Dom 06:00-01:00',
    tariffa: '€2,50/h — max €22,00/giorno',
    posti: 180,
    movyon: true
  },
  {
    id: 'p003',
    nome: 'Parking Fiera Milano',
    indirizzo: 'Viale Scarampo 1, Milano',
    lat: 45.4819,
    lng: 9.1482,
    orari: '24h',
    tariffa: '€1,50/h — max €12,00/giorno',
    posti: 1200,
    movyon: true
  },
  {
    id: 'p004',
    nome: 'Parking Lambrate',
    indirizzo: 'Via Conte Rosso 18, Milano',
    lat: 45.4840,
    lng: 9.2398,
    orari: 'Lun-Sab 07:00-22:00',
    tariffa: '€1,00/h — max €8,00/giorno',
    posti: 95,
    movyon: true
  }
]

pgMovimenti = [
  { id: 'pg001', parcheggio: 'Parking Centro Milano', ingresso: '2026-04-09T09:00:00', uscita: '2026-04-09T11:30:00', durata: '2h 30m', importo: 5.00, targa: 'AB123CD', stato: 'pagato' },
  { id: 'pg002', parcheggio: 'Parking Garibaldi',     ingresso: '2026-04-07T14:15:00', uscita: '2026-04-07T16:00:00', durata: '1h 45m', importo: 4.38, targa: 'AB123CD', stato: 'pagato' },
  { id: 'pg003', parcheggio: 'Parking Centro Milano', ingresso: '2026-04-03T10:30:00', uscita: '2026-04-03T12:30:00', durata: '2h 00m', importo: 4.00, targa: 'AB123CD', stato: 'pagato' }
]
```

---

## Integrazione Bus

| Evento | Pubblicato da | Payload | Trigger |
|---|---|---|---|
| `pagamento:confermato` | app | `{ servizio: 'parcheggi', importo, metodo: 'fattura', data, parcheggio }` | Uscita dal parcheggio simulata (scenario) |

| Evento | Ascoltato da | Effetto |
|---|---|---|
| `scenario:trigger` | app | Se `nome === 'pg:accesso'`, aggiunge riga in `pgMovimenti` con stato "in corso" |
| `scenario:trigger` | app | Se `nome === 'pg:uscita'`, aggiorna riga con durata e importo, pubblica `pagamento:confermato` |
| `cliente:registrato` | app | Se `servizi` include `parcheggi`, rende la sezione accessibile |

---

## Vincoli UI

- Il link "Mostra su Maps" apre `https://www.google.com/maps?q=LAT,LNG` in nuova tab — non usa Leaflet (Leaflet è usato solo per Strisce Blu)
- L'addebito è sempre su fattura mensile: comunicarlo con chiarezza
- Il servizio non richiede attivazione esplicita dall'app: è automaticamente disponibile ai clienti Enilive (nessun toggle on/off)
- Max-width container: 420px (standard app)
- La sezione è accessibile dal menu principale con icona `fa-square-parking`
- Non mostrare la mappa Leaflet: si usa solo la lista testuale + link Maps

---

*Creato: 2026-04-10*
