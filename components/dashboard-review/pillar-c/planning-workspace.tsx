"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Copy, Download, GitBranch, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { cAttrEntries } from "@/lib/dashboard-review/pillar-c/attribution-format";
import { C_PERIOD_LABELS } from "@/lib/dashboard-review/pillar-c/review";
import type { CClientAudience } from "@/lib/dashboard-review/pillar-c/audience-rules";
import { C_AUDIENCE_COPY, cAudienceActVocabulary, cAudienceLabel, cAudiencePlanningFilters, isCScopedClientAudience } from "@/lib/dashboard-review/pillar-c/audience-view";
import { usePillarCAudience } from "@/components/dashboard-review/pillar-c/audience-context";
import { itNumber } from "@/lib/format/it-number";
import { C_PLANNING_BPS_MAX, C_PLANNING_BPS_MIN, C_PLANNING_LABELS as L, C_PLANNING_MAX_GROUP, C_PLANNING_MAX_VARIANTS, C_PLANNING_PARAMS, C_PLANNING_READING, C_PLANNING_RULE_NOTES, C_PLANNING_RULES, C_PLANNING_SHARE_MAX, cPlanningAccept, cPlanningBpsToPercent, cPlanningCompare, cPlanningExport, cPlanningExportName, cPlanningFilters, cPlanningKnownIds, cPlanningMoney, cPlanningNumber, cPlanningOutside, cPlanningPartialText, cPlanningPercentLabel, cPlanningPercentToBps, cPlanningRegroup, cPlanningSearch, cPlanningShareText, cPlanningSplitStatus, cPlanningWorkspace, type CPlanningAmount, type CPlanningCrossingSet, type CPlanningPlan, type CPlanningRanking, type CPlanningResult, type CPlanningRule, type CPlanningSplit, type CPlanningSplitBand, type CPlanningState, type CPlanningVariant, type CPlanningVariantResult, type CPlanningView } from "@/lib/dashboard-review/pillar-c/planning";

/** The fetched view of one scope key (period|org|channel), or why there is none. Rendered only under that same key. */
export type CPlanningLoad = { key: string; view: CPlanningView } | { key: string; error: "forbidden" | "unavailable" } | null;
type Mode = "push" | "replace";
type Names = (id: string) => string;
type Focus = "group" | "variant" | "added" | null;
type Outcome = { status: "ready"; r: CPlanningResult; matched: CPlanningResult | null } | { status: "unknown" | "failed" };
type Bar = { key: string; label: string; detail?: string; lower: CPlanningAmount; upper: CPlanningAmount; dot: CPlanningAmount | null; band: CPlanningSplitBand | null; strong?: boolean };

