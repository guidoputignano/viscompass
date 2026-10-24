/** Pillar C additions (build add-v1; owner decision D24-4 of 24 Oct 2026): three outputs delivered behind sign-in to the
 * audiences entitled to them (reviewer, Regione, own Azienda).
 *   - P8-03: the administrative residence of the eligible January 2026 DPC recipients, by dispensing unit.
 *   - P10-04: the spend of the eligible recipients narrowed to one candidate area by a consistent exemption, by area,
 *     and the spend by the exemption class of each line (screened table: hidden cells carry one uniform marker).
 *   - P10-05: the File F 2025 rows of one Azienda by the presence of the fields that can help attribution.
 *
 * Browser-safe: types, the closed vocabularies, the Italian labels and the client audience check only. The parsers are
 * server-only (additions-parse.ts), so the guard's vocabulary never reaches a client bundle. No figure lives here. */
import type { CClientAudience } from "@/lib/dashboard-review/pillar-c/audience-rules";
import { C_EXT_UNIT_LABELS } from "@/lib/dashboard-review/pillar-c/extension";
import type { CScopedUnit } from "@/lib/dashboard-review/pillar-c/scoped-units";

/** The one marker a screened P10-04 area cell carries in place of its values, for every audience. */
export const C_ADD_HIDDEN = "suppressed" as const;
/** Display order of the units in the full object (the aggregate, then ASL 1-4 in fixed numeric order, never by value). */
export const C_ADD_ORDER = ["aggregato", "asl-1", "asl-2", "asl-3", "asl-4"] as const satisfies readonly CScopedUnit[];
/** The only unit whose File F 2025 rows are delivered. */
export const C_ADD_FILEF_UNIT = "asl-3" as const satisfies CScopedUnit;
export const C_ADD_RESIDENCE = ["sameAsl", "otherAslInRegion", "outsideRegion", "unknown"] as const;
export const C_ADD_AREAS = ["CV", "END", "GAS", "NEF", "PNE", "REU"] as const;
export const C_ADD_CLASSES = ["consistent", "inconsistent", "rare", "all_drug", "non_clinical", "none"] as const;
/** Each group partitions the same rows: together with «all» these are the 17 categories of the inventory. */
export const C_ADD_FILEF_GROUPS = [
  ["prescriber:present", "prescriber:blank"],
  ["sdo:present", "sdo:blank"],
  ["mode:01", "mode:02", "mode:03", "mode:04", "mode:05", "mode:06", "mode:07", "mode:08", "mode:09"],
  ["ticket:00", "ticket:01", "ticket:02"],
] as const;
export const C_ADD_FILEF_CATEGORIES = ["all", ...C_ADD_FILEF_GROUPS.flat()] as const;

export type CAddResidenceKey = typeof C_ADD_RESIDENCE[number];
export type CAddArea = typeof C_ADD_AREAS[number];
export type CAddClass = typeof C_ADD_CLASSES[number];
export type CAddFileFCategory = typeof C_ADD_FILEF_CATEGORIES[number];

export type CAddCountShare = { count: number; share: number };
/** P8-03. Shares are count / eligible, three decimals; the four categories add up to eligible. */
export type CAddResidence = { period: "2026-01"; channel: "DPC"; recipientsAreSum: boolean; eligible: number } & Record<CAddResidenceKey, CAddCountShare>;
export type CAddAreaCell = { recipients: number; shareOfNarrowedSpend: number; shareOfEligibleSpend: number };
export type CAddClassCell = { recipients: number; shareOfEligibleSpend: number };
/** P10-04 (attempt 2). Shares are proportions at four decimals; no euro amount is delivered. */
export type CAddNarrowing = {
  period: "2026-01"; channel: "DPC"; recipientsAreSum: boolean; domainReviewPending: true; eligibleRecipients: number;
  narrowed: { total: { recipients: number; shareOfEligibleSpend: number }; byArea: Record<CAddArea, CAddAreaCell | typeof C_ADD_HIDDEN> };
  lineClasses: Record<CAddClass, CAddClassCell>;
};
/** P10-05: rows, the reported amount as a decimal string with two decimals, and both shares at four decimals. */
export type CAddFileFCell = { rows: number; amountEUR: string; rowShare: number; amountShare: number };
export type CAddFileF = { scope: { period: "2025"; organisationUnit: CScopedUnit; countedUnit: "rows" }; categories: Record<CAddFileFCategory, CAddFileFCell> };
export type CAddEntry = { unit: CScopedUnit; residence: CAddResidence; narrowing: CAddNarrowing; fileFFields: CAddFileF | null };
export type CAddUnitObject = { schema: "pillar-c-additions-unit-v1"; build: "add-v1" } & CAddEntry;
export type CAddFullObject = { schema: "pillar-c-additions-v1"; build: "add-v1"; units: CAddEntry[] };
/** What a workspace receives: the units of its audience in display order, labelled by the server for that audience. */
export type CAdditionsView = { units: { key: CScopedUnit; label: string; entry: CAddEntry }[] };

