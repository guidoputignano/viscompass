// Biosimilar vs reference adoption in VALUE, with both denominators.
//
// Server-rendered. The filters live in the page-level bar (pillar-b-filter-
// bar.tsx) and in the URL; this section only renders what the server fetched
// under them. The browser never receives rows it then narrows locally, which
// is also what keeps an Azienda from holding another Azienda's data.
//
// WHAT THIS VIEW MAY NOT SHOW, by evidence rather than preference:
//   - no package or quantity total: the source basis is mixed/unknown
//   - no saving: a dispersion or a gap is not money recoverable
//   - no exclusivity forecast: B15 publishes an upper bound, not a term
//   - 2026 is never a selectable year: five months, zero comparable-eligible

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { formatEur, formatNumber, formatPercent } from "@/lib/dashboard-review/format";
import type { ValueUptakeView } from "@/lib/dashboard-review/pillar-b/value-uptake";
import type { DumbbellRow, TimelineModel } from "@/lib/dashboard-review/pillar-b/adoption";
import { DumbbellUptakeChart, FirstUseTimeline } from "@/components/dashboard-review/pillar-b-adoption-visuals";

/** Both denominators, side by side. Neither is shown without the other. */
function MeasureCard({
  title, lead, measure, accent,
}: {
  title: string; lead: string; accent?: boolean;
  measure: ValueUptakeView["dateValid"];
}) {
  return (
    <div className={
      "rounded-xl border p-4 " +
      (accent ? "border-primary/30 bg-primary/5" : "border-border bg-card")
    }>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {title}
      </p>
      <p className="font-display mt-1 text-2xl text-foreground">
        {measure.share === null ? "n/d" : formatPercent(measure.share)}
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{lead}</p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Biosimilare</dt>
          <dd className="font-mono text-foreground">{formatEur(measure.biosimilar)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Riferimento</dt>
          <dd className="font-mono text-foreground">{formatEur(measure.reference)}</dd>
        </div>
      </dl>
    </div>
  );
}

/** A horizontal share bar. The number is always stated beside it. */
function ShareBar({ share }: { share: number | null }) {
  if (share === null) {
    return <span className="text-[11px] text-muted-foreground">n/d</span>;
  }
  const pct = Math.max(0, Math.min(1, share)) * 100;
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden="true" className="block h-1.5 w-20 shrink-0 rounded-full bg-muted">
        <span className="block h-full rounded-full bg-primary/70" style={{ width: `${pct}%` }} />
      </span>
      <span className="font-mono text-xs tabular-nums">{formatPercent(share)}</span>
    </span>
  );
}