const card = "min-w-0 rounded-2xl border border-border bg-card p-4 shadow-sm md:p-6";
const field = "mt-1.5 h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-primary aria-[invalid=true]:border-destructive";
const action = "inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-medium hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-40";
const chip = "inline-flex max-w-full rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium leading-4 text-primary";
const amber = "rounded-xl border border-[#8a5a12]/40 bg-[#d89b38]/10";
const note = "text-xs leading-5 text-muted-foreground";
const small = "text-[11px] leading-4 text-muted-foreground";
const link = "inline-flex min-h-11 items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-primary";
const summary = "cursor-pointer rounded-xl px-4 py-3 text-xs font-medium focus-visible:outline-2 focus-visible:outline-primary";
const heading = "text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary";
const pointer = "inline-flex min-h-8 items-center text-[11px] font-medium leading-4 text-primary underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-primary";
const cleanLabel = (label: string) => label.replace(/\s*\([^)]*\)\s*$/, "");
const money = (v: CPlanningAmount) => cPlanningMoney(v);
const signed = (v: CPlanningAmount) => { const t = cPlanningMoney(v); return t.startsWith("-") || t === "0 €" ? t : `+${t}`; };
const range = (lower: CPlanningAmount, upper: CPlanningAmount) => cPlanningCompare(lower, upper) === 0 ? money(lower) : `${money(lower)} – ${money(upper)}`;
const channelName = (c: string) => c === "Tutti" ? "Tutti i canali" : c;
function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "application/json;charset=utf-8" })), anchor = document.createElement("a");
  anchor.href = url; anchor.download = name; document.body.appendChild(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
/** Changing text is replaced whole under a new key, never patched, so Chrome's page translation cannot leave it stale. */
function Live({ children, className }: { children: string; className?: string }) { return <span key={children} className={className}>{children}</span>; }

/** R1. Next applies a history update to useSearchParams inside a transition, so the address a render shows can lag behind the one
 * just written: a tap whose blur commits a typed value and whose click lands in the same task would otherwise build on the shown
 * address and drop that value. The tracker holds the addresses this panel wrote, newest last, until the page renders them, and
 * every change builds on `current()`. It also gives each declared variant a key that follows it across a removal (R6), so a
 * card's own draft never passes to another variant. */
export type CPlanningAddressChange = { remove?: number; add?: boolean };
export type CPlanningAddress = { current(): string; keys(search: string): string[]; write(next: string, change?: CPlanningAddressChange): void; rendered(search: string): void };
export function cPlanningAddress(initial: string): CPlanningAddress {
  type Entry = { search: string; keys: string[] };
  const bare = (s: string) => s.replace(/^\?/, ""), count = (s: string) => cPlanningFilters(s).state.variants.length;
  let made = 0; const fresh = () => `v${++made}`;
  // An address this panel did not write (another section, the back button): keys derived from it, so every render agrees on them.
  const foreign = (s: string): Entry => ({ search: s, keys: Array.from({ length: count(s) }, (_, i) => `${s}#${i}`) });
  let shown: Entry = { search: bare(initial), keys: Array.from({ length: count(initial) }, fresh) }, pending: Entry[] = [];
  const top = () => pending[pending.length - 1] ?? shown, find = (s: string) => [...pending].reverse().find(e => e.search === s) ?? (shown.search === s ? shown : null);
  return {
    current: () => top().search,
    keys: search => (find(bare(search)) ?? foreign(bare(search))).keys,
    write(next, change = {}) {
      const s = bare(next), n = count(s), keys = [...top().keys]; if (change.remove !== undefined) keys.splice(change.remove, 1); if (change.add) keys.push(fresh());
      pending.push({ search: s, keys: [...keys.slice(0, n), ...Array.from({ length: Math.max(0, n - keys.length) }, fresh)] });
    },
    rendered(search) { const s = bare(search), i = pending.findIndex(e => e.search === s); if (i >= 0) { shown = pending[i]; pending = pending.slice(i + 1); } else if (s !== shown.search) { shown = foreign(s); pending = []; } },
  };
}
/** The address after one change of the plan that `address` holds: only c_plan_* keys change (cPlanningSearch). */
export function cPlanningNext(address: string, change: (plan: CPlanningPlan) => CPlanningPlan): string {
  const { ids, variants, rule, shares } = cPlanningFilters(address).state; return cPlanningSearch(address, change({ ids, variants, rule, shares }));
}

/** Percent field steps: typing only edits the draft; a blur or Enter commits a valid value (normalised) or flags an invalid one,
 * so a transient «12,» or «-» is never flagged while the reader types. `commit` is present only when the value changes. */
export type CPlanningField = { draft: string; error: boolean };
export function cPlanningFieldStep(f: CPlanningField, event: { type: "type"; text: string } | { type: "commit" }, value: number | null, { min, max, optional }: { min: number; max: number; optional: boolean }): CPlanningField & { commit?: number | null } {
  if (event.type === "type") return { draft: event.text, error: false };
  if (f.draft.trim() === "") return !optional ? { draft: f.draft, error: true } : value === null ? { draft: "", error: false } : { draft: "", error: false, commit: null };
  let bps: number; try { bps = cPlanningPercentToBps(f.draft, min, max); } catch { return { draft: f.draft, error: true }; }
  return bps === value ? { draft: cPlanningBpsToPercent(bps), error: false } : { draft: cPlanningBpsToPercent(bps), error: false, commit: bps };
}
/** Focus after a structural change: the first candidate that can take it (still in the page, not disabled), else nothing. */
export function cPlanningFocusFirst(candidates: readonly (HTMLElement | null | undefined)[]): HTMLElement | null {
  for (const el of candidates) if (el && el.isConnected && !(el as HTMLButtonElement).disabled) { el.focus(); return el; }
  return null;
}

/** Every modelled number is printed with the assumption that produced it, resolved (the S3 percentage in force included). */
function assumptionText(v: CPlanningVariantResult, names: Names) {
  const a = v.assumption, ids = Object.keys(a.fixedBps), own = ids.filter(id => a.fixedBps[id] !== a.bps);
  return [...(own.length < ids.length ? [`${L.variants.fixedPart}: ${cPlanningPercentLabel(a.bps)}`] : []), ...own.map(id => `${names(id)}: ${cPlanningPercentLabel(a.fixedBps[id])}`), `${L.variants.sharedPart}: ${cPlanningPercentLabel(a.sharedBps)}`].join(" · ");
}
/** A declared split is a single value only when every crossing entry is covered; otherwise it is still an interval. */
const bandValue = (b: CPlanningSplitBand) => b.complete ? money(b.lower) : range(b.lower, b.upper);
const bandNotes = (b: CPlanningSplitBand): string[] => b.complete ? [L.split.point]
  : [`${L.split.partial} · ${cAttrEntries(b.uncovered.entries)} ${b.uncovered.entries === 1 ? L.split.uncoveredOne : L.split.uncoveredMany}`, `${L.split.covered}: ${cAttrEntries(b.covered.entries)}`];

/** Percent input: the draft text is the reader's, the committed value is the URL's. Help and error sit outside the label and
 * describe the input; only a blur or Enter commits (cPlanningFieldStep). */
/** The rendered value lags behind a commit (URL updates run in a transition). A value this field committed itself only
 * acknowledges that commit and never replaces what is being typed; any other value comes from outside and replaces the draft. */
export function cPlanningFieldSync(pending: readonly (number | null)[], value: number | null): { pending: (number | null)[]; replace: boolean } {
  const i = pending.indexOf(value);
  return i >= 0 ? { pending: pending.slice(i + 1), replace: false } : { pending: [], replace: true };
}
function PercentField({ label, help, helpId, error, value, min, max, optional = false, context, inputRef, onCommit }: { label: string; help?: string; helpId?: string; error: string; value: number | null; min: number; max: number; optional?: boolean; context?: string; inputRef?: (el: HTMLInputElement | null) => void; onCommit: (bps: number | null) => void }) {
  const id = useId(), text = (v: number | null) => v === null ? "" : cPlanningBpsToPercent(v);
  const [f, setF] = useState<CPlanningField>(() => ({ draft: text(value), error: false })), [seen, setSeen] = useState(value), [pending, setPending] = useState<(number | null)[]>([]);
  if (seen !== value) { const sync = cPlanningFieldSync(pending, value); setSeen(value); setPending(sync.pending); if (sync.replace) setF({ draft: text(value), error: false }); }
  // Compare a new commit with this field's latest commit, not with a value the page has not rendered yet.
  const base = pending.length ? pending[pending.length - 1] : value;
  const step = (event: { type: "type"; text: string } | { type: "commit" }) => { const next = cPlanningFieldStep(f, event, base, { min, max, optional }); setF({ draft: next.draft, error: next.error }); if ("commit" in next) { const bps = next.commit ?? null; setPending(p => [...p, bps]); onCommit(bps); } };
  const described = [help ? `${id}-help` : helpId ?? "", f.error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
  return <div className="min-w-0 text-xs">
    <label htmlFor={id} className="block font-medium"><Live>{label}</Live>{context ? <Live className="sr-only">{` · ${context}`}</Live> : null}</label>
    <input className={field} id={id} ref={inputRef} inputMode="decimal" autoComplete="off" spellCheck={false} value={f.draft} aria-invalid={f.error} aria-describedby={described} aria-errormessage={f.error ? `${id}-error` : undefined}
      onChange={e => step({ type: "type", text: e.target.value })} onBlur={() => step({ type: "commit" })} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); step({ type: "commit" }); } }}/>
    {help ? <p id={`${id}-help`} className="mt-1 leading-5 text-muted-foreground"><Live>{help}</Live></p> : null}
    {f.error ? <p id={`${id}-error`} className="mt-1 leading-5 text-destructive"><Live>{error}</Live></p> : null}
  </div>;
}

/** One euro scale for the bars of this chart only (positions, not lengths: the scale spans the plotted values, and a zero
 * line appears when they cross zero): brackets for the interval, a dot for the part that does not depend on the split,
 * a diamond (single value) or an amber band (still an interval) for a declared split, always inside the brackets.
 * Each chart holds one layer: observed bars and bars under a variant never share a scale. */
