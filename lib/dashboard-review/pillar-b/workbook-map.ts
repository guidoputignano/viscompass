// The 25 sheets of the frozen Pillar B workbook (VIS_PillarB_Analytical_R2),
// each placed in exactly one of four states. Shown on the private page so a
// reader knows what of the workbook is on the screen, what could be, and what
// is not — nothing is quietly dropped and nothing is quietly promoted.
//
// PURE DATA. The status is the state of the sheet's FULL content; a sheet
// whose headline is live but whose breakdown is not says so in its note. The
// map is checked by tests/pillar-b-workbook-map.test.mjs and documented in
// docs/PILLAR_B_WORKBOOK_MAP_20261002.md; the per-cent reconciliations behind
// every "implemented" line live in the evidence harnesses (b39, b41, b42, b43).

export type WorkbookStatus = "evidence" | "implemented" | "implementable" | "blocked";

export interface WorkbookSheet {
  /** Sheet id as in the workbook, e.g. "12". */
  id: string;
  sheet: string;
  /** What the sheet holds, in one line. */
  holds: string;
  status: WorkbookStatus;
  /** Where it is on the page, or what stands in its place. */
  where: string;
  /** What is partial, or what is missing for the next state. */
  note?: string;
}

export const WORKBOOK_STATUS_LABELS: Record<WorkbookStatus, string> = {
  evidence: "Evidenza e audit",
  implemented: "Analisi riservata implementata",
  implementable: "Implementabile con le funzioni autenticate attuali",
  blocked: "Bloccato: serve un contratto dati o una migrazione",
};

export const WORKBOOK_STATUS_ORDER: ReadonlyArray<WorkbookStatus> = ["implemented", "implementable", "blocked", "evidence"];

