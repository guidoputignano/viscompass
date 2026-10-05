// Bridge B (workbook sheet 09), led by the perimeter.
//
// The decision view opens on the biosimilar perimeter opened out into its
// gates, with euros and the share of the reported total for each; the
// whole-ledger reconciliation (the total, the spend outside the perimeter,
// the residual and the two-way perimeter check) is kept in a collapsed audit
// view below it. Nothing is hidden and no denominator changes: every share
// on the page is of the same reported total, named in the column heading.
//
// Server-rendered SVG, no state. No share of the perimeter is printed
// anywhere: the biosimilar share by status is the third adoption denominator
// the project forbids. The chart is never drawn over a disagreement between
// the two perimeter readings, nor over a negative gate (credit notes can net
// a narrow scope below zero), where only the table is honest.

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

/** One sentence per gate on what a reader can do with it; none is a saving. */
const ACTION: Record<BridgeBGate["id"], string> = {
  B0_outside_perimeter: "Nessuna decisione sui biosimilari: è il resto del libro mastro, mostrato perché nulla sia nascosto.",
  B_BIOSIMILAR_SPEND: "Già biosimilare: nessuna domanda di sostituzione.",
  B1_before_status_valid: "Nessuna alternativa esisteva: non è una domanda.",
  B2_boundary_month_unsplittable: "Non assegnabile: il mese non si divide.",
  B3_date_unknown: "Da documentare: manca la data di validità nelle fonti.",
  B4_eu_authorised_never_bought_here: "Domanda di evidenza: il biosimilare è autorizzato in EU; lo stato in Italia e la disponibilità vanno verificati prima di leggerlo come alternativa (lista «non osservato qui»).",
  B_ADDRESSABLE_REFERENCE: "Domanda di revisione organizzativa, molecola per molecola (lista «dopo il primo uso locale»). NON è un risparmio né un'indicazione prescrittiva.",
};

function Swatch({ id }: { id: BridgeBGate["id"] }) {
  return <i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: COLOR[id] }} />;
}

