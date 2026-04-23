# CLAUDE.md — PrototipoApp Enilive
Riferimento architetturale. Scritto in italiano.

## Panoramica
Demo interattiva multi-pannello per Telepedaggio + servizi ancillari Enilive.
Simula nel browser l'ecosistema digitale: app cliente, tablet operatore stazione, CRM back-office, flowchart backend.
- **Scopo:** Demo/MVP per stakeholder interni (IT, UX, consulenza, management)
- **No backend:** logica tutta client-side. Zero build process, zero package manager.
- Pannelli comunicano in tempo reale via event bus condiviso (`bus.js`)

## Regole caricate per contesto
@.claude/rules/architecture.md
@.claude/rules/data-model.md
@.claude/rules/state-management.md
@.claude/rules/conventions.md

<!-- Le regole path-scoped seguenti vengono caricate solo quando si lavora sui file corrispondenti -->
@.claude/rules/proto-app.md
@.claude/rules/tablet.md

## Contesto di Business — Servizi
| Servizio | Descrizione | Ruolo app |
| --- | --- | --- |
| Telepedaggio | Contratto OBU + caselli autostradali | Selfcare, movimenti, sospensione/riattivazione |
| Parcheggi in struttura | Antenna Movyon alza sbarra | Selfcare, lista parcheggi → Google Maps, rendiconto |
| Area C Milano | Costo ZTL su fattura mensile | Attivazione/disattivazione, rendiconto |
| RSA | Assistenza stradale €2/mese illimitata | Chiamata soccorso (iframe), tessera con codice univoco |
| Servizio Memo | Scadenze veicolo nel Garage | Bollo (con pagamento), revisione, RCA — tutti con reminder |
| Movimenti | Sezione trasversale | Filtrabili per servizio, data, importo |

Onboarding/sottoscrizione: in-app o canale fisico tramite tablet Enilive Station.

## Ultimo aggiornamento
2026-04-22 (schema ClienteRecord v3: serviziRsa[] → contratti[].serviziRsa[], areac/parcheggi → dispositivi[].serviziAbilitati, CRM con card Contratti + ricerca targa)

## OTP mock
`OTP_CONSENSI` → `1234` | `FIRMA_CONTRATTO` → `5678`
