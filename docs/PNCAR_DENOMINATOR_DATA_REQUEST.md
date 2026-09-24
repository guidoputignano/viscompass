# Richiesta dati · denominatore PNCAR per Azienda

**Stato:** da inviare alle Aziende del perimetro (201, 202, 203, 204)
**Preparata:** 24 settembre 2026
**Perché:** oggi non è possibile calcolare l’indicatore PNCAR per Azienda. Non è
un limite del software: mancano tre elementi di dato, elencati sotto. Si anticipa
che il terzo, da solo, non è sufficiente — anche il numeratore diverge, per le
ragioni spiegate più avanti.

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

Fonte: PNCAR 2022–2025, capitolo «La sorveglianza del consumo degli antibiotici»,
tabella degli indicatori dell’obiettivo 2, p. 42 (SHA-256 del PDF
`8daaa1b44600ff0d535e719b4a261b9bd3273836937d3714ba4bbe9bfd090f89`). Ripreso
identico da AIFA, Rapporto Antibiotici 2024, tabella 1.3.

Due conseguenze che guidano tutta la richiesta:

1. **L’obiettivo è relativo**, non un livello assoluto. Una riduzione
   percentuale non dipende da un denominatore scalato in modo coerente fra gli
   anni: è la forma che sopravvive all’incertezza sul denominatore.

   Questo punto è indipendente dal denominatore ed è il più vincolante: il piano
   **non fissa alcun livello di riferimento**. Una ricerca dei termini «soglia» e
   «valore di riferimento» nel testo restituisce solo soglie veterinarie in
   mg/PCU. Confrontare il *livello* di un’Azienda con una linea, e chiamarlo
   indicatore PNCAR, sarebbe un errore di categoria **anche se i denominatori
   coincidessero**. L’oggetto del piano è il rapporto 2025/2022 di ciascuna
   unità, non la sua distanza da una soglia.
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

## La prova decisiva: il test di riproduzione

Il test che conta non è quanto due denominatori differiscano in astratto, ma se
partendo dal nostro denominatore si riesca a riprodurre una cifra OSMED
pubblicata per un anno in cui entrambi esistono. Eseguito su Abruzzo, 2023 e 2024:

| Anno | Scarto del denominatore SDO rispetto alla cifra OSMED |
|---|---:|
| 2023 | −14,7% |
| 2024 | −7,8% |

Il denominatore OSMED implicito **si muove nella direzione opposta da un anno
all’altro**. Non esiste quindi un fattore di correzione, nemmeno approssimato,
che possa riallineare la serie: uno scarto costante sarebbe correggibile, uno
scarto che cambia segno non lo è.

A livello nazionale il divario 2024 è dello stesso ordine: circa 37,8–38,5
milioni di giornate secondo OSMED contro 44,0 milioni nella nostra serie
(14–16%), in una direzione che **abbasserebbe meccanicamente** ogni Azienda
rispetto alla linea 78,76.

## Anche il numeratore diverge

Un denominatore corretto non basterebbe. Il numeratore OSMED è l’acquistato
dalle strutture pubbliche al netto della distribuzione diretta; il workbook
riporta l’erogato di farmacia ospedaliera. Sulle quattro Aziende di questo
perimetro le due grandezze divergono fra **−17,8% e +41,5%**, perché una delle
Aziende acquista in forma centralizzata: l’acquistato è attribuito a chi compra,
non a chi consuma.

È il motivo per cui il punto 3 della richiesta, da solo, non chiude la
questione.

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
