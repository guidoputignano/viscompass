"use client";

/** Reviewer-only extension block (owner decision O1: the price/quantity/mix kind of decomposition stays with reviewers).
 * Imported only by the reviewer workspace, which loads in its own chunk: scoped audiences never download it. */
import { itNumber } from "@/lib/format/it-number";
import { CReviewExactTable as ExactTable, CReviewPanel as Panel } from "@/components/dashboard-review/pillar-c/review-blocks";
import type { CExtensionView } from "@/lib/dashboard-review/pillar-c/extension";

const pct = (v: number) => `${itNumber(v * 100, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}\u00a0%`;
const num = (v: number, digits = 0) => itNumber(v, { minimumFractionDigits: digits, maximumFractionDigits: digits });
const eur0 = (v: number) => itNumber(v, { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const signedEur = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${eur0(Math.abs(v))}`;

/** Section 4, reviewer only (O1): the File F quarterly unit-amount index on fixed common products, with its coverage. */
export function PillarCFileFBasket({ view }: { view: CExtensionView }) {
  const b = view.fileFBasket;
  if (!b) return null;
  const unit = view.units.find((u) => u.key === b.unit)?.label ?? b.unit;
  return <Panel title={`Importo unitario sugli stessi prodotti, trimestre per trimestre · File F 2025 · ${unit}`} description={`${num(b.products)} prodotti presenti e senza rettifiche in tutti i trimestri, con composizione fissa. Riferimento annuo = 100. Solo revisori.`}>
    <ExactTable caption="Indice trimestrale e copertura" headers={["Trimestre", "Indice (riferimento annuo = 100)", "Quota dell’importo del trimestre inclusa"]} rows={b.quarters.map((q) => [q.quarter, num(q.index, 2), pct(q.coverage)])} />
    <p className="mt-4 text-xs leading-5 text-muted-foreground">La copertura indica quanta parte dell’importo del trimestre entra nel confronto: non è un indice del costo medio di tutti i medicinali. Importo riportato, non spesa netta.</p>
  </Panel>;
}

const FACTORS = [["reach", "Destinatari per 1.000 residenti"], ["intensity", "Confezioni per destinatario"], ["mix", "Composizione dei prodotti"], ["acquisition", "Costo di acquisto per confezione"], ["service", "Servizio per confezione"]] as const;

/** Section 4, reviewer only (owner decision O1): why DPC spending per resident differs, exact Shapley decomposition. */
export function PillarCResidentDrivers({ view }: { view: CExtensionView }) {
  const d = view.drivers;
  if (!d) return null;
  const label = (key: string) => view.units.find((u) => u.key === key)?.label ?? key;
  const max = Math.max(1, ...d.units.flatMap((u) => FACTORS.map(([k]) => Math.abs(u[k]))));
  return <Panel title="Perché la spesa DPC per residente differisce fra le ASL? · gennaio 2026" description={`Euro per 1.000 residenti sui ${d.supportProducts} prodotti identici presenti in tutte le ASL, rispetto al riferimento delle quattro ASL (${eur0(d.referencePer1000)}). Scomposizione esatta: i cinque contributi sommano la differenza. Solo revisori.`}>
    <div className="grid gap-5 lg:grid-cols-2">{d.units.map((u) => <div key={u.unit} className="rounded-xl border border-border p-4">
      <p className="text-sm font-semibold">{label(u.unit)}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{`Differenza ${signedEur(u.difference)} per 1.000 residenti · ${num(u.reachPer1000, 1)} destinatari per 1.000 · ${num(u.packsPerRecipient, 2)} confezioni ciascuno`}</p>
      <ul className="mt-3 space-y-1.5">{FACTORS.map(([k, text]) => <li key={k} className="grid grid-cols-[minmax(0,11rem)_1fr_4.5rem] items-center gap-2 text-xs">
        <span>{text}</span>
        <span aria-hidden="true" className="relative h-2.5 rounded-full bg-secondary"><span className={`absolute top-0 h-2.5 rounded-full ${u[k] >= 0 ? "left-1/2 bg-primary" : "right-1/2 bg-amber-500/80"}`} style={{ width: `${(Math.abs(u[k]) / max) * 50}%` }} /></span>
        <span className="text-right tabular-nums">{signedEur(u[k])}</span>
      </li>)}</ul>
    </div>)}</div>
    {view.baskets && <ExactTable caption="Indici del paniere comune" headers={["Indice (riferimento = 100)", ...view.baskets.units.map((u) => label(u.unit))]} rows={(["acquisition", "service", "combined"] as const).map((k) => [k === "acquisition" ? "Acquisto" : k === "service" ? "Servizio" : "Combinato", ...view.baskets!.units.map((u) => num(u[k], 2))])} />}
    <p className="mt-4 text-xs leading-5 text-muted-foreground">{`Contributi contabili, non cause cliniche né risparmi. Destinatari e confezioni per destinatario dipendono dalla cadenza di dispensazione e vanno letti insieme. Costo di acquisto e servizio per confezione spostano la spesa al massimo del ${pct(Math.max(...d.units.map((u) => Math.abs(u.acquisition) + Math.abs(u.service))) / d.referencePer1000)} del riferimento. Confronto descrittivo, non standardizzato per età. Residenti al 31/12/2024 (Ministero della Salute, dati ISTAT).`}</p>
  </Panel>;
}
