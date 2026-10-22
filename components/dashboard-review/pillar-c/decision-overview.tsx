/** Section 1 «Quadro decisionale» of the six-section Pillar C page (docs/PILLAR_C_SIX_SECTIONS_20261022.md §1):
 * the three decision cards, the chosen comparison stated as text, the regional reference card that links to section 5
 * and the «Vai a» links. Presentation only, with no hooks, no chart and no control: every value arrives formatted as a
 * string prop (the caller formats money and the band, and owns the wording of unavailable values), the file reads no
 * organisation key or label and imports nothing that reads data, so it can sit in any workspace's bundle. The only
 * «Confronto» toggle lives in section 4 (§5.1); here the comparison is one keyed text so a changed filter remounts it. */
import { cn } from "@/lib/utils";

export type PillarCDecisionCard = { title: string; value: string; detail: string };
export type PillarCDecisionRegional = {
  /** The annual point of the regional estimate, already formatted. */
  annual: string;
  /** The 80-percent band «low – high», already formatted. */
  band: string;
  /** The anchor of the section that holds the forecast panel. */
  href: string;
};
export type PillarCDecisionOverviewProps = {
  cards: readonly [PillarCDecisionCard, PillarCDecisionCard, PillarCDecisionCard];
  /** The chosen comparison stated as text, e.g. «Confronto: 2024 → 2025»; the only «Confronto» toggle lives in section 4 (§5.1). */
  comparison: string;
  /** Null when the forecast is unavailable: the card is then absent, and nothing stands in for it. */
  regional?: PillarCDecisionRegional | null;
  links: readonly { href: string; label: string }[];
  className?: string;
};

const linkClass = "inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-primary";

export function PillarCDecisionOverview({ cards, comparison, regional = null, links, className }: PillarCDecisionOverviewProps) {
  return <div className={cn("rounded-2xl border border-primary/20 bg-card p-5 md:p-6", className)}>
    <div className="grid gap-4 md:grid-cols-3">{cards.map((card) => <div key={card.title} className="rounded-xl bg-secondary/40 p-4"><p className="text-xs text-muted-foreground">{card.title}</p><p className="mt-2 text-xl font-semibold">{card.value}</p><p className="mt-2 text-xs text-muted-foreground">{card.detail}</p></div>)}</div>
    <p key={comparison} className="mt-4 text-xs text-muted-foreground">{comparison}</p>
    {regional ? <div className="mt-5 rounded-xl bg-secondary/50 p-4">
      <p className="text-xs text-muted-foreground">Previsione regionale 2026 · stima annua indicativa</p>
      <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1"><span className="text-xl font-semibold tabular-nums">{regional.annual}</span><span className="text-xs text-muted-foreground">{"Fascia annua indicativa · 80\u00a0%"}</span><span className="text-sm font-medium tabular-nums">{regional.band}</span></p>
      <p className="mt-1 text-[11px] text-muted-foreground">Riferimento regionale, non budget approvato</p>
      <a href={regional.href} className={cn("mt-3", linkClass)}>Apri la previsione regionale</a>
    </div> : null}
    <div className="mt-5 flex flex-wrap gap-x-3 gap-y-1 text-sm">{links.map((link) => <a key={link.href} href={link.href} className={linkClass}>{`Vai a ${link.label}`}</a>)}</div>
  </div>;
}