export function PillarBValueUptake({
  view, dumbbell, timeline, substanceHref, resetHref,
}: {
  view: ValueUptakeView;
  dumbbell: DumbbellRow[];
  timeline: TimelineModel;
  /** Builds the URL that narrows the page to one substance. */
  substanceHref: (substance: string) => string;
  resetHref: string;
}) {
  const gap = view.dateValid.share !== null && view.locallyObserved.share !== null
    ? view.locallyObserved.share - view.dateValid.share
    : null;
  // EVERYTHING in neither published measure, not just the two classes it is
  // tempting to name. `outside` -- months in which no biosimilar of the
  // substance existed anywhere yet -- is excluded from date-valid AND from the
  // locally-observed window, so omitting it made the banner's own claim false:
  // it read EUR 1.109.465 held out for the Region while EUR 16.103.129,03
  // actually was, hiding 93% of it, and EUR 332.923 for Azienda 201 against a
  // true EUR 3.752.368,64.
  const held = view.boundary.total + view.unknown.total + view.outside.total;

  return (
    <div className="flex flex-col gap-4">
      {/* ------------------------------------------------- the two denominators */}
      <div className="grid gap-3 sm:grid-cols-2">
        <MeasureCard
          title="Su mesi a validità riconosciuta"
          lead="Mesi in cui il riferimento era già un riferimento, cioè dopo l'autorizzazione del biosimilare."
          measure={view.dateValid}
        />
        <MeasureCard
          accent
          title="Su mesi con biosimilare osservato qui"
          lead="Mesi in cui un biosimilare era già stato effettivamente dispensato nell'ambito visibile: la domanda onesta «lo scambio era possibile qui?»."
          measure={view.locallyObserved}
        />
      </div>
      {gap !== null && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          I due denominatori differiscono di{" "}
          <strong className="text-foreground">{formatPercent(Math.abs(gap))}</strong>.
          Rispondono a domande diverse e nessuno dei due è «quello giusto»:
          pubblicarne uno solo descriverebbe male l&apos;adozione. Il secondo è
          calcolato sull&apos;ambito visibile a chi guarda, quindi per
          un&apos;Azienda è il suo primo passaggio, non quello della Regione.
        </p>
      )}

      {/* ------------------------------------------- what is held out, and why */}
      {held > 0 && (
        <div className="flex gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs leading-relaxed">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" />
          <div>
            <p>
              <span className="font-semibold text-foreground">
                Fuori da entrambe le misure: {formatEur(held)}.
              </span>{" "}
              Non è spesa scartata: è spesa che non può entrare in nessuna delle due
              quote senza affermare qualcosa che l&apos;evidenza non sostiene. Le tre
              ragioni sono diverse e vengono tenute distinte.
            </p>
            <ul className="mt-1.5 space-y-0.5">
              {view.outside.total > 0 && (
                <li>
                  <strong className="text-foreground">{formatEur(view.outside.total)}</strong>{" "}
                  in mesi in cui <em>nessun</em> biosimilare di quella sostanza esisteva
                  ancora: il riferimento non era ancora un riferimento. Contarli
                  abbasserebbe meccanicamente l&apos;adozione per un periodo in cui
                  nessuna alternativa era disponibile.
                </li>
              )}
              {view.boundary.total > 0 && (
                <li>
                  <strong className="text-foreground">{formatEur(view.boundary.total)}</strong>{" "}
                  con validità che cade a metà mese: disponiamo del totale mensile e
                  non possiamo dividerlo dentro il mese.
                </li>
              )}
              {view.unknown.total > 0 && (
                <li>
                  <strong className="text-foreground">{formatEur(view.unknown.total)}</strong>{" "}
                  senza data di validità e senza evidenza che la collochi prima della
                  finestra: non viene contata come valida da nessuno.
                </li>
              )}
              {view.predates.total > 0 && (
                <li className="text-muted-foreground">
                  Inclusi invece {formatEur(view.predates.total)} di prodotti autorizzati
                  con procedura decentrata, la cui autorizzazione è documentata come
                  anteriore alla finestra.
                </li>
              )}
            </ul>
          </div>
        </div>
      )}

      <DumbbellUptakeChart rows={dumbbell} />
      <FirstUseTimeline model={timeline} />

      {/* --------------------------------------------------- the numeric table */}
      <details className="group">
        <summary className="cursor-pointer text-xs font-semibold text-primary">
          Apri la tabella numerica per principio attivo ({formatNumber(view.substances, 0)} molecole)
        </summary>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[52rem] text-sm" translate="no">
            <caption className="sr-only">
              Spesa biosimilare e di riferimento per principio attivo, sui due denominatori
            </caption>
            <thead className="bg-muted/50 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2.5 text-left font-semibold">Principio attivo</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">Biosimilare</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">Riferimento</th>
                <th scope="col" className="px-4 py-2.5 text-left font-semibold">Quota (validità)</th>
                <th scope="col" className="px-4 py-2.5 text-left font-semibold">Quota (osservato qui)</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">Primo uso locale</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">Fuori misura</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {view.rows.map((r) => (
                <tr key={r.substance}>
                  <td className="px-4 py-2.5 text-xs text-foreground">
                    <Link href={substanceHref(r.substance)} scroll={false}
                          className="hover:text-primary hover:underline">
                      {r.substance}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs">
                    {formatEur(r.dateValid.biosimilar)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs">
                    {formatEur(r.dateValid.reference)}
                  </td>
                  <td className="px-4 py-2.5"><ShareBar share={r.dateValid.share} /></td>
                  <td className="px-4 py-2.5"><ShareBar share={r.locallyObserved.share} /></td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-muted-foreground">
                    {r.firstLocalLabel ?? "mai"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-muted-foreground">
                    {r.boundary + r.unknown + r.outside === 0
                      ? "—" : formatEur(r.boundary + r.unknown + r.outside)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-muted/30">
              <tr>
                <td className="px-4 py-2.5 text-xs font-semibold text-foreground">
                  Totale {formatNumber(view.substances, 0)} molecole
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-xs font-semibold">
                  {formatEur(view.dateValid.biosimilar)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-xs font-semibold">
                  {formatEur(view.dateValid.reference)}
                </td>
                <td className="px-4 py-2.5"><ShareBar share={view.dateValid.share} /></td>
                <td className="px-4 py-2.5"><ShareBar share={view.locallyObserved.share} /></td>
                <td className="px-4 py-2.5" />
                <td className="px-4 py-2.5 text-right font-mono text-xs font-semibold">
                  {held === 0 ? "—" : formatEur(held)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </details>

      {view.rows.length === 0 && (
        <p className="rounded-xl border border-border bg-muted/30 px-3.5 py-2.5 text-xs text-muted-foreground">
          Nessun principio attivo nel perimetro con questi filtri. Non è uno zero:
          è un insieme vuoto. <Link href={resetHref} scroll={false}
          className="font-semibold text-primary hover:underline">Azzera i filtri</Link>.
        </p>
      )}

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Una molecola con riferimento ma senza biosimilare acquistato mostra 0,00%:
        significa che un&apos;alternativa autorizzata esisteva e non è stata
        comprata qui, non che non esistesse. «Primo uso locale» è il primo mese con
        quantità osservata nell&apos;ambito visibile, ed è indipendente dai filtri
        di anno e canale: un passaggio avvenuto nel 2024 non smette di essere
        avvenuto perché si seleziona il 2025.
      </p>
    </div>
  );
}
