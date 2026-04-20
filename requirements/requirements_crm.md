# requirements_crm.md — CRM Simulato Enilive

File di requisiti per la costruzione di `crm.html`.
Da leggere insieme a `CLAUDE.md` per il contesto architetturale completo.

---

## Scopo

Il CRM simulato è il pannello back-office della demo. Rappresenta il sistema interno Enilive che l'operatore (customer care, gestore stazione, IT) vedrebbe in produzione. Deve aggiornarsi in tempo reale in risposta alle azioni compiute sull'app cliente e sul tablet operatore, tramite `bus.js`.

È una pagina desktop full-width, layout a 3 colonne, dark o light theme coerente con il design system Enilive (`--color-primary: #117299`).

---

## Layout Generale

```
┌──────────────────────────────────────────────────────────────────┐
│  HEADER: logo Enilive | "CRM Simulato" | badge cliente attivo    │
├─────────────────┬──────────────────────────┬─────────────────────┤
│  COL SINISTRA   │     COL CENTRALE         │   COL DESTRA        │
│  Scheda cliente │  Servizi + Movimenti     │  Log eventi live    │
│  Garage         │  Casi assistenza         │                     │
│  T&C flags      │                          │                     │
└─────────────────┴──────────────────────────┴─────────────────────┘
```

Proporzioni colonne: 25% / 45% / 30%.

---

## Colonna Sinistra — Scheda Cliente

### Anagrafica
Mostra i dati del cliente attualmente "caricato" nel CRM. Popolata inizialmente con dati mock, aggiornabile via bus quando arriva l'evento `cliente:registrato` dal tablet.

Campi da mostrare:
- Nome e cognome
- Codice fiscale
- Email
- Telefono
- Data iscrizione
- Canale acquisizione (app | stazione | web) — badge colorato

### Garage veicoli
Lista dei veicoli associati al cliente. Ogni veicolo mostra:
- Targa
- Tipo (auto / moto / furgone)
- Marca e modello
- Badge servizi attivi su quel veicolo (es. "Memo", "RSA", "Telepedaggio")

Si aggiorna quando arriva l'evento `servizio:attivato` o `cliente:registrato`.

### Flag T&C e consensi
Sezione dedicata con una lista di checkbox (read-only nel CRM, solo visualizzazione):

| Flag | Descrizione |
|---|---|
| `tc_telepedaggio` | T&C contratto Telepedaggio accettati |
| `tc_strisce_blu` | T&C Strisce Blu accettati |
| `tc_rsa` | T&C RSA accettati |
| `tc_areac` | T&C Area C accettati |
| `tc_memo` | T&C Servizio Memo accettati |
| `privacy_marketing` | Consenso marketing |
| `privacy_profilazione` | Consenso profilazione |

Ogni flag mostra: nome, stato (accettato ✓ / non accettato ✗), data e ora accettazione se disponibile.

Si aggiorna via bus quando arriva l'evento `consenso:aggiornato`.

---

## Colonna Centrale — Servizi, Movimenti e Casi

### Sezione Servizi attivi
Griglia di card, una per servizio. Ogni card mostra:
- Nome servizio
- Stato: badge "Attivo" (verde) / "Inattivo" (grigio) / "Sospeso" (arancio)
- Data attivazione
- Per Telepedaggio: codice OBU, saldo credito
- Per RSA: codice tessera, numero interventi nel mese
- Per Area C: flag attivo/inattivo, numero transiti nel mese
- Per Memo: numero scadenze imminenti (entro 30gg)
- Per Parcheggi: numero accessi nel mese

Si aggiorna via bus sugli eventi `servizio:attivato` e `servizio:disattivato`.

### Sezione Movimenti
Tabella con tutti i movimenti del cliente, sincronizzata bidirezionalmente con la sezione Movimenti dell'app cliente.

Colonne tabella:
- Data e ora
- Servizio (badge colorato per tipo)
- Descrizione (es. "Sosta Zona A — 1h 30m", "Transito A8 Milano Nord", "Bollo auto XX123YY")
- Targa
- Importo (€)
- Stato: pagato / in corso / errore — badge

**Comportamento bidirezionale con l'app:**
- Quando l'app pubblica `pagamento:confermato` o `sosta:terminata`, il movimento appare nel CRM in tempo reale.
- Quando dal CRM viene aggiunto o modificato un movimento (es. storno, rettifica — bottone apposito), viene pubblicato l'evento `crm:movimento_aggiornato` che aggiorna la lista movimenti nell'app.

Filtri disponibili: per servizio (dropdown), per stato, per data (range datepicker mock).

### Sezione Casi di assistenza
Tabella dei casi aperti e chiusi per il cliente. Un "caso" rappresenta qualsiasi interazione di assistenza: chiamata RSA, contatto con il gestore stazione, segnalazione problema.

