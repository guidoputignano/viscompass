import { C_WORKBOOK_HASH, parseCWorkbookSection, type CWorkbookIndex, type CWorkbookOutput, type CWorkbookSection } from "@/lib/dashboard-review/pillar-c/workbook";

/**
 * Public comparators of Pillar C (owner clarification of 23 Oct 2026: other-region and national comparisons only from
 * verified, compatible sources). The public-tier outputs of workbook R5, section «attivita» (contract PC-14 §4): AIFA
 * open data, the Ministry/ISTAT population and the Annuario statistico del SSN, region level only. Each output compares
 * like with like on one source and one definition; none carries a ledger value or an Azienda figure, and none is ever
 * set against an Azienda (PC-14 §3.4). Every value was recomputed from the raw public files
 * (outputs/pillar-c/public-comparators-20261024/VERIFY_PUBLIC.json). Shown to the reviewer and the Regione.
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
  "PUB-07-11": "Spesa per acquisti diretti per ricovero acuto, 2023 (contesto)",
  "PUB-07-03": "Dimessi per capitolo diagnostico, 2023",
};

/** What each output compares and how to read it (outputs/pillar-c/public-comparators-20261024/COMPATIBILITY.md). */
export const C_PUBLIC_NOTES: Readonly<Record<CPublicOutputId, string>> = {
  "PUB-04": "Stesso file, campo e anno per l’Abruzzo, l’Italia (21 unità) e l’Italia esclusa l’Abruzzo. Serie ricostruita da pubblicazioni di date diverse; i dati 2025 sono un’istantanea del 14/05/2026, soggetta a revisione.",
  "PUB-01": "Spesa del flusso della tracciabilità divisa per i residenti al 31/12/2024 (ISTAT, tramite il file ministeriale). È un valore per residente, non per assistito trattato. Gli altri anni non sono disponibili: manca la popolazione dello stesso anno.",
  "PUB-02": "Quota di ciascuna classe sul totale dell’anno, con la classe alla data di pubblicazione di ciascun file.",
  "PUB-03": "Quote per gruppo ATC di primo livello e differenza in punti percentuali, sullo stesso file e anno. I dati 2025 sono provvisori.",
  "PUB-05": "Flusso della farmaceutica convenzionata, a prezzo al pubblico: una corsia separata, mai sommata alla spesa per acquisti diretti. Per residente al 31/12/2024; il totale comprende tutte le classi.",
  "PUB-07-10": "Annuario statistico del SSN 2023, con la popolazione ISTAT al 31/12/2022. È un contesto: non è un denominatore della spesa 2024 o 2025.",
  "PUB-07-11": "Rapporto di contesto fra due grandezze pubbliche dello stesso anno con perimetri diversi: non è una spesa né un costo per ricovero. Le righe con dati AIFA incompleti sono indicate.",
  "PUB-07-03": "Annuario statistico del SSN 2023: Regione della struttura che eroga. Tassi con la popolazione ISTAT al 31/12/2022.",
};

export const C_PUBLIC_COPY = {
  title: "Confronti pubblici fra Regioni",
  lead: "Dati pubblici a livello regionale: l’Abruzzo accanto all’Italia e alle altre Regioni, sulla stessa fonte e con la stessa definizione. Non sono la spesa delle Aziende e non si sommano né si confrontano con quella del dossier: la spesa AIFA descrive gli acquisti delle strutture, un flusso diverso.",
  source: "Fonte: AIFA, spesa e consumo relativi al flusso della farmaceutica convenzionata e degli acquisti diretti (open data, CC BY 4.0); popolazione: ISTAT tramite il Ministero della Salute; attività ospedaliera: Annuario statistico del SSN 2023. Elaborazione VIS. Definizioni dei campi dal manuale open data 2016–2017: il manuale corrente non è disponibile.",
  unavailable: "I confronti pubblici non sono disponibili in questo momento. Nessun valore viene sostituito.",
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
