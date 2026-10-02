// Biosimilar vs reference adoption in VALUE, with both denominators.
//
// Server-rendered. The filters are links, so the state lives in the URL, is
// shareable, survives a reload, needs no client JavaScript, and is reachable by
// keyboard and screen reader without a custom widget. Changing a filter is a
// navigation, and the server re-queries with the new scope — the browser never
// receives rows it then narrows locally, which is also what keeps an Azienda
// from holding another Azienda's data.
//
// WHAT THIS VIEW MAY NOT SHOW, by evidence rather than preference:
//   - no package or quantity total: the source basis is mixed/unknown
//   - no saving: a dispersion or a gap is not money recoverable
//   - no exclusivity forecast: B15 publishes an upper bound, not a term
//   - 2026 is never a selectable year: five months, zero comparable-eligible

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { StatusPill } from "@/components/dashboard-review/analytics-ui";
import { formatEur, formatNumber, formatPercent } from "@/lib/dashboard-review/format";
import {
  CHANNELS, type UptakeFilterState, type ValueUptakeView,
  activeFilterCount, describeFilters, filterHref,
} from "@/lib/dashboard-review/pillar-b/value-uptake";

const BASE = "/dashboard-review/revisione-pillar-b";

function Chip({
  href, active, children,
}: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
        (active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground")
      }
    >
      {children}
    </Link>
  );
}

function FilterRow({
  label, children,
}: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-20 shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

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
  view, filters, substanceOptions,
}: {
  view: ValueUptakeView;
  filters: UptakeFilterState;
  substanceOptions: string[];
}) {
  const href = (patch: Partial<UptakeFilterState>) => filterHref(BASE, filters, patch);
  const gap = view.dateValid.share !== null && view.locallyObserved.share !== null
    ? view.locallyObserved.share - view.dateValid.share
    : null;
  const held = view.boundary.total + view.unknown.total;

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg text-foreground">
          4 · Biosimilari e riferimento: adozione in valore
        </h2>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
          Quanta parte della spesa sostituibile è già su biosimilare. La domanda
          che questa vista sostiene è: <em>dove esiste un&apos;alternativa e non
          viene usata?</em> È una quota di <strong>denaro</strong>, non di
          pazienti: un biosimilare costa meno per unità, quindi la quota di spesa
          <strong> sottostima</strong> la quota di trattamenti.
        </p>
      </div>

      {/* ------------------------------------------------------------ filters */}
      <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-muted/30 p-3.5">
        <FilterRow label="Anno">
          <Chip href={href({ year: null })} active={filters.year === null}>2024 e 2025</Chip>
          <Chip href={href({ year: 2024 })} active={filters.year === 2024}>2024</Chip>
          <Chip href={href({ year: 2025 })} active={filters.year === 2025}>2025</Chip>
          <span className="text-[11px] text-muted-foreground">
            il 2026 copre cinque mesi e non è confrontabile con un anno intero
          </span>
        </FilterRow>
        <FilterRow label="Canale">
          <Chip href={href({ channel: null })} active={filters.channel === null}>Tutti</Chip>
          {CHANNELS.map((c) => (
            <Chip key={c} href={href({ channel: c })} active={filters.channel === c}>{c}</Chip>
          ))}
        </FilterRow>
        <FilterRow label="Molecola">
          <Chip href={href({ substance: null })} active={filters.substance === null}>Tutte</Chip>
          {substanceOptions.slice(0, 10).map((s) => (
            <Chip key={s} href={href({ substance: s })} active={filters.substance === s}>{s}</Chip>
          ))}
        </FilterRow>
        <div className="flex flex-wrap items-center gap-2 border-t border-border/70 pt-2.5">
          <StatusPill tone="neutral">Ambito: {describeFilters(filters)}</StatusPill>
          <StatusPill tone="neutral">
            {formatNumber(view.substances, 0)} molecole · {formatNumber(view.perimeterRows, 0)} record
          </StatusPill>
          {activeFilterCount(filters) > 0 && (
            <Link href={BASE} scroll={false}
                  className="text-xs font-semibold text-primary hover:underline">
              Azzera i filtri
            </Link>
          )}
        </div>
      </div>

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
              Non è spesa scartata, è spesa che non può essere attribuita a nessuna
              delle due parti senza inventare un dato.
            </p>
            <ul className="mt-1.5 space-y-0.5">
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

      {/* --------------------------------------------------- the numeric table */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[52rem] text-sm">
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
                  <Link href={href({ substance: r.substance })} scroll={false}
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
                  {r.boundary + r.unknown === 0 ? "—" : formatEur(r.boundary + r.unknown)}
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

      {view.rows.length === 0 && (
        <p className="rounded-xl border border-border bg-muted/30 px-3.5 py-2.5 text-xs text-muted-foreground">
          Nessun principio attivo nel perimetro con questi filtri. Non è uno zero:
          è un insieme vuoto. <Link href={BASE} scroll={false}
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
    </section>
  );
}
