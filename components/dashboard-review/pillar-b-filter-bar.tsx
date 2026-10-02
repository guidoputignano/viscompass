"use client";

// The Pillar B filter bar: one set of controls for every section of the page.
//
// EVERY CONTROL WRITES A URL. Nothing here holds data. Changing a selection
// navigates to the same page with a different query string; the server
// re-queries with the narrowed scope and re-renders. The browser never receives
// rows it then filters locally, which is what keeps an Azienda from holding
// another Azienda's ledger (lib/dashboard-review/pillar-b/filters.ts).
//
// The controls differ by what they select:
//   Azienda      a <select>, only when the viewer may narrow (Regione, reviewer)
//   Periodo      a segmented control: 2024 · 2025 · both. 2026 is shown as a
//                labelled, non-selectable five-month fragment, so a reader sees
//                it exists and why it is not a choice.
//   Canale       three toggles that can be combined (CO + DD, ...)
//   Molecola     a searchable combobox over the perimeter's substances, plus
//                quick picks for the substances with the most reference spend
//                still unmoved — where the question "an alternative exists and
//                is not used" is largest.
//
// Options arrive as plain strings resolved on the server; a real name that the
// viewer may not see never reaches this component.

import { useRouter } from "next/navigation";
import { useCallback, useId, useState, useTransition } from "react";
import { Check, Copy, Loader2, RotateCcw } from "lucide-react";
import { formatNumber } from "@/lib/dashboard-review/format";
import {
  PILLAR_B_CHANNELS, type PillarBChannel, type PillarBFilters,
  activePillarBFilterCount, pillarBHref, toggleChannel,
} from "@/lib/dashboard-review/pillar-b/filters";

export interface FilterBarProps {
  base: string;
  filters: PillarBFilters;
  /** org_code + label, for the Azienda selector. Empty hides the selector. */
  aziende: ReadonlyArray<{ orgCode: string; label: string }>;
  /** Every substance in the perimeter, for the combobox. */
  substances: ReadonlyArray<string>;
  /** A handful of substances worth one click, with the reason shown as a title. */
  quickPicks: ReadonlyArray<{ substance: string; hint: string }>;
  /** The scope in words, already resolved against the pseudonym rule. */
  scopeLine: string;
  recordCount: number | null;
  /** Set when the record count covers a scope WIDER than the scope line. */
  recordCountScope?: string | null;
  /** 2026's observed months, for the fragment pill. */
  partialYear: { year: number; months: number } | null;
}

const CHANNEL_NAMES: Record<PillarBChannel, string> = {
  CO: "Consumi ospedalieri",
  DD: "Distribuzione diretta",
  DPC: "Distribuzione per conto",
};

const label = "text-xs font-semibold uppercase tracking-wider text-muted-foreground";
const control = "h-11 w-full rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";

