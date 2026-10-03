// Bridge B (workbook sheet 09) as a two-level bar: the ledger total split
// into "outside the perimeter" and "perimeter", then the perimeter opened out
// into its gates down to the locally substitutable reference spend.
//
// Server-rendered SVG, no state: every mark is a figure that is also in the
// table below it. The lower bar is the perimeter enlarged so the gates can be
// told apart; no share of the perimeter is printed anywhere, because the
// biosimilar share by status is the third adoption denominator the project
// forbids. The perimeter cross-check against the status facet is shown as a
// sentence when it holds and as a warning when it does not; the chart is
// never drawn over a disagreement, and never over a negative gate (credit
// notes can net a narrow scope below zero), where only the table is honest.

import { formatEur, formatEurPrecise, formatNumber, formatPercent } from "@/lib/dashboard-review/format";
import type { BridgeB, BridgeBGate, BridgeBPerimeterCheck } from "@/lib/dashboard-review/pillar-b/bridge-b";

const ink = "hsl(var(--foreground))";
const muted = "hsl(var(--muted-foreground))";
const cardBg = "hsl(var(--card))";
const COLOR: Record<BridgeBGate["id"], string> = {
  B0_outside_perimeter: "hsl(204 15% 72%)",
  B_BIOSIMILAR_SPEND: "hsl(var(--primary))",
  B1_before_status_valid: "hsl(204 15% 48%)",
  B2_boundary_month_unsplittable: "hsl(38 92% 50%)",
  B3_date_unknown: "hsl(204 10% 60%)",
  B4_eu_authorised_never_bought_here: "#8b7fc0",
  B_ADDRESSABLE_REFERENCE: "#e87955",
};

