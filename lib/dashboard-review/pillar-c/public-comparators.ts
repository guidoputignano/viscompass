import { C_WORKBOOK_HASH, cWorkbookLabel, parseCWorkbookSection, type CWorkbookCell, type CWorkbookIndex, type CWorkbookOutput, type CWorkbookSection } from "@/lib/dashboard-review/pillar-c/workbook";

/**
 * Public comparators of Pillar C (owner clarification of 23 Oct 2026: other-region and national comparisons only from
 * verified, compatible sources). The public-tier outputs of workbook R5, section «attivita» (contract PC-14 §4): AIFA
 * open data, the Ministry/ISTAT population and the Annuario statistico del SSN, region level only. Each output compares
 * like with like on one source and one definition; none carries a ledger value or an Azienda figure, and none is ever
 * set against an Azienda (PC-14 §3.4). Every value was recomputed from the raw public files
 * (outputs/pillar-c/public-comparators-20261024/VERIFY_PUBLIC.json). Shown to the reviewer and the Regione as regional
 * comparisons, and to an Azienda as public context only (owner decision of 26 Oct 2026, PR25-04): never set beside its
 * own amounts and never presented as a comparison with another Azienda.
 */
export const C_PUBLIC_OUTPUTS = ["PUB-04", "PUB-01", "PUB-02", "PUB-03", "PUB-05", "PUB-07-10", "PUB-07-11", "PUB-07-03"] as const;
export type CPublicOutputId = typeof C_PUBLIC_OUTPUTS[number];

export const C_PUBLIC_LABELS: Readonly<Record<CPublicOutputId, string>> = {
  "PUB-04": "Spesa per acquisti diretti, 2018–2025: Abruzzo e Italia",
  "PUB-01": "Spesa per acquisti diretti per residente, 2024, per classe e per Regione",
  "PUB-02": "Composizione per classe di rimborsabilità, 2018–2025",
  "PUB-03": "Composizione per gruppo ATC, 2024 e 2025",
  "PUB-05": "Spesa convenzionata per residente, 2024, per Regione",
  "PUB-07-10": "Attività ospedaliera di contesto, 2023, per Regione",
  "PUB-07-11": "Rapporto di contesto, 2023: spesa per acquisti diretti ÷ ricoveri acuti",
  "PUB-07-03": "Dimessi per capitolo diagnostico, 2023",
};

/** What each output compares and how to read it (outputs/pillar-c/public-comparators-20261024/COMPATIBILITY.md). */
export const C_PUBLIC_NOTES: Readonly<Record<CPublicOutputId, string>> = {
  "PUB-04": "Stesso file, campo e anno per l’Abruzzo, l’Italia (21 unità) e l’Italia esclusa l’Abruzzo. Serie ricostruita da pubblicazioni di date diverse.",
  "PUB-01": "Spesa del flusso della tracciabilità divisa per i residenti al 31/12/2024 (ISTAT, tramite il file ministeriale). È un valore per residente, non per assistito trattato. Gli altri anni non sono disponibili: manca la popolazione dello stesso anno.",
  "PUB-02": "Quota di ciascuna classe sul totale dell’anno, con la classe alla data di pubblicazione di ciascun file.",
  "PUB-03": "Quote per gruppo ATC di primo livello e differenza in punti percentuali, sullo stesso file e anno.",
  "PUB-05": "Flusso della farmaceutica convenzionata, a prezzo al pubblico: una corsia separata, mai sommata alla spesa per acquisti diretti. Per residente al 31/12/2024; il totale comprende tutte le classi.",
  "PUB-07-10": "Annuario statistico del SSN 2023, con la popolazione ISTAT al 31/12/2022. È un contesto: non è un denominatore della spesa 2024 o 2025.",
  "PUB-07-11": "Rapporto di contesto fra due grandezze pubbliche dello stesso anno con perimetri diversi: la spesa AIFA comprende anche la distribuzione diretta e per conto e acquisti estranei ai ricoveri, mentre i ricoveri sono solo quelli acuti in regime ordinario nelle strutture pubbliche. Non è una spesa né un costo per ricovero, né un valore per persona trattata. Le righe con dati AIFA incompleti sono indicate.",
  "PUB-07-03": "Annuario statistico del SSN 2023: Regione della struttura che eroga. Tassi con la popolazione ISTAT al 31/12/2022.",
};

/** Source, publication date, provisional status and geography of each output, shown under the selected one (PR25-04;
 * outputs/pillar-c/public-comparators-20261024/COMPATIBILITY.md §2–3). */
export const C_PUBLIC_VINTAGE: Readonly<Record<CPublicOutputId, string>> = {
  "PUB-04": "AIFA, file dal 2018 al 2025, ciascun anno alla sua data di pubblicazione (colonna «Versione del file»); 2025: istantanea del 14/05/2026, provvisoria e soggetta a revisione. Geografia: la Regione come unità AIFA; Italia = 21 unità (19 Regioni e 2 Province autonome).",
  "PUB-01": "AIFA, dati 2024 pubblicati il 04/12/2025; residenti al 31/12/2024 (ISTAT, tramite il file del Ministero della Salute). Geografia: 21 unità AIFA (19 Regioni e 2 Province autonome).",
  "PUB-02": "AIFA, file dal 2018 al 2025, ciascun anno alla sua data di pubblicazione; 2025: istantanea del 14/05/2026, provvisoria. Geografia: Abruzzo e Italia (21 unità).",
  "PUB-03": "AIFA, dati 2024 pubblicati il 04/12/2025 e dati 2025 (istantanea del 14/05/2026, provvisori); codici ATC come pubblicati in ciascun file. Geografia: Abruzzo e Italia esclusa l’Abruzzo (20 unità).",
  "PUB-05": "AIFA, flusso della farmaceutica convenzionata, dati 2024 pubblicati il 04/12/2025; residenti al 31/12/2024. Geografia: 21 unità AIFA.",
  "PUB-07-10": "Ministero della Salute, Annuario statistico del SSN, anno 2023; popolazione ISTAT al 31/12/2022; rilevazione sul 98,7 % delle strutture con reparti per acuti. Geografia: Regione della struttura che eroga, quindi con la mobilità attiva.",
  "PUB-07-11": "AIFA, dati 2023 pubblicati il 15/01/2025; Ministero della Salute, Annuario statistico del SSN, anno 2023. Geografia: la Regione (la spesa per unità AIFA, i ricoveri per Regione della struttura che eroga).",
  "PUB-07-03": "Ministero della Salute, Annuario statistico del SSN, anno 2023; popolazione ISTAT al 31/12/2022. Geografia: Regione della struttura che eroga; il tasso per residente comprende la mobilità.",
};

