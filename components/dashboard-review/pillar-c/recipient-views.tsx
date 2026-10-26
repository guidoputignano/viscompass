"use client";

/** Section 2 views of the January 2026 DPC recipients (Guido's feedback 1, items G1-01, G1-02, G1-05 to G1-10).
 *
 * Each view answers one management question, offers a chart and the exact values, and reads only the verified packet
 * fields it is given: counts from the exact `count` fields (never rounded share × total), Lorenz points as delivered
 * (straight segments between them, no extra point), quartiles as delivered (no minimum, maximum or outlier is drawn).
 * Statistics of a distribution (median, quartiles, concentration) exist per ASL only: they are shown without an
 * aggregate column, because a median or a Gini index of four ASLs is not the sum or the mean of theirs.
 * Colour follows the organisation (--viz palette) and every value is also written, so nothing is read by colour alone.
 * Imports nothing reviewer-only (tests/pillar-c-scoped-client-graph.test.mjs). */
import { useId, useState } from "react";
import { itNumber } from "@/lib/format/it-number";
import { CReviewEmpty as Empty, CReviewPanel as Panel } from "@/components/dashboard-review/pillar-c/review-blocks";
import type { CExtDist, CExtensionView, CExtJanuary } from "@/lib/dashboard-review/pillar-c/extension";
import { cDpcMonths, usePillarCPeriodCatalog } from "@/components/dashboard-review/pillar-c/period-context";

