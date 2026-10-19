"use client";

import { useState } from "react";
import { ChevronDown, ClipboardList, Download, Plus, Save, Trash2 } from "lucide-react";
import { C_ORG_LABELS, C_PERIOD_LABELS } from "@/lib/dashboard-review/pillar-c/review";
import {
  C_REVIEW_STATES, C_REVIEW_TYPES, CReviewValidationError, cCreateReviewTask, cReviewContextKey,
  cReviewCsv, cReviewJson, cReviewPlan, cUpdateReviewTask,
  type CPortfolioReviewContext, type CReviewInput, type CReviewState, type CReviewTask, type CReviewType,
} from "@/lib/dashboard-review/pillar-c/review-plan";

const types: Record<CReviewType, string> = {
  attribution: "Chiarire l’attribuzione", "product-change": "Spiegare la variazione dei prodotti",
  identifier: "Verificare gli identificativi", "budget-evidence": "Raccogliere evidenza sul budget",
};
const states: Record<CReviewState, string> = {
  draft: "Bozza", assigned: "Assegnazione registrata nel piano", in_review: "Verifica in corso", resolved: "Verifica conclusa",
};
const errors = {
  context: "Il perimetro o la fonte del piano non sono validi.", input: "Controlla i campi e usa una data valida.",
  assignment: "Per registrare l’assegnazione servono ruolo, referente e scadenza.",
  resolution: "Per concludere servono un riferimento all’evidenza e l’esito della verifica.",
  transition: "Segui i passaggi: bozza, assegnazione, verifica, conclusione. Per modificare una verifica conclusa, riaprila prima.",
  task: "Questa attività non appartiene al perimetro o alla fonte selezionati.",
};
const inputClass = "mt-1 block min-h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
const buttonClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40";
const message = (error: unknown) => error instanceof CReviewValidationError ? errors[error.code] : "Operazione non completata. Il piano resta in questa pagina.";

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type })), anchor = document.createElement("a");
  anchor.href = url; anchor.download = name; document.body.appendChild(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function TaskEditor({ task, onSave, onDelete }: { task: CReviewTask; onSave: (input: CReviewInput) => void; onDelete: () => void }) {
  const [input, setInput] = useState<CReviewInput>({ type: task.type, title: task.title, role: task.role, owner: task.owner, dueDate: task.dueDate, state: task.state, evidence: task.evidence, outcome: task.outcome });
  const change = <K extends keyof CReviewInput>(key: K, value: CReviewInput[K]) => setInput(current => ({ ...current, [key]: value }));
  return <details className="rounded-xl border border-border bg-background/70" open={task.state === "draft"}>
    <summary className="cursor-pointer px-4 py-3 text-sm font-medium"><span>{task.title}</span><span className="ml-3 inline-block rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">{states[task.state]}</span><ChevronDown className="ml-2 inline text-primary" size={14} aria-hidden="true"/></summary>
    <form className="space-y-4 border-t border-border p-4" onSubmit={event => { event.preventDefault(); onSave(input); }}>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-xs font-medium">Obiettivo della verifica<input className={inputClass} value={input.title} maxLength={240} required onChange={event => change("title", event.target.value)} /></label>
        <label className="text-xs font-medium">Tipo di attività<select className={inputClass} value={input.type} onChange={event => change("type", event.target.value as CReviewType)}>{C_REVIEW_TYPES.map(type => <option key={type} value={type}>{types[type]}</option>)}</select></label>
        <label className="text-xs font-medium">Ruolo o ufficio<input className={inputClass} value={input.role} maxLength={120} placeholder="Es. Farmacia, controllo di gestione" onChange={event => change("role", event.target.value)} /></label>
        <label className="text-xs font-medium">Referente indicato nel piano<input className={inputClass} value={input.owner} maxLength={160} placeholder="Nome del referente" onChange={event => change("owner", event.target.value)} /></label>
        <label className="text-xs font-medium">Scadenza<input type="date" className={inputClass} value={input.dueDate} onChange={event => change("dueDate", event.target.value)} /></label>
        <label className="text-xs font-medium">Stato nel piano<select className={inputClass} value={input.state} onChange={event => change("state", event.target.value as CReviewState)}>{C_REVIEW_STATES.map(state => <option key={state} value={state}>{states[state]}</option>)}</select></label>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-xs font-medium">Riferimento all’evidenza<textarea className={`${inputClass} min-h-20`} value={input.evidence} maxLength={1600} placeholder="Es. estratto aggregato, periodo, protocollo e data. Nessun dato individuale." onChange={event => change("evidence", event.target.value)} /></label>
        <label className="text-xs font-medium">Esito e seguito<textarea className={`${inputClass} min-h-20`} value={input.outcome} maxLength={1600} placeholder="Che cosa è stato accertato? Che cosa resta da chiarire?" onChange={event => change("outcome", event.target.value)} /></label>
      </div>
      <div className="flex flex-wrap justify-between gap-3"><button type="submit" className={`${buttonClass} bg-primary/10 text-primary`}><Save size={14} aria-hidden="true"/>Registra nel piano</button><button type="button" className={buttonClass} onClick={onDelete}><Trash2 size={14} aria-hidden="true"/>Rimuovi attività</button></div>
    </form>
  </details>;
}

/** Only mount inside the existing reviewer-authorized workspace. No browser persistence or transport. */
export function CPortfolioReviewPlan({ context }: { context: CPortfolioReviewContext }) {
  const key = cReviewContextKey(context);
  const [plans, setPlans] = useState<Record<string, CReviewTask[]>>({});
  const [error, setError] = useState<{ key: string; text: string } | null>(null);
  const [feedback, setFeedback] = useState<{ key: string; text: string } | null>(null);
  const tasks = plans[key] ?? [];
  const showError = (caught: unknown) => setError({ key, text: message(caught) });
  const setTasks = (next: CReviewTask[], text: string) => { setPlans(current => ({ ...current, [key]: next })); setError(null); setFeedback({ key, text }); };
  const create = () => {
    try {
      const task = cCreateReviewTask(context, { type: "attribution", title: `Chiarire l’attribuzione: ${context.portfolioLabel}`.slice(0, 240), role: "", owner: "", dueDate: "", evidence: "", outcome: "", state: "draft" }, { id: crypto.randomUUID(), now: new Date().toISOString() });
      setTasks([...tasks, task], "Attività aggiunta alla bozza di questa pagina.");
    } catch (caught) { showError(caught); }
  };
  const exportPlan = (kind: "json" | "csv") => {
    try {
      const plan = cReviewPlan(context, tasks, new Date().toISOString());
      const name = `VIS_PillarC_Revisione_${context.period}_${context.org}_${context.channel}_${context.portfolioId}.${kind}`;
      download(name, kind === "json" ? cReviewJson(plan) : cReviewCsv(plan), kind === "json" ? "application/json;charset=utf-8" : "text/csv;charset=utf-8");
      setError(null); setFeedback({ key, text: "Download richiesto. Conserva il file in un luogo riservato." });
    } catch (caught) { showError(caught); }
  };
  return <details className="mt-5 rounded-2xl border border-primary/20 bg-primary/[.025]" data-c-review-plan data-context={key}>
    <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 p-4 text-sm font-semibold"><span className="inline-flex items-center gap-2"><ClipboardList className="text-primary" size={18} aria-hidden="true"/>Piano di revisione · bozza esportabile</span><span className="inline-flex items-center gap-2 text-xs font-normal text-muted-foreground">{tasks.length === 0 ? "Prepara il prossimo passo" : `${tasks.length} attività`}<ChevronDown size={15} aria-hidden="true"/></span></summary>
    <div className="space-y-4 border-t border-primary/15 p-4">
      <p className="text-xs leading-5 text-muted-foreground">Resta aperto in questa pagina; scarica per conservarlo. Nessun incarico o notifica viene inviato. Il piano è separato per portafoglio, periodo, Azienda e canale; ricaricare o chiudere la pagina lo cancella.</p>
      <p className="text-xs font-medium">{context.portfolioLabel} · {C_PERIOD_LABELS[context.period]} · {C_ORG_LABELS[context.org]} · {context.channel === "Tutti" ? "Tutti i canali" : context.channel}</p>
      <div className="flex flex-wrap gap-2"><button type="button" className={`${buttonClass} bg-primary text-primary-foreground hover:bg-primary/90`} onClick={create}><Plus size={14} aria-hidden="true"/>Aggiungi attività</button><button type="button" className={buttonClass} disabled={tasks.length === 0} onClick={() => exportPlan("json")}><Download size={14} aria-hidden="true"/>Scarica piano JSON</button><button type="button" className={buttonClass} disabled={tasks.length === 0} onClick={() => exportPlan("csv")}><Download size={14} aria-hidden="true"/>Scarica tabella CSV</button></div>
      {error?.key === key && <p role="alert" className="text-xs text-destructive">{error.text}</p>}
      {feedback?.key === key && error?.key !== key && <p role="status" className="text-xs text-primary">{feedback.text}</p>}
      <div className="space-y-3">{tasks.map(task => <TaskEditor key={`${key}|${task.id}|${task.updatedAt}`} task={task} onSave={input => { try { const updated = cUpdateReviewTask(context, task, input, new Date().toISOString()); setTasks(tasks.map(row => row.id === updated.id ? updated : row), "Attività aggiornata nella bozza. Scarica di nuovo il piano per conservarla."); } catch (caught) { showError(caught); } }} onDelete={() => { if (window.confirm("Rimuovere questa attività dalla bozza aperta? Il file già scaricato non viene modificato.")) setTasks(tasks.filter(row => row.id !== task.id), "Attività rimossa da questa pagina."); }} />)}</div>
      <p className="text-xs leading-5 text-muted-foreground">Inserisci solo riferimenti a evidenze aggregate, non dati di pazienti o allegati. Concludere una verifica registra un esito nel piano: non modifica la mappatura, gli importi o l’approvazione clinica.</p>
    </div>
  </details>;
}
