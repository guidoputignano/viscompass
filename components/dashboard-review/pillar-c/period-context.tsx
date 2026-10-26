"use client";

/** The period catalogue of the page (Guido's feedback 1, G1-03 and G1-11; contract pillar-c-period-catalog-v1, Codex).
 *
 * The server builds the catalogue from the view it has already authorised for the audience and hands the page only its
 * metadata (publicCPeriodCatalog). The panels use it to offer exactly the datasets it lists: which File F holders exist,
 * which years and months each one covers, and which measures a period carries. The data shown is the same authorised
 * view, matched to an entry by unit and period, never the first unit that happens to carry a source. Without a catalogue
 * the File F panels say the data is unavailable: nothing falls back to a first holder. */
import { createContext, useContext, type ReactNode } from "react";
import type { CPeriodCatalog, CPeriodEntry } from "@/lib/dashboard-review/pillar-c/period-contract";
import type { CExtensionView, CExtFileF } from "@/lib/dashboard-review/pillar-c/extension";

const PeriodCatalog = createContext<CPeriodCatalog | null>(null);

export function PillarCPeriodCatalogProvider({ catalog, children }: { catalog: CPeriodCatalog | null; children: ReactNode }) {
  return <PeriodCatalog.Provider value={catalog}>{children}</PeriodCatalog.Provider>;
}
export function usePillarCPeriodCatalog(): CPeriodCatalog | null { return useContext(PeriodCatalog); }

type Unit = CExtensionView["units"][number];
export type CFileFHolder = { entry: CPeriodEntry; unit: Unit; fileF: CExtFileF; months: CPeriodEntry[] };

/** The File F holders the catalogue lists for this view, in catalogue order: each annual entry matched to the one unit
 * with the same key and year. `missing` names the organisations of the view (never the aggregate) without a File F. */
export function cFileFHolders(catalog: CPeriodCatalog | null, view: CExtensionView): { holders: CFileFHolder[]; missing: string[] } {
  const entries = catalog?.entries ?? [];
  const holders = entries.filter((e) => e.sourceFamily === "file-f" && e.granularity === "year").flatMap((entry) => {
    const unit = view.units.find((u) => u.key === entry.unit), fileF = unit?.data.fileF;
    if (!unit || !fileF || `${fileF.year}-01` !== entry.windowFrom) return [];
    const months = entries.filter((e) => e.sourceFamily === "file-f" && e.granularity === "month" && e.unit === entry.unit && e.windowFrom.startsWith(`${fileF.year}-`));
    return [{ entry, unit, fileF, months }];
  });
  const missing = view.units.filter((u) => u.key !== "aggregato" && !holders.some((h) => h.unit.key === u.key)).map((u) => u.label);
  return { holders, missing };
}

/** The DPC months the catalogue lists for this view (one entry per unit and month), as distinct «YYYY-MM» values. */
export function cDpcMonths(catalog: CPeriodCatalog | null): string[] {
  return [...new Set((catalog?.entries ?? []).filter((e) => e.sourceFamily === "nsis-dpc").map((e) => e.windowFrom))].sort();
}