export const cAddIsHidden = (cell: CAddAreaCell | typeof C_ADD_HIDDEN): cell is typeof C_ADD_HIDDEN => cell === C_ADD_HIDDEN;

// ---------------------------------------------------------------------------- Italian labels (no figure)
export const C_ADD_RESIDENCE_LABELS: Readonly<Record<CAddResidenceKey, string>> = {
  sameAsl: "Residenti nella stessa ASL",
  otherAslInRegion: "Residenti in un’altra ASL della regione",
  outsideRegion: "Residenti fuori regione",
  unknown: "Residenza non nota o incoerente",
};
/** The candidate areas (ATC groupings of the draft portfolio taxonomy). */
export const C_ADD_AREA_LABELS: Readonly<Record<CAddArea, string>> = {
  CV: "Malattie cardiovascolari",
  END: "Malattie endocrine",
  GAS: "Malattie gastrointestinali ed epatiche",
  NEF: "Malattie renali e dialisi",
  PNE: "Malattie respiratorie e allergiche",
  REU: "Malattie reumatologiche, muscolo-scheletriche e immunologiche",
};
/** The exemption class of each dispensing line. */
export const C_ADD_CLASS_LABELS: Readonly<Record<CAddClass, string>> = {
  consistent: "Esenzione per patologia coerente con il farmaco",
  inconsistent: "Esenzione per patologia non coerente con il farmaco",
  rare: "Esenzione per malattia rara",
  all_drug: "Esenzione valida per tutti i farmaci",
  non_clinical: "Esenzione senza patologia (reddito, invalidità, altre categorie)",
  none: "Nessuna esenzione",
};
export const C_ADD_FILEF_LABELS: Readonly<Record<CAddFileFCategory, string>> = {
  all: "Tutte le righe",
  "prescriber:present": "Prescrittore: codice compilato",
  "prescriber:blank": "Prescrittore: campo vuoto",
  "sdo:present": "Riferimento SDO: compilato",
  "sdo:blank": "Riferimento SDO: campo vuoto",
  "mode:01": "Modalità di erogazione 01",
  "mode:02": "Modalità di erogazione 02",
  "mode:03": "Modalità di erogazione 03",
  "mode:04": "Modalità di erogazione 04",
  "mode:05": "Modalità di erogazione 05",
  "mode:06": "Modalità di erogazione 06",
  "mode:07": "Modalità di erogazione 07",
  "mode:08": "Modalità di erogazione 08",
  "mode:09": "Modalità di erogazione 09",
  "ticket:00": "Codice ticket 00",
  "ticket:01": "Codice ticket 01",
  "ticket:02": "Codice ticket 02",
};
/** The uniform marker of a hidden cell: never «<5», «1–4», a zero or a mark that tells one hidden cell from another. */
export const C_ADD_HIDDEN_LABEL = "dato oscurato";