function Segment({
  active, onClick, children, title, disabled,
}: { active: boolean; onClick?: () => void; children: React.ReactNode; title?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={active}
      className={
        "min-h-9 rounded-lg px-3 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary " +
        (disabled
          ? "cursor-help border border-dashed border-border text-muted-foreground"
          : active
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:bg-card hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}

export function PillarBFilterBar({
  base, filters, aziende, substances, quickPicks, scopeLine, recordCount, recordCountScope = null, partialYear,
}: FilterBarProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const listId = useId();

  const go = useCallback((patch: Partial<PillarBFilters>) => {
    const href = pillarBHref(base, filters, patch);
    startTransition(() => router.replace(href, { scroll: false }));
  }, [base, filters, router]);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard access can be refused; the URL bar still carries the link.
    }
  }, []);

  const active = activePillarBFilterCount(filters);
  const bothYears = filters.years.length === 2;

  return (
    <section
      id="filtri"
      className="scroll-mt-6 rounded-2xl border bg-card p-5 shadow-sm sm:p-6"
      role="region"
      aria-label="Filtri della sezione Pillar B"
      aria-busy={pending}
    >
      <div className={`grid gap-4 sm:grid-cols-2 ${aziende.length > 1 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
        {aziende.length > 1 && (
          <label className="flex min-w-0 flex-col gap-2">
            <span className={label}>Azienda</span>
            <select
              className={control}
              value={filters.asl ?? ""}
              onChange={(e) => go({ asl: e.target.value === "" ? null : e.target.value })}
            >
              <option value="">Tutte · {aziende.length} Aziende</option>
              {aziende.map((a) => <option key={a.orgCode} value={a.orgCode}>{a.label}</option>)}
            </select>
          </label>
        )}

        <div className="flex min-w-0 flex-col gap-2">
          <span className={label}>Periodo</span>
          <div className="flex min-h-11 flex-wrap items-center gap-0.5 rounded-lg bg-secondary p-0.5" role="group" aria-label="Anno">
            <Segment active={bothYears} onClick={() => go({ years: [2024, 2025] })}>2024 + 2025</Segment>
            <Segment active={!bothYears && filters.years[0] === 2024} onClick={() => go({ years: [2024] })}>2024</Segment>
            <Segment active={!bothYears && filters.years[0] === 2025} onClick={() => go({ years: [2025] })}>2025</Segment>
          </div>
          {partialYear && <span className="text-[11px] text-muted-foreground">
            {partialYear.year}: {partialYear.months} mesi; visibile solo nel calendario, non nei confronti.
          </span>}
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <span className={label}>Canale</span>
          <div className="flex min-h-11 flex-wrap items-center gap-0.5 rounded-lg bg-secondary p-0.5" role="group" aria-label="Canali di erogazione, combinabili">
            <Segment active={filters.channels.length === 0} onClick={() => go({ channels: [] })}>Tutti</Segment>
            {PILLAR_B_CHANNELS.map((c) => {
              const on = filters.channels.includes(c);
              return (
                <Segment key={c} active={on} title={CHANNEL_NAMES[c]}
                         onClick={() => go({ channels: filters.channels.length === 0 ? [c] : toggleChannel(filters, c) })}>
                  {c}
                </Segment>
              );
            })}
          </div>
          <span className="text-[11px] text-muted-foreground">Puoi combinare più canali.</span>
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <span className={label}>Molecola</span>
          <div className="flex items-center gap-2">
            <input
              className={control + " min-w-0 flex-1"}
              list={listId}
              placeholder="Cerca fra le molecole del perimetro…"
              defaultValue={filters.substance ?? ""}
              key={filters.substance ?? "all"}
              onChange={(e) => {
                // Navigate only on a complete choice. Partial text is the reader
                // typing; an emptied box while nothing is selected is not a change.
                const v = e.target.value.trim();
                if (v === "" && filters.substance !== null) go({ substance: null });
                else if (v !== "" && v !== filters.substance && substances.includes(v)) go({ substance: v });
              }}
              aria-label="Molecola"
            />
            <datalist id={listId}>
              {substances.map((s) => <option key={s} value={s} />)}
            </datalist>
            {filters.substance !== null && (
              <button type="button" onClick={() => go({ substance: null })}
                      className="text-xs font-semibold text-primary hover:underline">
                Tutte
              </button>
            )}
          </div>
        </div>
      </div>

      {quickPicks.length > 0 && (
        <details className="mt-4 border-t border-border/70 pt-3">
          <summary className="cursor-pointer text-xs font-medium text-primary">Esplora i principi attivi con maggiore spesa di riferimento</summary>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {quickPicks.map((q) => (
              <button
                key={q.substance}
                type="button"
                title={q.hint}
                aria-pressed={filters.substance === q.substance}
                onClick={() => go({ substance: filters.substance === q.substance ? null : q.substance })}
                className={
                  "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors " +
                  (filters.substance === q.substance
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground")
                }
              >
                {q.substance}
              </button>
            ))}
          </div>
        </details>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border/70 pt-3 text-xs">
        <span className="max-w-full font-medium text-foreground">Ambito: {scopeLine}</span>
        {recordCount !== null && (
          <span className="text-muted-foreground">Analisi in valore: {formatNumber(recordCount, 0)} record nel perimetro biosimilare{recordCountScope ? ` · ambito effettivo: ${recordCountScope}` : ""}</span>
        )}
        {pending && <span role="status" className="flex items-center gap-1.5 font-medium text-primary"><Loader2 size={13} className="animate-spin" /> Aggiornamento in corso</span>}
        <span className="ml-auto flex items-center gap-3">
          <button type="button" onClick={copyLink}
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? "Link copiato" : "Copia il link a questa vista"}
          </button>
          {active > 0 && (
            <button type="button" onClick={() => router.replace(base, { scroll: false })}
                    className="flex items-center gap-1 font-semibold text-primary hover:underline">
              <RotateCcw size={12} /> Azzera ({active})
            </button>
          )}
        </span>
      </div>
    </section>
  );
}
