# Requirements: Tablet — Selezione Servizi Post-Valutazione Creditizia

> Generato da: conversazione con Matteo — Aprile 2026
> Da implementare in: `tablet.html`

---

## 1. Panoramica

Dopo l'esito positivo della valutazione creditizia nel flusso di onboarding tablet, viene inserita una nuova schermata con due tab che consentono all'operatore di scegliere quale servizio sottoscrivere per il cliente: **Telepedaggio (OBU)** oppure **RSA Standalone**. I due tab sono mutuamente esclusivi (XOR): si sceglie uno e si procede col relativo flusso. Il flusso successivo (riepilogo → IBAN → firma → SMS OTP → attivazione) rimane invariato per entrambi.

---

## 2. Posizionamento nel flusso tablet esistente

Inserire questo step **subito dopo** lo step di valutazione creditizia con esito positivo, **prima** dello step di configurazione OBU attuale.

```
[Anagrafica] → [Veicoli] → [Valutazione Creditizia ✓] → ★[SELEZIONE SERVIZIO]★ → [Configurazione] → [Riepilogo] → [IBAN] → [Firma] → [OTP] → [Attivazione]
```

---

## 3. ⚠️ Analisi impatti sul codice esistente — LEGGERE PRIMA DI MODIFICARE

Prima di toccare qualsiasi cosa, analizzare attentamente:

### 3.1 Step numerazione
Il flusso tablet è governato da un indice step (es. `tabletStep` o variabile equivalente). L'inserimento del nuovo step **sposta di +1 tutti gli indici successivi**. Verificare ogni `tabletStep === N` hardcoded e aggiornare di conseguenza.

### 3.2 Flusso OBU esistente
L'attuale step di configurazione OBU (selezione targa, add-on RSA/furto) **non va toccato**: diventa il sotto-flusso del tab "Telepedaggio". Verificare che la navigazione da "tab Telepedaggio → Continua" atterri esattamente sullo step OBU esistente.

### 3.3 Logica di creazione contratto
La funzione che costruisce il `ClienteRecord.contratti[]` al termine del flusso deve essere condizionata al tab selezionato:
- Tab OBU → `tipo: "obu"` (comportamento attuale invariato)
- Tab RSA Standalone → `tipo: "rsa_standalone"`, popola `rsaStandalone: [{ targa }, ...]`

### 3.4 Bus events
Al termine del flusso RSA standalone emettere:
- `servizio:attivato` con `{ servizio: 'rsa', targhe: [...] }`
- `cliente:registrato` con `servizi: ['rsa']`

Verificare che il CRM e l'app reagiscano correttamente a questi eventi anche senza `obu` nel payload.

### 3.5 Schema `rsaStandalone`
Il CLAUDE.md definisce `rsaStandalone: [{ targa }]` dentro `contratti[]`. **Nessun limite sul numero di targhe** (a differenza degli OBU). Verificare che l'attuale schema non abbia vincoli hardcoded a 2.

---

## 4. Stato Alpine da aggiungere in `tablet.html`

```javascript
// Selezione servizio post-valutazione creditizia
tabletServizioSelezionato: null,   // 'obu' | 'rsa_standalone'

// RSA Standalone — configurazione targhe
rsaStandaloneTarghe: [''],         // array di stringhe targa (min 1, no limite)
```

---

## 5. Struttura della nuova schermata

### Layout generale
Schermata a piena altezza, stile coerente con gli altri step tablet (header step, contenuto centrale, bottone "Continua" in basso).

### Header
```
Step X di Y — Selezione Servizio
```

### Tab switcher (2 tab, mutuamente esclusivi)
```
[ Telepedaggio (OBU) ]   [ RSA ]
```
- Tab selezionato: bordo/sfondo `--color-primary`
- Tab non selezionato: stile outline

### Contenuto Tab "Telepedaggio (OBU)"
- Icona: `fa-car` o icona OBU
- Titolo: "Telepedaggio con OBU"
- Descrizione breve: "Accesso automatico ai caselli. Puoi aggiungere RSA e Furto & Smarrimento per ogni veicolo."
- Add-on disponibili (solo informativo, la configurazione per-OBU avviene nello step successivo):
  - ✅ RSA incluso (opzionale per OBU)
  - ✅ Furto & Smarrimento dispositivo (opzionale per OBU)
- CTA: "Configura OBU →" → porta allo step OBU esistente

