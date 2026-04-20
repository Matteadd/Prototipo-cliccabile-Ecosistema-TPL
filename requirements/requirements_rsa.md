# requirements_rsa.md — Servizio RSA (Assistenza Stradale)

File di requisiti per l'implementazione della sezione RSA in `proto-app.html`.
Da leggere insieme a `CLAUDE.md` per il contesto architetturale completo.

---

## Scopo

L'RSA (Roadside Assistance) è un servizio di assistenza stradale a canone mensile fisso di **€2,00/mese**, illimitato. Il cliente, in caso di panne o necessità, può chiamare il soccorso direttamente dall'app. L'interfaccia di chiamata è erogata da un partner esterno tramite iframe. Il cliente ha anche una **tessera digitale** con codice univoco da esibire all'operatore sul campo.

---

## Flussi Principali

### 1. Visualizzazione tessera digitale
- Card con codice tessera univoco (es. `RSA-2024-98765`)
- Istruzione: "In caso di intervento, comunica questo codice all'operatore"
- Bottone "Copia codice" (clipboard)
- Badge stato: Attivo / Sospeso

### 2. Chiamata soccorso
- Bottone CTA primario "Chiama Soccorso" — grande, ben visibile, accessibile
- Al click: apre modal con iframe del partner RSA
  - URL iframe: configurabile tramite variabile `rsaIframeUrl` (placeholder: `about:blank` con messaggio mock)
  - Il modal occupa tutto lo schermo (full-screen overlay)
  - Bottone "Chiudi" nell'angolo in alto a destra
- Al click su "Chiama Soccorso": pubblica `rsa:chiamata` sul bus con posizione mock
- `rsaCallActive = true` durante la chiamata, torna `false` alla chiusura modal

### 3. Storico interventi
- Lista degli interventi passati con: data, tipo (foratura / batteria / altro), stato (chiuso / in corso)
- Mock con 1-2 interventi storici

### 4. Informazioni canone
- Sezione informativa: "€2,00/mese — Illimitato — Attivo su [targa]"
- Link a T&C (placeholder href)

---

## Stati Possibili

| Stato | Condizione | Badge |
|---|---|---|
| Attivo | `rsaAttiva` | verde |
| Non attivato | `!rsaAttiva` | grigio |
| Chiamata in corso | `rsaCallActive` | rosso pulsante |

---

## Variabili di Stato (Alpine.js)

```javascript
rsaAttiva: true,                 // contratto attivo
rsaCodiceTessera: 'RSA-2024-98765', // codice univoco
rsaCallActive: false,            // chiamata in corso
rsaIframeUrl: 'about:blank',     // URL partner (configurabile)
showRsaModal: false,             // visibilità modal chiamata
rsaInterventi: [...]             // storico interventi
```

---

## Dati Mock

```javascript
rsaInterventi = [
  {
    id: 'rsa001',
    data: '2026-04-05T08:00:00',
    tipo: 'foratura',
    descrizione: 'Foratura pneumatico anteriore sinistro — A8 km 14',
    stato: 'chiuso',
    dataChiusura: '2026-04-05T09:45:00',
    targa: 'AB123CD'
  }
]
```

---

## Integrazione Bus

| Evento | Pubblicato da | Payload | Trigger |
|---|---|---|---|
| `rsa:chiamata` | app | `{ targa, posizione: 'mock', tipo: 'generico' }` | Utente apre modal chiamata |
| `pagamento:confermato` | app | `{ servizio: 'rsa', importo: 2.00, metodo: 'fattura', data }` | Canone mensile simulato (scenario) |

| Evento | Ascoltato da | Effetto |
|---|---|---|
| `cliente:registrato` | app | Se `servizi` include `rsa`, imposta `rsaAttiva = true` e assegna `rsaCodiceTessera` |
| `servizio:attivato` | app | Se `servizio === 'rsa'`, imposta `rsaAttiva = true` |
| `crm:caso_chiuso` | app | Se il caso era RSA, aggiorna stato intervento nello storico |

---

## Vincoli UI

- Il bottone "Chiama Soccorso" deve essere **sempre visibile e in primo piano** nella sezione RSA — non nasconderlo dietro tab o scroll
- Il modal iframe è full-screen per simulare l'esperienza reale di una chiamata
- L'URL dell'iframe è un placeholder: `about:blank` con testo mock "Chiamata al centro assistenza in corso..."
- Il codice tessera non è modificabile dall'utente
- Max-width container: 420px (standard app)
- La sezione è accessibile dal menu principale con icona `fa-truck-medical`

---

*Creato: 2026-04-10*