function RangeChart({ label, bars }: { label: string; bars: Bar[] }) {
  const values = bars.flatMap(b => [b.lower, b.upper, ...(b.dot ? [b.dot] : []), ...(b.band ? [b.band.lower, b.band.upper] : [])]);
  const lo = values.reduce((a, b) => cPlanningCompare(a, b) <= 0 ? a : b), hi = values.reduce((a, b) => cPlanningCompare(a, b) >= 0 ? a : b);
  const min = cPlanningNumber(lo), span = cPlanningNumber(hi) - min, pad = span * 0.04, zero = cPlanningCompare(lo, "0") < 0 && cPlanningCompare(hi, "0") > 0;
  const at = (v: CPlanningAmount) => span > 0 ? Math.min(100, Math.max(0, (cPlanningNumber(v) - min + pad) / (span + 2 * pad) * 100)) : 50;
  return <figure className="mt-4 min-w-0" aria-label={label}>
    {bars.length > 1 && <figcaption className={small}><Live>{`${L.bounds.scale}: ${range(lo, hi)}`}</Live></figcaption>}
    <ul className="mt-2 space-y-3">{bars.map(b => { const left = at(b.lower), right = at(b.upper); return <li key={b.key} className="min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-xs"><Live className={b.strong ? "min-w-0 font-semibold" : "min-w-0 font-medium"}>{b.label}</Live><Live className="font-semibold tabular-nums">{range(b.lower, b.upper)}</Live></div>
      <div className="relative mt-1 h-6 rounded-lg bg-secondary/60" aria-hidden="true">
        {zero && <span className="absolute inset-y-1 border-l border-dashed border-muted-foreground/60" style={{ left: `${at("0")}%` }}/>}
        <span className={`absolute top-1/2 -translate-y-1/2 rounded-full ${b.strong ? "h-2 bg-primary/45" : "h-1.5 bg-primary/30"}`} style={{ left: `${left}%`, width: `${right - left}%` }}/>
        <span className="absolute inset-y-1 w-0.5 -translate-x-1/2 bg-primary" style={{ left: `${left}%` }}/><span className="absolute inset-y-1 w-0.5 -translate-x-1/2 bg-primary" style={{ left: `${right}%` }}/>
        {b.band && (b.band.complete ? <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2 border-[#8a5a12] bg-[#d89b38]" style={{ left: `${at(b.band.lower)}%` }}/>
          : <span className="absolute inset-y-1.5 rounded-sm border-2 border-[#8a5a12] bg-[#d89b38]/60" style={{ left: `${at(b.band.lower)}%`, width: `${Math.max(at(b.band.upper) - at(b.band.lower), 0.5)}%` }}/>)}
        {b.dot && <span className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground ring-2 ring-card" style={{ left: `${at(b.dot)}%` }}/>}
      </div>
      {b.detail ? <p className={`mt-1 ${small}`}><Live>{b.detail}</Live></p> : null}
    </li>; })}</ul>
    <p className={`mt-2 flex flex-wrap gap-x-4 gap-y-1 ${small}`}><span>{L.bounds.legendRange}</span>{bars.some(b => b.dot) && <span>{L.bounds.legendDot}</span>}{bars.some(b => b.band) && <span>{L.split.legend}</span>}{zero && <span>{L.bounds.legendZero}</span>}</p>
  </figure>;
}

/** PC-08-A12 item 5 as corrected: the group statements and the section's own two, verbatim, in the single block shown once,
 * beside the observed group interval; every other group interval points here (ReadPointer). Its open state belongs to the
 * panel, so a recalculation never closes it. The A13 notes on what a split is sit with the split results (BaseSplit). */
function ReadingNotes({ open, onToggle }: { open: boolean; onToggle: (open: boolean) => void }) {
  return <details id="scenari-reading" className="mt-2 scroll-mt-6 rounded-xl bg-secondary/35 xl:scroll-mt-56" open={open} onToggle={e => onToggle(e.currentTarget.open)}><summary className={summary}>{L.bounds.read}</summary>
    <ul className="space-y-1.5 px-4 pb-3 text-[11px] leading-5 text-muted-foreground">{C_PLANNING_READING.map(s => <li key={s}><Live>{s}</Live></li>)}</ul></details>;
}
/** The visible pointer beside every group interval: it opens the reading block and moves there. */
function ReadPointer({ onRead }: { onRead: () => void }) {
  return <button type="button" className={pointer} aria-controls="scenari-reading" onClick={onRead}>{L.bounds.readThis}</button>;
}

/** Group editor: a chip per portfolio, and a select whose choice is committed only by «Aggiungi» or Enter, never by browsing. */
function GroupPicker({ ids, portfolios, names, headingRef, addRef, onAdd, onRemove }: { ids: string[]; portfolios: { id: string; label: string }[] | null; names: Names; headingRef: RefObject<HTMLLegendElement | null>; addRef: RefObject<HTMLSelectElement | null>; onAdd: (id: string) => void; onRemove: (id: string) => void }) {
  const id = useId(), [choice, setChoice] = useState(""), free = portfolios ? portfolios.filter(p => !ids.includes(p.id)) : [], full = ids.length >= C_PLANNING_MAX_GROUP;
  const valid = !full && free.some(p => p.id === choice), add = () => { if (valid) { setChoice(""); onAdd(choice); } };
  return <fieldset className="min-w-0"><legend ref={headingRef} tabIndex={-1} className={heading}>{L.group.label}</legend>
    <ul className="mt-2 flex flex-wrap gap-2">{ids.map(pid => <li key={pid} className="inline-flex min-h-11 max-w-full items-center rounded-xl border border-primary/30 bg-primary/5 pl-3 text-xs font-medium"><Live className="min-w-0 truncate">{names(pid)}</Live><button type="button" className="ml-1 inline-flex size-10 shrink-0 items-center justify-center rounded-xl hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-40" disabled={ids.length === 1} aria-label={`${L.group.remove}: ${names(pid)}`} onClick={() => onRemove(pid)}><X size={14} aria-hidden="true"/></button></li>)}</ul>
    <div className="mt-3 flex max-w-md items-end gap-2"><label className="block min-w-0 flex-1 text-xs font-medium" htmlFor={`${id}-add`}>{L.group.add}<select className={field} id={`${id}-add`} ref={addRef} value={valid ? choice : ""} disabled={full || !free.length} aria-describedby={`${id}-limit`} onChange={e => setChoice(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }}><option value="">{L.group.choose}</option>{free.map(p => <option key={p.id} value={p.id}>{cleanLabel(p.label)}</option>)}</select></label>
      <button type="button" className={`${action} h-11 shrink-0`} disabled={!valid} onClick={add}><Plus size={14} aria-hidden="true"/>{L.group.commit}</button></div>
    <p id={`${id}-limit`} className={`mt-1.5 ${note}`}>{L.group.limit}</p>
  </fieldset>;
}

/** The declared variants' inputs, at the top of the section next to the group; their results are in the assumptions lane. Each
 * card is keyed by its variant's stable key, and every commit is a change of that variant in the newest plan (R1, R6). */
function VariantControls({ variants, keys, ids, names, heads, inputs, addRef, onChange, onAdd, onRemove }: { variants: CPlanningVariant[]; keys: string[]; ids: string[]; names: Names; heads: RefObject<(HTMLHeadingElement | null)[]>; inputs: RefObject<(HTMLInputElement | null)[]>; addRef: RefObject<HTMLButtonElement | null>; onChange: (key: string, change: (v: CPlanningVariant) => CPlanningVariant) => void; onAdd: () => void; onRemove: (key: string) => void }) {
  const help = useId();
  return <fieldset className="min-w-0"><legend className="text-sm font-semibold">{L.variants.source}</legend>
    <p id={help} className={`mt-1 ${note}`}><span>{L.variants.inputHelp}</span> <span>{L.variants.range}</span></p>
    {variants.length > 0 && <ul className="mt-3 grid gap-3 md:grid-cols-2">{variants.map((v, i) => { const key = keys[i] ?? `v${i}`; return <li key={key} className="min-w-0 rounded-xl border border-border bg-background/60 p-3">
      <div className="flex items-center justify-between gap-2"><h4 ref={el => { heads.current[i] = el; }} tabIndex={-1} className={heading}><Live>{L.variants.names[i]}</Live></h4><button type="button" className={action} aria-label={`${L.variants.remove}: ${L.variants.names[i]}`} onClick={() => onRemove(key)}><Trash2 size={14} aria-hidden="true"/>{L.variants.remove}</button></div>
      <div className="mt-2"><PercentField label={L.variants.input} context={L.variants.names[i]} helpId={help} error={L.variants.invalid} value={v.bps} min={C_PLANNING_BPS_MIN} max={C_PLANNING_BPS_MAX} inputRef={el => { inputs.current[i] = el; }} onCommit={bps => onChange(key, x => ({ ...x, bps: bps ?? 0 }))}/></div>
      <details className="mt-2 rounded-lg border border-border/70"><summary className="cursor-pointer rounded-lg px-3 py-2 text-xs font-medium focus-visible:outline-2 focus-visible:outline-primary">{L.variants.advanced}</summary><div className="space-y-3 px-3 pb-3">
        <PercentField optional label={L.variants.sharedInput} context={L.variants.names[i]} help={L.variants.unset} error={L.variants.invalid} value={v.sharedBps} min={C_PLANNING_BPS_MIN} max={C_PLANNING_BPS_MAX} onCommit={bps => onChange(key, x => ({ ...x, sharedBps: bps }))}/>
        {ids.map(pid => <PercentField key={pid} optional label={`${names(pid)} · ${L.variants.fixedInput}`} context={L.variants.names[i]} help={L.variants.unset} error={L.variants.invalid} value={v.fixedBps[pid] ?? null} min={C_PLANNING_BPS_MIN} max={C_PLANNING_BPS_MAX} onCommit={bps => onChange(key, x => { const fixedBps = { ...x.fixedBps }; if (bps === null) delete fixedBps[pid]; else fixedBps[pid] = bps; return { ...x, fixedBps }; })}/>)}
      </div></details>
    </li>; })}</ul>}
    {variants.length < C_PLANNING_MAX_VARIANTS && <button ref={addRef} type="button" className={`${action} mt-3`} onClick={onAdd}><Plus size={14} aria-hidden="true"/>{L.variants.add}</button>}
  </fieldset>;
}

function UserShares({ sets, unused, names, onShare }: { sets: CPlanningCrossingSet[]; unused: string[]; names: Names; onShare: (set: string, bps: number | null) => void }) {
  const [all, setAll] = useState(false), shown = all ? sets : sets.slice(0, 10);
  return <div className="mt-3">
    <p className={note}>{L.split.userUnset}</p>
    <ul className="mt-1 divide-y divide-border/60">{shown.map(s => { const label = s.candidates.map(names).join(" · "); return <li key={s.set} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_10rem] sm:items-start">
      <div className="min-w-0 text-xs"><p className="font-medium"><Live>{label}</Live></p><p className="mt-1 text-muted-foreground"><Live>{`${L.split.inGroup}: ${s.inGroup.map(names).join(", ")} · ${cAttrEntries(s.entries)} · ${L.split.exposure}: ${money(s.abs)}`}</Live></p></div>
      <PercentField optional label={L.split.userShare} context={`${L.split.set}: ${label}`} error={L.split.invalid} value={s.share} min={0} max={C_PLANNING_SHARE_MAX} onCommit={bps => onShare(s.set, bps)}/>
    </li>; })}</ul>
    {sets.length > 10 && <button type="button" className={`${action} mt-2`} aria-expanded={all} onClick={() => setAll(!all)}><Live>{all ? L.split.fewer : L.split.more}</Live></button>}
    {unused.length > 0 && <p className={`mt-2 ${note}`}>{L.split.unused}</p>}
  </div>;
}

/** The split rule picker; the share editor appears for R-USER only when the group has candidate sets to declare. */
function RuleControls({ rule, r, names, onRule, onShare }: { rule: CPlanningRule | null; r: CPlanningResult | null; names: Names; onRule: (rule: CPlanningRule | null) => void; onShare: (set: string, bps: number | null) => void }) {
  const id = useId();
  return <fieldset className="min-w-0"><legend className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold">{L.split.rule}<span className={chip}>{L.split.chip}</span></legend>
    <div className="mt-2 grid gap-0.5">{([null, ...C_PLANNING_RULES] as const).map(x => <label key={x ?? "none"} className="flex min-h-11 items-center gap-3 rounded-lg px-2 text-sm hover:bg-primary/5"><input type="radio" className="size-4 shrink-0 accent-primary" name={`${id}-rule`} value={x ?? "none"} checked={rule === x} onChange={() => onRule(x)}/><Live>{x ? L.split[x] : L.split.none}</Live></label>)}</div>
    {rule && <p className="mt-2 text-xs font-medium leading-5"><Live>{C_PLANNING_RULE_NOTES[rule]}</Live></p>}
    {rule === "user" && r && r.crossingSets.length > 0 && <UserShares sets={r.crossingSets} unused={r.split?.unusedShares ?? []} names={names} onShare={onShare}/>}
  </fieldset>;
}

/** Observed layer only: the group interval, its reference, a chart with its own scale, the partition and the reading block. */
function ObservedLane({ r, matched, names, readOpen, onRead, onPointer }: { r: CPlanningResult; matched: CPlanningResult | null; names: Names; readOpen: boolean; onRead: (open: boolean) => void; onPointer: () => void }) {
  const o = r.observed, fixed = r.partition.rows.filter(x => x.part === "fixed"), rest = r.partition.rows.filter(x => x.part !== "fixed");
  const bars: Bar[] = [...r.members.map((m): Bar => ({ key: `m|${m.id}`, label: `${names(m.id)} · ${L.bounds.member}`, lower: m.lower1, upper: m.upper1, dot: m.fixed, band: null, detail: m.zero ? L.observed.zeroFixed : undefined })),
    { key: "group", label: L.bounds.joint, strong: true, lower: o.lower1, upper: o.upper1, dot: o.reference, band: null }];
  const cell = "border-b border-border/50 py-2 pr-3", num = "border-b border-border/50 py-2 pr-3 text-right tabular-nums";
  return <article className={card} aria-labelledby="scenari-observed-title">
    <div className="flex flex-wrap gap-2"><p className={chip}>{L.observed.chip}</p>{r.variants.length > 0 && <p className="inline-flex max-w-full rounded-full border border-border px-2.5 py-1 text-[11px] font-medium leading-4">{L.variants.base}</p>}</div>
    <h3 id="scenari-observed-title" className="mt-3 text-base font-semibold">{L.observed.title}</h3>
    <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
      <div className="min-w-0"><dt className="text-muted-foreground">{L.bounds.joint}</dt><dd className="mt-1 text-lg font-semibold tabular-nums"><Live>{range(o.lower1, o.upper1)}</Live></dd><dd className={`mt-1 ${small}`}><Live>{`${L.bounds.width}: ${money(o.width1)}`}</Live></dd></div>
      <div className="min-w-0"><dt className="text-muted-foreground">{L.bounds.reference}</dt>{o.referenceZero ? <dd className="mt-1 text-sm font-medium leading-5"><Live>{L.observed.zeroFixed}</Live></dd> : <dd className="mt-1 text-lg font-semibold tabular-nums"><Live>{money(o.reference)}</Live></dd>}<dd className={`mt-1 ${small}`}>{L.bounds.referenceDetail}</dd></div>
    </dl>
    {r.members.length > 1 && <details className="mt-3 rounded-xl border border-border/70"><summary className={summary}>{L.bounds.members}</summary><div className="px-4 pb-3"><RangeChart label={L.bounds.chip} bars={bars}/></div></details>}
    <p className="mt-3 text-xs font-medium"><Live>{o.full ? L.bounds.full : `${L.bounds.l2} ${range(o.lower2, o.upper2)}`}</Live></p>
    {matched && <p className={`mt-2 ${note}`}><Live>{`${C_PERIOD_LABELS[matched.scope.period]} · ${L.bounds.joint}: ${range(matched.observed.lower1, matched.observed.upper1)}. ${L.observed.matched}`}</Live></p>}
    <ReadPointer onRead={onPointer}/>
    <details className="mt-2 rounded-xl border border-border/70"><summary className={summary}>{L.observed.parts}</summary><div className="px-4 pb-4">
      <div className="overflow-x-auto"><table className="w-full text-left text-xs"><caption className="sr-only">{L.observed.parts}</caption>
        <thead><tr><th scope="col" className="border-b border-border py-2 pr-3 font-semibold">{L.observed.part}</th><th scope="col" className="border-b border-border py-2 pr-3 text-right font-semibold">{L.observed.amount}</th><th scope="col" className="border-b border-border py-2 text-right font-semibold">{L.observed.entries}</th></tr></thead>
        <tbody>
          <tr><td colSpan={3} className="pb-1 pt-3 font-semibold">{L.observed.fixed}</td></tr>
          {fixed.map(x => <tr key={x.key}><th scope="row" className={`${cell} pl-3 font-medium`}><Live>{names(x.id ?? "")}</Live></th><td className={x.zero ? `${cell} text-right text-muted-foreground` : num}><Live>{x.zero ? L.observed.zeroFixed : money(x.value)}</Live></td><td className={`${num} pr-0`}>—</td></tr>)}
          {rest.map(x => <tr key={x.key}><th scope="row" className={`${cell} font-medium`}><Live>{x.label}</Live></th><td className={num}><Live>{money(x.value)}</Live></td><td className={`${num} pr-0`}><Live>{x.entries === null ? "—" : itNumber(x.entries)}</Live></td></tr>)}
          <tr><th scope="row" className="py-2 pr-3 font-semibold">{L.observed.total}</th><td className="py-2 pr-3 text-right font-semibold tabular-nums"><Live>{money(r.partition.total)}</Live></td><td/></tr>
        </tbody></table></div>
      <p className={`mt-2 ${note}`}>{L.observed.footer}</p>
      <p className={`mt-1 ${note}`}><span>{L.observed.crossingAbs}</span> · <Live className="font-medium tabular-nums text-foreground">{money(r.partition.crossingAbs)}</Live></p>
    </div></details>
    <ReadingNotes open={readOpen} onToggle={onRead}/>
  </article>;
}

/** A declared split at the observed base: its own labelled assumption block and its own chart, never under the observed base's
 * label and never on the variants' scale. Its container is the observed group interval, named as observed (PC-08-A13 item 4);
 * the split statement sits under the value and the A13 notes on what a split is sit here, with the split results. */
function BaseSplit({ r, split, onRead }: { r: CPlanningResult; split: CPlanningSplit; onRead: () => void }) {
  const o = r.observed, b = split.observed, id = useId();
  return <div className={`mt-3 p-3.5 ${amber}`} data-scenario="base-split" role="group" aria-labelledby={id}>
    <h4 id={id} className="text-sm font-semibold">{L.split.baseTitle}</h4>
    <p className={`mt-1 ${small}`}><Live>{`${L.split.rule}: ${L.split[split.rule]}`}</Live></p>
    <p className="mt-2 text-sm font-semibold tabular-nums"><Live>{`${L.split.result}: ${bandValue(b)}`}</Live></p>
    <p className={`mt-1 ${small}`}>{L.split.statement}</p>
    {bandNotes(b).map(t => <p key={t} className="mt-1 text-xs"><Live>{t}</Live></p>)}
    <RangeChart label={L.split.baseTitle} bars={[{ key: "base", label: L.bounds.observedJoint, lower: o.lower1, upper: o.upper1, dot: null, band: b }]}/>
    <ReadPointer onRead={onRead}/>
    <ul className={`mt-1 space-y-1 ${small}`}>{[L.split.inside, L.split.noEffect, ...(split.rule === "prop" ? [L.split.propZero, L.split.propWeights] : [])].map(s => <li key={s}><Live>{s}</Live></li>)}</ul>
  </div>;
}

function VariantCard({ result, band, names, onRead }: { result: CPlanningVariantResult; band: CPlanningSplitBand | null; names: Names; onRead: () => void }) {
  const b = result.bounds, id = useId();
  return <article className="min-w-0 rounded-xl border border-border bg-background/60 p-3.5" data-scenario={String(result.index)} data-bps={String(result.assumption.bps)} aria-labelledby={`${id}-name`}>
    <h4 id={`${id}-name`} className="text-sm font-semibold"><Live>{result.name}</Live></h4>
    <p className={`mt-2 ${chip}`}><Live>{`${L.variants.source} · ${assumptionText(result, names)}`}</Live></p>
    <dl className="mt-3 space-y-2.5 text-xs">
      <div><dt className="text-muted-foreground">{L.variants.reference}</dt>{b.referenceZero ? <dd className="mt-1 text-sm font-medium leading-5"><Live>{L.observed.zeroFixed}</Live></dd> : <dd className="mt-1 text-lg font-semibold tabular-nums"><Live>{money(b.reference)}</Live></dd>}<dd className={`mt-1 ${small}`}>{L.bounds.referenceDetail}</dd></div>
      <div><dt className="text-muted-foreground">{L.variants.interval}</dt><dd className="mt-1 font-semibold tabular-nums"><Live>{range(b.lower1, b.upper1)}</Live></dd><dd className={`mt-1 ${small}`}><Live>{b.full ? L.bounds.full : `${L.bounds.l2} ${range(b.lower2, b.upper2)}`}</Live></dd><dd><ReadPointer onRead={onRead}/></dd></div>
      <div><dt className="text-muted-foreground">{L.variants.effect}</dt><dd className="mt-1 font-semibold tabular-nums"><Live>{signed(result.effect.reference)}</Live></dd></div>
      {band && <div className={`p-3 ${amber}`}><dt className="font-medium">{L.split.result}</dt><dd className="mt-1 font-semibold tabular-nums"><Live>{bandValue(band)}</Live></dd><dd className={`mt-1 ${small}`}>{L.split.statement}</dd></div>}
    </dl>
    <p className={`mt-3 ${small}`}>{L.variants.compact}</p>
    <p className={`mt-1 ${small}`}>{L.variants.unvaried}</p>
    {result.members.length > 1 && <details className="mt-2"><summary className="cursor-pointer py-1 text-xs font-medium focus-visible:outline-2 focus-visible:outline-primary">{L.variants.members}</summary><ul className={`mt-2 space-y-1 ${small}`}>{result.members.map(m => <li key={m.id}><Live>{`${names(m.id)}: ${range(m.lower1, m.upper1)} · ${L.variants.fixedPart}: ${m.zero ? L.observed.zeroFixed : money(m.fixed)}`}</Live></li>)}</ul></details>}
  </article>;
}

/** Assumption layer only. Its head prints the scenario caption, the time reading and (with a split shown) the split statement once;
 * under every variant's values and every split result a compact caption repeats them (PC-08-A12 items 6 and 7, A13 item 4, as
 * corrected). Then the declared split at the observed base in its own block, one card per variant (keyed by the variant's stable
 * key) and, to compare two variants or to draw a split inside its interval, a chart of the variants alone (no observed bar, no
 * shared axis with the observed lane). */
function AssumptionLane({ r, keys, names, onRead }: { r: CPlanningResult; keys: string[]; names: Names; onRead: () => void }) {
  const status = cPlanningSplitStatus(r), shown = status === "shown" ? r.split : null;
  const head = <><p className={chip}>{L.variants.chip}</p><h3 id="scenari-variants-title" className="mt-3 text-base font-semibold">{L.variants.title}</h3></>;
  if (!r.variants.length && status === "off") return <article className={card} aria-labelledby="scenari-variants-title">{head}<p className={`mt-2 ${note}`}>{L.variants.empty}</p></article>;
  const bars = r.variants.map((v, i): Bar => ({ key: `v${v.index}`, label: v.name, strong: true, lower: v.bounds.lower1, upper: v.bounds.upper1, dot: v.bounds.reference, band: shown?.variants[i] ?? null }));
  return <article className={card} aria-labelledby="scenari-variants-title">{head}
    <div className={`mt-3 space-y-1 px-3 py-2 text-[11px] leading-4 ${amber}`}><p className="font-medium">{L.variants.scenario}</p>{r.variants.length > 0 && <p>{L.section.duration}</p>}{shown && <p>{L.split.statement}</p>}</div>
    {status === "nothing" && <p className="mt-4 text-xs font-medium leading-5">{L.split.nothing}</p>}
    {status === "uncovered" && <p className="mt-4 text-xs font-medium leading-5">{L.split.noneCovered}</p>}
    {shown && <BaseSplit r={r} split={shown} onRead={onRead}/>}
    {r.variants.length > 0 && <div className="mt-3 grid gap-3 md:grid-cols-2">{r.variants.map((v, i) => <VariantCard key={keys[i] ?? v.index} result={v} band={shown?.variants[i] ?? null} names={names} onRead={onRead}/>)}</div>}
    {(r.variants.length > 1 || (shown && r.variants.length > 0)) && <><RangeChart label={L.variants.chip} bars={bars}/><p className={`mt-2 ${small}`}>{L.variants.compact}</p>{shown && <p className={`mt-1 ${small}`}>{L.split.statement}</p>}<ReadPointer onRead={onRead}/></>}
  </article>;
}

function Ranking({ ranking, names, evidence }: { ranking: CPlanningRanking; names: Names; evidence: boolean }) {
  const [all, setAll] = useState(false), rows = all ? ranking.rows : ranking.rows.slice(0, 10);
  return <article className={card} aria-labelledby="scenari-ranking-title">
    <h3 id="scenari-ranking-title" className="text-base font-semibold">{L.ranking.title}</h3>
    <p className={`mt-1 ${note}`}>{L.ranking.base}</p>
    {ranking.count ? <>
      <p className="mt-2 text-sm"><Live>{`${L.ranking.n80}: ${ranking.n80 === null ? "—" : cAttrEntries(ranking.n80)} · ${L.bounds.width}: ${money(ranking.total)}`}</Live></p>
      <details className="mt-3 rounded-xl border border-border/70"><summary className={summary}><Live>{`${L.ranking.show} · ${cAttrEntries(ranking.count)}`}</Live></summary><div className="px-3 pb-3">
        <ol className="space-y-2">{rows.map(x => <li key={`${x.key}|${x.state}|${x.candidates.join("+")}|${x.atc}`} className="min-w-0 rounded-xl bg-secondary/35 px-3 py-2.5 text-xs">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"><Live className="min-w-0 font-semibold">{`${x.rank}. ${x.label}`}</Live><Live className="font-semibold tabular-nums">{`${L.ranking.reduction} ${money(x.abs)}`}</Live></div>
          <p className="mt-1 break-words text-muted-foreground"><Live>{`${x.key} · ${x.atc || L.ranking.noAtc} · ${L.ranking.candidates}: ${x.candidates.map(names).join(", ")}`}</Live></p>
          <p className="mt-1 text-muted-foreground"><Live>{`${L.ranking.cumulative}: ${cPlanningShareText(x.cumulative, ranking.total) ?? "—"}`}</Live></p>
        </li>)}</ol>
        {ranking.rows.length > 10 && <button type="button" className={`${action} mt-2`} aria-expanded={all} onClick={() => setAll(!all)}><Live>{all ? L.ranking.fewer : L.ranking.more}</Live></button>}
        <ul className="mt-3 space-y-1 text-xs leading-5 text-muted-foreground"><li>{L.ranking.note}</li><li>{L.ranking.organisational}</li><li>{L.ranking.order}</li></ul>
      </div></details>
    </> : <p className="mt-2 text-sm text-muted-foreground">{L.ranking.empty}</p>}
    {evidence && <a href="#evidence-workflow" className={`${link} mt-1`}>{L.ranking.link}<ArrowRight size={13} aria-hidden="true"/></a>}
  </article>;
}

/** Budget and regional context as status lines and links only: no amount, no modelled budget, no forecast figure.
 * Organisations are named only by the audience's own labels. */
function Outside({ scope, acts, audience }: { scope: Pick<CPlanningState, "period" | "org" | "channel">; acts: readonly string[]; audience: CClientAudience }) {
  let o: ReturnType<typeof cPlanningOutside> | null = null;
  try { o = cPlanningOutside(scope, acts, cAudienceActVocabulary(audience)); } catch { o = null; }
  return <aside className="rounded-2xl border border-dashed border-border bg-card/60 p-4 md:p-5" aria-labelledby="scenari-outside-title">
    <h3 id="scenari-outside-title" className="text-sm font-semibold">{L.outside.title}</h3>
    <div className="mt-2 grid gap-3 text-xs leading-5 text-muted-foreground md:grid-cols-2">
      <div>{o && <p key={o.key}>{o.status === "within" ? <><Live>{o.budget[0]}</Live> <Live>{`${o.orgs.map(c => cAudienceLabel(audience, c) ?? "").join(", ")}.`}</Live> <Live>{o.budget[1]}</Live></> : <Live>{o.budget[0]}</Live>}</p>}
        {o && o.status !== "none" && <a href="#pianificazione" className={link}>{L.outside.actsLink}<ArrowRight size={13} aria-hidden="true"/></a>}</div>
      <div>{(o?.regional ?? [L.outside.regional, L.outside.noLocalForecast, L.outside.selection]).map(t => <p key={t}><Live>{t}</Live></p>)}<a href="#previsione" className={link}>{L.outside.regionalLink}<ArrowRight size={13} aria-hidden="true"/></a></div>
    </div>
  </aside>;
}

type CPlanningPanelProps = { search: string; load: CPlanningLoad; acts: readonly string[]; evidenceAnchor?: boolean; onSearch: (next: string, mode: Mode) => void; onRetry: () => void };
/** Pure render of the workspace for one URL and one load (SSR-tested). The stale-scope guard lives here: a view is used
 * only under its own scope key, and a result only when its key starts with that scope; otherwise no figure is shown.
 * Controls come first (group, variants, rule), then the observed lane, the assumptions lane and the review order.
 * The audience is mandatory: without one nothing renders. */
export function CPlanningPanel(props: CPlanningPanelProps) {
  const audience = usePillarCAudience();
  return audience ? <PlanningPanel {...props} audience={audience}/> : null;
}
function PlanningPanel({ search, load, acts, evidenceAnchor = false, onSearch, onRetry, audience }: CPlanningPanelProps & { audience: CClientAudience }) {
  // The dossier scope, with its organisation clamped to this audience's keys (the reviewer's parser, unchanged, for the reviewer).
  const { state, invalid } = useMemo(() => cAudiencePlanningFilters(audience, search), [audience, search]);
  const scopeKey = `${state.period}|${state.org}|${state.channel}`;
  const view = load && load.key === scopeKey && "view" in load ? load.view : null;
  const error = load && load.key === scopeKey && "error" in load ? load.error : null;
  const outcome = useMemo((): Outcome | null => {
    if (!view) return null;
    try {
      if (!cPlanningKnownIds(state.ids, view.portfolios)) return { status: "unknown" };
      const r = cPlanningWorkspace(view, state); if (!r.key.startsWith(`${scopeKey}|`)) return { status: "failed" };
      let matched: CPlanningResult | null = null;
      if (view.comparison) try { matched = cPlanningWorkspace({ ...view, scope: view.comparison }, { ids: state.ids, variants: [], rule: null, shares: {} }); } catch { matched = null; }
      return { status: "ready", r, matched };
    } catch { return { status: "failed" }; }
  }, [view, state, scopeKey]);
  const [copied, setCopied] = useState<string | null>(null), [exportFailures, setExportFailures] = useState(0), [announceAfter, setAnnounceAfter] = useState<string | null>(null), [readOpen, setReadOpen] = useState(false), [readJump, setReadJump] = useState(0);
  // R1: the newest address, written synchronously on every commit; the page catches up when Next renders it.
  const [address] = useState(() => cPlanningAddress(search)), keys = address.keys(search);
  useLayoutEffect(() => { address.rendered(search); }, [address, search]);
  const focus = useRef<Focus>(null), groupHeading = useRef<HTMLLegendElement>(null), addRef = useRef<HTMLSelectElement>(null), heads = useRef<(HTMLHeadingElement | null)[]>([]), inputs = useRef<(HTMLInputElement | null)[]>([]), addVariantRef = useRef<HTMLButtonElement>(null);
  const variantCount = state.variants.length;
  // Focus moves only after the URL change has rendered: a removed chip or card takes its button with it.
  useEffect(() => {
    const want = focus.current; if (!want) return; focus.current = null;
    if (want === "group") cPlanningFocusFirst([addRef.current, groupHeading.current]);
    else if (want === "added") cPlanningFocusFirst([inputs.current[variantCount - 1], heads.current[variantCount - 1]]);
    else cPlanningFocusFirst([heads.current[0], addVariantRef.current]);
  }, [search, variantCount]);
  const nameMap = new Map((view?.portfolios ?? []).map(p => [p.id, cleanLabel(p.label)])), names: Names = id => nameMap.get(id) ?? id;
  const commit = (next: string, mode: Mode, target: Focus = null, change?: CPlanningAddressChange) => { if (next.replace(/^\?/, "") === address.current()) return; focus.current = target; setAnnounceAfter(next.replace(/^\?/, "")); address.write(next, change); onSearch(next, mode); };
  // Every change is a function of the newest plan, never of the plan this render shows (R1): a blur that has just committed
  // a value and the click of the same tap both land in the address.
  const apply = (change: (plan: CPlanningPlan) => CPlanningPlan, mode: Mode, target: Focus = null, shape?: CPlanningAddressChange) => { try { commit(cPlanningNext(address.current(), change), mode, target, shape); } catch { /* a plan the reader would reject is never written */ } };
  const at = (key: string) => address.keys(address.current()).indexOf(key);
  const addId = (id: string) => apply(p => p.ids.includes(id) || p.ids.length >= C_PLANNING_MAX_GROUP ? p : cPlanningRegroup(p, [...p.ids, id]), "replace", "group");
  const removeId = (id: string) => apply(p => p.ids.length > 1 && p.ids.includes(id) ? cPlanningRegroup(p, p.ids.filter(x => x !== id)) : p, "replace", "group");
  const variant = (key: string, change: (v: CPlanningVariant) => CPlanningVariant) => { const i = at(key); if (i >= 0) apply(p => ({ ...p, variants: p.variants.map((x, j) => j === i ? change(x) : x) }), "replace"); };
  const addVariant = () => apply(p => p.variants.length >= C_PLANNING_MAX_VARIANTS ? p : { ...p, variants: [...p.variants, { bps: 0, sharedBps: null, fixedBps: {} }] }, "push", "added", { add: true });
  const removeVariant = (key: string) => { const i = at(key); if (i >= 0) apply(p => ({ ...p, variants: p.variants.filter((_, j) => j !== i) }), "push", "variant", { remove: i }); };
  const share = (set: string, bps: number | null) => apply(p => { const shares = { ...p.shares }; if (bps === null) delete shares[set]; else shares[set] = bps; return { ...p, shares }; }, "replace");
  const reset = () => { const q = new URLSearchParams(address.current()); for (const k of C_PLANNING_PARAMS) q.delete(k); const s = q.toString(); commit(s ? `?${s}` : "", "push"); };
  const copy = async () => { try { await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}${window.location.search}#scenari`); setCopied(search); } catch { setCopied(null); } };
  const ready = outcome?.status === "ready" ? outcome : null;
  // The file is built from the newest committed address (R1): a value committed by the blur of the same tap is in it.
  // The file carries this audience's confidentiality label, the one printed beside the button.
  const exportJson = () => { try { const latest = cAudiencePlanningFilters(audience, address.current()).state; if (!view || !ready) throw Error("C_PLANNING_EXPORT"); download(cPlanningExportName(latest), JSON.stringify(cPlanningExport(view, latest, new Date().toISOString(), audience.exportLabel), null, 2)); setExportFailures(0); } catch { setExportFailures(n => n + 1); } };
  // A pointer opens the reading block; once the open block has rendered, the page moves there and focus lands on its summary.
  const openReading = () => { setReadOpen(true); setReadJump(n => n + 1); };
  useEffect(() => { if (!readJump) return; const block = document.getElementById("scenari-reading"); block?.scrollIntoView({ block: "start" }); block?.querySelector("summary")?.focus({ preventScroll: true }); }, [readJump]);
  const partial = cPlanningPartialText(state.period);
  // Constant for the page: a refused read is described in the audience's own words.
  const forbidden = isCScopedClientAudience(audience) ? C_AUDIENCE_COPY.forbidden : L.section.forbidden;
  // One polite announcement per committed change, once the address it wrote has rendered. A later URL change made by
  // another section is not this workspace recalculating, so it announces nothing.
  const announcement = ready && announceAfter !== null && announceAfter === search.replace(/^\?/, "") ? `${L.section.updated}: ${[ready.r.ids.map(names).join(", "), ...ready.r.variants.map(v => `${v.name} ${cPlanningPercentLabel(v.assumption.bps)}`), ...(state.rule ? [`${L.split.rule}: ${L.split[state.rule]}`] : [])].join(" · ")}` : null;
  return <section id="scenari" aria-labelledby="scenari-title" className="scroll-mt-6 space-y-4 xl:scroll-mt-56" data-c-planning="v1">
    <div className="flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/5 text-primary"><GitBranch size={21} aria-hidden="true"/></span><div className="min-w-0"><p className="text-xs font-medium text-primary">{L.section.eyebrow}</p><h2 id="scenari-title" tabIndex={-1} className="mt-1 text-xl font-semibold focus-visible:outline-2 focus-visible:outline-primary">{L.section.title}</h2><p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">{L.section.lead}</p><p className="mt-1 max-w-4xl text-xs leading-5 text-muted-foreground">{L.section.separation}</p></div></div>
    <div className={card}>
      <div className="min-w-0"><p className="text-xs text-muted-foreground">{L.section.scopeTitle}</p><p className="mt-0.5 text-sm font-semibold"><Live>{`${C_PERIOD_LABELS[state.period]} · ${cAudienceLabel(audience, state.org) ?? ""} · ${channelName(state.channel)}`}</Live></p>{partial && <p className="mt-1 text-xs font-medium leading-5"><Live>{partial}</Live></p>}<a href="#portafogli" className={link}>{L.section.dossierScope}<ArrowRight size={13} aria-hidden="true"/></a></div>
      <div className="mt-3"><GroupPicker ids={state.ids} portfolios={view?.portfolios ?? null} names={names} headingRef={groupHeading} addRef={addRef} onAdd={addId} onRemove={removeId}/></div>
      <div className="mt-4 border-t border-border pt-3"><VariantControls variants={state.variants} keys={keys} ids={state.ids} names={names} heads={heads} inputs={inputs} addRef={addVariantRef} onChange={variant} onAdd={addVariant} onRemove={removeVariant}/></div>
      <div className="mt-4 border-t border-border pt-3"><RuleControls rule={state.rule} r={ready?.r ?? null} names={names} onRule={rule => apply(p => ({ ...p, rule }), "replace")} onShare={share}/></div>
      <div className="mt-4 border-t border-border pt-3">
        <div className="flex flex-wrap gap-1.5"><button type="button" className={action} onClick={copy}><Copy size={14} aria-hidden="true"/><Live>{copied === search ? L.section.copied : L.section.copyLink}</Live></button><button type="button" className={action} onClick={reset}><RotateCcw size={14} aria-hidden="true"/>{L.section.reset}</button><button type="button" className={action} disabled={!ready} aria-describedby="scenari-confidentiality" onClick={exportJson}><Download size={14} aria-hidden="true"/>{L.section.exportJson}</button></div>
        <p id="scenari-confidentiality" className="mt-2 text-xs font-medium">{audience.exportLabel}</p>
        <p className={`mt-1 ${note}`}>{L.section.draft}</p>
        <p role="status" className="text-xs text-destructive">{exportFailures > 0 && <Live key={exportFailures}>{L.section.exportFailed}</Live>}</p>
        {invalid.length > 0 && <p role="status" className="mt-1 text-xs text-destructive">{L.section.invalidUrl}</p>}
      </div>
    </div>
    <p className="sr-only" role="status">{announcement && <Live key={search}>{announcement}</Live>}</p>
    {!view ? <div role="status" className={card}>{error ? <><p className="text-sm">{L.section.unavailable}</p>{error === "forbidden" ? <p className={`mt-2 ${note}`}>{forbidden}</p> : <button type="button" className={`${action} mt-3`} onClick={onRetry}>{L.section.retry}</button>}</> : <p className="text-sm text-muted-foreground">{L.section.loading}</p>}</div>
      : !ready ? <div role="status" className={card}>{outcome?.status === "unknown" ? <><p className="text-sm">{L.section.unknownPortfolio}</p><button type="button" className={`${action} mt-3`} onClick={reset}><RotateCcw size={14} aria-hidden="true"/>{L.section.reset}</button></> : <p className="text-sm">{L.section.unavailable}</p>}</div>
      : <div key={ready.r.key} className="space-y-4" data-scope-key={ready.r.key}>
        <ObservedLane r={ready.r} matched={ready.matched} names={names} readOpen={readOpen} onRead={setReadOpen} onPointer={openReading}/>
        <AssumptionLane r={ready.r} keys={keys} names={names} onRead={openReading}/>
        <Ranking ranking={ready.r.ranking} names={names} evidence={evidenceAnchor && audience.capabilities.evidence}/>
      </div>}
    <Outside scope={state} acts={acts} audience={audience}/>
    <details className="rounded-xl border border-border bg-card"><summary className="cursor-pointer rounded-xl px-5 py-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-primary">{L.notComputed.title}</summary><ul className="list-disc space-y-2 pb-5 pl-9 pr-5 text-xs leading-5 text-muted-foreground">{L.notComputed.items.map(t => <li key={t}><Live>{t}</Live></li>)}</ul></details>
  </section>;
}

type CPlanningWorkspaceProps = { publishedActs: readonly string[]; evidenceAnchor?: boolean };
/** Planning workspace (PC-08-A12, A13). It inherits the dossier scope from the URL, reads the attribution view of that
 * scope (reviewer-gated, or the organisation-scoped audience's own units under Storage RLS) and computes every number
 * with the planning engine. Nothing is stored or sent; the only URL keys it writes are c_plan_*. The audience is
 * mandatory: without one nothing renders and nothing is fetched. */
export function PillarCPlanningWorkspace(props: CPlanningWorkspaceProps) {
  const audience = usePillarCAudience();
  return audience ? <PlanningWorkspace {...props} audience={audience}/> : null;
}
function PlanningWorkspace({ publishedActs, evidenceAnchor = false, audience }: CPlanningWorkspaceProps & { audience: CClientAudience }) {
  const search = useSearchParams().toString();
  const { period, org, channel } = useMemo(() => cAudiencePlanningFilters(audience, search).state, [audience, search]), key = `${period}|${org}|${channel}`;
  const [load, setLoad] = useState<CPlanningLoad>(null), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    fetch(`/api/pillar-c/attribution?${new URLSearchParams({ period, org, channel })}`, { signal: controller.signal, cache: "no-store", credentials: "same-origin" }).then(async (response): Promise<CPlanningLoad> => {
      if (response.status === 403) return { key, error: "forbidden" };
      if (!response.ok) throw Error("unavailable");
      return { key, view: cPlanningAccept(await response.json(), period, org, channel) };
    }).then(next => { if (active) setLoad(next); }).catch(() => { if (active) setLoad({ key, error: "unavailable" }); });
    return () => { active = false; controller.abort(); };
  }, [key, period, org, channel, attempt]);
  const navigate = (next: string, mode: Mode) => { const url = `${window.location.pathname}${next}${window.location.hash}`; if (mode === "push") window.history.pushState(null, "", url); else window.history.replaceState(null, "", url); };
  return <CPlanningPanel search={search} load={load} acts={publishedActs} evidenceAnchor={evidenceAnchor} onSearch={navigate} onRetry={() => { setLoad(null); setAttempt(a => a + 1); }}/>;
}
