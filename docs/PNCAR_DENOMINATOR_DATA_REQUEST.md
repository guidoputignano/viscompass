# Richiesta dati · denominatore PNCAR per Azienda

**Stato:** da inviare alle Aziende del perimetro (201, 202, 203, 204)
**Preparata:** 24 settembre 2026
**Perché:** oggi non è possibile calcolare l’indicatore PNCAR per Azienda. Non è
un limite del software: mancano due elementi di dato, elencati sotto.

---

## Il problema, in una frase

L’indicatore PNCAR è definito su un denominatore che non possediamo e che non è
ricostruibile da fonti pubbliche al livello richiesto; il denominatore che
possediamo è un’altra grandezza, e la differenza è abbastanza grande da
determinare da sola l’esito del confronto con l’obiettivo.

## Cosa dice esattamente il PNCAR

Indicatore 2.3, PNCAR 2022–2025, testo letterale:

> «Riduzione >5% del consumo (DDD/100 giornate di degenza) di antibiotici
> sistemici in ambito ospedaliero nel 2025 rispetto al 2022.»

Due conseguenze che guidano tutta la richiesta:

1. **L’obiettivo è relativo**, non un livello assoluto. Una riduzione
   percentuale non dipende da un denominatore scalato in modo coerente fra gli
   anni: è la forma che sopravvive all’incertezza sul denominatore.
2. **Il piano non definisce il denominatore.** Non indica perimetro assistenziale
   (acuti, riabilitazione, lungodegenza), non indica regime, non indica se
   includere le strutture private accreditate. L’unica definizione operativa
   esistente è quella adottata da AIFA/OSMED.

## Cosa usa OSMED

Giornate SDO in **regime ordinario nei soli ospedali pubblici**, **più** day
hospital e day surgery. **Nessuna restrizione agli acuti.**

OSMED pubblica questo indicatore **solo a livello regionale** (21 regioni e
province autonome, tre macroaree, Italia). **Non esiste un valore OSMED per
Azienda.**

Il numeratore OSMED è inoltre una grandezza diversa dalla nostra: antibiotici
*acquistati dalle strutture pubbliche al netto della distribuzione diretta*,
mentre il workbook riporta l’erogato di farmacia ospedaliera.

## Perché non possiamo ricostruirlo da fonti pubbliche

| Asse | OSMED | Serie SDO disponibile |
|---|---|---|
| Proprietà | solo ospedali pubblici | tutti gli istituti, incluse le private accreditate |
| Regime | ordinario + DH/DS | ordinario + accessi diurni |
| Perimetro | tutti i regimi assistenziali | **solo acuti** |
| Grana | regionale | regionale |

Lo scarto è su **due assi contemporaneamente**. E non è correggibile:

- Le giornate non sono mai pubblicate per regione × tipo istituto, quindi il
  sottoinsieme pubblico non è estraibile.
- Le quote di dimissioni non sostituiscono le quote di giornate: nel 2024, in
  regime ordinario per acuti, gli istituti pubblici pesano il **74,4%** delle
  dimissioni ma l’**81,3%** delle giornate.

## Quanto pesa la scelta del denominatore

Calibrazione dell’attività pubblica contro il valore fornito dall’Azienda,
regione 130, 2024 (`data/derived/pillar_a/a2_public_proxy_calibration_summary.json`):

| Composizione | Valore | Scarto |
|---|---:|---:|
| Fornito dall’Azienda (A3/T1) | 963.045 | — |
| SDO acuti: giornate ordinarie + accessi DH | 1.022.331 | +6,2% |
| SDO acuti: sole giornate ordinarie | 910.332 | −5,5% |

A numeratore invariato, queste due composizioni spostano la stessa Azienda fra
**78,09** e **87,70** DDD/100 — un intervallo di 9,6 punti. Il riferimento
**78,76** cade dentro l’intervallo. **La scelta del denominatore determina da
sola se l’Azienda risulti in linea con l’obiettivo.**

Si segnala inoltre che 78,76 non compare in alcuna fonte: è calcolato come tasso
OSMED 2022 del territorio × 0,95.

---

## Cosa chiediamo

### 1. L’anno 2022 del workbook

Stessa struttura degli anni 2023–2025 già forniti: per Azienda, per categoria
AWaRe, con CF, CMR, DDD e attività.

**Perché:** è l’anno base dell’indicatore PNCAR. Senza il 2022 la riduzione
richiesta dal piano non è calcolabile, e la variazione relativa — l’unica forma
che sopravvive all’incertezza sul denominatore — non può essere confrontata con
l’obiettivo.

### 2. I quattro campi del selettore A2

Il selettore usato dalla Regione è noto alla lettera:

> `DEGENZA + ACCESSI - ESCLUDI ONERE "4" E DRG 391`

Servono, per Azienda e per anno, i campi che lo compongono:

- **DEGENZA** — giornate di degenza
- **ACCESSI** — accessi in regime diurno
- **ONERE** — per escludere l’onere «4»
- **DRG** — per escludere il DRG 391

**Perché:** con questi campi A2 si calcola in modo esatto per Azienda, senza
proxy e senza fattori di correzione. Oggi disponiamo di una stima pubblica
calibrata su **una sola regione, un solo anno e zero osservazioni per Azienda**;
il file di calibrazione riporta infatti `generalizationPolicy: "not_yet_approved"`
e marca ogni composizione come `blocked`. Un fattore stimato su un caso non può
essere applicato a quattro Aziende.

### 3. Le giornate sulla definizione OSMED, se l’Azienda può estrarle

Per Azienda e per anno, dalle proprie SDO:

- giornate in **regime ordinario**, **solo struttura pubblica**
- **più** accessi di day hospital e day surgery
- **tutti i regimi assistenziali**, non i soli acuti

**Perché:** questa è la sola strada verso un indicatore PNCAR autentico per
Azienda. OSMED non pubblica il dato per Azienda, ma ogni Azienda possiede le
proprie SDO e può calcolare il proprio denominatore sulla definizione OSMED.
Senza questo, un confronto per Azienda con l’obiettivo del piano resta non
verificabile.

Se il punto 3 non è producibile, indicarlo: è un esito accettabile e verrà
riportato come tale. Continueremo a mostrare l’intensità sul denominatore A3/T1,
dichiarata per quello che è e senza soglia tracciata.

---

## Cosa mostriamo nel frattempo

Intensità per Azienda in DDD/100 A3/T1, con la variazione osservata sugli anni
disponibili. **Nessuna soglia PNCAR è tracciata**, e il pannello spiega perché.
Preferiamo un grafico che dichiara di non essere l’indicatore del piano a un
grafico che gli somiglia senza esserlo.
