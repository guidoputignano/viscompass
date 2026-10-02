"use client";

// The public Pillar B observatory: AIFA's EV/SC focus tables for infliximab,
// rituximab and trastuzumab, direct purchases, January–December 2025.
//
// WHAT THIS PAGE MAY SAY. Only what the source table says: for one molecule,
// one measure and one territory, how the 100 % splits between originator and
// biosimilar, intravenous and subcutaneous. Sums of cells of the same row
// (biosimilar share, SC share) and differences in percentage points are the
// only arithmetic. No volumes, no euros, no totals, no comparison across
// molecules except side by side, no causes the source does not publish, no
// claim about clinical appropriateness or legal exclusivity.
//
// The selection lives in the URL (history.replaceState, no navigation), so a
// link reproduces the view; the server parses the same keys on a fresh load.

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { itNumberFormat } from "@/lib/format/it-number";
import { formatDate } from "@/lib/dashboard-review/format";
import {
  COMPONENTS, COMPONENT_LABELS, ITALY, MEASURES, MEASURE_LABELS, MEASURE_SENTENCE, MOLECULES, MOLECULE_LABELS,
  biosimilarShare, compositionRows, diffFromItaly, measureComparison, moleculeComparison, originatorShare,
  positionOf, rankTerritories, rowFor, scFormPresence, scFormSentence, scShare, selectionHref, territoryLabel,
  type ComponentId, type EvScAsset, type MeasureId, type MoleculeId, type Selection,
} from "@/lib/pillar-b-public/ev-sc-view";

// COLOUR CARRIES ONE THING, TEXTURE ANOTHER. Biosimilar is teal, originator
// amber (a blue–yellow contrast that survives the common colour-vision
// deficiencies); the subcutaneous form is the same colour, hatched. Every fill
// has at least 3:1 against both the light and the dark card, and identity is
// never colour alone: legend, value labels and a table carry it too. Text is
// always drawn in theme ink, never in a series colour.
const TEAL = "#13998f";      // 3.51:1 on the light card, 3.71:1 on the dark
const AMBER = "#c27a1a";     // 3.45:1 / 3.78:1
const ITALY_COLOR = "#6f8bb3"; // 3.49:1 / 3.73:1
const FILL: Record<ComponentId, string> = {
  biosimilar_ev: TEAL,
  biosimilar_sc: "url(#pbp-hatch-teal)",
  originator_ev: AMBER,
  originator_sc: "url(#pbp-hatch-amber)",
};
const INK = "hsl(var(--foreground))";
const MUTED = "hsl(var(--muted-foreground))";
const tick = { fontSize: 11, fill: MUTED };
const tipStyle = {
  borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))",
  color: "hsl(var(--card-foreground))", boxShadow: "0 12px 30px rgba(0,0,0,.18)", fontSize: 12,
};
const tipItem = { color: "hsl(var(--card-foreground))" };
const legendText = (value: string) => <span style={{ color: INK }}>{value}</span>;
// Small text in the brand colour needs a darker shade in light mode (4.5:1).
const LINK = "font-semibold text-[hsl(174_66%_28%)] underline dark:text-primary";

