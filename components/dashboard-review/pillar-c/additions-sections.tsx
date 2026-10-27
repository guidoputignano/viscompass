"use client";

/** Pillar C additions (build add-v1, owner decision D24-4 of 24 Oct 2026), shared by the reviewer and the
 * organisation-scoped workspaces:
 *   - P8-03, section 2: where the eligible January 2026 DPC recipients reside, one column per unit;
 *   - P10-04, section 3: the spend narrowed to one candidate area by a consistent exemption, and the spend by the
 *     exemption class of the line, one unit at a time;
 *   - P10-05, section 3, beside the File F blocks: the File F 2025 rows of one Azienda by the fields that can help
 *     attribution.
 * They read the units they are given, already checked for the audience (cAdditionsFor) and labelled by the server, and
 * import nothing reviewer-only (tests/pillar-c-scoped-client-graph.test.mjs). Delivery disclosure rules: a hidden P10-04
 * cell is the uniform «dato oscurato» and is never computed from any other value; no euro amount and no value per
 * recipient in P10-04; no ranking, no difference between units, no sentence that spans units, and P8-03 and P10-04 are
 * never crossed. Tables only, no bar: every value is text. A change of unit replaces the keyed block whole, so a page
 * translated by the browser never keeps a stale value (AGENTS.md). */
import { useState } from "react";
import { itNumber } from "@/lib/format/it-number";
import { cMoneyLabel } from "@/lib/dashboard-review/pillar-c/review";
import { CReviewPanel as Panel } from "@/components/dashboard-review/pillar-c/review-blocks";
import { PillarCSectionEmpty } from "@/components/dashboard-review/pillar-c/section-frame";
import {
  C_ADD_AREAS, C_ADD_AREA_LABELS, C_ADD_CLASSES, C_ADD_CLASS_LABELS, C_ADD_COPY, C_ADD_FILEF_CATEGORIES, C_ADD_FILEF_LABELS, C_ADD_HIDDEN_LABEL, C_ADD_RESIDENCE,
  C_ADD_RESIDENCE_LABELS, cAddIsHidden, type CAdditionsView,
} from "@/lib/dashboard-review/pillar-c/additions";

type Unit = CAdditionsView["units"][number];
const num = (v: number) => itNumber(v, { maximumFractionDigits: 0 });
const pct = (v: number, digits: number) => `${itNumber(v * 100, { minimumFractionDigits: digits, maximumFractionDigits: digits })}\u00a0%`;
const th = "whitespace-nowrap border-b border-border px-2 py-3 text-right align-bottom font-semibold first:text-left";
const thRow = "border-b border-border/50 px-2 py-2.5 text-left font-medium";
const td = "whitespace-nowrap border-b border-border/50 px-2 py-2.5 text-right tabular-nums";
const tdHidden = "whitespace-nowrap border-b border-border/50 px-2 py-2.5 text-right italic text-muted-foreground";
const SELECT = "mt-2 h-11 w-full min-w-0 rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";
const NOTE = "mt-4 text-xs leading-5 text-muted-foreground";
const hasAggregate = (units: readonly Unit[]) => units.some((u) => u.key === "aggregato");

/** A table of text values: a header row, then one row per entry with its label as the row header. */
function Table({ caption, headers, rows, minWidth = "min-w-[34rem]" }: { caption: string; headers: readonly string[]; rows: { key: string; label: string; cells: { key: string; text: string; hidden?: boolean }[] }[]; minWidth?: string }) {
  return <div className="mt-4 overflow-x-auto"><table className={`w-full ${minWidth} text-xs`}><caption className="sr-only">{caption}</caption>
    <thead><tr>{headers.map((h) => <th key={h} scope="col" className={th}>{h}</th>)}</tr></thead>
    <tbody>{rows.map((r) => <tr key={r.key}><th scope="row" className={thRow}>{r.label}</th>{r.cells.map((c) => c.hidden
      ? <td key={c.key} className={tdHidden} data-c-hidden="true">{C_ADD_HIDDEN_LABEL}</td>
      : <td key={c.key} className={td}>{c.text}</td>)}</tr>)}</tbody></table></div>;
}

/** The DPC view (P8-03): the ASL of reference, beside the January assistiti. One column per unit the audience reads, in
 * its fixed order. */
export function PillarCAdditionsResidence({ view, unavailable = false }: { view: CAdditionsView | null; unavailable?: boolean }) {
  if (!view) return unavailable ? <PillarCSectionEmpty>{C_ADD_COPY.residenceUnavailable}</PillarCSectionEmpty> : null;
  const units = view.units;
  const rows = [
    { key: "eligible", label: "Assistiti con erogazioni DPC", cells: units.map((u) => ({ key: u.key, text: num(u.entry.residence.eligible) })) },
    ...C_ADD_RESIDENCE.map((k) => ({ key: k, label: C_ADD_RESIDENCE_LABELS[k], cells: units.map((u) => ({ key: u.key, text: `${num(u.entry.residence[k].count)} (${pct(u.entry.residence[k].share, 1)})` })) })),
  ];
  return <Panel title={C_ADD_COPY.residenceTitle} description={hasAggregate(units) ? `${C_ADD_COPY.residenceLead} ${C_ADD_COPY.residenceAggregate}` : C_ADD_COPY.residenceLead}>
    <div data-c-additions="residence"><Table caption="ASL di riferimento degli assistiti DPC" headers={["ASL di riferimento", ...units.map((u) => u.label)]} rows={rows} /></div>
  </Panel>;
}