export function BridgeBChart({ bridge, check, monthsLabel, scopeLabel }: {
  bridge: BridgeB;
  check: BridgeBPerimeterCheck | null;
  /** "12 e 12 mesi osservati": the scope label already names the years. */
  monthsLabel: string;
  scopeLabel: string;
}) {
  const width = 760, left = 16, right = 744, barH = 34, span = right - left;
  const b0 = bridge.gates.find((g) => g.id === "B0_outside_perimeter");
  const perimeterGates = bridge.gates.filter((g) => g.id !== "B0_outside_perimeter");
  const perimeterShare = bridge.total === 0 ? null : bridge.perimeter / bridge.total;
  const b0W = Math.max(0, Math.min(1, b0?.shareOfTotal ?? 0)) * span;
  const perW = Math.max(0, Math.min(1, perimeterShare ?? 0)) * span;
  // The perimeter enlarged to the full width, each gate in proportion to its
  // euros. Widths are geometry only; no ratio is printed.
  const segs = perimeterGates.reduce<Array<{ g: BridgeBGate; x: number; w: number }>>((acc, g) => {
    const x = acc.length ? acc[acc.length - 1].x + acc[acc.length - 1].w : left;
    const w = bridge.perimeter > 0 ? Math.max(0, g.eur) / bridge.perimeter * span : 0;
    return [...acc, { g, x, w }];
  }, []);
  const consistent = check === null || check.consistent;
  const negative = bridge.gates.filter((g) => g.eur < 0);
  const drawable = consistent && negative.length === 0 && bridge.total > 0 && bridge.perimeter > 0;
  const totalHeading = `Del totale rendicontato (${formatEur(bridge.total)})`;

  return (
    <figure className="overflow-hidden rounded-xl border border-border bg-card p-4 sm:p-5">
      <figcaption className="mb-3">
        <p className="text-sm font-semibold text-foreground">Il perimetro biosimilare, soglia per soglia · {formatEur(bridge.perimeter)}{perimeterShare === null ? "" : ` · ${formatPercent(perimeterShare)} del totale rendicontato`}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
          {scopeLabel} · {monthsLabel}. Biosimilari e medicinali di riferimento, in ogni mese; ogni euro del perimetro esce da una
          sola soglia. Le percentuali sono tutte <strong>spesa della soglia ÷ totale rendicontato della selezione</strong> ({formatEur(bridge.total)}),
          mai quote del perimetro. Il foglio 09 del workbook ripartisce i 29 mesi del rilascio; qui il periodo è quello
          selezionato, mai il 2026 incompleto. L&apos;ultima soglia è una popolazione di spesa, <strong>non un risparmio</strong>.
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
            <svg role="img" viewBox={`0 0 ${width} 72`} className="w-full min-w-[34rem]" xmlns="http://www.w3.org/2000/svg"
              aria-label={`Perimetro biosimilare ${formatEur(bridge.perimeter)}, ripartito in ${perimeterGates.map((g) => `${g.label} ${formatEur(g.eur)}`).join(", ")}`}>
              <text x={left} y={14} fontSize="11" fill={muted}>Il perimetro ingrandito a tutta larghezza; gli importi sono nella tabella</text>
              {segs.map(({ g, x, w }) => (
                <rect key={g.id} x={x} y={22} width={Math.max(0, w - 1)} height={barH} fill={COLOR[g.id]} stroke={cardBg} strokeWidth="1" />
              ))}
            </svg>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            {perimeterGates.map((g) => <span key={g.id}><Swatch id={g.id} />{g.label}</span>)}
          </div>
        </>
      )}
      <div className="mt-3 overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[46rem] text-sm" translate="no">
          <caption className="sr-only">Perimetro biosimilare per soglia: spesa, quota del totale rendicontato, e che cosa se ne può fare ({scopeLabel} · {monthsLabel})</caption>
          <thead className="bg-muted/50 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2.5 text-left font-semibold">Soglia</th>
              <th scope="col" className="px-4 py-2.5 text-left font-semibold">Significato · che cosa se ne fa</th>
              <th scope="col" className="px-4 py-2.5 text-right font-semibold">Spesa</th>
              <th scope="col" className="px-4 py-2.5 text-right font-semibold">{totalHeading}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {perimeterGates.map((g) => (
              <tr key={g.id}>
                <th scope="row" className="px-4 py-2.5 text-left text-xs font-medium text-foreground">
                  <Swatch id={g.id} />{g.label}
                  <span className="block font-mono text-[10px] font-normal text-muted-foreground">{g.id}</span>
                </th>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{g.meaning}<span className="mt-0.5 block text-foreground">{ACTION[g.id]}</span></td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono text-xs">{formatEur(g.eur)}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono text-xs">{g.shareOfTotal === null ? "—" : formatPercent(g.shareOfTotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-muted/30">
            <tr>
              <td className="px-4 py-2.5 text-xs font-semibold text-foreground" colSpan={2}>Perimetro biosimilare · somma delle {formatNumber(perimeterGates.length, 0)} soglie</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono text-xs font-semibold">{formatEur(bridge.perimeter)}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono text-xs font-semibold">{perimeterShare === null ? "—" : formatPercent(perimeterShare)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* THE AUDIT VIEW: the whole ledger, the spend outside the perimeter,
          the residual and the two-way check. Collapsed, never removed. */}
      <details className="mt-3 rounded-xl border border-border bg-muted/20 px-4 py-3">
        <summary className="cursor-pointer text-xs font-semibold text-primary">
          Riconciliazione con il totale del libro mastro · {formatEur(bridge.total)} · fuori dal perimetro {formatEur(b0?.eur ?? 0)}{b0?.shareOfTotal == null ? "" : ` (${formatPercent(b0.shareOfTotal)})`}
        </summary>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          Il totale rendicontato della selezione esce da una sola soglia in più: «fuori dal perimetro», né biosimilare né
          medicinale di riferimento nominato in un EPAR. Non entra in nessuna decisione sui biosimilari; è mostrato perché il
          perimetro sia letto nella sua proporzione e nulla sia nascosto. Residuo della ripartizione: {formatEurPrecise(bridge.residual)}.
        </p>
        {drawable && (
          <div className="mt-2 overflow-x-auto">
            <svg role="img" viewBox={`0 0 ${width} 76`} className="w-full min-w-[34rem]" xmlns="http://www.w3.org/2000/svg"
              aria-label={`Totale rendicontato ${formatEur(bridge.total)}, di cui fuori dal perimetro ${formatEur(b0?.eur ?? 0)} e perimetro biosimilare ${formatEur(bridge.perimeter)}`}>
              <rect x={left} y={10} width={b0W} height={barH} rx="4" fill={COLOR.B0_outside_perimeter} />
              <rect x={left + b0W} y={10} width={perW} height={barH} rx="4" fill={COLOR.B_BIOSIMILAR_SPEND} fillOpacity="0.35" stroke={COLOR.B_BIOSIMILAR_SPEND} strokeWidth="1.5" />
              <text x={left} y={10 + barH + 16} fontSize="11" fill={ink}>fuori dal perimetro · {formatEur(b0?.eur ?? 0)} · {b0?.shareOfTotal == null ? "n/d" : formatPercent(b0.shareOfTotal)}</text>
              <text x={right} y={10 + barH + 16} fontSize="11" fill={ink} textAnchor="end">perimetro biosimilare · {formatEur(bridge.perimeter)} · {perimeterShare === null ? "n/d" : formatPercent(perimeterShare)}</text>
            </svg>
          </div>
        )}
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          {check && check.consistent
            ? `Perimetro verificato due volte: la funzione di uptake (${formatEurPrecise(bridge.perimeter)}) e la classificazione per stato (${formatEurPrecise(check.facetsPerimeter)}) coincidono al centesimo.`
            : check === null ? "Perimetro letto dalla sola funzione di uptake: la classificazione per stato non è disponibile in questa selezione." : null}
          {" "}Nessuna quota del perimetro è stampata: la quota biosimilare per stato non è una delle due quote pubblicate (vedi Evidenza).
          {" "}Spesa lorda, IVA inclusa. {formatNumber(bridge.gates.length, 0)} soglie in tutto, «fuori dal perimetro» inclusa.
        </p>
      </details>
    </figure>
  );
}