### Contenuto Tab "RSA"
- Icona: `fa-shield-alt` o `fa-road`
- Titolo: "RSA — Assistenza Stradale"
- Descrizione breve: "€2/mese per veicolo. Assistenza stradale illimitata."
- **Input targhe**: lista dinamica di campi input targa
  - Alla prima apertura: 1 campo vuoto
  - Bottone "+ Aggiungi veicolo" per aggiungere ulteriori campi (nessun limite)
  - Ogni campo ha una X per rimuoverlo (min 1 campo sempre visibile)
  - Validazione: formato targa italiano (es. `AB123CD`), non vuoto
- CTA: "Continua →" → porta allo step riepilogo (stesso dell'OBU ma con dati RSA)

---

## 6. Funzioni Alpine da implementare

### `selezionaServizio(tipo)`
- Imposta `tabletServizioSelezionato = tipo`
- Se `tipo === 'rsa_standalone'` e `rsaStandaloneTarghe` è vuoto: inizializza con `['']`

### `rsaAggiungiTarga()`
- Push `''` in `rsaStandaloneTarghe`

### `rsaRimuoviTarga(index)`
- Rimuove elemento all'indice dato
- Vincolo: non rimuovere se `rsaStandaloneTarghe.length === 1`

### `validaTargheRsa()`
- Ritorna `true` se tutte le targhe sono non-vuote e formato valido
- Usare regex semplice: `/^[A-Z]{2}\d{3}[A-Z]{2}$/i`
- Mostrare feedback inline se invalide (classe errore sul campo)

### `proseguiDaSelezioneServizio()`
- Se `tabletServizioSelezionato === 'obu'` → naviga allo step OBU esistente (invariato)
- Se `tabletServizioSelezionato === 'rsa_standalone'` → valida targhe → naviga allo step Riepilogo RSA
- Se `tabletServizioSelezionato === null` → mostra errore "Seleziona un servizio per continuare"

---

## 7. Step Riepilogo RSA Standalone

Stesso layout del riepilogo OBU ma con dati RSA:

| Campo | Valore |
|---|---|
| Servizio | RSA — Assistenza Stradale |
| Veicoli abilitati | `rsaStandaloneTarghe` (lista targhe) |
| Costo | €2,00/mese per veicolo |
| Totale mensile | €2,00 × N targhe |
| Decorrenza | Immediata |

Poi prosegue con: IBAN → Firma → OTP → Attivazione (flusso esistente adattato).

---

## 8. Attivazione RSA Standalone (fine flusso)

Al completamento OTP, eseguire:

```javascript
// 1. Aggiorna clientiDemo
const record = clientiDemo[cfCliente];
record.contratti.push({
  id: `c${Date.now()}_${cfCliente.slice(0,8)}`,
  tipo: 'rsa_standalone',
  stato: 'attivo',
  dataCreazione: new Date().toISOString(),
  iban: tabletIban,
  totale: rsaStandaloneTarghe.length * 2.00,
  obu: [],
  rsaStandalone: rsaStandaloneTarghe.map(t => ({ targa: t.toUpperCase() }))
});
record.serviziAttivi.rsa = {
  attivo: true,
  dataAttivazione: new Date().toISOString(),
  targhe: rsaStandaloneTarghe.map(t => t.toUpperCase())
};

// 2. Emetti eventi bus
Bus.emit('servizio:attivato', { servizio: 'rsa', targhe: rsaStandaloneTarghe, data: new Date().toISOString() });
Bus.emit('cliente:registrato', { nome: `${tabletNome} ${tabletCognome}`, cf: tabletCf, servizi: ['rsa'] });
```

---

## 9. Cosa NON implementare nel prototipo

- Verifica backend univocità targa già associata a RSA → simulare come sempre valida
- Chiamata API pricing RSA → hardcodare €2,00/mese/veicolo
- Invio SMS/email conferma → simulare con toast "Contratto RSA attivato"
- Verifica IBAN reale → accettare qualsiasi stringa non vuota

---

## 10. Vincoli implementativi

- Non superare `max-width: 900px` (tablet landscape)
- Non modificare il flusso OBU esistente — solo aggiungere il nuovo step prima
- Usare solo CSS custom properties, mai hex hardcoded
- Non introdurre nuovi CDN
- Aggiornare `clientiDemo` (source of truth) prima di emettere Bus events
- Il bottone "Continua" del nuovo step deve essere disabilitato finché `tabletServizioSelezionato !== null`

---

## Come usare questo file con Claude Code

1. Apri Claude Code sul progetto PrototipoApp
2. Avvia una nuova sessione
3. Incolla il prompt qui sotto
