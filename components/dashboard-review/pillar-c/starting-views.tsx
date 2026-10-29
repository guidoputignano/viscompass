"use client";

import { Building2, BriefcaseBusiness, Pill } from "lucide-react";
import { cn } from "@/lib/utils";
import { C_STARTING_VIEWS, type CStartingView } from "@/lib/dashboard-review/pillar-c/starting-views";

const CHOICES = {
  direzione: { label: "Direzione ASL", description: "Spesa, variazioni e budget", icon: BriefcaseBusiness },
  farmacia: { label: "Farmacia", description: "Assistiti DPC, costo del servizio e farmaci", icon: Pill },
  regione: { label: "Regione", description: "Aggregato e confronto tra le ASL disponibili", icon: Building2 },
} as const;

export function PillarCStartingViews({ value, peerComparison, href, taskHref, onSelect }: {
  value: CStartingView; peerComparison: boolean; href: (choice: CStartingView) => string; taskHref: (choice: CStartingView) => string; onSelect: (choice: CStartingView) => void;
}) {
  const routes = value === "farmacia"
    ? [{ label: "Costo del servizio DPC", target: "#c-dpc-service" }, { label: "Farmaci sotto 10 €", target: "#c-under10" }, { label: "Tempi di erogazione registrati", target: "#c-dpc-intervals" }]
    : value === "regione"
      ? [{ label: "Spesa dell’ambito selezionato", target: "#quadro" }, { label: "Prodotti e variazioni", target: "#portafogli-attribuzione" }, { label: "Budget e previsione regionale", target: "#budget-scenari" }]
      : [{ label: "Che cosa è cambiato?", target: "#fattori" }, { label: "Quali prodotti incidono?", target: "#portafogli-attribuzione" }, { label: "Budget e pianificazione", target: "#budget-scenari" }];
  return <nav aria-label="Punto di partenza" className="space-y-3" data-c-starting-view={value}>
    <p className="text-sm font-medium">Da quale domanda vuoi partire?</p>
    <div className="grid gap-2 md:grid-cols-3">{C_STARTING_VIEWS.map((choice) => {
      const { label, description, icon: Icon } = CHOICES[choice];
      return <a key={choice} href={href(choice)} aria-current={choice === value ? "true" : undefined}
        onClick={(event) => { event.preventDefault(); onSelect(choice); }}
        className={cn("flex min-h-11 min-w-0 items-center gap-3 rounded-xl border px-4 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary",
          choice === value ? "border-primary/30 bg-primary/5" : "border-border bg-card hover:border-primary/30 hover:bg-primary/[0.03]")}>
        <Icon size={19} aria-hidden="true" className="shrink-0 text-primary" />
        <span className="min-w-0"><span className="block text-sm font-semibold">{label}</span>
          <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{choice === "regione" && !peerComparison ? "La tua ASL a confronto con l’aggregato" : description}</span></span>
      </a>;
    })}</div>
    <p className="text-xs leading-5 text-muted-foreground">Il punto di partenza organizza la lettura. I dati disponibili dipendono dall’accesso della tua organizzazione.</p>
    <div className="flex flex-wrap gap-x-5 gap-y-1" aria-label="Domande da approfondire">{routes.map((route) => <a key={route.target} className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" href={`${taskHref(value)}${route.target}`}>{route.label}</a>)}</div>
  </nav>;
}