Colonne tabella:
- ID caso (es. #0042)
- Data apertura
- Tipo: RSA / Gestore stazione / App / Customer care — badge
- Descrizione breve
- Stato: aperto / in lavorazione / chiuso — badge colorato
- Data chiusura (se chiuso)

**Generazione automatica di casi via bus:**
- `rsa:chiamata` → crea automaticamente un caso di tipo "RSA" con stato "in lavorazione"
- `gestore:interazione` (pubblicato dal tablet) → crea caso di tipo "Gestore stazione"
- Qualsiasi errore pagamento (`pagamento:errore`) → crea caso di tipo "App" con stato "aperto"

**Gestione manuale nel CRM:**
- Bottone "+ Nuovo caso" → form inline: tipo, descrizione, targa collegata
- Bottone "Chiudi caso" su ogni riga aperta
- Quando un caso viene chiuso, viene pubblicato `crm:caso_chiuso` sul bus (l'app può mostrare una notifica)

---

## Colonna Destra — Log eventi live

Feed cronologico in tempo reale di tutti gli eventi che transitano sul bus. È il componente più importante per le demo tecniche con IT e consulenti: mostra visivamente che il sistema è connesso.

### Struttura di ogni voce nel log

```
[HH:MM:SS]  •  nome:evento
             payload sintetico (max 2 righe)
```

Ogni tipo di evento ha un colore/icona diverso:
- `cliente:*` → teal (acquisizione)
- `servizio:*` → blu (contratti)
- `pagamento:*` → verde se confermato, rosso se errore
- `sosta:*` → viola (Strisce Blu)
- `rsa:*` → arancio (assistenza)
- `crm:*` → grigio (azioni interne)
- `consenso:*` → giallo (T&C)

### Comportamenti
- Nuovi eventi appaiono in cima (più recente in alto)
- Animazione fade-in su ogni nuovo evento
- Max 50 voci visibili, poi scroll
- Bottone "Pulisci log" in testa alla colonna
- Bottone "Pausa" per bloccare il feed senza perdere eventi (li accoda e mostra al resume)
- Ogni voce è espandibile (click) per vedere il payload JSON completo

---

## Dati Mock Iniziali

Al caricamento della pagina, il CRM mostra un cliente precaricato con:

```javascript
cliente = {
  nome: "Marco Bianchi",
  cf: "BNCMRC85M10F205Z",
  email: "marco.bianchi@email.it",
  telefono: "+39 339 1234567",
  dataIscrizione: "2024-11-15",
  canale: "stazione"
}

veicoli = [
  { targa: "AB123CD", tipo: "auto", marca: "Volkswagen", modello: "Golf", servizi: ["telepedaggio", "memo", "rsa"] },
  { targa: "EF456GH", tipo: "auto", marca: "Fiat", modello: "500", servizi: ["memo"] }
]

serviziAttivi = ["telepedaggio", "rsa", "memo"]

tcFlags = {
  tc_telepedaggio: { accettato: true, data: "2024-11-15T10:32:00" },
  tc_strisce_blu:  { accettato: true, data: "2025-01-08T14:21:00" },
  tc_rsa:          { accettato: true, data: "2024-11-15T10:33:00" },
  tc_areac:        { accettato: false, data: null },
  tc_memo:         { accettato: true, data: "2024-11-15T10:33:00" },
  privacy_marketing:    { accettato: false, data: null },
  privacy_profilazione: { accettato: true, data: "2024-11-15T10:32:00" }
}

movimenti = [
  { id: "m001", data: "2026-04-09T09:15:00", servizio: "strisce_blu", descrizione: "Sosta Zona A — 1h 30m", targa: "AB123CD", importo: 2.25, stato: "pagato" },
  { id: "m002", data: "2026-04-08T17:40:00", servizio: "telepedaggio", descrizione: "Transito A8 Milano Nord", targa: "AB123CD", importo: 1.80, stato: "pagato" },
  { id: "m003", data: "2026-04-07T11:00:00", servizio: "rsa", descrizione: "Canone mensile RSA", targa: "AB123CD", importo: 2.00, stato: "pagato" }
]

casiAssistenza = [
  { id: "c001", dataApertura: "2026-04-05T08:00:00", tipo: "rsa", descrizione: "Intervento foratura A8 km 14", stato: "chiuso", dataChiusura: "2026-04-05T09:45:00", targa: "AB123CD" },
  { id: "c002", dataApertura: "2026-04-09T10:30:00", tipo: "app", descrizione: "Errore pagamento Strisce Blu", stato: "aperto", dataChiusura: null, targa: "AB123CD" }
]
```

---

## Integrazione Bus — Riepilogo eventi ascoltati

| Evento | Effetto nel CRM |
|---|---|
| `cliente:registrato` | Aggiorna anagrafica, garage, T&C flags |
| `servizio:attivato` | Aggiorna card servizio → badge "Attivo" |
| `servizio:disattivato` | Aggiorna card servizio → badge "Inattivo" |
| `pagamento:confermato` | Aggiunge riga in Movimenti |
| `pagamento:errore` | Aggiunge riga Movimenti (stato: errore) + apre caso assistenza |
| `sosta:avviata` | Aggiunge riga Movimenti (stato: in corso) |
| `sosta:terminata` | Aggiorna riga Movimenti (stato: pagato, importo finale) |
| `rsa:chiamata` | Apre caso assistenza tipo "RSA" |
| `memo:scadenza` | Aggiunge notifica su card Memo |
| `consenso:aggiornato` | Aggiorna T&C flags |
| `gestore:interazione` | Apre caso assistenza tipo "Gestore stazione" |

## Integrazione Bus — Eventi pubblicati dal CRM

| Evento | Trigger | Effetto sull'app |
|---|---|---|
| `crm:movimento_aggiornato` | Modifica/storno movimento | Aggiorna lista movimenti in app |
| `crm:caso_chiuso` | Chiusura manuale caso | Notifica in app (se implementata) |
| `crm:servizio_sospeso` | Sospensione manuale servizio | Aggiorna stato servizio in app |

---

## Vincoli tecnici

- Stack: Alpine.js 3.x + Tailwind CSS CDN — coerente con `proto-app.html`
- No backend, no fetch reali — tutti i dati sono mock JavaScript
- Comunicazione esclusivamente tramite `bus.js` (BroadcastChannel + localStorage)
- Layout responsive fino a 1280px, non ottimizzare per mobile
- Colori: usare le CSS custom properties del design system Enilive definite in `proto-app.css`; se `crm.html` è standalone, ridichiarare le variabili nel `<style>` della pagina

---

*Creato: 2026-04-10 — da usare come input per Claude Code*