// A non-breaking space keeps "97,93 %" on one line in narrow table cells.
const NB = " ";
const fmt = (v: number, d = 2) => itNumberFormat({ minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
const pct = (v: number | null, d = 2) => (v === null ? "—" : `${fmt(v, d)}${NB}%`);
const pp = (v: number | null) => (v === null ? "—" : v === 0 ? `0,00${NB}p.p.` : `${v > 0 ? "+" : "−"}${fmt(Math.abs(v))}${NB}p.p.`);
const ordinal = (n: number) => `${n}º`;

function Hatches() {
  return <defs>
    {([["teal", TEAL], ["amber", AMBER]] as const).map(([id, color]) => (
      <pattern key={id} id={`pbp-hatch-${id}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="6" height="6" fill={color} />
        <line x1="0" y1="0" x2="0" y2="6" stroke="hsl(var(--card))" strokeWidth="2.2" />
      </pattern>
    ))}
  </defs>;
}

function Panel({ title, note, control, children }: {
  title: string; note: string; control?: React.ReactNode; children: React.ReactNode;
}) {
  return <section className="min-w-0 rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
    <div className="mb-6 flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
      <div className="min-w-0 grow basis-72">
        <h2 className="font-display text-xl font-semibold">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{note}</p>
      </div>
      {control && <div className="w-full sm:w-60 sm:shrink-0">{control}</div>}
    </div>
    {children}
  </section>;
}

function Select({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: ReadonlyArray<{ value: string; label: string }>;
}) {
  return <label className="flex min-w-0 flex-col gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
    {label}
    <select
      className="h-11 rounded-lg border bg-background px-3 text-sm font-medium normal-case tracking-normal text-foreground"
      value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </label>;
}

function Tile({ label, value, note, accent }: { label: string; value: string; note: string; accent?: boolean }) {
  return <div className={`rounded-2xl border p-5 ${accent ? "bg-[#173b49] text-white" : "bg-card"}`}>
    <p className={`text-xs ${accent ? "text-teal-100" : "text-muted-foreground"}`}>{label}</p>
    <p className="my-4 whitespace-nowrap font-display text-3xl font-semibold tabular-nums">{value}</p>
    <p className={`text-xs leading-relaxed ${accent ? "text-teal-100" : "text-muted-foreground"}`}>{note}</p>
  </div>;
}

type TickProps = { x?: number; y?: number; payload?: { value: string } };

// Narrow screens get short territory labels and a narrower axis. Read through
// useSyncExternalStore so the server render (false) and the first client
// render agree, and the switch happens without an effect.
const NARROW = "(max-width: 640px)";
const subscribeNarrow = (cb: () => void) => {
  const mq = window.matchMedia(NARROW);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const useNarrow = () => useSyncExternalStore(subscribeNarrow, () => window.matchMedia(NARROW).matches, () => false);

const SCOPE = "2025 · acquisti diretti";

export function PillarBPublic({ asset, initial }: { asset: EvScAsset; initial: Selection }) {
  const [sel, setSel] = useState<Selection>(initial);
  const [order, setOrder] = useState<"desc" | "asc">("desc");
  const narrow = useNarrow();
  const labelKey = narrow ? "shortLabel" : "label";
  // The URL is written beside the state, not inside the updater: an updater
  // must stay pure (React may run it twice), and replaceState is an effect.
  const update = useCallback((patch: Partial<Selection>) => {
    const next = { ...sel, ...patch };
    setSel(next);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `${window.location.pathname}${selectionHref(next)}${window.location.hash}`);
    }
  }, [sel]);

  const territoryName = territoryLabel(asset, sel.territory);
  const moleculeName = MOLECULE_LABELS[sel.molecule];
  const measureName = MEASURE_LABELS[sel.measure];
  const row = rowFor(asset, sel);
  const italy = rowFor(asset, { ...sel, territory: ITALY });
  const italyShare = italy ? biosimilarShare(italy) : null;
  const diff = diffFromItaly(asset, sel);
  const presence = scFormPresence(asset, sel.molecule);
  // The POSITION is always "from the highest": the tile and the summary must
  // not change meaning when the table's direction is flipped. The direction
  // control sorts the table rows only.
  const rankDesc = useMemo(() => rankTerritories(asset, sel.molecule, sel.measure, "desc"), [asset, sel.molecule, sel.measure]);
  const tableRows = useMemo(() => (order === "desc" ? rankDesc : [...rankDesc].reverse()), [rankDesc, order]);
  const position = positionOf(rankDesc, sel.territory);
  const composition = useMemo(() => compositionRows(asset, sel.molecule, sel.measure, sel.territory), [asset, sel.molecule, sel.measure, sel.territory]);
  const byMeasure = measureComparison(asset, sel.molecule, sel.territory);
  const byMolecule = moleculeComparison(asset, sel.measure, sel.territory);
  const isItaly = sel.territory === ITALY;
  const builtOn = formatDate(asset.version);

  const territoryOptions = asset.territories.map((t) => ({ value: t.code, label: t.label }));
  const scopeLine = `${moleculeName} · ${measureName} · ${territoryName} · ${SCOPE}`;
  const withItaly = isItaly ? "" : " e Italia";

  const TerritoryTick = ({ x = 0, y = 0, payload }: TickProps) => {
    const r = composition.find((c) => c[labelKey] === payload?.value);
    return <text x={x} y={y} dy={4} textAnchor="end" fontSize={narrow ? 10 : 11}
      fontWeight={r?.selected ? 700 : r?.isItaly ? 600 : 400} fill={r?.selected ? INK : r?.isItaly ? INK : MUTED}>
      {r?.selected ? "▸ " : ""}{payload?.value}{r?.isItaly ? " ·" : ""}
    </text>;
  };
  const valueLabel = (v: unknown) => (v === null || v === undefined ? "" : pct(Number(v), 1));

  return <div className="mx-auto max-w-7xl space-y-8 px-5 py-10 sm:py-14">
    <div className="grid gap-6 md:grid-cols-[1fr_auto]">
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[.2em] text-[hsl(174_66%_28%)] dark:text-primary">Pillar B · Biosimilari ed esclusività / Osservatorio pubblico</p>
        <h1 className="font-display max-w-3xl text-3xl font-semibold leading-tight sm:text-5xl">
          Quota biosimilare e forma di somministrazione.<br /><span className="text-primary">Tre molecole, un anno, un canale.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Quanta parte di infliximab, rituximab e trastuzumab è biosimilare negli acquisti diretti del 2025,
          e in quale forma di somministrazione, territorio per territorio. Fonte pubblica AIFA: percentuali
          pubblicate, o somme di celle della stessa riga; nessun totale ricostruito.
        </p>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Questa pagina non contiene dati sull&apos;esclusività: brevetti, date di autorizzazione e protezione
          regolatoria non sono nella fonte. «Originator» è una classificazione di prodotto, non uno stato di esclusività.
        </p>
      </div>
      <div className="self-end rounded-xl border bg-card p-4 text-sm">
        <p className="font-semibold">AIFA · NSIS Tracciabilità del farmaco</p>
        <p className="mt-2 text-muted-foreground">Gennaio–dicembre 2025 · dato aggiornato a dicembre 2025</p>
        <p className="mt-1 text-muted-foreground">Elaborazione VIS del {builtOn}</p>
      </div>
    </div>

    <p className="rounded-lg border-l-4 border-primary bg-secondary/50 px-4 py-3 text-sm leading-relaxed">
      <strong>Perimetro di questa pagina:</strong> tre molecole (infliximab, rituximab, trastuzumab), un anno
      (gennaio–dicembre 2025), un canale (acquisti diretti). Le percentuali ripartiscono il totale di ciascuna
      molecola in ciascun territorio; la fonte non pubblica volumi né euro, quindi qui non ci sono totali, somme
      fra molecole o confronti di spesa assoluta. L&apos;analisi dei flussi locali, con i due denominatori di
      adozione, è nell&apos;<Link href="/dashboard-review/revisione-pillar-b" className={LINK}>area riservata</Link>.
    </p>

    <div className="grid gap-4 rounded-2xl border bg-card p-5 sm:grid-cols-3">
      <Select label="Territorio" value={sel.territory} onChange={(v) => update({ territory: v })} options={territoryOptions} />
      <Select label="Molecola" value={sel.molecule} onChange={(v) => update({ molecule: v as MoleculeId })}
        options={MOLECULES.map((m) => ({ value: m, label: MOLECULE_LABELS[m] }))} />
      <Select label="Misura" value={sel.measure} onChange={(v) => update({ measure: v as MeasureId })}
        options={MEASURES.map((m) => ({ value: m, label: `${MEASURE_LABELS[m]} · ${asset.measures.find((x) => x.id === m)?.note ?? ""}` }))} />
    </div>

    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Tile accent label="Quota biosimilare · tutte le forme" value={pct(row ? biosimilarShare(row) : null)}
        note={`${scopeLine}. Biosimilare EV + biosimilare SC, sul totale ${MEASURE_SENTENCE[sel.measure]} della molecola.`} />
      <Tile label="Quota della forma sottocutanea" value={pct(row ? scShare(row) : null)}
        note={`Originator SC + biosimilare SC, sul totale ${MEASURE_SENTENCE[sel.measure]} della molecola. ${presence === "solo biosimilare" ? "Per questa molecola la forma SC compare solo come biosimilare."
          : presence === "solo originator" ? "Per questa molecola la forma SC compare solo come originator."
          : presence === "assente" ? "Nessuna forma sottocutanea nel dato." : ""}`} />
      <Tile label="Differenza da Italia" value={isItaly ? "riferimento" : pp(diff)}
        note={isItaly ? "L'Italia è il dato nazionale della stessa tabella." : `Punti percentuali di quota biosimilare rispetto all'Italia (${pct(italyShare)}), stessa molecola, misura e periodo.`} />
      <Tile label="Posizione fra i territori" value={isItaly || !position ? "—" : `${ordinal(position.position)}${position.tied ? "=" : ""} su ${rankDesc.length}`}
        note={isItaly ? "L'Italia non è in graduatoria: è il dato nazionale della stessa tabella." : "Per quota biosimilare, contando dalla più alta. A parità di quota la posizione è condivisa (=)."} />
    </div>

    <p className="text-sm leading-relaxed text-muted-foreground">{scFormSentence(sel.molecule, presence)}{" "}
      La forma endovenosa (EV) e quella sottocutanea (SC) sono formulazioni diverse della stessa molecola: la loro
      quota descrive cosa è stato acquistato, non l&apos;appropriatezza della scelta.</p>

    <Panel title={`Composizione per territorio · ${moleculeName} · ${measureName}`}
      note={`Ogni barra ripartisce il 100 % ${MEASURE_SENTENCE[sel.measure]} di ${moleculeName} nel territorio (${SCOPE}) fra biosimilare (verde acqua) e originator (ambra); la forma sottocutanea è tratteggiata. Territori ordinati per quota biosimilare; l'Italia (·) è il riferimento, il territorio selezionato è in evidenza (▸).`}>
      <div className="h-[36rem]" role="img" aria-label={`Composizione ${MEASURE_SENTENCE[sel.measure]} di ${moleculeName} per territorio, ${SCOPE}; territorio selezionato: ${territoryName}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={composition} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }} barCategoryGap={3}>
            <Hatches />
            <CartesianGrid horizontal={false} strokeDasharray="3 5" stroke="hsl(var(--border))" />
            {/* Rows of two-decimal percentages can sum to 100,01: the axis stays
                at 100 and the hundredth of a point overflowing it is clipped,
                rather than the scale stretching to a "100,01 %" tick. */}
            <XAxis type="number" domain={[0, 100]} allowDataOverflow ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} tick={tick} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey={labelKey} width={narrow ? 100 : 160} interval={0} tick={TerritoryTick} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tipStyle} itemStyle={tipItem} formatter={(v, name) => [pct(Number(v)), String(name)]}
              labelFormatter={(label) => composition.find((c) => c[labelKey] === label)?.label ?? String(label)} />
            <Legend wrapperStyle={{ fontSize: 12 }} formatter={legendText} />
            {COMPONENTS.map((c) => <Bar key={c} dataKey={c} name={COMPONENT_LABELS[c]} stackId="s" fill={FILL[c]}
              stroke="hsl(var(--card))" strokeWidth={1} isAnimationActive={false} />)}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-4">
        <summary className={`cursor-pointer text-xs ${LINK} no-underline`}>Apri la tabella · {moleculeName} · {measureName}</summary>
        <div className="mt-3 max-h-96 overflow-auto rounded-xl border">
          <table className="w-full min-w-[36rem] text-sm" translate="no">
            <caption className="sr-only">Composizione {MEASURE_SENTENCE[sel.measure]} di {moleculeName} per territorio, {SCOPE}, in percentuale del totale della molecola nel territorio</caption>
            <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground">
              <tr><th scope="col" className="py-2.5 pl-3">Territorio</th>{COMPONENTS.map((c) => <th scope="col" key={c} className="whitespace-nowrap py-2.5 pr-3 text-right">{COMPONENT_LABELS[c]}</th>)}<th scope="col" className="whitespace-nowrap py-2.5 pr-3 text-right">quota biosimilare</th></tr>
            </thead>
            <tbody>
              {composition.map((r) => <tr key={r.territory} aria-current={r.selected ? "true" : undefined} className={`border-t ${r.selected ? "bg-secondary/60 font-semibold" : r.isItaly ? "italic" : ""}`}>
                <th scope="row" className="py-2 pl-3 text-left font-normal">{r.selected ? <span className="font-semibold">▸ {r.label}<span className="sr-only"> (selezionato)</span></span> : r.label}</th>
                {COMPONENTS.map((c) => <td key={c} className="whitespace-nowrap py-2 pr-3 text-right font-mono text-xs">{pct(r[c])}</td>)}
                <td className="whitespace-nowrap py-2 pr-3 text-right font-mono text-xs">{pct(Math.round((r.biosimilar_ev + r.biosimilar_sc) * 100) / 100)}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </details>
    </Panel>

    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title={`Tre misure, stessa molecola · ${moleculeName}`}
        note={`Quota biosimilare di ${moleculeName} in ${territoryName}${isItaly ? "" : " e in Italia"} secondo confezioni, DDD e spesa (${SCOPE}). Le tre misure contano gli stessi acquisti con unità diverse, quindi le ripartizioni possono divergere: una confezione non contiene sempre le stesse DDD, e i valori unitari differiscono fra prodotti. La fonte non pubblica prezzi né la causa del divario.`}>
        <div className="h-72" role="img" aria-label={`Quota biosimilare di ${moleculeName} per misura, ${territoryName}${withItaly}, ${SCOPE}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byMeasure} margin={{ left: 0, right: 12, top: 22, bottom: 4 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 5" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={tick} width={48} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tipStyle} itemStyle={tipItem} formatter={(v, name) => [pct(Number(v)), String(name)]} />
              <Legend wrapperStyle={{ fontSize: 12 }} formatter={legendText} />
              <Bar dataKey="territory" name={territoryName} fill={TEAL} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                <LabelList dataKey="territory" position="top" formatter={valueLabel} style={{ fill: INK, fontSize: 10 }} />
              </Bar>
              {!isItaly && <Bar dataKey="italy" name="Italia" fill={ITALY_COLOR} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                <LabelList dataKey="italy" position="top" formatter={valueLabel} style={{ fill: INK, fontSize: 10 }} />
              </Bar>}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <table className="mt-3 w-full text-xs" translate="no">
          <caption className="sr-only">Quota biosimilare di {moleculeName} per misura, {territoryName}{withItaly}, {SCOPE}</caption>
          <thead className="text-left text-muted-foreground"><tr><th scope="col" className="py-1.5">Misura</th><th scope="col" className="py-1.5 text-right">{territoryName}</th>{!isItaly && <th scope="col" className="py-1.5 text-right">Italia</th>}<th scope="col" className="py-1.5 text-right">quota forma SC · {territoryName}</th></tr></thead>
          <tbody>{byMeasure.map((m) => <tr key={m.measure} className="border-t"><th scope="row" className="py-1.5 text-left font-normal">{m.label}</th><td className="whitespace-nowrap py-1.5 text-right font-mono">{pct(m.territory)}</td>{!isItaly && <td className="whitespace-nowrap py-1.5 text-right font-mono">{pct(m.italy)}</td>}<td className="whitespace-nowrap py-1.5 text-right font-mono">{pct(m.territorySc)}</td></tr>)}</tbody>
        </table>
      </Panel>
      <Panel title={`Tre molecole, stessa misura · ${measureName}`}
        note={`Quota biosimilare ${MEASURE_SENTENCE[sel.measure]} per ciascuna molecola in ${territoryName}${isItaly ? "" : " e in Italia"} (${SCOPE}). Ogni molecola ha il proprio 100 %: le barre si leggono una per una, non si sommano.`}>
        <div className="h-72" role="img" aria-label={`Quota biosimilare per molecola, ${measureName}, ${territoryName}${withItaly}, ${SCOPE}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byMolecule} margin={{ left: 0, right: 12, top: 22, bottom: 4 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 5" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={tick} width={48} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tipStyle} itemStyle={tipItem} formatter={(v, name) => [pct(Number(v)), String(name)]} />
              <Legend wrapperStyle={{ fontSize: 12 }} formatter={legendText} />
              <Bar dataKey="territory" name={territoryName} fill={TEAL} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                <LabelList dataKey="territory" position="top" formatter={valueLabel} style={{ fill: INK, fontSize: 10 }} />
              </Bar>
              {!isItaly && <Bar dataKey="italy" name="Italia" fill={ITALY_COLOR} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                <LabelList dataKey="italy" position="top" formatter={valueLabel} style={{ fill: INK, fontSize: 10 }} />
              </Bar>}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <table className="mt-3 w-full text-xs" translate="no">
          <caption className="sr-only">Quota biosimilare per molecola, {measureName}, {territoryName}{withItaly}, {SCOPE}</caption>
          <thead className="text-left text-muted-foreground"><tr><th scope="col" className="py-1.5">Molecola</th><th scope="col" className="py-1.5 text-right">{territoryName}</th>{!isItaly && <th scope="col" className="py-1.5 text-right">Italia</th>}</tr></thead>
          <tbody>{byMolecule.map((m) => <tr key={m.molecule} className="border-t"><th scope="row" className="py-1.5 text-left font-normal">{m.label}</th><td className="whitespace-nowrap py-1.5 text-right font-mono">{pct(m.territory)}</td>{!isItaly && <td className="whitespace-nowrap py-1.5 text-right font-mono">{pct(m.italy)}</td>}</tr>)}</tbody>
        </table>
      </Panel>
    </div>

    <Panel title={`Graduatoria dei territori · ${moleculeName} · ${measureName}`}
      note={`I 21 territori AIFA per quota biosimilare ${MEASURE_SENTENCE[sel.measure]} di ${moleculeName} (${SCOPE}); la tabella è mostrata ${order === "desc" ? "dalla quota più alta" : "dalla quota più bassa"}, la posizione si conta sempre dalla più alta. Ordina una ripartizione, non la qualità clinica né l'appropriatezza: composizione dei pazienti, forme disponibili e gare variano fra territori, e la graduatoria non identifica risparmi conseguibili.`}
      control={<Select label="Ordine della tabella" value={order} onChange={(v) => setOrder(v as "desc" | "asc")}
        options={[{ value: "desc", label: "Dalla quota più alta" }, { value: "asc", label: "Dalla quota più bassa" }]} />}>
      {!isItaly && position && <p className="mb-3 rounded-lg bg-secondary/50 px-4 py-2.5 text-sm">
        <span className="font-semibold">{territoryName}</span>: {ordinal(position.position)}{position.tied ? "=" : ""} su {rankDesc.length} contando dalla quota più alta ({pct(position.share)}); Italia {pct(italyShare)}.
      </p>}
      <div className="max-h-96 overflow-auto rounded-xl border">
        <table className="w-full text-sm" translate="no">
          <caption className="sr-only">Graduatoria dei territori per quota biosimilare {MEASURE_SENTENCE[sel.measure]} di {moleculeName}, {SCOPE}; posizione contata dalla quota più alta</caption>
          <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground">
            <tr><th scope="col" className="py-3 pl-3 pr-2 text-right">#</th><th scope="col" className="py-3">Territorio</th><th scope="col" className="whitespace-nowrap py-3 pr-3 text-right">Quota biosimilare</th><th scope="col" className="hidden whitespace-nowrap py-3 pr-3 text-right sm:table-cell">di cui EV</th><th scope="col" className="hidden whitespace-nowrap py-3 pr-3 text-right sm:table-cell">di cui SC</th><th scope="col" className="hidden whitespace-nowrap py-3 pr-3 text-right sm:table-cell">Originator</th></tr>
          </thead>
          <tbody>
            {tableRows.map((r) => {
              const selected = r.territory === sel.territory;
              return <tr key={r.territory} aria-current={selected ? "true" : undefined} className={`border-t ${selected ? "bg-secondary/60 font-semibold" : ""}`}>
                <td className="whitespace-nowrap py-2.5 pl-3 pr-2 text-right font-mono text-muted-foreground">{r.position}{r.tied ? "=" : ""}</td>
                <th scope="row" className="py-2.5 text-left font-normal">{selected ? <span className="font-semibold">▸ {r.label}<span className="sr-only"> (selezionato)</span></span> : r.label}</th>
                <td className="whitespace-nowrap py-2.5 pr-3 text-right font-mono">{pct(r.share)}</td>
                <td className="hidden whitespace-nowrap py-2.5 pr-3 text-right font-mono text-xs text-muted-foreground sm:table-cell">{pct(r.row.biosimilar_ev)}</td>
                <td className="hidden whitespace-nowrap py-2.5 pr-3 text-right font-mono text-xs text-muted-foreground sm:table-cell">{pct(r.row.biosimilar_sc)}</td>
                <td className="hidden whitespace-nowrap py-2.5 pr-3 text-right font-mono text-xs text-muted-foreground sm:table-cell">{pct(originatorShare(r.row))}</td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Posizioni secondo la graduatoria standard: a parità di quota (due decimali) i territori condividono la
        posizione, segnalata con «=», e la successiva salta di conseguenza. L&apos;Italia non è in graduatoria. Le due
        province autonome sono unità distinte nella fonte e restano distinte qui. Su schermi stretti la tabella mostra
        solo la quota totale; la ripartizione EV/SC è nella tabella della composizione.
      </p>
    </Panel>

    <Panel title="Come leggere gli indicatori" note="Una tabella AIFA, quattro colonne, un solo 100 %.">
      <dl className="grid gap-5 text-sm md:grid-cols-2">
        <div><dt className="font-semibold">Il 100 %</dt><dd className="mt-2 text-muted-foreground">Per ogni molecola e territorio, il totale {MEASURE_SENTENCE[sel.measure]} nel canale degli acquisti diretti. Le quattro colonne (originator EV, biosimilare EV, originator SC, biosimilare SC) lo ripartiscono; la quota biosimilare è la somma delle due colonne biosimilari della stessa riga.</dd></div>
        <div><dt className="font-semibold">EV e SC</dt><dd className="mt-2 text-muted-foreground">Forma endovenosa e sottocutanea della stessa molecola: formulazioni diverse. La ripartizione in spesa può non coincidere con quella in DDD o in confezioni, perché le tre misure usano unità diverse; la fonte non pubblica prezzi unitari né spiega il divario.</dd></div>
        <div><dt className="font-semibold">Confezioni, DDD, spesa</dt><dd className="mt-2 text-muted-foreground">Confezioni: unità di confezionamento tracciate. DDD: dosi definite giornaliere, l&apos;unità tecnica dell&apos;OMS. Spesa: valori di tracciabilità. Nessuna delle tre è una dose prescritta né un conteggio di pazienti.</dd></div>
        <div><dt className="font-semibold">Originator e biosimilare</dt><dd className="mt-2 text-muted-foreground">Classificazione della fonte. Una quota biosimilare alta descrive cosa è stato acquistato; non misura l&apos;appropriatezza né il risparmio ottenuto. «Originator» non significa che il prodotto sia in esclusività.</dd></div>
        <div><dt className="font-semibold">Cosa non c&apos;è</dt><dd className="mt-2 text-muted-foreground">Volumi ed euro assoluti, totali fra molecole, anni precedenti, altre molecole, canali diversi dagli acquisti diretti, dati brevettuali o di esclusività. Una «quota biosimilare della sola forma EV» avrebbe un denominatore che la fonte non pubblica, e non è calcolata.</dd></div>
        <div><dt className="font-semibold">Differenze fra territori</dt><dd className="mt-2 text-muted-foreground">Sono differenze di ripartizione in punti percentuali, sulla stessa tabella. Non tengono conto della composizione dei pazienti, delle gare né delle forme disponibili localmente.</dd></div>
      </dl>
    </Panel>

    <Panel title="Dalla visualizzazione alla fonte" note="Ogni percentuale di questa pagina è una cella della tabella AIFA citata o la somma di celle della stessa riga (stesso 100 %); le differenze sono in punti percentuali. Le celle sono lette per coordinate dal PDF e verificate riga per riga.">
      <div className="grid gap-6 md:grid-cols-3">
        <div>
          <h3 className="font-semibold">Documento</h3>
          <p className="mt-2 text-sm text-muted-foreground">{asset.source.title}. {asset.source.publisher}. {asset.source.edition}.{" "}
            <a href={asset.source.url} className={LINK} rel="noopener noreferrer" target="_blank">Scarica il PDF dal sito AIFA</a>.</p>
        </div>
        <div>
          <h3 className="font-semibold">Tabelle</h3>
          <p className="mt-2 text-sm text-muted-foreground">Nove tabelle (tre molecole × confezioni, DDD, spesa), 21 territori più Italia ciascuna, alle pagine stampate 2–4, 6–8 e 10–12. Ogni riga è stata verificata: quattro colonne che sommano a 100,0 %, etichette identiche in tutte le tabelle.</p>
        </div>
        <div>
          <h3 className="font-semibold">Oltre questa pagina</h3>
          <p className="mt-2 text-sm text-muted-foreground">L&apos;analisi dei flussi regionali — spesa, perimetro, due denominatori di adozione, primo uso locale — è riservata e resta dietro autenticazione.{" "}
            <Link href="/dashboard-review/revisione-pillar-b" className={LINK}>Area riservata →</Link>{" "}
            Le serie pubbliche di spesa e attività sono in <Link href="/pillar-a" className={LINK}>Pillar A</Link>.</p>
        </div>
      </div>
    </Panel>
    <footer className="border-t py-3 text-xs text-muted-foreground">VIS Pharma Compass · Fonte pubblica AIFA (elaborazione AIFA del 3 luglio 2026) · Elaborazione VIS del {builtOn}</footer>
  </div>;
}