/** The heading shown for a published column. Only words change, never a value, its order or its format: PUB-07-11
 * divides AIFA spending by acute admissions of another perimeter, a context ratio, never «spesa per ricovero» (PR25-04). */
export function cPublicColumnLabel(id: CPublicOutputId, column: string): string {
  return id === "PUB-07-11" && /per ricovero/i.test(column) ? "Rapporto di contesto: spesa AIFA ÷ ricoveri acuti (€)" : column;
}

/** A published cell as text. A year-on-year change («var. annua», a share format without a declared sign) shows «+» on
 * an increase like every other change column (PR25-04); the formats with a declared sign already show it. */
export function cPublicCellLabel(cell: CWorkbookCell, formats: Record<string, string>, column: string): string {
  const text = cWorkbookLabel(cell, formats, column);
  return /var\. annua/i.test(column) && Array.isArray(cell) && Number(cell[0]) > 0 && /[1-9]/.test(text) && !text.startsWith("+") ? `+${text}` : text;
}

export const C_PUBLIC_COPY = {
  title: "Confronti pubblici fra Regioni",
  lead: "Dati pubblici a livello regionale: l’Abruzzo accanto all’Italia e alle altre Regioni, sulla stessa fonte e con la stessa definizione. Non sono la spesa delle Aziende e non si sommano né si confrontano con quella del dossier: la spesa AIFA descrive gli acquisti delle strutture, un flusso diverso.",
  source: "Fonte: AIFA, spesa e consumo relativi al flusso della farmaceutica convenzionata e degli acquisti diretti (open data, CC BY 4.0); popolazione: ISTAT tramite il Ministero della Salute; attività ospedaliera: Annuario statistico del SSN 2023. Elaborazione VIS. Definizioni dei campi dal manuale open data 2016–2017: il manuale corrente non è disponibile.",
  unavailable: "I confronti pubblici non sono disponibili in questo momento. Nessun valore viene sostituito.",
  aziendaTitle: "Contesto pubblico: Abruzzo, Italia e altre Regioni",
  aziendaLead: "Dati pubblici a livello regionale e nazionale: descrivono l’Abruzzo nel suo insieme, l’Italia e le altre Regioni, sulla stessa fonte e con la stessa definizione. Non contengono dati della tua Azienda né di altre Aziende e non si confrontano con gli importi della tua Azienda: la spesa AIFA descrive gli acquisti delle strutture, un flusso e un perimetro diversi.",
} as const;

function fail(): never { throw new Error("PILLAR_C_PUBLIC"); }

/** The Regione's object: the eight outputs verbatim, with the formats they use, checked by the section parser the
 * reviewer's fetch uses (as the price/quantity/mix object). Any other output, order or tier is refused. */
export function parseCRegionalPublic(value: unknown, attivitaSha256: string): CWorkbookSection {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail();
  const p = value as Record<string, unknown>;
  if (Object.keys(p).length !== 5 || p.schema !== "pillar-c-regional-public-v1" || p.workbookSha256 !== C_WORKBOOK_HASH || p.attivitaSha256 !== attivitaSha256
    || !/^[a-f0-9]{64}$/.test(attivitaSha256) || !p.formats || typeof p.formats !== "object" || Array.isArray(p.formats) || !Array.isArray(p.outputs)) fail();
  const outputs = p.outputs as unknown[];
  if (outputs.length !== C_PUBLIC_OUTPUTS.length) fail();
  const metas = outputs.map((o, i) => {
    if (!o || typeof o !== "object" || Array.isArray(o)) fail();
    const meta = Object.fromEntries(Object.entries(o).filter(([k]) => k !== "tables")) as unknown as CWorkbookOutput;
    if (meta.id !== C_PUBLIC_OUTPUTS[i] || meta.section !== "attivita" || meta.tier !== "Fonte pubblica") fail();
    return meta;
  });
  const index: CWorkbookIndex = { schema: "pillar-c-workbook-index-v1", workbookSha256: C_WORKBOOK_HASH, outputs: metas, sections: { attivita: { sha256: attivitaSha256, bytes: 2, outputs: metas.length } } };
  return parseCWorkbookSection({ schema: "pillar-c-workbook-section-v1", workbookSha256: C_WORKBOOK_HASH, section: "attivita", formats: p.formats, outputs }, "attivita", index);
}

/** The reviewer's «attivita» section limited to the same eight outputs, in the same order; null when one is missing. */
export function cPublicFromSection(section: CWorkbookSection): CWorkbookSection | null {
  const outputs = C_PUBLIC_OUTPUTS.map((id) => section.outputs.find((o) => o.id === id && o.tier === "Fonte pubblica"));
  return outputs.every(Boolean) ? { ...section, outputs: outputs as CWorkbookSection["outputs"] } : null;
}
