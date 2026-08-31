import type { LucideIcon } from "lucide-react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BookOpenCheck,
  CircleMinus,
  DatabaseZap,
  Euro,
  FileSearch,
  MapPinned,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  period,
  scope,
}: {
  eyebrow: string;
  title: string;
  description: string;
  period?: string;
  scope?: string;
}) {
  return (
    <header className="grid gap-5 border-b border-border pb-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          {eyebrow}
        </p>
        <h1 className="font-display mt-2 max-w-4xl text-3xl leading-[1.08] tracking-[-0.02em] md:text-4xl">
          {title}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {(period || scope) && (
        <div className="flex flex-wrap gap-2 lg:max-w-sm lg:justify-end">
          {period && <StatusPill>{period}</StatusPill>}
          {scope && <StatusPill>{scope}</StatusPill>}
        </div>
      )}
    </header>
  );
}

export function StatusPill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "positive" | "warning" | "danger";
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em]",
        tone === "neutral" && "border-border bg-card text-muted-foreground",
        tone === "positive" && "border-emerald-200 bg-emerald-50 text-emerald-800",
        tone === "warning" && "border-amber-200 bg-amber-50 text-amber-800",
        tone === "danger" && "border-rose-200 bg-rose-50 text-rose-800",
      )}
    >
      {children}
    </span>
  );
}

export function KpiCard({
  label,
  value,
  detail,
  icon: Icon,
  accent = false,
}: {
  label: string;
  value: string;
  detail: React.ReactNode;
  icon: LucideIcon;
  accent?: boolean;
}) {
  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-2xl border p-5 shadow-[0_12px_30px_-24px_rgba(13,43,52,0.55)]",
        accent
          ? "border-[hsl(174_48%_25%)] bg-[hsl(174_46%_22%)] text-white"
          : "border-border bg-card text-card-foreground",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className={cn(
            "text-[10px] font-semibold uppercase tracking-[0.14em]",
            accent ? "text-white/65" : "text-muted-foreground",
          )}
        >
          {label}
        </p>
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-lg",
            accent ? "bg-white/10 text-[hsl(78_75%_60%)]" : "bg-secondary text-primary",
          )}
        >
          <Icon aria-hidden="true" size={16} strokeWidth={1.8} />
        </span>
      </div>
      <p className="font-display mt-4 text-3xl leading-none tracking-[-0.03em]">{value}</p>
      <div className={cn("mt-3 text-xs leading-5", accent ? "text-white/70 [&>span]:text-white/80" : "text-muted-foreground")}>
        {detail}
      </div>
      {accent && <span className="absolute -bottom-20 -right-16 size-48 rounded-full border border-white/10" />}
    </article>
  );
}

export function Delta({ value, suffix = " vs periodo precedente" }: { value: number | null; suffix?: string }) {
  if (value === null) {
    return <span className="inline-flex items-center gap-1"><CircleMinus size={13} /> confronto non disponibile</span>;
  }
  const UpOrDown = value >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-1", value >= 0 ? "text-rose-700" : "text-emerald-700")}>
      <UpOrDown size={13} />
      {new Intl.NumberFormat("it-IT", { style: "percent", maximumFractionDigits: 1 }).format(Math.abs(value))}
      {suffix}
    </span>
  );
}

const DECISION_ICONS = [DatabaseZap, MapPinned, Euro, FileSearch];

export function DecisionFrame({
  changed,
  variance,
  materiality,
  nextEvidence,
}: {
  changed: string;
  variance: string;
  materiality: string;
  nextEvidence: string;
}) {
  const items = [
    ["Cosa è cambiato", changed],
    ["Dove si concentra", variance],
    ["Quanto conta", materiality],
    ["Cosa verificare", nextEvidence],
  ];
  return (
    <section className="grid overflow-hidden rounded-2xl border border-border bg-card shadow-sm sm:grid-cols-2 xl:grid-cols-4">
      {items.map(([label, text], index) => {
        const Icon = DECISION_ICONS[index];
        return (
          <div key={label} className="border-b border-border p-4 last:border-b-0 sm:odd:border-r sm:[&:nth-child(3)]:border-b-0 xl:border-b-0 xl:border-r xl:last:border-r-0">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
              <Icon size={14} strokeWidth={1.8} /> {label}
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{text}</p>
          </div>
        );
      })}
    </section>
  );
}

export function MethodologyPanel({
  title = "Metodo, definizioni e tracciabilità",
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-2xl border border-border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 text-sm font-semibold marker:hidden">
        <span className="flex items-center gap-2.5">
          <BookOpenCheck className="text-primary" size={17} /> {title}
        </span>
        <span className="text-xs font-normal text-muted-foreground group-open:hidden">Espandi</span>
        <span className="hidden text-xs font-normal text-muted-foreground group-open:inline">Comprimi</span>
      </summary>
      <div className="border-t border-border px-5 py-5 text-xs leading-6 text-muted-foreground">
        {children}
      </div>
    </details>
  );
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-secondary/25 px-6 text-center">
      <FileSearch className="text-muted-foreground" size={22} />
      <p className="mt-3 text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}