/** Section 3 (P10-04): one unit at a time, chosen among the audience's units; the hidden cells stay hidden. */
export function PillarCAdditionsNarrowing({ view, unavailable = false }: { view: CAdditionsView | null; unavailable?: boolean }) {
  const [selected, setSelected] = useState("");
  if (!view) return unavailable ? <PillarCSectionEmpty>{C_ADD_COPY.narrowingUnavailable}</PillarCSectionEmpty> : null;
  const unit = view.units.find((u) => u.key === selected) ?? view.units[0];
  if (!unit) return null;
  const n = unit.entry.narrowing, total = n.narrowed.total;
  const hidden = C_ADD_AREAS.some((a) => cAddIsHidden(n.narrowed.byArea[a]));
  const areas = C_ADD_AREAS.map((a) => {
    const cell = n.narrowed.byArea[a];
    return { key: a, label: C_ADD_AREA_LABELS[a], cells: cAddIsHidden(cell)
      ? ["recipients", "narrowed", "eligible"].map((key) => ({ key, text: "", hidden: true }))
      : [{ key: "recipients", text: num(cell.recipients) }, { key: "narrowed", text: pct(cell.shareOfNarrowedSpend, 2) }, { key: "eligible", text: pct(cell.shareOfEligibleSpend, 2) }] };
  });
  const classes = C_ADD_CLASSES.map((k) => ({ key: k, label: C_ADD_CLASS_LABELS[k], cells: [{ key: "recipients", text: num(n.lineClasses[k].recipients) }, { key: "eligible", text: pct(n.lineClasses[k].shareOfEligibleSpend, 2) }] }));
  const controls = view.units.length > 1
    ? <label className="min-w-40 text-xs font-medium text-muted-foreground">Unità<select aria-label="Unità delle aree delle esenzioni" className={SELECT} value={unit.key} onChange={(e) => setSelected(e.target.value)}>{view.units.map((u) => <option key={u.key} value={u.key}>{u.label}</option>)}</select></label>
    : undefined;
  return <Panel title={C_ADD_COPY.narrowingTitle} description={hasAggregate(view.units) ? `${C_ADD_COPY.narrowingLead} ${C_ADD_COPY.narrowingAggregate}` : C_ADD_COPY.narrowingLead} controls={controls}>
    <div key={unit.key} data-c-additions="narrowing" data-c-unit={unit.key}>
      <p className="text-sm leading-6">{`${unit.label}: ${num(total.recipients)} dei ${num(n.eligibleRecipients)} assistiti con erogazioni DPC hanno almeno una riga ristretta a un’area; quella spesa è il ${pct(total.shareOfEligibleSpend, 2)} della loro spesa.`}</p>
      <Table caption={`Spesa ristretta per area candidata · ${unit.label}`} headers={["Area candidata", "Assistiti", "Quota della spesa ristretta", "Quota della spesa ammissibile"]} rows={areas} />
      {hidden && <p className={NOTE} data-c-hidden-note="true">{C_ADD_COPY.hiddenNote}</p>}
      <Table caption={`Spesa per classe di esenzione della riga · ${unit.label}`} headers={["Classe di esenzione della riga", "Assistiti", "Quota della spesa ammissibile"]} rows={classes} />
      <p className={NOTE}>{C_ADD_COPY.classesNote}</p>
    </div>
  </Panel>;
}

/** Section 3 (P10-05), beside the File F blocks: only for an audience that holds the File F unit. */
export function PillarCAdditionsFileF({ view, unavailable = false }: { view: CAdditionsView | null; unavailable?: boolean }) {
  const holder = view?.units.find((u) => u.entry.fileFFields);
  const f = holder?.entry.fileFFields;
  if (!holder || !f) return unavailable && !view ? <PillarCSectionEmpty>{C_ADD_COPY.fileFUnavailable}</PillarCSectionEmpty> : null;
  const rows = C_ADD_FILEF_CATEGORIES.map((k) => {
    const c = f.categories[k];
    return { key: k, label: C_ADD_FILEF_LABELS[k], cells: [{ key: "rows", text: num(c.rows) }, { key: "rowShare", text: pct(c.rowShare, 2) }, { key: "amount", text: cMoneyLabel(c.amountEUR) }, { key: "amountShare", text: pct(c.amountShare, 2) }] };
  });
  return <Panel title={`File F 2025 · ${holder.label}: campi utili all’attribuzione`} description={C_ADD_COPY.fileFLead}>
    <div data-c-additions="filef-fields"><Table caption={`Righe del File F 2025 per campo utile all’attribuzione · ${holder.label}`} headers={["Campo e valore", "Righe", "Quota delle righe", "Importo riportato", "Quota dell’importo"]} rows={rows} minWidth="min-w-[40rem]" /></div>
    <p className={NOTE}>{C_ADD_COPY.fileFNote}</p>
  </Panel>;
}
