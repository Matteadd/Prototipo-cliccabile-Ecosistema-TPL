# requirements_telepedaggio.md — Servizio Telepedaggio

File di requisiti per l'implementazione della sezione Telepedaggio in `proto-app.html`.
Da leggere insieme a `CLAUDE.md` per il contesto architetturale completo.

---

## Scopo

Il Telepedaggio è il **prodotto principale** dell'offerta Enilive. Il cliente sottoscrive un contratto che include un dispositivo OBU (On-Board Unit) da montare in auto: quando transita ai caselli autostradali, il pedaggio viene addebitato automaticamente sul conto Enilive. L'app permette il selfcare: visualizzare il dispositivo attivo, consultare il saldo, vedere i transiti e sospendere/riattivare il contratto.

---

## Flussi Principali

### 1. Visualizzazione stato contratto
- L'utente accede alla sezione Telepedaggio dall'home o dal menu
- Se il servizio è attivo (`tpActive = true`): mostra card con OBU, saldo, stato
- Se non attivo: mostra CTA "Attiva Telepedaggio" (mock, nessun flusso di attivazione in-app — avviene via tablet)

### 2. Visualizzazione movimenti caselli
- Lista cronologica dei transiti con: data/ora, nome casello, autostrada, importo addebitato
- Filtrabili per data (range)
- Ogni riga è cliccabile per il dettaglio (modal o espansione inline)

### 3. Sospensione contratto
- Bottone "Sospendi" visibile solo se `tpActive && !tpSospeso`
- Modal di conferma: "Sospendendo il contratto, l'OBU verrà disabilitato. Potrai riattivarlo in qualsiasi momento."
- Al conferma: `tpSospeso = true`, pubblica `servizio:disattivato` sul bus
- Stato visivo cambia in badge "Sospeso" arancione

### 4. Riattivazione contratto
- Bottone "Riattiva" visibile solo se `tpSospeso`
- Nessun modal, riattivazione immediata
- `tpSospeso = false`, pubblica `servizio:attivato` sul bus

---

## Stati Possibili

| Stato | Condizione | Badge |
|---|---|---|
| Attivo | `tpActive && !tpSospeso` | verde |
| Sospeso | `tpActive && tpSospeso` | arancione |
| Non attivato | `!tpActive` | grigio |

---

## Variabili di Stato (Alpine.js)

```javascript
tpActive: true,          // contratto attivo
tpObu: 'OBU-IT-00123456', // codice dispositivo OBU
tpSaldo: 45.30,          // credito residuo in €
tpSospeso: false,        // flag sospensione
tpMovimenti: [...]       // array transiti caselli
```

---

## Dati Mock

```javascript
tpMovimenti = [
  { id: 'tp001', data: '2026-04-09T08:22:00', casello: 'Milano Nord',    autostrada: 'A8',  importo: 1.80, targa: 'AB123CD' },
  { id: 'tp002', data: '2026-04-08T19:05:00', casello: 'Rho',            autostrada: 'A8',  importo: 1.20, targa: 'AB123CD' },
  { id: 'tp003', data: '2026-04-06T07:45:00', casello: 'Lainate',        autostrada: 'A8',  importo: 0.90, targa: 'AB123CD' },
  { id: 'tp004', data: '2026-04-03T16:30:00', casello: 'Como Sud',       autostrada: 'A9',  importo: 2.40, targa: 'AB123CD' },
  { id: 'tp005', data: '2026-03-28T09:10:00', casello: 'Milano Est',     autostrada: 'A51', importo: 1.10, targa: 'AB123CD' }
]
```

---

## Integrazione Bus

| Evento | Pubblicato da | Payload | Trigger |
|---|---|---|---|
| `servizio:disattivato` | app | `{ servizio: 'telepedaggio', targa, data }` | Utente sospende |
| `servizio:attivato` | app | `{ servizio: 'telepedaggio', targa, data }` | Utente riattiva |
| `pagamento:confermato` | app | `{ servizio: 'telepedaggio', importo, metodo: 'conto_enilive', data }` | Transito simulato (scenario) |

| Evento | Ascoltato da | Effetto |
|---|---|---|
| `scenario:trigger` | app | Se `nome === 'tp:transito'`, aggiunge movimento mock e scala saldo |
| `cliente:registrato` | app | Se `servizi` include `telepedaggio`, imposta `tpActive = true` |

---

## Vincoli UI

- Il codice OBU è read-only, non modificabile dall'utente
- Il saldo non si ricarica dall'app (operazione bancaria esterna): mostrare link/tooltip "Come ricaricare"
- Max-width container: 420px (standard app)
- Non implementare il flusso di attivazione in-app: il contratto è già attivo alla demo (onboarding via tablet)
- La sezione è accessibile dal menu principale con icona `fa-road`

---

*Creato: 2026-04-10*
