"use client";

/** «Confronti pubblici fra Regioni» (owner clarification of 23 Oct 2026), beside the regional forecast: the public-tier
 * outputs of the workbook, one at a time, each table as published (rows in the source's fixed order, never ranked).
 * The reviewer fetches its «attivita» section on opening; the Regione receives the same outputs with the page, read under
 * its own session. An Azienda never reads them (PC-14 §3.4: never a comparator for an Azienda). A change of output
 * replaces the keyed block whole, so a page translated by the browser never keeps a stale value (AGENTS.md). */
import { useEffect, useState } from "react";
import { cWorkbookLabel, parseCWorkbookSection, type CWorkbookIndex, type CWorkbookSection } from "@/lib/dashboard-review/pillar-c/workbook";
import { C_PUBLIC_COPY, C_PUBLIC_LABELS, C_PUBLIC_NOTES, C_PUBLIC_OUTPUTS, C_PUBLIC_VINTAGE, cPublicCellLabel, cPublicColumnLabel, cPublicFromSection, type CPublicOutputId } from "@/lib/dashboard-review/pillar-c/public-comparators";
import { usePillarCAudience } from "@/components/dashboard-review/pillar-c/audience-context";

const SELECT = "mt-2 h-11 w-full min-w-0 rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";

export function PillarCPublicComparators({ workbook = null, loaded = null, unavailable = false, initial = C_PUBLIC_OUTPUTS[0] }: { workbook?: CWorkbookIndex | null; loaded?: CWorkbookSection | null; unavailable?: boolean; initial?: CPublicOutputId }) {
  const audience = usePillarCAudience();
  const [open, setOpen] = useState(false), [fetched, setFetched] = useState<CWorkbookSection | null>(null), [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<CPublicOutputId>(initial);
  const reviewer = audience?.kind === "reviewer";
  useEffect(() => {
    if (!reviewer || !open || !workbook || fetched) return;
    let active = true; const controller = new AbortController();
    fetch("/api/pillar-c/workbook?section=attivita", { credentials: "same-origin", cache: "no-store", signal: controller.signal })
      .then(async (r) => { if (!r.ok) throw Error("unavailable"); const s = cPublicFromSection(parseCWorkbookSection(await r.json(), "attivita", workbook)); if (!s) throw Error("unavailable"); return s; })
      .then((s) => { if (active) { setFetched(s); setFailed(false); } }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; controller.abort(); };
  }, [reviewer, open, workbook, fetched, attempt]);
  if (!audience || (audience.kind !== "reviewer" && audience.kind !== "regione")) return null;
  const section = reviewer ? fetched : loaded;
  const output = section?.outputs.find((o) => o.id === selected);
  const table = output?.tables[0];
  const body = section && output && table
    ? <div key={output.id} data-c-public={output.id}>
        <label className="block max-w-xl text-xs font-medium text-muted-foreground">Confronto<select aria-label="Confronto pubblico" className={SELECT} value={selected} onChange={(e) => setSelected(e.target.value as CPublicOutputId)}>{C_PUBLIC_OUTPUTS.map((id) => <option key={id} value={id}>{C_PUBLIC_LABELS[id]}</option>)}</select></label>
        <p className="mt-4 text-xs leading-5 text-muted-foreground">{C_PUBLIC_NOTES[selected]}</p>
        <p className="mt-2 text-xs leading-5 text-muted-foreground" data-c-public-vintage={selected}>{`Fonte e data: ${C_PUBLIC_VINTAGE[selected]}`}</p>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[40rem] text-xs"><caption className="sr-only">{C_PUBLIC_LABELS[selected]}</caption>
          <thead><tr>{table.columns.map((h, c) => <th key={c} scope="col" className="border-b border-border px-2 py-3 text-right align-bottom font-semibold first:text-left">{cPublicColumnLabel(output.id as CPublicOutputId, h)}</th>)}</tr></thead>
          <tbody>{table.rows.map((row, r) => <tr key={r} className={/^abruzzo$/i.test(String(row[0] ?? "")) ? "font-semibold" : undefined}>{row.map((cell, c) => c === 0
            ? <th key={c} scope="row" className="border-b border-border/50 px-2 py-2.5 text-left font-medium">{cWorkbookLabel(cell, section.formats, table.columns[c])}</th>
            : <td key={c} className="whitespace-nowrap border-b border-border/50 px-2 py-2.5 text-right tabular-nums">{cPublicCellLabel(cell, section.formats, table.columns[c])}</td>)}</tr>)}</tbody>
        </table></div>
      </div>
    : !reviewer ? <p role="status" className="text-sm text-muted-foreground">{C_PUBLIC_COPY.unavailable}</p>
    : !workbook ? <p role="status" className="text-sm text-muted-foreground">{C_PUBLIC_COPY.unavailable}</p>
    : failed ? <div role="status"><p className="text-sm">{C_PUBLIC_COPY.unavailable}</p><button type="button" className="mt-3 min-h-11 rounded-lg border border-border px-3 text-xs" onClick={() => { setFailed(false); setAttempt((n) => n + 1); }}>Riprova</button></div>
    : <p role="status" className="text-sm text-muted-foreground">Caricamento dei confronti pubblici…</p>;
  return <details className="mt-6 rounded-xl border border-border bg-card" onToggle={(e) => setOpen(e.currentTarget.open)} data-c-public-comparators={unavailable ? "unavailable" : "ready"}>
    <summary className="cursor-pointer px-5 py-4 text-sm font-medium">{C_PUBLIC_COPY.title}</summary>
    <div className="space-y-4 border-t border-border p-5">
      <p className="text-sm leading-6">{C_PUBLIC_COPY.lead}</p>
      {body}
      <p className="border-t border-border pt-3 text-xs leading-5 text-muted-foreground">{C_PUBLIC_COPY.source}</p>
    </div>
  </details>;
}
