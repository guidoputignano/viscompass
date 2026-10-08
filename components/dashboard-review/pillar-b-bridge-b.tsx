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
//
// NARROW CONTAINERS. The three wide drawings (the per-gate bars and the
// whole-ledger bar, both 760 units wide, and the four-column gate table) need
// 47.5rem, 47.5rem and 46rem of their own wrapper; inside a phone or tablet
// card they were up to two-thirds hidden behind a sideways scroll, or their
// text shrank to 7-8 px. Each wrapper is a size container and switches on its
// own width, not the viewport's: under the threshold the same values are
// re-flowed (names on their own line, a stacked list for the table), with the
// same formatters and the same exact-value labels. Both variants are always in
// the markup and the inactive one is display:none, so only one is read.

import { formatEur, formatEurPrecise, formatNumber, formatPercent } from "@/lib/dashboard-review/format";
import { bridgeBPublishable, type BridgeB, type BridgeBGate, type BridgeBPerimeterCheck } from "@/lib/dashboard-review/pillar-b/bridge-b";

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
const SHORT_LABEL: Record<BridgeBGate["id"], string> = {
  B0_outside_perimeter: "Fuori perimetro",
  B_BIOSIMILAR_SPEND: "Già biosimilare",
  B1_before_status_valid: "Prima della validità",
  B2_boundary_month_unsplittable: "Mese di confine",
  B3_date_unknown: "Data non disponibile",
  B4_eu_authorised_never_bought_here: "EU, non osservato qui",
  B_ADDRESSABLE_REFERENCE: "Riferimento dopo primo uso",
};