export function BridgeBChart({ bridge, check, monthsLabel, scopeLabel }: {
  bridge: BridgeB;
  check: BridgeBPerimeterCheck | null;
  /** "12 e 12 mesi osservati": the scope label already names the years. */
  monthsLabel: string;
  scopeLabel: string;
}) {
  const width = 760, left = 16, right = 744, barH = 34, topY = 26, bottomY = 132, height = 180;
  const span = right - left;
  const b0 = bridge.gates.find((g) => g.id === "B0_outside_perimeter");
  const perimeterGates = bridge.gates.filter((g) => g.id !== "B0_outside_perimeter");
  const perimeterShare = bridge.total === 0 ? null : bridge.perimeter / bridge.total;
  const b0W = Math.max(0, Math.min(1, b0?.shareOfTotal ?? 0)) * span;
  const perW = Math.max(0, Math.min(1, perimeterShare ?? 0)) * span;
  // Lower bar: the perimeter enlarged to the full width, each gate in
  // proportion to its euros. Widths are geometry only; no ratio is printed.
  const segs = perimeterGates.reduce<Array<{ g: BridgeBGate; x: number; w: number }>>((acc, g) => {
    const x = acc.length ? acc[acc.length - 1].x + acc[acc.length - 1].w : left;
    const w = bridge.perimeter > 0 ? Math.max(0, g.eur) / bridge.perimeter * span : 0;
    return [...acc, { g, x, w }];
  }, []);
  const consistent = check === null || check.consistent;
  const negative = bridge.gates.filter((g) => g.eur < 0);
  const drawable = consistent && negative.length === 0 && bridge.total > 0 && bridge.perimeter > 0;

  return (
    <figure className="overflow-hidden rounded-xl border border-border bg-card p-4 sm:p-5">
      <figcaption className="mb-3">
        <p className="text-sm font-semibold text-foreground">Ponte B · dal totale del libro mastro alla spesa di riferimento sostituibile localmente</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
          Ogni euro esce da una sola soglia: le soglie ripartiscono il totale. {scopeLabel} · {monthsLabel}. Il foglio 09 del
          workbook ripartisce i 29 mesi del rilascio; qui il periodo è quello selezionato, mai il 2026 parziale.
          L&apos;ultima soglia è una popolazione di spesa, <strong>non un risparmio</strong>.
        </p>
      </figcaption>
      {!consistent && check ? (
        <div role="alert" className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 text-xs leading-relaxed">
          <strong className="text-foreground">Ponte non disegnato.</strong> Il perimetro letto dalla funzione di uptake
          ({formatEurPrecise(bridge.perimeter)}) non coincide con la spesa degli stati «biosimilare» e «medicinale di riferimento»
          della classificazione ({formatEurPrecise(check.facetsPerimeter)}): differenza {formatEurPrecise(check.difference)}. Le due
          letture devono coincidere al centesimo prima che il ponte sia pubblicabile.
        </div>
      ) : negative.length > 0 ? (
        <p className="rounded-xl border border-border bg-muted/40 px-3.5 py-2.5 text-xs leading-relaxed text-muted-foreground">
          Barra non disegnata: in questa selezione {negative.length === 1 ? "una soglia è negativa" : `${formatNumber(negative.length, 0)} soglie sono negative`} ({negative.map((g) => g.label).join(", ")}),
          perché le note di credito superano le dispensazioni. La tabella resta esatta: la somma delle soglie è il totale.
        </p>
      ) : !drawable ? null : (
        <>
          <div className="overflow-x-auto">
            <svg role="img" viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[34rem]" xmlns="http://www.w3.org/2000/svg"
              aria-label={`Ponte B: totale ${formatEur(bridge.total)}, di cui fuori dal perimetro ${formatEur(b0?.eur ?? 0)} e perimetro biosimilare ${formatEur(bridge.perimeter)}; il perimetro si ripartisce in ${perimeterGates.map((g) => `${g.label} ${formatEur(g.eur)}`).join(", ")}`}>
              <text x={left} y={topY - 8} fontSize="11" fill={muted}>Totale rendicontato · {formatEur(bridge.total)}</text>
              <rect x={left} y={topY} width={b0W} height={barH} rx="4" fill={COLOR.B0_outside_perimeter} />
              <rect x={left + b0W} y={topY} width={perW} height={barH} rx="4" fill={COLOR.B_BIOSIMILAR_SPEND} fillOpacity="0.35" stroke={COLOR.B_BIOSIMILAR_SPEND} strokeWidth="1.5" />
              <text x={left} y={topY + barH + 14} fontSize="11" fill={ink}>fuori dal perimetro · {formatEur(b0?.eur ?? 0)} · {b0?.shareOfTotal == null ? "n/d" : formatPercent(b0.shareOfTotal)}</text>
              <text x={right} y={topY + barH + 14} fontSize="11" fill={ink} textAnchor="end">perimetro biosimilare · {formatEur(bridge.perimeter)} · {perimeterShare === null ? "n/d" : formatPercent(perimeterShare)}</text>
              {/* the bridge: the perimeter segment opens out into the lower bar */}
              <path d={`M ${left + b0W} ${topY + barH} L ${left} ${bottomY} L ${right} ${bottomY} L ${left + b0W + perW} ${topY + barH} Z`} fill={COLOR.B_BIOSIMILAR_SPEND} fillOpacity="0.08" />
              <text x={left} y={bottomY - 8} fontSize="11" fill={muted}>Il perimetro ingrandito, soglia per soglia (gli importi sono nella tabella)</text>
              {segs.map(({ g, x, w }) => (
                <rect key={g.id} x={x} y={bottomY} width={Math.max(0, w - 1)} height={barH} fill={COLOR[g.id]} stroke={cardBg} strokeWidth="1" />
              ))}
            </svg>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            {bridge.gates.map((g) => <span key={g.id}><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: COLOR[g.id] }} />{g.label}</span>)}
          </div>
        </>
      )}
      <div className="mt-3 overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[40rem] text-sm" translate="no">
          <caption className="sr-only">Ponte B, soglia per soglia: spesa e quota del totale ({scopeLabel} · {monthsLabel})</caption>
          <thead className="bg-muted/50 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2.5 text-left font-semibold">Soglia</th>
              <th scope="col" className="px-4 py-2.5 text-left font-semibold">Significato</th>
              <th scope="col" className="px-4 py-2.5 text-right font-semibold">Spesa</th>
              <th scope="col" className="px-4 py-2.5 text-right font-semibold">Del totale</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {bridge.gates.map((g) => (
              <tr key={g.id}>
                <th scope="row" className="px-4 py-2.5 text-left text-xs font-medium text-foreground">
                  <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: COLOR[g.id] }} />{g.label}
                  <span className="block font-mono text-[10px] font-normal text-muted-foreground">{g.id}</span>
                </th>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{g.meaning}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono text-xs">{formatEur(g.eur)}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono text-xs">{g.shareOfTotal === null ? "—" : formatPercent(g.shareOfTotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-muted/30">
            <tr>
              <td className="px-4 py-2.5 text-xs font-semibold text-foreground" colSpan={2}>Somma delle soglie · residuo {formatEurPrecise(bridge.residual)}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono text-xs font-semibold">{formatEur(bridge.total - bridge.residual)}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono text-xs font-semibold">{bridge.total === 0 ? "—" : formatPercent(1)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        {check && check.consistent
          ? `Perimetro verificato due volte: la funzione di uptake (${formatEurPrecise(bridge.perimeter)}) e la classificazione per stato (${formatEurPrecise(check.facetsPerimeter)}) coincidono al centesimo.`
          : check === null ? "Perimetro letto dalla sola funzione di uptake: la classificazione per stato non è disponibile in questa selezione." : null}
        {" "}Nessuna quota del perimetro è stampata: la quota biosimilare per stato non è una delle due quote pubblicate (vedi Evidenza).
        {" "}Spesa lorda, IVA inclusa. {formatNumber(bridge.gates.length, 0)} soglie.
      </p>
    </figure>
  );
}
