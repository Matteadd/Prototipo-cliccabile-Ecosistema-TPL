# requirements_areac.md — Servizio Area C Milano

File di requisiti per l'implementazione della sezione Area C in `proto-app.html`.
Da leggere insieme a `CLAUDE.md` per il contesto architetturale completo.

---

## Scopo

Area C è il sistema di congestion charge del Comune di Milano per accedere alla ZTL centrale. Il cliente attiva il servizio dall'app: quando il suo veicolo transita nell'Area C, il costo del transito viene rilevato automaticamente (tramite targa, senza OBU aggiuntivo) e addebitato sulla **fattura mensile Enilive**. L'utente può attivare/disattivare il servizio in qualsiasi momento.

---

## Flussi Principali

### 1. Attivazione servizio
- Se `acAttiva = false`: mostra schermata di attivazione con:
  - Spiegazione del servizio (cos'è Area C, come funziona l'addebito)
  - Lista veicoli del garage con checkbox per selezionare quale abilitare
  - CTA "Attiva per [targa selezionata]"
  - Al conferma: `acAttiva = true`, pubblica `servizio:attivato`

### 2. Disattivazione servizio
- Bottone "Disattiva" nella card del servizio attivo
- Modal di conferma: "Disattivando il servizio, i transiti in Area C non verranno più addebitati su Enilive. Dovrai pagare il transito tramite gli altri canali del Comune."
- Al conferma: `acAttiva = false`, pubblica `servizio:disattivato`

### 3. Visualizzazione transiti
- Lista cronologica dei transiti con: data/ora, importo addebitato, stato (pagato / da addebitare in fattura)
- Nota informativa: "Gli importi vengono addebitati sulla tua fattura mensile Enilive"
- Importo variabile: Area C Milano costa €7,50 per i veicoli standard, €5,00 per veicoli elettrici/ibridi

### 4. Riepilogo mensile
- Card con totale transiti del mese corrente e importo complessivo previsto in fattura
- Badge: "X transiti questo mese — €Y,YY da addebitare"

---

## Stati Possibili

| Stato | Condizione | Badge |
|---|---|---|
| Attivo | `acAttiva` | verde |
| Non attivato | `!acAttiva` | grigio |

---

## Variabili di Stato (Alpine.js)

```javascript
acAttiva: false,          // servizio attivo
acTargaAbilitata: null,   // targa abilitata al servizio
acMovimenti: [...],       // array transiti addebitati
acTransitiMese: 0,        // contatore transiti mese corrente
acImportoMese: 0.00       // importo totale mese corrente
```

---

## Dati Mock

```javascript
// Attivato a demo già attivo (per mostrare la sezione con dati)
acAttiva: true,
acTargaAbilitata: 'AB123CD',

acMovimenti = [
  { id: 'ac001', data: '2026-04-08T08:15:00', targa: 'AB123CD', importo: 7.50, stato: 'da_addebitare', note: 'Ingresso ore 08:15' },
  { id: 'ac002', data: '2026-04-07T09:02:00', targa: 'AB123CD', importo: 7.50, stato: 'da_addebitare', note: 'Ingresso ore 09:02' },
  { id: 'ac003', data: '2026-03-31T07:55:00', targa: 'AB123CD', importo: 7.50, stato: 'pagato',       note: 'Ingresso ore 07:55 — fattura marzo' }
]
```

---

## Integrazione Bus

| Evento | Pubblicato da | Payload | Trigger |
|---|---|---|---|
| `servizio:attivato` | app | `{ servizio: 'areac', targa, data }` | Utente attiva |
| `servizio:disattivato` | app | `{ servizio: 'areac', targa, data }` | Utente disattiva |
| `pagamento:confermato` | app | `{ servizio: 'areac', importo: 7.50, metodo: 'fattura', data }` | Transito simulato (scenario) |

| Evento | Ascoltato da | Effetto |
|---|---|---|
| `scenario:trigger` | app | Se `nome === 'ac:transito'`, aggiunge movimento mock, incrementa `acTransitiMese` |
| `cliente:registrato` | app | Se `servizi` include `areac`, imposta `acAttiva = true` |

---

## Vincoli UI

- L'addebito è sempre su fattura mensile, mai su carta di credito in tempo reale: comunicarlo chiaramente all'utente
- Il servizio è abilitato per targa, non per account: se il cliente ha più veicoli, ogni targa deve essere abilitata separatamente
- Non simulare la comunicazione con il sistema MIT (Comune di Milano): i transiti sono sempre mock
- Max-width container: 420px (standard app)
- La sezione è accessibile dal menu principale con icona `fa-city`

---

*Creato: 2026-04-10*