/** One sentence per gate on what a reader can do with it; none is a saving. */
const ACTION: Record<BridgeBGate["id"], string> = {
  B0_outside_perimeter: "Nessuna decisione sui biosimilari: è il resto della spesa rendicontata, mostrato perché nulla sia nascosto.",
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

// THE NARROW DRAWINGS. The per-gate bars sit in about 235 px at a 375 px phone
// and the whole-ledger bar, one panel deeper, in about 200 px; the viewBoxes
// are close to those widths and the widths are capped, so 13-unit text renders
// at about 11-15 px, never at 7. Every name fits one line (pinned in
// tests/pillar-b-narrow-g4-bridge-b.test.mjs): nothing is shortened.
const NARROW_GATES = { width: 256, left: 2, right: 254, top: 2, row: 46, font: 13, valueColumn: 116 } as const;
const NARROW_LEDGER = { width: 216, left: 1, right: 215, barH: 24, font: 13, swatch: 11 } as const;

/** The per-gate bars below 47.5rem: the name on its own line, the bar under it, the euro value at the right. */
function GateBarsNarrow({ gates, maxGate, ariaLabel }: { gates: BridgeBGate[]; maxGate: number; ariaLabel: string }) {
  const { width, left, right, top, row, font, valueColumn } = NARROW_GATES;
  const barMax = right - left - valueColumn;
  const height = top + gates.length * row - 8;
  return (
    <svg role="img" viewBox={`0 0 ${width} ${height}`} className="w-full max-w-[18rem]" xmlns="http://www.w3.org/2000/svg" aria-label={ariaLabel}>
      {gates.map((g, index) => {
        const y0 = top + index * row;
        return <g key={g.id}>
          <text x={left} y={y0 + 13} fontSize={font} fill={ink}>{SHORT_LABEL[g.id]}</text>
          <rect x={left} y={y0 + 19} width={barMax * g.eur / maxGate} height={16} rx="3" fill={COLOR[g.id]} stroke={cardBg} strokeWidth="1" />
          <text x={right} y={y0 + 32} textAnchor="end" fontSize={font} fill={ink}>{formatEur(g.eur)}</text>
          {index < gates.length - 1 && <line x1={0} y1={y0 + 41} x2={width} y2={y0 + 41} stroke="hsl(var(--border))" strokeWidth="1" />}
        </g>;
      })}
    </svg>
  );
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
  const b0Fraction = Math.max(0, Math.min(1, b0?.shareOfTotal ?? 0));
  const perFraction = Math.max(0, Math.min(1, perimeterShare ?? 0));
  const b0W = b0Fraction * span;
  const perW = perFraction * span;
  const maxGate = Math.max(1, ...perimeterGates.map((g) => g.eur));
  const consistent = check?.consistent === true;
  const negative = bridge.gates.filter((g) => g.eur < 0);
  const drawable = bridgeBPublishable(bridge, check);
  const totalHeading = `Della spesa rendicontata (${formatEur(bridge.total)})`;
  const gatesAria = `Spesa assoluta per soglia, in euro: ${perimeterGates.map((g) => `${g.label} ${formatEur(g.eur)}`).join(", ")}`;
  const ledgerAria = `Totale rendicontato ${formatEur(bridge.total)}, di cui fuori dal perimetro ${formatEur(b0?.eur ?? 0)} e perimetro biosimilare ${formatEur(bridge.perimeter)}`;
  const b0Value = `${formatEur(b0?.eur ?? 0)} · ${b0?.shareOfTotal == null ? "n/d" : formatPercent(b0.shareOfTotal)}`;
  const perimeterValue = `${formatEur(bridge.perimeter)} · ${perimeterShare === null ? "n/d" : formatPercent(perimeterShare)}`;
  const caption = `Perimetro biosimilare per soglia: spesa, quota del totale rendicontato, e che cosa se ne può fare (${scopeLabel} · ${monthsLabel})`;
  const nl = NARROW_LEDGER, nlSpan = nl.right - nl.left;

  return (
    <figure className="overflow-hidden rounded-xl border border-border bg-card p-4 sm:p-5">
      <figcaption className="mb-3">
        <p className="text-sm font-semibold text-foreground">Il perimetro biosimilare, soglia per soglia · {formatEur(bridge.perimeter)}{perimeterShare === null ? "" : ` · ${formatPercent(perimeterShare)} della spesa rendicontata`}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
          {scopeLabel} · {monthsLabel}. Biosimilari e medicinali di riferimento, in ogni mese; ogni euro del perimetro esce da una
          sola soglia. Le percentuali sono tutte <strong>spesa della soglia ÷ spesa rendicontata della selezione</strong> ({formatEur(bridge.total)}).
          Il periodo è quello selezionato, mai il 2026 incompleto. L&apos;ultima soglia è una popolazione di spesa, <strong>non un risparmio</strong>.
        </p>
      </figcaption>
      {!consistent ? (
        <div role="alert" className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 text-xs leading-relaxed">
          <strong className="text-foreground">Ponte non disegnato.</strong> {check
            ? <>Il perimetro ricostruito mese per mese ({formatEurPrecise(bridge.perimeter)}) non coincide con la spesa dei prodotti con stato «biosimilare» e «medicinale di riferimento» ({formatEurPrecise(check.facetsPerimeter)}): differenza {formatEurPrecise(check.difference)}.</>
            : <>La lettura indipendente del perimetro non è disponibile in questa selezione.</>}
          {" "}Le due letture devono coincidere al centesimo prima che il ponte sia pubblicabile.
        </div>
      ) : negative.length > 0 ? (
        <p className="rounded-xl border border-border bg-muted/40 px-3.5 py-2.5 text-xs leading-relaxed text-muted-foreground">
          Barra non disegnata: in questa selezione {negative.length === 1 ? "una soglia è negativa" : `${formatNumber(negative.length, 0)} soglie sono negative`} ({negative.map((g) => g.label).join(", ")}),
          perché le note di credito superano le dispensazioni. La tabella resta esatta: la somma delle soglie è il totale.
        </p>
      ) : !drawable ? null : (
        <>
          {/* The per-gate bars: 760 units drawn 1:1 from 47.5rem of their own
              wrapper; under it, the narrow drawing with the heading as text. */}
          <div className="[container-type:inline-size]">
            <div className="[@container(min-width:47.5rem)]:hidden">
              <p className="mb-1.5 text-[11px] leading-relaxed text-muted-foreground">Spesa per soglia · barre indipendenti sulla stessa scala in euro; non una quota di adozione</p>
              <GateBarsNarrow gates={perimeterGates} maxGate={maxGate} ariaLabel={gatesAria} />
            </div>
            <div className="hidden overflow-x-auto [@container(min-width:47.5rem)]:block">
              <svg role="img" viewBox={`0 0 ${width} ${perimeterGates.length * 35 + 28}`} className="w-full min-w-[46rem]" xmlns="http://www.w3.org/2000/svg"
                aria-label={gatesAria}>
                <text x={left} y={13} fontSize="11" fill={muted}>Spesa per soglia · barre indipendenti sulla stessa scala in euro; non una quota di adozione</text>
                {perimeterGates.map((g, index) => {
                  const y = 23 + index * 35;
                  return <g key={g.id}>
                    <text x={left} y={y + 15} fontSize="10" fill={ink}>{SHORT_LABEL[g.id]}</text>
                    <rect x={280} y={y} width={360 * g.eur / maxGate} height={18} rx="3" fill={COLOR[g.id]} stroke={cardBg} strokeWidth="1" />
                    <text x={right} y={y + 15} textAnchor="end" fontSize="11" fill={ink}>{formatEur(g.eur)}</text>
                  </g>;
                })}
              </svg>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            {perimeterGates.map((g) => <span key={g.id}><Swatch id={g.id} />{g.label}</span>)}
          </div>
        </>
      )}
      {/* The gate table needs 46rem inside its border; under it, one item per
          gate in the same order, the perimeter total last. */}
      <div className="mt-3 overflow-hidden rounded-xl border border-border [container-type:inline-size]">
        <ul aria-label={caption} className="divide-y divide-border text-xs [@container(min-width:46rem)]:hidden" translate="no">
          {perimeterGates.map((g) => (
            <li key={g.id} className="px-3 py-2.5">
              <p className="font-medium text-foreground"><Swatch id={g.id} />{g.label}</p>
              <dl className="mt-1.5 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1">
                <dt className="text-muted-foreground">Spesa</dt>
                <dd className="whitespace-nowrap text-right font-mono">{formatEur(g.eur)}</dd>
                <dt className="text-muted-foreground">{totalHeading}</dt>
                <dd className="whitespace-nowrap text-right font-mono">{g.shareOfTotal === null ? "—" : formatPercent(g.shareOfTotal)}</dd>
                <dt className="col-span-2 mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Significato · che cosa se ne fa</dt>
                <dd className="col-span-2 text-muted-foreground">{g.meaning}<span className="mt-0.5 block text-foreground">{ACTION[g.id]}</span></dd>
              </dl>
            </li>
          ))}
          <li className="bg-muted/30 px-3 py-2.5">
            <p className="font-semibold text-foreground">Perimetro biosimilare · somma delle {formatNumber(perimeterGates.length, 0)} soglie</p>
            <dl className="mt-1.5 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1">
              <dt className="text-muted-foreground">Spesa</dt>
              <dd className="whitespace-nowrap text-right font-mono font-semibold">{formatEur(bridge.perimeter)}</dd>
              <dt className="text-muted-foreground">{totalHeading}</dt>
              <dd className="whitespace-nowrap text-right font-mono font-semibold">{perimeterShare === null ? "—" : formatPercent(perimeterShare)}</dd>
            </dl>
          </li>
        </ul>
        <div className="hidden overflow-x-auto [@container(min-width:46rem)]:block">
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
      </div>

      {/* THE AUDIT VIEW: the whole ledger, the spend outside the perimeter,
          the residual and the two-way check. Collapsed, never removed. */}
      <details className="mt-3 rounded-xl border border-border bg-muted/20 px-4 py-3">
        <summary className="cursor-pointer text-xs font-semibold text-primary">
          Riconciliazione con la spesa rendicontata · {formatEur(bridge.total)} · fuori dal perimetro {formatEur(b0?.eur ?? 0)}{b0?.shareOfTotal == null ? "" : ` (${formatPercent(b0.shareOfTotal)})`}
        </summary>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          Il totale rendicontato della selezione esce da una sola soglia in più: «fuori dal perimetro», né biosimilare né
          medicinale di riferimento nominato in un EPAR. Non entra in nessuna decisione sui biosimilari; è mostrato perché il
          perimetro sia letto nella sua proporzione e nulla sia nascosto. Residuo della ripartizione: {formatEurPrecise(bridge.residual)}.
        </p>
        {drawable && (
          // 760 units drawn 1:1 from 47.5rem of this wrapper. Under it, each
          // part's name on its own line, under the end of the bar it names (as
          // in the wide drawing) and beside a swatch drawn like its segment.
          <div className="mt-2 [container-type:inline-size]">
            <svg role="img" viewBox={`0 0 ${nl.width} 112`} className="w-full max-w-[15.5rem] [@container(min-width:47.5rem)]:hidden" xmlns="http://www.w3.org/2000/svg"
              aria-label={ledgerAria}>
              <rect x={nl.left} y={1} width={b0Fraction * nlSpan} height={nl.barH} rx="4" fill={COLOR.B0_outside_perimeter} />
              <rect x={nl.left + b0Fraction * nlSpan} y={1} width={perFraction * nlSpan} height={nl.barH} rx="4" fill={COLOR.B_BIOSIMILAR_SPEND} fillOpacity="0.35" stroke={COLOR.B_BIOSIMILAR_SPEND} strokeWidth="1.5" />
              <rect x={nl.left} y={34} width={nl.swatch} height={nl.swatch} rx="2" fill={COLOR.B0_outside_perimeter} />
              <text x={nl.left + 16} y={44} fontSize={nl.font} fill={ink}>fuori dal perimetro</text>
              <text x={nl.left + 16} y={63} fontSize={nl.font} fill={ink}>{b0Value}</text>
              <rect x={nl.right - nl.swatch} y={76} width={nl.swatch} height={nl.swatch} rx="2" fill={COLOR.B_BIOSIMILAR_SPEND} fillOpacity="0.35" stroke={COLOR.B_BIOSIMILAR_SPEND} strokeWidth="1.5" />
              <text x={nl.right - 16} y={86} fontSize={nl.font} fill={ink} textAnchor="end">perimetro biosimilare</text>
              <text x={nl.right - 16} y={105} fontSize={nl.font} fill={ink} textAnchor="end">{perimeterValue}</text>
            </svg>
            <div className="hidden overflow-x-auto [@container(min-width:47.5rem)]:block">
              <svg role="img" viewBox={`0 0 ${width} 76`} className="w-full min-w-[34rem]" xmlns="http://www.w3.org/2000/svg"
                aria-label={ledgerAria}>
                <rect x={left} y={10} width={b0W} height={barH} rx="4" fill={COLOR.B0_outside_perimeter} />
                <rect x={left + b0W} y={10} width={perW} height={barH} rx="4" fill={COLOR.B_BIOSIMILAR_SPEND} fillOpacity="0.35" stroke={COLOR.B_BIOSIMILAR_SPEND} strokeWidth="1.5" />
                <text x={left} y={10 + barH + 16} fontSize="11" fill={ink}>fuori dal perimetro · {formatEur(b0?.eur ?? 0)} · {b0?.shareOfTotal == null ? "n/d" : formatPercent(b0.shareOfTotal)}</text>
                <text x={right} y={10 + barH + 16} fontSize="11" fill={ink} textAnchor="end">perimetro biosimilare · {formatEur(bridge.perimeter)} · {perimeterShare === null ? "n/d" : formatPercent(perimeterShare)}</text>
              </svg>
            </div>
          </div>
        )}
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          {check && check.consistent
            ? `Perimetro verificato due volte: la ricostruzione mese per mese (${formatEurPrecise(bridge.perimeter)}) e la spesa per stato del prodotto (${formatEurPrecise(check.facetsPerimeter)}) coincidono al centesimo.`
            : check === null ? "Perimetro ricostruito solo mese per mese: la spesa per stato del prodotto non è disponibile in questa selezione." : null}
          {" "}La composizione del perimetro per stato del prodotto è in Evidenza, senza filtro di molecola; non è una quota di adozione.
          {" "}Spesa lorda, IVA inclusa. {formatNumber(bridge.gates.length, 0)} soglie in tutto, «fuori dal perimetro» inclusa.
        </p>
      </details>
    </figure>
  );
}
