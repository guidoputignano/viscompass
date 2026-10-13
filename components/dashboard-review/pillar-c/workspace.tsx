"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowDownUp, ArrowRight, Check, Copy, FileCheck2, Layers3, RotateCcw, SlidersHorizontal, Wallet } from "lucide-react";
import { PageHeader, KpiCard } from "@/components/dashboard-review/analytics-ui";
import { LocalToggle } from "@/components/dashboard-review/pillar-b-local-toggle";
import {
  buildPreview, parsePreviewFilters, previewSearch, PORTFOLIOS, WORKBOOK_SECTIONS,
  PILLAR_C_PREVIEW_VERSION, type PreviewFilters, type PreviewPortfolio,
} from "@/lib/dashboard-review/pillar-c/preview";
import { AttributionChart, BudgetChart, ChangeBars, FigureNote, MonthlyChart, PortfolioBars, compactEuro, euro, percent, signedEuro } from "./charts";

const fieldClass = "mt-2 h-10 w-full min-w-0 rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";
const iconButtonClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border px-3 text-xs font-medium hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";

function Panel({ title, subtitle, controls, children }: { title: string; subtitle?: string; controls?: React.ReactNode; children: React.ReactNode }) {
  return <article className="min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6">
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><h3 className="text-base font-semibold">{title}</h3>{subtitle && <p className="mt-1 text-xs leading-5 text-muted-foreground">{subtitle}</p>}</div>{controls}</div>
    {children}
  </article>;
}

function SectionHeading({ index, description }: { index: number; description: string }) {
  const section = WORKBOOK_SECTIONS[index];
  return <div className="mb-5 flex items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/5 text-xs font-semibold text-primary">{section.number}</span><div><h2 id={`${section.id}-title`} className="text-xl font-semibold tracking-tight">{section.question}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p></div></div>;
}

