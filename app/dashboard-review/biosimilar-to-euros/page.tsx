import Link from "next/link";
import { ArrowRight, BadgeEuro, Beaker, CircleGauge, ShieldCheck } from "lucide-react";
import {
  DecisionFrame,
  KpiCard,
  MethodologyPanel,
  PageHeader,
  StatusPill,
  TemplateNotice,
} from "@/components/dashboard-review/analytics-ui";
import { getBiosimilarComparison, getBiosimilarRetirement } from "@/lib/dashboard-review/queries";
import { formatEur, formatEurPrecise, formatNumber, formatPercent } from "@/lib/dashboard-review/format";
import type { BiosimilarComparisonRow } from "@/lib/dashboard-review/types";

const BASIS = { mg: "mg", packs: "confezioni", spend: "spesa" } as const;

// A fictional, organization-neutral dataset used only when the tenant has no
// facts yet. Molecule names and ATC codes are public taxonomy; all values are
// deliberately invented and are not derived from the Abruzzo source files.
// Each row's headroom is its substitutable base times its own measured
// differential, so the demo obeys the same arithmetic as a real row rather than
// showing a shape the production computation could never produce.
const DEMO_ROWS: BiosimilarComparisonRow[] = [
  // The first two are mg-complete, so their measurable base EQUALS their window —
  // under an mg basis the code cannot produce anything else, because every row in
  // the window already carries mg. Only the third, on a packs basis, can show the
  // second gate biting. An earlier draft of this demo had all three narrowing on
  // an mg basis, which is a shape the production computation can never return.
  { active_substance: "ADALIMUMAB", atc4: "L04AB", therapeutic_area: "Immunologia · specialità da verificare", therapeutic_area_status: "review_required", originator_cost_per_mg: 3.84, biosimilar_cost_per_mg: 2.31, originator_spend_eur: 1_080_000, biosimilar_spend_eur: 3_620_000, originator_share: 0.23, substitution_headroom_eur: 286_875, headroom_is_upper_bound: true, headroom_basis: "mesi con biosimilare effettivamente dispensato, differenziale misurabile", substitutable_originator_spend_eur: 720_000, headroom_base_eur: 720_000, biosimilar_penetration: 0.77, penetration_basis: "mg", penetration_locally_substitutable: 0.82, penetration_locally_substitutable_basis: "mg", comparable_share: 0.667, normalized_volume_mg: 1_420_000, normalization_coverage: 1, evidence_status: "ready", latest_year: 2025 },
  { active_substance: "TRASTUZUMAB", atc4: "L01FD", therapeutic_area: "Oncologia / ematologia", therapeutic_area_status: "supported_by_atc", originator_cost_per_mg: 4.72, biosimilar_cost_per_mg: 3.51, originator_spend_eur: 910_000, biosimilar_spend_eur: 2_840_000, originator_share: 0.24, substitution_headroom_eur: 156_377, headroom_is_upper_bound: true, headroom_basis: "mesi con biosimilare effettivamente dispensato, differenziale misurabile", substitutable_originator_spend_eur: 610_000, headroom_base_eur: 610_000, biosimilar_penetration: 0.76, penetration_basis: "mg", penetration_locally_substitutable: 0.81, penetration_locally_substitutable_basis: "mg", comparable_share: 0.670, normalized_volume_mg: 932_000, normalization_coverage: 1, evidence_status: "ready", latest_year: 2025 },
  { active_substance: "PEGFILGRASTIM", atc4: "L03AA", therapeutic_area: "Immunologia / ematologia", therapeutic_area_status: "review_required", originator_cost_per_mg: 72.4, biosimilar_cost_per_mg: 58.2, originator_spend_eur: 690_000, biosimilar_spend_eur: 2_070_000, originator_share: 0.25, substitution_headroom_eur: 60_801, headroom_is_upper_bound: true, headroom_basis: "mesi con biosimilare effettivamente dispensato, differenziale misurabile", substitutable_originator_spend_eur: 430_000, headroom_base_eur: 310_000, biosimilar_penetration: 0.75, penetration_basis: "packs", penetration_locally_substitutable: 0.79, penetration_locally_substitutable_basis: "packs", comparable_share: 0.449, normalized_volume_mg: 43_700, normalization_coverage: 0.86, evidence_status: "ready", latest_year: 2025 },
];