type Unit = CExtensionView["units"][number];
const pct = (v: number, digits = 1) => `${itNumber(v * 100, { minimumFractionDigits: digits, maximumFractionDigits: digits })} %`;
const num = (v: number, digits = 0) => itNumber(v, { minimumFractionDigits: digits, maximumFractionDigits: digits });
const eur0 = (v: number) => itNumber(v, { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const eur2 = (v: number) => itNumber(v, { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** What a cell without a number means. A real zero is written as a number. */
export const C_RECIPIENT_STATES = {
  unavailable: "non disponibile",
  suppressed: "non mostrato: classi con meno di 5 persone",
} as const;

/** One colour per organisation, the same in every view of the section. */
const UNIT_COLOR: Readonly<Record<string, string>> = { aggregato: "var(--viz-6)", "asl-1": "var(--viz-1)", "asl-2": "var(--viz-2)", "asl-3": "var(--viz-3)", "asl-4": "var(--viz-4)" };
const colorOf = (key: string) => UNIT_COLOR[key] ?? "var(--viz-6)";

const th = "whitespace-nowrap border-b border-border px-2 py-3 text-right align-bottom font-semibold first:text-left";
const tdRow = "border-b border-border/50 px-2 py-2.5 text-left font-medium";
const td = "whitespace-nowrap border-b border-border/50 px-2 py-2.5 text-right tabular-nums";
const SELECT = "mt-2 h-11 w-full min-w-0 rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";
const NOTE = "mt-4 text-xs leading-5 text-muted-foreground";

/** A small set of mutually exclusive choices as native radio buttons: arrow keys move between them. */
function Choice<T extends string>({ legend, value, options, onChange }: { legend: string; value: T; options: readonly { value: T; label: string }[]; onChange: (v: T) => void }) {
  const name = useId();
  return <fieldset className="min-w-0"><legend className="text-xs font-medium text-muted-foreground">{legend}</legend>
    <div className="mt-2 inline-flex flex-wrap rounded-lg border border-border p-0.5">{options.map((o) => <label key={o.value} className={`inline-flex min-h-11 cursor-pointer items-center rounded-md px-3 text-xs font-medium focus-within:outline focus-within:outline-2 focus-within:outline-primary ${value === o.value ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}>
      <input type="radio" className="sr-only" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />{o.label}</label>)}</div></fieldset>;
}
type View = "chart" | "table";
const VIEW_OPTIONS = [{ value: "chart", label: "Grafico" }, { value: "table", label: "Tabella" }] as const;

/** A table of text values: a row header, then one cell per column. */
function Table({ caption, headers, rows, minWidth = "min-w-[30rem]" }: { caption: string; headers: string[]; rows: { key: string; label: string; cells: string[] }[]; minWidth?: string }) {
  return <div className="overflow-x-auto"><table className={`w-full ${minWidth} text-xs`}><caption className="sr-only">{caption}</caption>
    <thead><tr>{headers.map((h) => <th key={h} scope="col" className={th}>{h}</th>)}</tr></thead>
    <tbody>{rows.map((r) => <tr key={r.key}><th scope="row" className={tdRow}>{r.label}</th>{r.cells.map((c, i) => <td key={i} className={td}>{c}</td>)}</tr>)}</tbody></table></div>;
}
function Swatch({ unit }: { unit: string }) { return <span aria-hidden="true" className="inline-block h-3 w-3 shrink-0 rounded-sm" style={{ background: colorOf(unit) }} />; }

// ---------------------------------------------------------------- G1-02: what the section counts
/** Source, period, cohort and coverage above the recipient analyses, with the detail on demand. */
const MONTH_NAMES = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
export function PillarCRecipientCoverage({ units }: { units: Unit[] }) {
  const asl = units.filter((u) => u.key !== "aggregato"), aggregate = units.some((u) => u.key === "aggregato");
  // The DPC months the period catalogue lists for this view (G1-03): today only the January 2026 reference month.
  const months = cDpcMonths(usePillarCPeriodCatalog()).map((m) => `${MONTH_NAMES[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`);
  const items: [string, string][] = [
    ["Fonte e canale", "Flussi NSIS della distribuzione per conto (DPC)"],
    ["Periodo", months.length > 1 ? months.join(", ") : `${months[0] ?? "Gennaio 2026"}: un solo mese`],
    ["Chi è contato", "Destinatari ammissibili, contati una volta in ciascuna ASL"],
    ["Organizzazioni", `${asl.map((u) => u.label).join(", ")}${aggregate ? " e la loro somma" : ""}`],
  ];
  return <section aria-label="Copertura dei dati sui destinatari" className="rounded-2xl border border-border bg-card p-5 md:p-6" data-c-recipient-coverage>
    <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{items.map(([k, v]) => <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="mt-1 text-sm font-medium">{v}</dd></div>)}</dl>
    {aggregate && <p className="mt-4 text-xs leading-5 text-muted-foreground">L’aggregato somma i destinatari delle quattro ASL: chi riceve medicinali in due ASL è contato in ciascuna, quindi non è il numero di persone distinte della regione.</p>}
    <details className="mt-4 rounded-xl border border-border"><summary className="cursor-pointer rounded-xl px-4 py-3.5 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">Perché gennaio 2026 e come si contano i destinatari</summary>
      <div className="space-y-3 px-4 pb-4 text-xs leading-5 text-muted-foreground">
        <p>I flussi DPC disponibili riguardano il periodo di riferimento di gennaio 2026, inviato dalle ASL. Altri mesi richiedono i rispettivi file: finché non ci sono, questa sezione non mostra né stima altri periodi. Un invio può contenere anche erogazioni precedenti registrate in quel periodo.</p>
        <p>Un destinatario è ammissibile se il suo identificativo è valorizzato (non vuoto e non fatto di soli zeri), ha un solo stato di validità e tipologia ammesso in tutto il file dell’ASL e almeno una riga di medicinale nel mese. Ogni persona conta una volta per ASL.</p>
        <p>Un solo mese descrive una situazione, non un andamento: le confezioni e le prescrizioni dipendono anche dalla cadenza con cui si ritirano i medicinali.</p>
      </div></details>
  </section>;
}

// ---------------------------------------------------------------- G1-01: totals apart from per-ASL statistics
const over65 = (d: CExtDist) => d.status === "released" && d.total ? d.cells.filter((c) => ["65-74", "75-84", "85+"].includes(c.id)).reduce((a, c) => a + c.count, 0) / d.total : null;

/** What adds up across the ASLs: recipients, and shares recomputed from counts. Every column, the aggregate included. */
export function PillarCRecipientSummary({ units }: { units: Unit[] }) {
  return <Panel title="Quanti sono i destinatari e chi sono · gennaio 2026" description="Conteggi e quote che valgono anche per l’aggregato: si ottengono sommando i conteggi delle ASL.">
    <Table caption="Destinatari ammissibili, età e sesso" headers={["Misura", ...units.map((u) => u.label)]} rows={[
      { key: "recipients", label: "Destinatari ammissibili", cells: units.map((u) => num(u.data.january.recipients)) },
      { key: "over65", label: "65 anni e oltre", cells: units.map((u) => { const s = over65(u.data.january.age); return s === null ? C_RECIPIENT_STATES.suppressed : pct(s); }) },
      { key: "female", label: "Donne (sul sesso noto)", cells: units.map((u) => pct(u.data.january.sex.female)) },
    ]} />
    <p className={NOTE}>Età raggiunta nel 2026, ricavata dall’anno di nascita; la quota di donne esclude il sesso non noto.</p>
  </Panel>;
}

/** The statistics of each ASL's own distribution of the cost per recipient: one column per ASL, no aggregate column. */
export function PillarCCostPerRecipient({ units }: { units: Unit[] }) {
  const asl = units.filter((u) => u.key !== "aggregato" && u.data.january.cost.quartiles);
  if (!asl.length) return null;
  const v = (u: Unit, f: (c: CExtJanuary["cost"]) => string | null) => f(u.data.january.cost) ?? C_RECIPIENT_STATES.unavailable;
  return <Panel title="Quanto costa di solito un destinatario, in ciascuna ASL" description="Statistiche della distribuzione dentro ciascuna ASL. Per l’aggregato non c’è un valore: una mediana o un indice di concentrazione di quattro ASL non si ottiene sommando o facendo la media dei loro.">
    <Table caption="Costo per destinatario nelle singole ASL" headers={["Misura", ...asl.map((u) => u.label)]} rows={[
      { key: "median", label: "Mediana (valore centrale)", cells: asl.map((u) => v(u, (c) => c.quartiles ? eur2(c.quartiles.median) : null)) },
      { key: "iqr", label: "Metà centrale dei destinatari (1° – 3° quartile)", cells: asl.map((u) => v(u, (c) => c.quartiles ? `${eur0(c.quartiles.q1)} – ${eur0(c.quartiles.q3)}` : null)) },
      { key: "top10", label: "Quota del costo del 10 % con costo maggiore", cells: asl.map((u) => v(u, (c) => c.top10 === null ? null : pct(c.top10))) },
      { key: "top20", label: "Quota del costo del 20 % con costo maggiore", cells: asl.map((u) => v(u, (c) => c.top20 === null ? null : pct(c.top20))) },
      { key: "gini", label: "Indice di Gini (0 = costo uguale per tutti)", cells: asl.map((u) => v(u, (c) => c.gini === null ? null : num(c.gini, 2))) },
    ]} />
    <p className={NOTE}>Costo registrato nel flusso: acquisto più compenso di servizio, nel solo mese di gennaio. La mediana è il valore centrale; più destinatari possono avere lo stesso valore.</p>
  </Panel>;
}

// ---------------------------------------------------------------- G1-05: concentration curve
const DECILES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
/** How the cost is spread over the recipients: each ASL's eleven delivered Lorenz points, joined by straight segments,
 * against the line of equal cost. No curve for the aggregate: four distributions are not one. */
export function PillarCCostConcentration({ units, initialView = "chart" }: { units: Unit[]; initialView?: View }) {
  const curves = units.filter((u) => u.key !== "aggregato" && u.data.january.cost.lorenz);
  const [view, setView] = useState<View>(initialView);
  const [hidden, setHidden] = useState<string[]>([]);
  if (!curves.length) return null;
  const shown = curves.filter((u) => !hidden.includes(u.key));
  const W = 360, H = 260, L = 48, R = 12, T = 12, B = 44, pw = W - L - R, ph = H - T - B;
  // Coordinates rounded to the hundredth of a unit: the geometry carries no floating-point noise.
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const x = (share: number) => r2(L + share * pw), y = (share: number) => r2(T + (1 - share) * ph);
  const controls = <div className="flex flex-wrap gap-4"><Choice legend="Vista" value={view} options={VIEW_OPTIONS} onChange={setView} /></div>;
  return <Panel title="Il costo è concentrato su pochi destinatari? · gennaio 2026" description="Curva di concentrazione: destinatari ordinati dal costo più basso. Più la curva si allontana dalla diagonale, più il costo si concentra su pochi destinatari." controls={controls}>
    <div key={view} data-c-concentration={view}>
      {view === "chart" ? <div className="grid gap-5 lg:grid-cols-[minmax(0,26rem)_1fr]">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full max-w-[28rem]" role="img" aria-label={`Curve di concentrazione del costo: ${shown.map((u) => `${u.label}, il 50 % con costo più basso riceve il ${pct(u.data.january.cost.lorenz![5])} del costo`).join("; ") || "nessuna ASL selezionata"}`}>
          {[0, 0.25, 0.5, 0.75, 1].map((t) => <g key={t}>
            <line x1={x(0)} x2={x(1)} y1={y(t)} y2={y(t)} stroke="hsl(var(--border))" strokeDasharray="3 4" />
            <text x={L - 6} y={y(t) + 3} textAnchor="end" fontSize={10} fill="currentColor" className="text-muted-foreground">{`${t * 100}%`}</text>
            <text x={x(t)} y={H - B + 14} textAnchor="middle" fontSize={10} fill="currentColor" className="text-muted-foreground">{`${t * 100}%`}</text></g>)}
          <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} stroke="currentColor" strokeDasharray="5 4" className="text-muted-foreground" />
          <text x={x(0.62)} y={y(0.62) - 8} fontSize={10} fill="currentColor" className="text-muted-foreground" transform={`rotate(${-Math.atan(ph / pw) * 180 / Math.PI} ${x(0.62)} ${y(0.62) - 8})`}>costo uguale per tutti</text>
          {shown.map((u) => { const l = u.data.january.cost.lorenz!; return <g key={u.key}>
            <polyline fill="none" stroke={colorOf(u.key)} strokeWidth={2} points={DECILES.map((k) => `${x(k / 10)},${y(l[k])}`).join(" ")} />
            {DECILES.map((k) => <circle key={k} cx={x(k / 10)} cy={y(l[k])} r={3} fill={colorOf(u.key)} stroke="hsl(var(--card))" strokeWidth={1.5}><title>{`${u.label}: il ${k * 10} % con costo più basso riceve il ${pct(l[k])} del costo`}</title></circle>)}
          </g>; })}
          <text x={L + pw / 2} y={H - 8} textAnchor="middle" fontSize={10} fill="currentColor">Destinatari, dal costo più basso</text>
          <text x={12} y={T + ph / 2} textAnchor="middle" fontSize={10} fill="currentColor" transform={`rotate(-90 12 ${T + ph / 2})`}>Quota cumulata del costo</text>
        </svg>
        <div className="min-w-0 space-y-4">
          <fieldset><legend className="text-xs font-medium text-muted-foreground">ASL mostrate</legend>
            <div className="mt-2 flex flex-wrap gap-2">{curves.map((u) => <label key={u.key} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-xs focus-within:outline focus-within:outline-2 focus-within:outline-primary">
              <input type="checkbox" checked={!hidden.includes(u.key)} onChange={(e) => setHidden((h) => e.target.checked ? h.filter((k) => k !== u.key) : [...h, u.key])} /><Swatch unit={u.key} />{u.label}</label>)}</div></fieldset>
          <ul className="space-y-2 text-xs leading-5">{shown.map((u) => { const c = u.data.january.cost; return <li key={u.key} className="flex gap-2"><Swatch unit={u.key} /><span>{`${u.label}: la metà dei destinatari con costo più basso riceve il ${pct(c.lorenz![5])} del costo; il 10 % con costo più alto ne riceve il ${c.top10 === null ? C_RECIPIENT_STATES.unavailable : pct(c.top10)}.`}</span></li>; })}</ul>
        </div>
      </div> : <Table caption="Quota cumulata del costo per decimo di destinatari" headers={["Destinatari con costo più basso", ...curves.map((u) => u.label)]} rows={DECILES.map((k) => ({ key: String(k), label: `${k * 10} %`, cells: curves.map((u) => pct(u.data.january.cost.lorenz![k])) }))} />}
    </div>
    <p className={NOTE}>{`I punti sono i decimi consegnati, uniti da segmenti rettilinei: fra un punto e l’altro non ci sono altre osservazioni. Un solo mese: chi ritira a gennaio medicinali per più mesi compare fra i costi più alti.${units.some((u) => u.key === "aggregato") ? " Per l’aggregato non c’è una curva: quattro distribuzioni non formano una distribuzione." : ""}`}</p>
  </Panel>;
}

// ---------------------------------------------------------------- G1-06 to G1-08: distribution explorer
type MeasureId = "packs" | "ingredients" | "prescriptions" | "aics" | "age" | "cost";
const MEASURES: readonly { id: MeasureId; label: string; pick: (j: CExtJanuary) => CExtDist; note: string }[] = [
  { id: "packs", label: "Confezioni per destinatario", pick: (j) => j.use.packs.bins, note: "Confezioni registrate nel mese, con segno: non sono dosi né giorni di terapia." },
  { id: "ingredients", label: "Sostanze e combinazioni ATC5 per destinatario", pick: (j) => j.ingredients, note: "Codici ATC di quinto livello distinti nel mese: una combinazione può contenere più principi attivi, quindi non è un conteggio di ingredienti unici." },
  { id: "prescriptions", label: "Prescrizioni registrate per destinatario", pick: (j) => j.use.prescriptions.bins, note: "Contatti di prescrizione distinti nel flusso del mese: non sono visite né nuove terapie." },
  { id: "aics", label: "Prodotti AIC distinti per destinatario", pick: (j) => j.use.distinctAICs.bins, note: "Confezioni commerciali distinte per codice AIC: più AIC possono contenere la stessa sostanza, quindi non sono principi attivi distinti." },
  { id: "age", label: "Fasce d’età", pick: (j) => j.age, note: "Età raggiunta nel 2026, ricavata dall’anno di nascita; fasce OsMed." },
  { id: "cost", label: "Classi di costo per destinatario", pick: (j) => j.cost.bins, note: "Costo registrato nel mese: acquisto più compenso di servizio." },
];
type Mode = "share" | "count";
const MODE_OPTIONS = [{ value: "share", label: "Percentuale" }, { value: "count", label: "Destinatari" }] as const;
/** Class colours: one hue from light to dark, because the classes are ordered. */
const classColor = (k: number, n: number) => `color-mix(in srgb, var(--viz-1) ${Math.round(35 + (65 * k) / Math.max(1, n - 1))}%, hsl(var(--card)))`;

function DonutChart({ unit, dist, mode }: { unit: Unit; dist: CExtDist; mode: Mode }) {
  const total = dist.total ?? 0, cells = dist.cells.filter((c) => c.count > 0);
  const R = 70, r = 42, cx = 90, cy = 90;
  // The start angle of each class: the counts before it, as a fraction of the total (from the top, clockwise).
  const before = cells.map((_, i) => cells.slice(0, i).reduce((a, c) => a + c.count, 0));
  const arcs = cells.map((c, i) => {
    const k = dist.cells.indexOf(c), sweep = total ? (c.count / total) * Math.PI * 2 : 0, a0 = -Math.PI / 2 + (total ? (before[i] / total) * Math.PI * 2 : 0), a1 = a0 + sweep;
    const p = (rad: number, a: number) => `${cx + rad * Math.cos(a)},${cy + rad * Math.sin(a)}`;
    const large = sweep > Math.PI ? 1 : 0;
    const d = sweep >= Math.PI * 2 - 1e-9 ? `M${cx - R},${cy}a${R},${R} 0 1,0 ${2 * R},0a${R},${R} 0 1,0 ${-2 * R},0M${cx - r},${cy}a${r},${r} 0 1,1 ${2 * r},0a${r},${r} 0 1,1 ${-2 * r},0Z`
      : `M${p(R, a0)}A${R},${R} 0 ${large},1 ${p(R, a1)}L${p(r, a1)}A${r},${r} 0 ${large},0 ${p(r, a0)}Z`;
    return { c, k, d };
  });
  const value = (count: number, share: number) => mode === "count" ? `${num(count)} (${pct(share)})` : `${pct(share)} (${num(count)})`;
  return <div className="grid items-center gap-5 sm:grid-cols-[11rem_1fr]">
    <svg viewBox="0 0 180 180" className="mx-auto h-44 w-44" role="img" aria-label={`${unit.label}: ${dist.cells.map((c) => `${c.label} ${value(c.count, c.share)}`).join("; ")}`}>
      {arcs.map(({ c, k, d }) => <path key={c.id} d={d} fill={classColor(k, dist.cells.length)} stroke="hsl(var(--card))" strokeWidth={2} fillRule="evenodd"><title>{`${c.label}: ${value(c.count, c.share)}`}</title></path>)}
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize={15} fontWeight={600} fill="currentColor">{num(total)}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize={9} fill="currentColor" className="text-muted-foreground">destinatari</text>
    </svg>
    <ul className="max-w-sm space-y-2 text-xs">{dist.cells.map((c, k) => <li key={c.id} className="flex items-center justify-between gap-3"><span className="flex items-center gap-2"><span aria-hidden="true" className="inline-block h-3 w-3 rounded-sm" style={{ background: classColor(k, dist.cells.length) }} />{c.label}</span><span className="font-medium tabular-nums">{value(c.count, c.share)}</span></li>)}</ul>
  </div>;
}

/** Several organisations on one common scale: per class, one bar per organisation, value written at the end. */
function CompareBars({ units, dists, mode }: { units: Unit[]; dists: CExtDist[]; mode: Mode }) {
  const first = dists.find((d) => d.status === "released")!;
  const max = Math.max(1e-9, ...dists.flatMap((d) => d.status === "released" ? d.cells.map((c) => mode === "count" ? c.count : c.share) : []));
  return <div className="space-y-4" role="list" aria-label="Confronto fra organizzazioni sulla stessa scala">{first.cells.map((cell, k) => <div key={cell.id} role="listitem">
    <p className="mb-1.5 text-xs font-medium">{cell.label}</p>
    <div className="space-y-1">{units.map((u, i) => { const d = dists[i], c = d.status === "released" ? d.cells[k] : null, v = c ? (mode === "count" ? c.count : c.share) : 0;
      return <div key={u.key} className="grid grid-cols-[minmax(4.5rem,9rem)_1fr_auto] items-center gap-2 text-xs">
        <span className="truncate text-muted-foreground" title={u.label}>{u.label}</span>
        <span className="h-2.5 rounded-full bg-secondary"><span className="block h-2.5 rounded-full" style={{ width: `${(v / max) * 100}%`, background: colorOf(u.key) }} /></span>
        <span className="min-w-20 text-right tabular-nums">{c ? (mode === "count" ? num(c.count) : pct(c.share)) : C_RECIPIENT_STATES.suppressed}</span></div>; })}</div>
  </div>)}</div>;
}

/** One explorer for every recipient distribution of the month: measure, organisation, chart or table, share or count. */
export function PillarCDistributionExplorer({ units, initial }: { units: Unit[]; initial?: { measure?: MeasureId; unit?: string; view?: View; mode?: Mode } }) {
  const [measure, setMeasure] = useState<MeasureId>(initial?.measure ?? "packs");
  const [unitKey, setUnitKey] = useState<string>(initial?.unit ?? (units.length > 1 ? "all" : units[0]?.key ?? "all"));
  const [view, setView] = useState<View>(initial?.view ?? "chart");
  const [mode, setMode] = useState<Mode>(initial?.mode ?? "share");
  const m = MEASURES.find((x) => x.id === measure) ?? MEASURES[0];
  const selected = unitKey === "all" ? units : units.filter((u) => u.key === unitKey);
  if (!selected.length) return null;
  const dists = selected.map((u) => m.pick(u.data.january));
  const released = dists.some((d) => d.status === "released");
  const value = (c: { count: number; share: number }) => mode === "count" ? `${num(c.count)} (${pct(c.share)})` : `${pct(c.share)} (${num(c.count)})`;
  const first = dists.find((d) => d.status === "released");
  const empty = first ? first.cells.filter((_, k) => dists.every((d) => d.status !== "released" || d.cells[k].count === 0)).map((c) => c.label) : [];
  const controls = <div className="grid w-full gap-4 sm:grid-cols-2 xl:grid-cols-4">
    <label className="text-xs font-medium text-muted-foreground">Misura<select aria-label="Misura della distribuzione" className={SELECT} value={measure} onChange={(e) => setMeasure(e.target.value as MeasureId)}>{MEASURES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></label>
    <label className="text-xs font-medium text-muted-foreground">Organizzazione<select aria-label="Organizzazione della distribuzione" className={SELECT} value={unitKey} onChange={(e) => setUnitKey(e.target.value)}>{units.length > 1 && <option value="all">Confronta tutte</option>}{units.map((u) => <option key={u.key} value={u.key}>{u.label}</option>)}</select></label>
    <Choice legend="Vista" value={view} options={VIEW_OPTIONS} onChange={setView} />
    <Choice legend="Valori" value={mode} options={MODE_OPTIONS} onChange={setMode} />
  </div>;
  return <Panel title="Come si distribuiscono i destinatari · gennaio 2026" description="Scegli una misura e un’organizzazione: il grafico e la tabella mostrano gli stessi valori, in percentuale o come numero di destinatari." controls={controls}>
    <div key={`${measure}|${unitKey}|${view}|${mode}`} data-c-distribution={measure} data-c-distribution-unit={unitKey} data-c-distribution-view={view} data-c-distribution-mode={mode}>
      <p className="mb-4 text-sm font-medium">{m.label}</p>
      {!released ? <Empty>{`La distribuzione non è mostrata: ${C_RECIPIENT_STATES.suppressed}. Nessun valore viene sostituito.`}</Empty>
        : view === "table" ? <Table caption={`${m.label}: destinatari per classe`} headers={["Classe", ...selected.map((u) => u.label)]} rows={first!.cells.map((cell, k) => ({ key: cell.id, label: cell.label, cells: dists.map((d) => d.status === "released" ? value(d.cells[k]) : C_RECIPIENT_STATES.suppressed) }))} />
        : selected.length === 1 ? <DonutChart unit={selected[0]} dist={dists[0]} mode={mode} />
        : <CompareBars units={selected} dists={dists} mode={mode} />}
      <p className="mt-4 text-xs leading-5 text-muted-foreground">{`Denominatore: ${selected.map((u, i) => `${u.label} ${dists[i].total === null ? C_RECIPIENT_STATES.suppressed : `${num(dists[i].total!)} destinatari`}`).join(" · ")}. Gennaio 2026, DPC.${empty.length ? ` Nessun destinatario nelle classi: ${empty.join(", ")}.` : ""}`}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{m.note}</p>
    </div>
  </Panel>;
}

// ---------------------------------------------------------------- G1-09: typical use and spread
const USE = [["packs", "Confezioni"], ["prescriptions", "Prescrizioni registrate"], ["distinctAICs", "Prodotti AIC distinti"]] as const;
/** A median marker on the interval of the central half, on one axis per measure. No whisker: no minimum or maximum. */
function IntervalRows({ rows, max, format, tick = (v: number) => num(v), legend = true }: { rows: { key: string; label: string; unit: string; q1: number; median: number; q3: number }[]; max: number; format: (v: number) => string; tick?: (v: number) => string; legend?: boolean }) {
  const at = (v: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
  // Ticks on round values: every unit up to 6, every 2 up to 12, then about five steps.
  const step = max <= 6 ? 1 : max <= 12 ? 2 : Math.ceil(max / 5);
  const ticks = Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step);
  return <div>
    {legend && <p className="mb-2 flex flex-wrap gap-4 text-[11px] text-muted-foreground" aria-hidden="true"><span className="flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-full bg-foreground" />mediana</span><span className="flex items-center gap-1.5"><span className="inline-block h-2 w-5 rounded-full bg-foreground/40" />metà centrale (1° – 3° quartile)</span></p>}
    <div className="space-y-2">{rows.map((r) => <div key={r.key} className="grid grid-cols-[minmax(4.5rem,9rem)_1fr_auto] items-center gap-3 text-xs">
      <span className="truncate text-muted-foreground" title={r.label}>{r.label}</span>
      <span className="relative h-6 rounded bg-secondary/60" aria-hidden="true">
        <span className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-full" style={{ left: at(r.q1), width: `calc(${at(r.q3)} - ${at(r.q1)})`, minWidth: "2px", background: colorOf(r.unit), opacity: 0.45 }} />
        <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card" style={{ left: at(r.median), background: colorOf(r.unit) }} />
      </span>
      <span className="min-w-28 text-right tabular-nums">{`${format(r.median)} · ${format(r.q1)} – ${format(r.q3)}`}</span></div>)}</div>
    <div className="mt-1 grid grid-cols-[minmax(4.5rem,9rem)_1fr_auto] gap-3 text-[10px] text-muted-foreground" aria-hidden="true"><span /><span className="relative h-4">{ticks.map((t) => <span key={t} className="absolute -translate-x-1/2" style={{ left: at(t) }}>{tick(t)}</span>)}</span><span className="min-w-28" /></div>
  </div>;
}
export function PillarCTypicalUse({ units, initialView = "chart" }: { units: Unit[]; initialView?: View }) {
  const asl = units.filter((u) => u.key !== "aggregato");
  const [view, setView] = useState<View>(initialView);
  if (!asl.length || !asl.every((u) => USE.every(([k]) => u.data.january.use[k].quartiles))) return asl.length ? <Empty>{`Mediane e quartili di utilizzo: ${C_RECIPIENT_STATES.unavailable}.`}</Empty> : null;
  const one = (v: number) => num(v, 1);
  return <Panel title="Quante confezioni, prescrizioni e prodotti riceve di solito un destinatario?" description="Il punto è la mediana, il valore centrale: più destinatari possono avere lo stesso valore. La barra va dal primo al terzo quartile e comprende almeno la metà centrale dei destinatari." controls={<Choice legend="Vista" value={view} options={VIEW_OPTIONS} onChange={setView} />}>
    <div key={view} data-c-typical-use={view}>
      {view === "chart" ? <div className="grid gap-6 lg:grid-cols-3">{USE.map(([k, label], i) => {
        const rows = asl.map((u) => { const q = u.data.january.use[k].quartiles!; return { key: u.key, label: u.label, unit: u.key, ...q }; });
        const max = Math.max(1, Math.ceil(Math.max(...rows.map((r) => r.q3)) + 1));
        return <div key={k} role="group" aria-label={`${label} per destinatario: ${rows.map((r) => `${r.label} mediana ${one(r.median)}, metà centrale ${one(r.q1)} – ${one(r.q3)}`).join("; ")}`}><p className="mb-2 text-xs font-semibold">{label}</p><IntervalRows rows={rows} max={max} format={one} legend={i === 0} /></div>;
      })}</div>
        : <Table caption="Mediane e metà centrale dell’utilizzo per destinatario" headers={["Misura", ...asl.map((u) => u.label)]} rows={USE.flatMap(([k, label]) => [
          { key: `${k}-median`, label: `${label}, mediana`, cells: asl.map((u) => one(u.data.january.use[k].quartiles!.median)) },
          { key: `${k}-iqr`, label: `${label}, metà centrale (1° – 3° quartile)`, cells: asl.map((u) => { const q = u.data.january.use[k].quartiles!; return `${one(q.q1)} – ${one(q.q3)}`; }) },
        ])} />}
    </div>
    <p className={NOTE}>{`Non è un box plot completo: minimi, massimi e valori estremi non sono nei dati consegnati e non vengono disegnati. Dove la barra si riduce a un punto, la metà centrale dei destinatari riceve lo stesso numero.${units.some((u) => u.key === "aggregato") ? " Per l’aggregato non ci sono mediane né quartili: quelli delle singole ASL non si sommano." : ""}`}</p>
  </Panel>;
}

// ---------------------------------------------------------------- G1-10: services and recorded intervals
type ServiceId = "serviceShare" | "servicePerPack" | "under10Packs" | "under10Service";
const SERVICE: readonly { id: ServiceId; label: string; all: boolean; format: (v: number) => string }[] = [
  { id: "serviceShare", label: "Quota del compenso di servizio sul costo", all: true, format: (v) => pct(v) },
  { id: "servicePerPack", label: "Compenso di servizio per confezione", all: true, format: eur2 },
  { id: "under10Packs", label: "Confezioni sotto 10 € di acquisto", all: false, format: (v) => pct(v) },
  { id: "under10Service", label: "Quota del servizio sul costo di quelle confezioni", all: false, format: (v) => pct(v) },
];
/** Service-cost burden: the measures that hold for the aggregate (shares of sums) and those of each ASL, apart. */
export function PillarCServiceBurden({ units }: { units: Unit[] }) {
  const [measure, setMeasure] = useState<ServiceId>("serviceShare");
  const m = SERVICE.find((s) => s.id === measure) ?? SERVICE[0];
  const shown = units.filter((u) => m.all || u.key !== "aggregato");
  const values = shown.map((u) => u.data.january.services[m.id]);
  const max = Math.max(1e-9, ...values.map((v) => v ?? 0));
  const asl = units.filter((u) => u.key !== "aggregato");
  const controls = <label className="min-w-56 text-xs font-medium text-muted-foreground">Misura<select aria-label="Misura del servizio di distribuzione" className={SELECT} value={measure} onChange={(e) => setMeasure(e.target.value as ServiceId)}>{SERVICE.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>;
  return <Panel title="Quanto pesa il servizio di distribuzione sul costo? · gennaio 2026" description="Compenso della distribuzione per conto su tutte le righe del flusso. Una quota alta riguarda soprattutto le confezioni a basso prezzo: è un tema di scelta del canale, non una misura di inefficienza." controls={controls}>
    <div key={measure} data-c-service={measure} className="space-y-2" role="list" aria-label={m.label}>{shown.map((u, i) => <div key={u.key} role="listitem" className="grid grid-cols-[minmax(4.5rem,9rem)_1fr_auto] items-center gap-3 text-xs">
      <span className="truncate text-muted-foreground" title={u.label}>{u.label}</span>
      <span className="h-2.5 rounded-full bg-secondary"><span className="block h-2.5 rounded-full" style={{ width: `${((values[i] ?? 0) / max) * 100}%`, background: colorOf(u.key) }} /></span>
      <span className="min-w-20 text-right tabular-nums">{values[i] === null ? C_RECIPIENT_STATES.unavailable : m.format(values[i]!)}</span></div>)}</div>
    {!m.all && units.some((u) => u.key === "aggregato") && <p className={NOTE}>Misura calcolata dentro ciascuna ASL: per l’aggregato non c’è un valore.</p>}
    <details className="mt-5 rounded-xl border border-border"><summary className="cursor-pointer rounded-xl px-4 py-3.5 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">Valori esatti del servizio</summary><div className="space-y-4 p-4">
      <Table caption="Servizio di distribuzione: misure valide anche per l’aggregato" headers={["Misura", ...units.map((u) => u.label)]} rows={SERVICE.filter((s) => s.all).map((s) => ({ key: s.id, label: s.label, cells: units.map((u) => { const v = u.data.january.services[s.id]; return v === null ? C_RECIPIENT_STATES.unavailable : s.format(v); }) }))} />
      {asl.length > 0 && <Table caption="Servizio di distribuzione: misure delle singole ASL" headers={["Misura", ...asl.map((u) => u.label)]} rows={SERVICE.filter((s) => !s.all).map((s) => ({ key: s.id, label: s.label, cells: asl.map((u) => { const v = u.data.january.services[s.id]; return v === null ? C_RECIPIENT_STATES.unavailable : s.format(v); }) }))} />}
    </div></details>
  </Panel>;
}

/** The pharmacy fee per pack across each ASL's pharmacies, and the cost share of the 10 % of pharmacies with the
 * highest cost. Per ASL only; no pharmacy is named. */
export function PillarCPharmacyFees({ units, initialView = "chart" }: { units: Unit[]; initialView?: View }) {
  const asl = units.filter((u) => u.key !== "aggregato" && u.data.january.services.pharmacyFeeMedian !== null);
  const [view, setView] = useState<View>(initialView);
  if (!asl.length) return null;
  const s = (u: Unit) => u.data.january.services;
  const rows = asl.map((u) => ({ key: u.key, label: u.label, unit: u.key, q1: s(u).pharmacyFeeQ1!, median: s(u).pharmacyFeeMedian!, q3: s(u).pharmacyFeeQ3! }));
  const max = Math.max(1, Math.ceil(Math.max(...rows.map((r) => r.q3)) + 1));
  return <Panel title="Quanto varia il compenso per confezione fra le farmacie?" description="Per ogni ASL, il compenso di servizio per confezione calcolato farmacia per farmacia: il punto è la farmacia mediana, la barra la metà centrale delle farmacie. Nessuna farmacia è indicata." controls={<Choice legend="Vista" value={view} options={VIEW_OPTIONS} onChange={setView} />}>
    <div key={view} data-c-pharmacy={view}>
      {view === "chart" ? <div role="group" aria-label={`Compenso per confezione fra le farmacie: ${rows.map((r) => `${r.label} mediana ${eur2(r.median)}, metà centrale ${eur2(r.q1)} – ${eur2(r.q3)}`).join("; ")}`}><IntervalRows rows={rows} max={max} format={eur2} tick={eur0} /></div>
        : <Table caption="Compenso fra le farmacie" headers={["Misura", ...asl.map((u) => u.label)]} rows={[
          { key: "pharmacies", label: "Farmacie che erogano", cells: asl.map((u) => s(u).pharmacies === null ? C_RECIPIENT_STATES.unavailable : num(s(u).pharmacies!)) },
          { key: "median", label: "Compenso per confezione, farmacia mediana", cells: asl.map((u) => eur2(s(u).pharmacyFeeMedian!)) },
          { key: "iqr", label: "Metà centrale delle farmacie (1° – 3° quartile)", cells: asl.map((u) => `${eur2(s(u).pharmacyFeeQ1!)} – ${eur2(s(u).pharmacyFeeQ3!)}`) },
          { key: "top10", label: "Quota del costo del 10 % di farmacie con costo maggiore", cells: asl.map((u) => s(u).pharmacyTop10 === null ? C_RECIPIENT_STATES.unavailable : pct(s(u).pharmacyTop10!)) },
        ]} />}
    </div>
    <p className={NOTE}>Differenze fra farmacie riflettono anche il mix di confezioni e gli accordi di distribuzione: non sono una misura di efficienza della singola farmacia.</p>
  </Panel>;
}

/** Recorded days between prescription and dispensing: date differences in the flow, not waiting times. Per ASL only. */
export function PillarCDispensingIntervals({ units, initialView = "chart" }: { units: Unit[]; initialView?: View }) {
  const asl = units.filter((u) => u.key !== "aggregato" && u.data.january.services.intervalMedian !== null);
  const [view, setView] = useState<View>(initialView);
  if (!asl.length) return null;
  const s = (u: Unit) => u.data.january.services;
  const rows = asl.map((u) => ({ key: u.key, label: u.label, unit: u.key, q1: s(u).intervalQ1!, median: s(u).intervalMedian!, q3: s(u).intervalQ3! }));
  const max = Math.max(7, Math.ceil(Math.max(...rows.map((r) => r.q3)) + 1));
  const days = (v: number) => num(v);
  return <Panel title="Quanti giorni passano, nei dati registrati, fra prescrizione ed erogazione?" description="Differenza fra la data di prescrizione e quella di erogazione registrate sui contatti ammissibili. Non è un tempo di attesa clinico: la data di ritiro dipende anche da quando la persona si presenta." controls={<Choice legend="Vista" value={view} options={VIEW_OPTIONS} onChange={setView} />}>
    <div key={view} data-c-intervals={view}>
      {view === "chart" ? <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div role="group" aria-label={`Giorni fra prescrizione ed erogazione: ${rows.map((r) => `${r.label} mediana ${days(r.median)}, metà centrale ${days(r.q1)} – ${days(r.q3)}`).join("; ")}`}><p className="mb-2 text-xs font-semibold">Giorni: mediana e metà centrale dei contatti</p><IntervalRows rows={rows} max={max} format={days} /></div>
        <div className="space-y-3"><p className="text-xs font-semibold">Quota dei contatti</p>{asl.map((u) => <div key={u.key} className="text-xs"><p className="mb-1 text-muted-foreground">{u.label}</p>
          {[["Stesso giorno", s(u).sameDay], ["Entro 7 giorni", s(u).within7]].map(([label, v]) => <div key={label as string} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-2"><span>{label}</span><span className="h-2 rounded-full bg-secondary"><span className="block h-2 rounded-full" style={{ width: `${((v as number | null) ?? 0) * 100}%`, background: colorOf(u.key) }} /></span><span className="min-w-14 text-right tabular-nums">{v === null ? C_RECIPIENT_STATES.unavailable : pct(v as number)}</span></div>)}</div>)}</div>
      </div> : <Table caption="Giorni fra prescrizione ed erogazione" headers={["Misura", ...asl.map((u) => u.label)]} rows={[
        { key: "median", label: "Giorni, mediana", cells: asl.map((u) => days(s(u).intervalMedian!)) },
        { key: "iqr", label: "Giorni, metà centrale (1° – 3° quartile)", cells: asl.map((u) => `${days(s(u).intervalQ1!)} – ${days(s(u).intervalQ3!)}`) },
        { key: "sameDay", label: "Prescrizione ed erogazione nello stesso giorno", cells: asl.map((u) => s(u).sameDay === null ? C_RECIPIENT_STATES.unavailable : pct(s(u).sameDay!)) },
        { key: "within7", label: "Erogato entro 7 giorni", cells: asl.map((u) => s(u).within7 === null ? C_RECIPIENT_STATES.unavailable : pct(s(u).within7!)) },
      ]} />}
    </div>
    <p className={NOTE}>{`Calcolato dentro ciascuna ASL${units.some((u) => u.key === "aggregato") ? ": per l’aggregato non ci sono mediane né quartili" : ""}. Nessuna persona né farmacia è indicata.`}</p>
  </Panel>;
}