export const WORKBOOK_SHEETS: ReadonlyArray<WorkbookSheet> = [
  { id: "00", sheet: "README", holds: "Note di rilascio, basi di calcolo, periodo", status: "evidence", where: "Riga di provenienza nella sezione Fonte" },
  { id: "01", sheet: "Verification", holds: "Ri-somme fatte in Excel", status: "evidence", where: "Sostituita dall'harness b39, che ri-somma sui dati del rilascio" },
  { id: "03", sheet: "Spend_by_Period", holds: "Totali mensili del rilascio", status: "implemented", where: "Panorama → profilo mensile", note: "ogni mese al centesimo (b39, b44); 2026 mostrato come anno parziale, mai confrontato" },
  { id: "04", sheet: "Spend_by_ASL", holds: "4 Aziende × 3 anni", status: "implemented", where: "Panorama → Aziende", note: "ogni cella e i totali al centesimo (b39, b44); nomi reali solo per il revisore; la colonna 2026 (anno parziale) non è mostrata" },
  { id: "05", sheet: "Spend_by_Channel", holds: "3 canali × 3 anni", status: "implemented", where: "Panorama → canali; Spesa → confronto per canale", note: "al centesimo (b39, b44); la colonna 2026 (anno parziale) non è mostrata" },
  { id: "06", sheet: "Spend_by_Molecule", holds: "Graduatoria della spesa per principio attivo", status: "implemented", where: "Spesa → variazioni per molecola; Concentrazione", note: "tutte le voci al centesimo, ordine delle prime 25 esatto" },
  { id: "07", sheet: "Perimeter", holds: "5 stati di perimetro, conteggio AIC, spesa", status: "implemented", where: "Evidenza → composizione della spesa nel perimetro biosimilare", note: "conteggi e spesa al centesimo; le chiavi non-AIC mostrate come «fuori dalla tassonomia»" },
  { id: "07b", sheet: "B03_Candidates", holds: "AIC candidati NON adottati", status: "evidence", where: "Non mostrato: è il registro di ciò che non è stato cambiato" },
  { id: "08", sheet: "Bridge_A_Comparability", holds: "Nove soglie di esclusione che ripartiscono la spesa rendicontata", status: "blocked", where: "Evidenza → imbuto dei record (le fasi)", note: "parziale: le fasi sono vive; le nove soglie nominate con i loro euro richiedono una funzione per soglia (migrazione)" },
  { id: "09", sheet: "Bridge_B_Opportunity", holds: "6 soglie che ripartiscono lo stesso totale", status: "implemented", where: "Adozione → riconciliazione della spesa del perimetro, soglia per soglia", note: "sei soglie al centesimo sui 29 mesi del rilascio (b46); sulla pagina il periodo selezionato; il perimetro è verificato a ogni richiesta contro la classificazione per stato (foglio 07)" },
  { id: "10", sheet: "Coverage_Cuts", holds: "Quota confrontabile per Azienda, canale, mese", status: "implemented", where: "Panorama (misura «quota con quantità confrontabile»)", note: "ogni taglio al centesimo (b39, b44)" },
  { id: "11", sheet: "Date_and_Availability", holds: "Dentro / prima / confine / fuori; livelli T0, T1, T2", status: "implemented", where: "Adozione → importi fuori dalle due quote e le due schede", note: "ripartizione a quattro vie e tre livelli al centesimo (b36, b38, b39)" },
  { id: "12", sheet: "Uptake", holds: "Uptake in valore su due denominatori; per anno; 16 coppie in volume", status: "implemented", where: "Adozione", note: "titolo e per anno al centesimo; copertura della misura esatta (b42); le 16 coppie in volume non ancora riconciliate coppia per coppia" },
  { id: "13", sheet: "Expenditure_Change", holds: "B06 prezzo / volume / interazione su strati appaiati; entrate e uscite", status: "blocked", where: "Non mostrato; Spesa mostra solo la variazione annua", note: "risultato statistico congelato: importazione con provenienza, o ri-derivazione SQL che incorpori l'adjudicazione di plausibilità dei prezzi" },
  { id: "14", sheet: "Benchmarks", holds: "B07: confronti stesso AIC/anno/canale fra Aziende", status: "blocked", where: "Non mostrato", note: "tabella fra Aziende solo per Regione/revisore via importazione; «il tuo prezzo contro il minimo regionale» richiede una funzione SECURITY DEFINER (migrazione)" },
  { id: "15", sheet: "Trends_and_Adoption", holds: "B08 pendenze Newey–West, correzione giorni lavorativi", status: "blocked", where: "Adozione → cronologia del primo uso (controparte viva, non statistica)", note: "risultato statistico congelato, non ricalcolabile in SQL" },
  { id: "16", sheet: "Heterogeneity", holds: "B09 Friedman, permutazioni, uptake grezzo e standardizzato", status: "blocked", where: "Limiti: nessuna classifica fra Aziende", note: "la conclusione (rifiuto della graduatoria) è onorata; i numeri sono un risultato statistico congelato" },
  { id: "17", sheet: "Anomalies", holds: "B11 punti di cambiamento sulle serie mensili", status: "blocked", where: "Non mostrato", note: "importazione con righe per Azienda sotto RLS" },
  { id: "18", sheet: "Uncertainty", holds: "B13 curva di specificazione; intervalli bootstrap", status: "blocked", where: "Non mostrato", note: "prima importazione candidata: è il grafico più onesto del workbook" },
  { id: "19", sheet: "Opportunity_Scenarios", holds: "B14 scenari A / B / C", status: "evidence", where: "Limiti: nessuna cifra di risparmio", note: "rifiuto pubblicato dal workbook, riportato come tale; mai un risparmio realizzato" },
  { id: "20", sheet: "Exclusivity", holds: "B15: medicinali di riferimento, date EU, anni senza concorrenza", status: "blocked", where: "Adozione → primo uso locale (metà viva); Limiti: non è esclusività legale", note: "le date EU stanno nel manifesto EMA congelato, non nei dati del rilascio" },
  { id: "21", sheet: "Action_Register", holds: "B16: 6 azioni di revisione + 2 sui dati, responsabile e scadenza vuoti", status: "blocked", where: "Non mostrato", note: "solo se i campi restano onestamente vuoti; nessun responsabile inventato" },
  { id: "22", sheet: "Refusals", holds: "B10 nessuna previsione; B12 nessun nesso causale", status: "evidence", where: "Limiti" },
  { id: "23", sheet: "Artifact_Manifest", holds: "SHA-256 di ogni artefatto derivato", status: "evidence", where: "Provenienza; l'harness verifica gli input contro il manifesto del rilascio" },
  { id: "24", sheet: "Caveats", holds: "10 avvertenze", status: "implemented", where: "Limiti", note: "come testo, una per voce" },
];

export function workbookTally(sheets: ReadonlyArray<WorkbookSheet> = WORKBOOK_SHEETS): Record<WorkbookStatus, number> {
  const t: Record<WorkbookStatus, number> = { evidence: 0, implemented: 0, implementable: 0, blocked: 0 };
  for (const s of sheets) t[s.status] += 1;
  return t;
}

export function workbookByStatus(sheets: ReadonlyArray<WorkbookSheet> = WORKBOOK_SHEETS): Array<{ status: WorkbookStatus; sheets: WorkbookSheet[] }> {
  return WORKBOOK_STATUS_ORDER.map((status) => ({ status, sheets: sheets.filter((s) => s.status === status) }));
}