function BiosimilarToEurosView({ rows }: { rows: BiosimilarComparisonRow[] }) {
  const isTemplate = rows.length === 0;
  const displayRows = isTemplate ? DEMO_ROWS : rows;
  // Deliberately NOT called a saving, and deliberately not summed under a heading
  // that implies recoverable money. It is the arithmetic ceiling on substitution
  // under assumptions this data cannot test.
  const totalHeadroom = displayRows.reduce((sum, row) => sum + row.substitution_headroom_eur, 0);
  const originatorSpend = displayRows.reduce((sum, row) => sum + row.originator_spend_eur, 0);
  const substitutableSpend = displayRows.reduce(
    (sum, row) => sum + row.substitutable_originator_spend_eur,
    0,
  );
  const headroomBase = displayRows.reduce((sum, row) => sum + row.headroom_base_eur, 0);
  const readyRows = displayRows.filter((row) => row.evidence_status === "ready");
  const top = displayRows[0];
  const combinedSpend = displayRows.reduce(
    (sum, row) => sum + row.originator_spend_eur + row.biosimilar_spend_eur,
    0,
  );
  const weightedOriginatorShare = combinedSpend > 0 ? originatorSpend / combinedSpend : null;
  const headroomBaseShare = originatorSpend > 0 ? headroomBase / originatorSpend : null;
  // Share of the total headroom sitting on the single largest molecule — an actual
  // concentration measure, which is what the frame's second slot is labelled.
  const concentration =
    totalHeadroom > 0 && top ? top.substitution_headroom_eur / totalHeadroom : null;

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow="Intelligence biosimilari"
        title="Penetrazione, costo, margine teorico."
        description="Confronti economici normalizzati, molecola per molecola."
        period={`Periodo ${displayRows[0].latest_year}`}
        scope={`${displayRows.length} molecole ${isTemplate ? "simulate" : "osservate"}`}
      />

      {isTemplate && <TemplateNotice label="Scenario sintetico" source="Ente dimostrativo · valori interamente fittizi · 2025" />}

      <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em]">Il margine non è un risparmio</p>
        <p className="mt-1.5">
          È il <strong>limite superiore</strong> di ciò che la sostituzione potrebbe valere, calcolato
          solo sui mesi in cui un biosimilare della molecola è stato <strong>effettivamente
          dispensato</strong> in questo ente e solo dove il differenziale di prezzo è misurabile.
          Presuppone sostituibilità clinica integrale, tenuta del prezzo a volumi maggiori, assenza di
          vincoli contrattuali e nessun costo di transizione: nessuna di queste condizioni è
          verificabile da questi dati, quindi la cifra non va letta come denaro recuperabile né
          iscritta a budget.
        </p>
      </div>

      {/*
        The frame's own labels are Variazione / Concentrazione / Materialità.
        A molecule name is not a variation and a penetration share is not a
        concentration, so each slot now carries what its label claims.
      */}
      <DecisionFrame
        changed={top && top.penetration_locally_substitutable !== null && top.biosimilar_penetration !== null
          ? `Uptake ${formatPercent(top.biosimilar_penetration)} anno · ${formatPercent(top.penetration_locally_substitutable)} in finestra`
          : "Penetrazione da calcolare"}
        variance={concentration === null
          ? "Concentrazione da calcolare"
          : `${formatPercent(concentration)} del margine su ${top ? top.active_substance : "una molecola"}`}
        materiality={totalHeadroom > 0 ? `Margine ≤ ${formatEur(totalHeadroom)}` : "€/mg da completare"}
        nextEvidence={top ? `Verifica ${top.active_substance}` : "Completa il mapping AIC"}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard accent label="Margine (limite superiore)" value={formatEur(totalHeadroom)} detail="non un risparmio" icon={BadgeEuro} />
        <KpiCard label="Spesa originator" value={formatEur(originatorSpend)} detail={weightedOriginatorShare === null ? undefined : formatPercent(weightedOriginatorShare)} icon={Beaker} />
        <KpiCard label="Base del margine" value={formatEur(headroomBase)} detail={headroomBaseShare === null ? undefined : `${formatPercent(headroomBaseShare)} della spesa originator`} icon={ShieldCheck} />
        <KpiCard label="Molecole" value={formatNumber(displayRows.length, 0)} detail={`${readyRows.length} con differenziale misurabile`} icon={CircleGauge} />
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">Come si restringe la base</p>
        <p className="mt-1 text-xs text-muted-foreground">Il margine non si applica a tutta la spesa originator: due filtri la riducono, e sono entrambi mostrati.</p>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { step: "1", label: "Spesa originator", value: originatorSpend, note: "tutte le molecole con un biosimilare a catalogo" },
            { step: "2", label: "Mesi sostituibili", value: substitutableSpend, note: "dal primo mese di dispensazione locale del biosimilare" },
            { step: "3", label: "Differenziale misurabile", value: headroomBase, note: "spesa originator con mg noti; il tasso richiede la misura su entrambi i lati" },
            { step: "4", label: "Margine (limite superiore)", value: totalHeadroom, note: "non un risparmio realizzabile" },
          ].map((item) => (
            <li key={item.step} className="rounded-xl border border-border bg-secondary/20 p-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{item.step} · {item.label}</p>
              <p className="mt-1.5 font-mono text-sm font-semibold">{formatEur(item.value)}</p>
              <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{item.note}</p>
            </li>
          ))}
        </ol>
      </div>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border p-5 md:p-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">Radar molecolare</p>
            <h2 className="font-display mt-1 text-xl">Priorità per margine normalizzato</h2>
            <p className="mt-1 text-xs text-muted-foreground">Area analitica da ATC; le specialità multi-indicazione restano da verificare.</p>
          </div>
          {isTemplate && <Link href="/dashboard-review/dati" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">Carica dati reali <ArrowRight size={13} /></Link>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] text-sm">
            <thead><tr className="border-b border-border text-left text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              <th className="sticky left-0 z-10 bg-card px-5 py-3 font-semibold">Molecola e area</th><th className="px-5 py-3 text-right font-semibold">Margine (max)</th><th className="px-5 py-3 font-semibold">Evidenza</th><th className="px-5 py-3 text-right font-semibold">Penetrazione<span className="block font-normal normal-case tracking-normal">anno · mesi sostituibili</span></th><th className="px-5 py-3 text-right font-semibold">Originator €/mg</th><th className="px-5 py-3 text-right font-semibold">Biosimilare €/mg</th><th className="px-5 py-3 text-right font-semibold">Spesa originator<span className="block font-normal normal-case tracking-normal">sostituibile · misurabile</span></th><th className="px-5 py-3 font-semibold" />
            </tr></thead>
            <tbody>
              {displayRows.map((row) => (
                <tr key={row.active_substance} className="group border-b border-border last:border-0 hover:bg-secondary/25">
                  <td className="sticky left-0 z-10 bg-card px-5 py-4 transition-colors group-hover:bg-secondary/25">
                    <p className="font-semibold">{row.active_substance}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{row.atc4 ?? "ATC non disponibile"}</p>
                    <p className="mt-1 text-[10px] text-foreground/70">{row.therapeutic_area}{row.therapeutic_area_status === "review_required" ? " · verifica" : ""}</p>
                  </td>
                  <td className="px-5 py-4 text-right font-mono text-xs font-semibold text-primary">{row.substitution_headroom_eur > 0 ? `≤ ${formatEur(row.substitution_headroom_eur)}` : "—"}</td>
                  <td className="px-5 py-4"><StatusPill tone={row.evidence_status === "ready" ? "positive" : row.evidence_status === "partial" ? "warning" : "danger"}>{row.evidence_status === "ready" ? "Pronta" : row.evidence_status === "partial" ? "Parziale" : "Irrisolta"}</StatusPill><p className="mt-1 text-[10px] text-muted-foreground">Righe normalizzate {row.normalization_coverage === null ? "—" : formatPercent(row.normalization_coverage)}</p></td>
                  <td className="px-5 py-4 text-right">
                    <p className="font-mono text-xs">{row.biosimilar_penetration === null ? "—" : formatPercent(row.biosimilar_penetration)}<span className="ml-1 font-sans text-[10px] font-normal text-muted-foreground">{BASIS[row.penetration_basis]}</span></p>
                    <p className="mt-0.5 font-mono text-[11px] text-foreground/70">{row.penetration_locally_substitutable === null ? "—" : formatPercent(row.penetration_locally_substitutable)}<span className="ml-1 font-sans text-[10px] font-normal text-muted-foreground">{row.penetration_locally_substitutable_basis === null ? "n/d" : BASIS[row.penetration_locally_substitutable_basis]}</span></p>
                  </td>
                  <td className="px-5 py-4 text-right font-mono text-xs">{row.originator_cost_per_mg === null ? "—" : formatEurPrecise(row.originator_cost_per_mg, 4)}</td>
                  <td className="px-5 py-4 text-right font-mono text-xs">{row.biosimilar_cost_per_mg === null ? "—" : formatEurPrecise(row.biosimilar_cost_per_mg, 4)}</td>
                  <td className="px-5 py-4 text-right">
                    <p className="font-mono text-xs">{formatEur(row.originator_spend_eur)}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-foreground/70">{formatEur(row.substitutable_originator_spend_eur)}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-foreground/70">{formatEur(row.headroom_base_eur)}{row.comparable_share === null ? "" : ` · ${formatPercent(row.comparable_share)}`}</p>
                  </td>
                  <td className="px-5 py-4"><Link href={isTemplate ? "/dashboard-review/dati" : `/dashboard-review/ricerca?molecule=${encodeURIComponent(row.active_substance)}`} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">{isTemplate ? "Sostituisci" : "Dettaglio"} <ArrowRight size={12} /></Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <MethodologyPanel>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <div><p className="font-semibold text-foreground">Penetrazione, due denominatori</p><p className="mt-1">Un solo numero non è difendibile: la quota sull’intero anno e quella sui soli mesi in cui il biosimilare era localmente disponibile rispondono a domande diverse e divergono in modo rilevante. Entrambe sono esposte, con la base indicata per molecola. La base in mg è usata solo quando il contenuto è noto su <em>tutte</em> le righe confrontate; altrimenti si scende a confezioni o spesa, perché una riga senza mg uscirebbe dal denominatore restando nel numeratore e la quota biosimilare risulterebbe artificialmente vicina al 100%. La base a confezioni resta però valida solo se le confezioni sono comparabili fra originator e biosimilare: quando la base indicata non è «mg», il confronto va letto con questa riserva.</p></div>
          <div><p className="font-semibold text-foreground">Costo comparabile</p><p className="mt-1">€/mg = spesa ÷ contenuto, calcolati sulle <em>stesse</em> righe: solo quelle con unità per confezione × forza × confezioni note. Includere al numeratore righe prive di contenuto gonfierebbe il €/mg esattamente della quota non normalizzata, e sul lato originator questo gonfierebbe il differenziale.</p></div>
          <div><p className="font-semibold text-foreground">I due filtri sulla base</p><p className="mt-1">Primo: la spesa originator conta solo dal mese in cui un biosimilare della molecola è stato effettivamente dispensato in questo ente — prima non c’era nulla verso cui spostarsi, per quanti biosimilari esistessero altrove. Secondo: dentro quella finestra conta solo la spesa di cui si conoscono i mg, perché il differenziale è un tasso per mg e applicarlo a righe mai misurate sarebbe un’estrapolazione.</p></div>
          <div><p className="font-semibold text-foreground">Margine, non risparmio</p><p className="mt-1">Base misurabile × (1 − costo/mg biosimilare ÷ costo/mg originator), solo dove entrambi i costi sono misurabili e il biosimilare costa meno. Dove costa di più il margine è zero, mai negativo: una sostituzione in perdita non deve compensare silenziosamente un margine reale altrove.</p></div>
          <div><p className="font-semibold text-foreground">Limiti noti</p><p className="mt-1">Il confronto non applica ancora il filtro di comparabilità completo dell’analisi certificata (via di somministrazione, accordo sul numero di confezioni, coerenza tra fonti) e non pubblica un intervallo di confidenza. La cifra va quindi letta come soglia massima, non come stima puntuale.</p></div>
          <div><p className="font-semibold text-foreground">Copertura</p><p className="mt-1">La percentuale accanto all’evidenza è la quota di <em>righe</em> di spesa con un costo per unità normalizzato. Non è la quota di spesa eleggibile del registro complessivo, che è calcolata a monte sull’intera fonte ed è sensibilmente più bassa.</p></div>
        </div>
      </MethodologyPanel>
    </div>
  );
}

export default async function BiosimilarToEurosPage() {
  const [rows, retiredForRelease] = await Promise.all([
    getBiosimilarComparison(),
    getBiosimilarRetirement(),
  ]);

  // Under a gated release this page's figures are superseded, not merely empty.
  // Every number it produces — penetration, costo/mg, margine — is computed over
  // unfiltered facts, before the comparability gate, the quantity-basis gate and
  // the withheld complement existed. Saying so is the point: a blank page would
  // read as "no biosimilar activity".
  if (retiredForRelease !== null) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader
          eyebrow="Biosimilari"
          title="Biosimilari → Euro"
          description="Pagina superata dalla revisione Pillar B per la release attiva."
        />
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5">
          <h2 className="font-display text-base text-foreground">
            Questi calcoli non sono validi per la release {retiredForRelease}
          </h2>
          <p className="mt-2 max-w-3xl text-xs leading-relaxed text-muted-foreground">
            Le cifre di questa pagina (penetrazione, costo per mg, margine) sono
            calcolate sull&apos;insieme completo dei record, prima del filtro di
            comparabilità, del controllo sulla base della quantità e della quota
            trattenuta. Per la release attiva quei controlli esistono e cambiano il
            risultato, quindi la pagina non li ripubblica.
          </p>
          <p className="mt-3 text-xs">
            <Link
              href="/dashboard-review/revisione-pillar-b"
              className="font-semibold text-primary hover:underline"
            >
              Apri la revisione Pillar B →
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return <BiosimilarToEurosView rows={rows} />;
}