export function PillarCWorkspace() {
  const search = useSearchParams();
  const filters = parsePreviewFilters(search);
  const model = buildPreview(filters);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [priority, setPriority] = useState<string | null>(null);
  const update = (patch: Partial<PreviewFilters>, reset = false) => {
    // Next synchronizes native history changes with useSearchParams without a
    // server fetch. A null state is required; never recycle Next's own state.
    window.history.pushState(null, "", `${window.location.pathname}${previewSearch(window.location.search, patch, reset)}${window.location.hash}`);
    setCopyState("idle");
  };
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopyState("copied"); }
    catch { setCopyState("failed"); }
  };
  const selectedPortfolio = PORTFOLIOS.find((p) => p.id === filters.portfolio)?.label ?? "Tutti i portafogli";
  const channelLabel = filters.channel === "all" ? "Tutti i canali" : filters.channel;
  const priorities = [...model.portfolios].sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  const activePriority = priorities.find((p) => p.id === priority) ?? priorities[0];
  const budgetTotal = model.portfolios.reduce((sum, p) => sum + p.budget, 0);

  return <div className="space-y-8 pb-12" data-preview-version={PILLAR_C_PREVIEW_VERSION} data-mode={model.mode}>
    <PageHeader eyebrow="Pillar C · Anteprima riservata" title="Aree cliniche e budget" description="Dalla lettura del portafoglio alle priorità di revisione: esplora spesa, attribuzione e obiettivi in un unico percorso." scope="Prototipo interattivo" />

    <div className="flex flex-wrap items-start gap-3 rounded-xl border border-primary/25 bg-primary/5 px-5 py-4 text-sm" role="note">
      <Layers3 size={19} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
      <div><p className="font-semibold">Dati illustrativi · nessun risultato aziendale</p><p className="mt-1 max-w-4xl text-xs leading-5 text-muted-foreground">Importi, budget e andamenti sono esempi inventati per valutare l’interfaccia. I risultati reali saranno collegati solo dopo la validazione del workbook e la verifica indipendente.</p></div>
    </div>

    <nav aria-label="Sezioni di Pillar C" className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm sm:grid-cols-3 xl:grid-cols-6">
      {WORKBOOK_SECTIONS.map((s) => <a key={s.id} href={`#${s.id}`} className="flex min-h-12 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><span className="text-[10px] tabular-nums text-primary">{s.number}</span><span>{s.label}</span></a>)}
    </nav>

    <section aria-label="Filtri del prototipo" className="rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6">
      <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary"><SlidersHorizontal size={15} aria-hidden="true" /><span>Esplora l’ambito</span></div>
      <div className="grid items-end gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto]">
        <label className="min-w-0 text-xs font-medium text-muted-foreground">Portafoglio<select aria-label="Portafoglio" value={filters.portfolio} onChange={(e) => update({ portfolio: e.target.value as PreviewPortfolio })} className={fieldClass}><option value="all">Tutti i portafogli</option>{PORTFOLIOS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
        <label className="min-w-0 text-xs font-medium text-muted-foreground">Canale<select aria-label="Canale" value={filters.channel} onChange={(e) => update({ channel: e.target.value as PreviewFilters["channel"] })} className={fieldClass}><option value="all">Tutti i canali</option><option value="DD">DD · Distribuzione diretta</option><option value="DPC">DPC · Distribuzione per conto</option><option value="CO">CO · Consumo ospedaliero</option></select></label>
        <div className="flex flex-wrap gap-2"><button type="button" className={iconButtonClass} onClick={copyLink}>{copyState === "copied" ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}<span>{copyState === "copied" ? "Link copiato" : "Copia vista"}</span></button><button type="button" className={iconButtonClass} onClick={() => update({}, true)}><RotateCcw size={14} aria-hidden="true" /><span>Azzera</span></button></div>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"><p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">{selectedPortfolio} · {channelLabel}</span><span> · ambito dimostrativo</span></p><p className="text-xs text-muted-foreground">I controlli di anno e misura sono accanto ai grafici.</p></div>
      <p className="sr-only" role="status">{selectedPortfolio}, {channelLabel}. Vista aggiornata.</p>
      {copyState === "failed" && <p role="status" className="mt-3 text-xs text-muted-foreground">La copia non è disponibile. Puoi copiare l’indirizzo dalla barra del browser.</p>}
    </section>

    <section id="portafogli" aria-labelledby="portafogli-title" className="scroll-mt-6">
      <SectionHeading index={0} description="Dimensione del portafoglio, composizione e andamento nel tempo. Le categorie restano proxy finché l’attribuzione clinica non è confermata." />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><p className="text-xs font-medium text-muted-foreground">Fotografia annuale · indicatori, portafogli e attribuzione</p><LocalToggle label="Anno" value={filters.year} options={[{ value: "2024", label: "2024" }, { value: "2025", label: "2025" }]} onChange={(year) => update({ year })} ariaLabel="Anno della fotografia annuale" /></div>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={`Spesa illustrativa · ${filters.year}`} value={compactEuro(model.amount)} detail="Portafoglio e canale selezionati" icon={Wallet} accent />
        <KpiCard label="Variazione illustrativa · 2024–25" value={`${model.change > 0 ? "+" : ""}${percent(model.change / model.previous)}`} detail={signedEuro(model.change)} icon={ArrowDownUp} />
        <KpiCard label={`Quota condivisa · ${filters.year}`} value={percent(model.sharedShare ?? 0)} detail="Da attribuire con evidenza locale" icon={Layers3} />
        <KpiCard label="Portafogli in vista" value={String(model.portfolios.length)} detail="Categorie dimostrative selezionate" icon={FileCheck2} />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title={`Composizione del portafoglio · ${filters.year}`} subtitle="Esplora il contributo di ciascuna categoria." controls={<LocalToggle label="Misura" value={filters.composition} options={[{ value: "amount", label: "Euro" }, { value: "share", label: "Quota %" }]} onChange={(composition) => update({ composition })} ariaLabel="Misura della composizione" />}>
          <PortfolioBars model={model} metric={filters.composition} onSelect={(portfolio) => update({ portfolio })} /><FigureNote>Le quote hanno come denominatore la spesa dell’ambito selezionato.</FigureNote>
        </Panel>
        <Panel title="Andamento a confronto · 2024–2025" subtitle="Stesso portafoglio e canale; entrambi gli anni sono sempre visibili." controls={<LocalToggle label="Vista" value={filters.trend} options={[{ value: "monthly", label: "Mensile" }, { value: "cumulative", label: "Cumulata" }]} onChange={(trend) => update({ trend })} ariaLabel="Vista dell’andamento" />}>
          <MonthlyChart rows={model.months} cumulative={filters.trend === "cumulative"} /><FigureNote>La distribuzione mensile è costruita per il prototipo; non descrive stagionalità osservata.</FigureNote>
        </Panel>
      </div>
    </section>

    <section id="attribuzione" aria-labelledby="attribuzione-title" className="scroll-mt-6">
      <SectionHeading index={1} description="La spesa osservata e la sua destinazione clinica sono due evidenze distinte. La copertura deve rimanere visibile." />
      <div className="grid gap-5 xl:grid-cols-[1.1fr_1fr]">
        <Panel title={`Copertura dell’attribuzione · ${filters.year}`} subtitle="Composizione illustrativa della spesa selezionata."><AttributionChart model={model} /><FigureNote>Ogni importo compare una sola volta. La quota condivisa non viene ripartita tra aree senza una regola documentata.</FigureNote></Panel>
        <Panel title="Dal portafoglio all’area clinica" subtitle="Che cosa servirà per passare a un’analisi attribuita.">
          <ol className="space-y-5">{[
            ["01", "Identificare il prodotto", "AIC, ATC, periodo e canale devono essere riconciliati con il totale di partenza."],
            ["02", "Documentare il proxy", "La corrispondenza farmaco–portafoglio richiede fonti, versione e revisione. ATC e indicazione autorizzata non provano l’uso locale."],
            ["03", "Confermare l’allocazione", "Centro di costo o evidenza locale validata permettono l’assegnazione clinica. Solo allora è applicabile lo stato S1."],
          ].map(([n, title, text]) => <li key={n} className="flex gap-3"><span className="pt-0.5 text-xs font-semibold text-primary">{n}</span><div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p></div></li>)}</ol>
          <a href="#fonti" className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-primary">Leggi i requisiti di pubblicazione<ArrowRight size={14} aria-hidden="true" /></a>
        </Panel>
      </div>
    </section>

    <section id="variazioni" aria-labelledby="variazioni-title" className="scroll-mt-6">
      <SectionHeading index={2} description="Distingui il contributo alla variazione dalle sue possibili cause. Un aumento di spesa richiede una verifica, non implica inefficienza." />
      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Panel title="Contributi alla variazione · 2024 → 2025" subtitle="Ordinati per valore assoluto; il totale è la somma dei contributi."><ChangeBars model={model} /><FigureNote>Contributi contabili in euro. Effetti di costo, quantità e mix richiedono strati e unità confrontabili.</FigureNote></Panel>
        <Panel title="La quadratura del cambiamento" subtitle="Stesso ambito nei due periodi.">
          <dl className="space-y-5"><div className="flex justify-between gap-3 border-b border-border pb-4"><dt className="text-sm text-muted-foreground">Spesa 2024</dt><dd className="font-semibold tabular-nums">{euro(model.previous)}</dd></div><div className="flex justify-between gap-3 border-b border-border pb-4"><dt className="text-sm text-muted-foreground">Variazione</dt><dd className="font-semibold tabular-nums">{signedEuro(model.change)}</dd></div><div className="flex justify-between gap-3"><dt className="text-sm font-semibold">Spesa 2025</dt><dd className="text-lg font-semibold tabular-nums text-primary">{euro(model.current)}</dd></div></dl>
          <div className="mt-6 rounded-xl bg-secondary/60 p-4"><p className="text-xs font-semibold">Approfondimento previsto</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Scomposizione costo–quantità–mix, sensibilità e confronto per strati omogenei saranno attivati quando i relativi contratti del workbook superano la verifica indipendente.</p></div><FigureNote />
        </Panel>
      </div>
    </section>

    <section id="budget" aria-labelledby="budget-title" className="scroll-mt-6">
      <SectionHeading index={3} description="Un obiettivo di budget deve avere un perimetro, un periodo e una fonte approvata prima di essere confrontato con la spesa." />
      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Panel title="Consuntivo e budget · scenario 2025" subtitle="Il budget di questo esempio è interamente inventato." controls={<LocalToggle label="Vista" value={filters.budget} options={[{ value: "amount", label: "Confronto" }, { value: "deviation", label: "Scostamento" }]} onChange={(budget) => update({ budget })} ariaLabel="Vista del budget" />}><BudgetChart model={model} view={filters.budget} /><FigureNote>Uno scostamento positivo indica spesa superiore al budget di esempio, non un giudizio di appropriatezza.</FigureNote></Panel>
        <Panel title="Obiettivo e perimetro" subtitle="Riepilogo dello scenario selezionato.">
          <p className="text-xs text-muted-foreground">Budget illustrativo · 2025</p><p className="mt-2 text-3xl font-semibold tracking-tight">{compactEuro(budgetTotal)}</p><p className="mt-2 text-sm"><span className="text-muted-foreground">Scostamento: </span><span className="font-semibold tabular-nums">{signedEuro(model.current - budgetTotal)}</span></p>
          <div className="mt-6 border-t border-border pt-5"><h4 className="text-sm font-semibold">Prima di collegare dati reali</h4><ul className="mt-3 space-y-3 text-xs leading-5 text-muted-foreground"><li>Budget approvato, revisioni e periodo di validità documentati.</li><li>Consuntivo con lo stesso criterio di costo e lo stesso perimetro organizzativo.</li><li>Quote non attribuite e discontinuità dichiarate. Previsioni solo con serie adeguate e validazione temporale.</li></ul></div><FigureNote />
        </Panel>
      </div>
    </section>

    <section aria-labelledby="contesto-title" className="scroll-mt-6">
      <div className="rounded-2xl border border-border bg-card p-5 md:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="contesto-title" className="text-base font-semibold">Confronti e contesto</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Spazio previsto per confronti territoriali e attività assistenziale · fogli 13–14.</p></div><span className="rounded-full border border-border bg-secondary/50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">In attesa di evidenza compatibile</span></div><div className="mt-5 grid gap-5 md:grid-cols-3">{[
        ["Confronti omogenei", "Stesso periodo, criterio di costo, canale e regole di attribuzione. Differenze di composizione richiedono un aggiustamento documentato."],
        ["Denominatori verificati", "Residenti, ricoveri e giornate descrivono perimetri diversi. Ogni indicatore dovrà usare un denominatore pertinente e coerente con il numeratore."],
        ["Ambiti autorizzati", "Un’Azienda vede il proprio dato e comparatori aggregati approvati per la propria regione o l’Italia. Nessun dettaglio di altre Aziende."],
      ].map(([title, text]) => <div key={title}><h3 className="text-sm font-semibold">{title}</h3><p className="mt-2 text-xs leading-5 text-muted-foreground">{text}</p></div>)}</div></div>
    </section>

    <section id="priorita" aria-labelledby="priorita-title" className="scroll-mt-6">
      <SectionHeading index={4} description="Trasforma un segnale in una domanda verificabile, con responsabilità e prova di chiusura. Queste schede illustrano il flusso futuro." />
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Coda di revisione dimostrativa" subtitle="Ordine per variazione assoluta, non per gravità clinica.">
          <div className="space-y-2">{priorities.map((p, i) => <button key={p.id} type="button" aria-pressed={activePriority.id === p.id} onClick={() => setPriority(p.id)} className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${activePriority.id === p.id ? "border-primary/40 bg-primary/5" : "border-border hover:bg-secondary/60"}`}><span className="text-xs text-muted-foreground">{String(i + 1).padStart(2, "0")}</span><span className="min-w-0 flex-1 text-sm font-medium">{p.label}</span><span className="shrink-0 text-xs font-semibold tabular-nums">{signedEuro(p.change)}</span><ArrowRight size={14} className="shrink-0 text-primary" aria-hidden="true" /></button>)}</div><FigureNote>Nessuna attività viene creata o assegnata. La selezione serve solo a esplorare la scheda.</FigureNote>
        </Panel>
        <Panel title={`Verifica del portafoglio · ${activePriority.label}`} subtitle="Esempio di scheda operativa · confronto 2024–2025">
          <dl className="space-y-4 text-sm"><div><dt className="text-[10px] font-semibold uppercase tracking-wider text-primary">Domanda</dt><dd className="mt-1 leading-6">Quali prodotti e cambiamenti di perimetro spiegano la variazione di {signedEuro(activePriority.change)}?</dd></div><div><dt className="text-[10px] font-semibold uppercase tracking-wider text-primary">Verifiche proposte</dt><dd className="mt-1 text-xs leading-5 text-muted-foreground">Riconciliare gli importi, esaminare i prodotti a maggior contributo e confermare l’attribuzione con la farmacia e il controllo di gestione.</dd></div><div><dt className="text-[10px] font-semibold uppercase tracking-wider text-primary">Responsabilità da confermare</dt><dd className="mt-1 text-xs leading-5 text-muted-foreground">Farmacia e controllo di gestione. Referente, scadenza e decisione saranno concordati nel flusso operativo.</dd></div><div><dt className="text-[10px] font-semibold uppercase tracking-wider text-primary">Prova di chiusura</dt><dd className="mt-1 text-xs leading-5 text-muted-foreground">Spiegazione documentata, evidenze utilizzate, eventuale azione organizzativa e data di riesame.</dd></div></dl>
          <p className="mt-5 border-t border-border pt-3 text-[11px] leading-5 text-muted-foreground">Nessuna raccomandazione terapeutica o stima automatica di risparmio.</p>
        </Panel>
      </div>
    </section>

    <section id="fonti" aria-labelledby="fonti-title" className="scroll-mt-6">
      <SectionHeading index={5} description="Il workbook precede la pubblicazione. Ogni risultato dovrà essere riproducibile e riconciliato con la sua fonte." />
      <Panel title="Dal workbook al cruscotto" subtitle="Questa anteprima prova l’interfaccia; non certifica l’avanzamento delle analisi.">
        <div className="grid gap-4 md:grid-cols-3">{[
          ["01", "Workbook congelato", "Fonti, perimetri, formule, copertura e impronte dei file documentati."],
          ["02", "Doppia verifica", "Ricalcolo indipendente, quadrature e test delle selezioni su ogni analisi."],
          ["03", "Rilascio controllato", "Collegamento server-side, autorizzazioni, verifica dei grafici e approvazione finale."],
        ].map(([n, title, text]) => <div key={n} className="rounded-xl border border-border p-4"><p className="text-xs font-semibold text-primary">{n}</p><h4 className="mt-2 text-sm font-semibold">{title}</h4><p className="mt-2 text-xs leading-5 text-muted-foreground">{text}</p></div>)}</div>
        <details className="mt-6 rounded-xl border border-border"><summary className="cursor-pointer rounded-xl px-4 py-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">Mappa di integrazione con il workbook · 24 fogli previsti</summary><div className="overflow-x-auto px-4 pb-4"><table className="w-full text-left text-xs"><caption className="pb-3 text-left text-muted-foreground">Struttura prevista dal piano; tutti i risultati reali restano soggetti al gate workbook.</caption><thead><tr>{["Sezione", "Fogli previsti", "Contratti di riferimento"].map((h) => <th scope="col" key={h} className="border-b border-border px-2 py-2">{h}</th>)}</tr></thead><tbody>{WORKBOOK_SECTIONS.map((s) => <tr key={s.id}><th scope="row" className="border-b border-border/60 px-2 py-3 font-medium">{s.label}</th><td className="whitespace-nowrap border-b border-border/60 px-2 py-3">{s.sheets}</td><td className="whitespace-nowrap border-b border-border/60 px-2 py-3 text-muted-foreground">{s.gate}</td></tr>)}</tbody></table></div></details>
        <p className="mt-5 text-xs leading-5 text-muted-foreground">Dati locali riservati, fonti pubbliche e documenti di budget manterranno provenienza e permessi distinti. Nessun dato aziendale viene caricato da questa anteprima.</p>
      </Panel>
    </section>
    <footer className="flex flex-wrap justify-between gap-2 border-t border-border pt-4 text-[11px] text-muted-foreground"><span>VIS · Pillar C · Anteprima con dati illustrativi</span><span>{PILLAR_C_PREVIEW_VERSION}</span></footer>
  </div>;
}