/** Copy of the three panels: what each output is and is not, its honest unavailable state, the hidden-cell note. */
export const C_ADD_COPY = {
  residenceTitle: "Dove risiedono i destinatari · gennaio 2026",
  residenceLead: "Residenza amministrativa registrata sul record di erogazione della DPC, un solo mese (gennaio 2026): quota dei destinatari ammissibili di ciascuna colonna. Descrive dove risiedono i destinatari serviti dall’ASL, non i percorsi di cura né i flussi fra ASL.",
  residenceAggregate: "L’aggregato è la somma delle quattro ASL, non un conteggio di persone distinte: chi riceve medicinali in due ASL è contato in ciascuna.",
  residenceUnavailable: "La residenza dei destinatari di gennaio 2026 non è disponibile in questo momento. Nessun valore viene mostrato né sostituito.",
  narrowingTitle: "Aree delle esenzioni coerenti e classi di esenzione · gennaio 2026",
  narrowingLead: "Evidenza di congruenza delle esenzioni: una riga di un prodotto condiviso è ristretta a un’area candidata quando l’esenzione rientra nelle classi correlate alla patologia secondo l’elenco della Regione Toscana, DGR 865/2018, un riferimento esterno. La mappatura fra esenzioni e aree e la tassonomia dei portafogli sono in bozza, in attesa di revisione clinica. Non è un’attribuzione della spesa a un’area clinica né della titolarità del budget. I destinatari con righe in più aree contano in ciascuna.",
  narrowingAggregate: "L’aggregato è la somma delle quattro ASL.",
  narrowingUnavailable: "Le aree delle esenzioni coerenti e le classi di esenzione non sono disponibili in questo momento. Nessun valore viene sostituito.",
  hiddenNote: "Dato oscurato: le celle con meno di 5 destinatari sono oscurate insieme alle celle complementari necessarie, così che nessun valore oscurato si possa ricavare dai totali o dalle altre celle.",
  classesNote: "Ogni riga di erogazione ha una sola classe di esenzione: le quote ripartiscono la spesa dei destinatari ammissibili e, arrotondate, possono non sommare esattamente a cento. I destinatari con righe di più classi contano in ciascuna.",
  fileFLead: "Conteggi di righe del File F 2025 di una sola Azienda, non di persone: quante righe riportano i campi che possono aiutare l’attribuzione (prescrittore, riferimento SDO, modalità di erogazione, codice ticket). È un inventario dei campi, non un’attribuzione della spesa.",
  fileFNote: "Ogni gruppo (prescrittore, riferimento SDO, modalità di erogazione, codice ticket) ripartisce le stesse righe. Importo riportato nel flusso, non spesa netta. Il significato di questi campi per l’attribuzione resta da rivedere con i referenti di dominio.",
  fileFUnavailable: "L’inventario dei campi di attribuzione del File F 2025 non è disponibile in questo momento. Nessun valore viene sostituito.",
} as const;

// ---------------------------------------------------------------------------- client audience check
/** The units a client audience reads, in its display order: the reviewer the aggregate and ASL 1-4 under the reviewed
 * labels; a scoped audience exactly its own options (an Azienda its own unit and the aggregate). */
function expected(audience: CClientAudience): { key: string; label: string }[] | null {
  if (audience.kind === "reviewer") return C_ADD_ORDER.map((key) => ({ key, label: C_EXT_UNIT_LABELS[key] }));
  if (audience.kind === "azienda" || audience.kind === "regione") return audience.orgs.map((o) => ({ key: o.key, label: o.label }));
  return null;
}

/** The additions are shown only when they hold exactly the audience's units, in its order and under its labels, with the
 * File F fields on asl-3 alone and no hidden marker on the aggregate. Anything else is refused like an unreadable
 * object («not available»): a client never renders a row outside its audience. */
export function cAdditionsFor(audience: CClientAudience | null, view: CAdditionsView | null): CAdditionsView | null {
  if (!audience || !view || !Array.isArray(view.units)) return null;
  const want = expected(audience);
  if (!want || view.units.length !== want.length) return null;
  const ok = view.units.every((u, i) => u.key === want[i].key && u.label === want[i].label && u.entry?.unit === u.key
    && (u.entry.fileFFields === null) === (u.key !== C_ADD_FILEF_UNIT)
    && (u.key !== "aggregato" || C_ADD_AREAS.every((a) => !cAddIsHidden(u.entry.narrowing.narrowed.byArea[a]))));
  return ok ? view : null;
}

/** Whether the audience holds the File F unit (reviewer, Regione, the Azienda of asl-3): only then can the File F
 * inventory be missing, so only then is its unavailable state shown. */
export function cAdditionsHoldsFileF(audience: CClientAudience | null): boolean {
  if (!audience) return false;
  return audience.kind === "reviewer" || audience.orgs.some((o) => o.key === C_ADD_FILEF_UNIT);
}
