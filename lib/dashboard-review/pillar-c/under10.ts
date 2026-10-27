/** Pillar C, the DPC medicines with an average acquisition below 10 € per pack (joint feedback 2, G2-16): which
 * medicines make up the group of the service measures «Confezioni con acquisto medio sotto 10 €» and «Servizio sul
 * costo dei farmaci sotto 10 €», one ASL at a time, for a review of distribution arrangements (never a saving).
 *
 * Built privately from Codex's verified list (build u10-v1): one row per AIC in each ASL whose unrounded average
 * acquisition per pack is below 10 € (service excluded from the threshold), money in integer cents. Products dispensed
 * to fewer than 5 assistiti in the ASL are not listed one by one: they form one «others» row, so the list still adds up
 * to the group. Browser-safe: types, copy and the client audience check; the parser is server-only (under10-parse.ts).
 * No figure lives here. */
import type { CClientAudience } from "@/lib/dashboard-review/pillar-c/audience-rules";
import { C_EXT_UNIT_LABELS } from "@/lib/dashboard-review/pillar-c/extension";
import type { CScopedUnit } from "@/lib/dashboard-review/pillar-c/scoped-units";

/** The ASLs with a list, in fixed order. The aggregate has none: each ASL applies the threshold to its own averages. */
export const C_U10_UNITS = ["asl-1", "asl-2", "asl-3", "asl-4"] as const satisfies readonly CScopedUnit[];
export type CU10Unit = (typeof C_U10_UNITS)[number];

export type CU10Amounts = { packs: number; acquisitionCents: number; serviceCents: number };
export type CU10Row = CU10Amounts & { aic: string; medicine: string; pack: string; ingredient: string };
/** The products dispensed to fewer than 5 assistiti, together; `zeroAcquisition` counts those with a recorded acquisition of zero. */
export type CU10Others = CU10Amounts & { products: number; zeroAcquisition: number };
export type CU10Entry = { unit: CU10Unit; total: CU10Amounts & { products: number }; rows: CU10Row[]; others: CU10Others | null };
export type CU10Object = { schema: "pillar-c-under10-v1"; build: "u10-v1"; period: "2026-01"; channel: "DPC"; thresholdCents: 1000; minRecipients: 5; units: CU10Entry[] };
/** What a workspace receives: the audience's ASLs under its own labels. */
export type CU10View = { units: { key: CU10Unit; label: string; entry: CU10Entry }[] };

export const C_U10_COPY = {
  title: "Quanto costa il servizio per i farmaci con acquisto medio sotto 10 €? · gennaio 2026",
  lead: "I farmaci il cui costo medio d’acquisto per confezione nell’ASL è sotto 10 €, ordinati per spesa di servizio. Sono candidati per una revisione delle modalità di distribuzione, non risparmi accertati.",
  threshold: "La soglia usa il costo medio d’acquisto per confezione di ciascun codice AIC nell’ASL, senza arrotondamenti e senza il servizio: un valore mostrato come 10,00 € può essere appena sotto la soglia.",
  identity: "Nome, confezione e principio attivo vengono dall’elenco AIFA delle confezioni (13 ottobre 2026), per codice AIC; non indicano prezzo o stato del farmaco a gennaio.",
  zero: "acquisto registrato pari a zero",
  zeroNote: "Acquisto registrato pari a zero nel flusso: non significa che il farmaco sia gratuito.",
  others: "Per riservatezza, i farmaci erogati a meno di 5 assistiti nell’ASL sono riuniti in una sola riga.",
  noAggregate: "Per l’aggregato non c’è un elenco: ogni ASL applica la soglia ai propri costi medi.",
  unavailable: "L’elenco dei farmaci con acquisto medio sotto 10 € non è disponibile in questo momento. Nessun valore viene mostrato né sostituito.",
} as const;

/** The ASLs a client audience reads, in order and under its labels: the reviewer ASL 1-4 under the reviewed labels; the
 * Regione its four ASLs; an Azienda its own unit only. */
function expected(audience: CClientAudience): { key: string; label: string }[] | null {
  if (audience.kind === "reviewer") return C_U10_UNITS.map((key) => ({ key, label: C_EXT_UNIT_LABELS[key] }));
  if (audience.kind === "regione") return audience.orgs.filter((o) => (C_U10_UNITS as readonly string[]).includes(o.key)).map((o) => ({ key: o.key, label: o.label }));
  if (audience.kind === "azienda") return audience.orgs.filter((o) => o.key === audience.defaultOrg && (C_U10_UNITS as readonly string[]).includes(o.key)).map((o) => ({ key: o.key, label: o.label }));
  return null;
}

/** The list is shown only when it holds exactly the audience's ASLs, in order and under its labels; anything else is
 * refused like an unreadable object («not available»): a client never renders another organisation's medicines. */
export function cUnder10For(audience: CClientAudience | null, view: CU10View | null): CU10View | null {
  if (!audience || !view || !Array.isArray(view.units)) return null;
  const want = expected(audience);
  if (!want || !want.length || view.units.length !== want.length) return null;
  return view.units.every((u, i) => u.key === want[i].key && u.label === want[i].label && u.entry?.unit === u.key) ? view : null;
}
