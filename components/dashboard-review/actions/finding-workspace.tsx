"use client";

// The action loop's workspace. A reviewer sees the findings of the active
// release and every case; a member sees the cases of their Azienda that an
// Azienda colleague owns, and acts on the ones they own. The server decides
// who may do what (lib/dashboard-review/actions/model.ts); this only offers
// the same steps. Text that changes after a save sits in keyed elements, so a
// page translated by the browser is replaced, never patched in place.

import { useEffect, useId, useState } from "react";
import { ClipboardCheck, History, RefreshCw } from "lucide-react";
import {
  FINDING_ACTION_LABELS, FINDING_DECISIONS, FINDING_DECISION_LABELS, FINDING_KIND_LABELS, FINDING_STATE_LABELS,
  findingSummary, type FindingAction, type FindingCandidate, type FindingCase, type FindingDecision, type FindingKind,
} from "@/lib/dashboard-review/actions/model";
import { itNumber } from "@/lib/format/it-number";

type Case = FindingCase & { allowed: FindingAction[] };
type Candidate = FindingCandidate & { case_id: string | null };
type Owner = { id: string; label: string; org: string; internal: boolean };
type Event = { revision: number; action: string; actor_id: string; created_at: string; payload: Record<string, unknown> | null };
type Workspace =
  | { schema: string; active: false; viewer: { kind: "reviewer" | "member" } }
  | { schema: string; active: true; viewer: { kind: "reviewer" | "member"; id: string }; cases: Case[]; candidates: Candidate[] | null; withheld?: string[]; year?: number | null };
type Detail = { case: Case; events: Event[]; people: Record<string, string>; owners: Owner[] | null };
type Notice = { id: number; text: string; tone: "ok" | "error" };

const field = "mt-1.5 block min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-primary";
const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-medium hover:bg-primary/5 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-primary";
const primary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary-strong px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-strong/95 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const stamp = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });
const when = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.valueOf()) ? "data non disponibile" : stamp.format(d); };
/** Due dates are calendar days: never shifted through a time zone. */
const day = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)}` : "non indicata");
const today = () => new Date().toISOString().slice(0, 10);
const EVENT_LABELS: Record<string, string> = {
  create: "Caso aperto", assign: "Assegnazione", start: "Presa in carico", record_decision: "Decisione registrata", close: "Caso chiuso", reopen: "Caso riaperto",
};
const ERRORS: Record<string, string> = {
  invalid: "Richiesta non valida: aggiorna e riprova. Nessuna modifica è stata registrata.",
  forbidden: "Questa sessione non può compiere questo passaggio. Nessuna modifica è stata registrata.",
  actor: "Il tuo account non ha un’adesione approvata. Nessuna modifica è stata registrata.",
  not_found: "Caso non trovato: aggiorna l’elenco. Nessuna modifica è stata registrata.",
  conflict: "Il caso è cambiato dopo l’ultima lettura: aggiorna e controlla la versione corrente. Nessuna modifica è stata registrata.",
  owner: "La persona indicata non può ricevere questo caso: scegline una dall’elenco. Nessuna modifica è stata registrata.",
  due_date: "La scadenza deve essere oggi o una data entro due anni. Nessuna modifica è stata registrata.",
  validation: "Mancano dei campi o il passaggio non è consentito in questo stato. Nessuna modifica è stata registrata.",
  unavailable: "Servizio non disponibile: nessuna modifica è stata confermata. Aggiorna prima di riprovare.",
};
const errorText = (code: string) => ERRORS[code] ?? ERRORS.unavailable;

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try { response = await fetch(url, { ...init, credentials: "same-origin", cache: "no-store" }); } catch { throw Error("unavailable"); }
  const data = await response.json().catch(() => null) as { error?: unknown } | null;
  if (!response.ok) throw Error(typeof data?.error === "string" ? data.error : "unavailable");
  if (!data || typeof data !== "object") throw Error("unavailable");
  return data as T;
}
const send = <T,>(method: "POST" | "PATCH", body: unknown) =>
  request<T>("/api/findings", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

function caseTitle(c: Pick<FindingCase, "source">) {
  return `${c.source.subject_label} · ${c.source.org_label}`;
}

export function FindingWorkspace() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);

  const [round, setRound] = useState(0);
  const load = () => setRound((r) => r + 1);
  useEffect(() => {
    let alive = true;
    request<Workspace>("/api/findings").then((w) => {
      if (!alive) return;
      setWorkspace(w); setLoadError(null);
      // The link in an assignment email opens its case.
      const id = new URLSearchParams(window.location.search).get("caso");
      if (id && /^[0-9a-f-]{36}$/i.test(id)) setSelected((s) => s ?? id);
    }, (e) => { if (alive) setLoadError(e instanceof Error ? e.message : "unavailable"); });
    return () => { alive = false; };
  }, [round]);

  const say = (text: string, tone: Notice["tone"]) => setNotice({ id: Date.now(), text, tone });

  async function open(candidate: Candidate) {
    setBusy(true);
    try {
      const saved = await send<{ case: FindingCase }>("POST", { kind: candidate.kind, asl_code: candidate.asl_code, subject: candidate.subject });
      say(`Caso aperto: ${caseTitle(saved.case)}. Assegnalo a chi deve esaminarlo.`, "ok");
      load();
      setSelected(saved.case.id);
    } catch (e) { say(errorText(e instanceof Error ? e.message : "unavailable"), "error"); }
    finally { setBusy(false); }
  }

  if (loadError) {
    return (
      <div key={`error-${loadError}`} role="alert" className="rounded-2xl border border-border bg-card p-5 text-sm">
        <p>{loadError === "forbidden" ? "Il registro delle azioni è riservato agli utenti con un’adesione approvata." : "Il registro delle azioni non è disponibile al momento."}</p>
        <button type="button" className={`${button} mt-3`} onClick={load}><RefreshCw size={15} aria-hidden="true" />Riprova</button>
      </div>
    );
  }
  if (!workspace) return <p role="status" className="text-sm text-muted-foreground">Caricamento del registro delle azioni…</p>;
  if (!workspace.active) {
    return (
      <p key="inactive" className="rounded-2xl border border-border bg-card p-5 text-sm">
        Il registro delle azioni non è ancora attivo in questo ambiente: la tabella dei casi non è stata creata. Nessun caso è stato perso.
      </p>
    );
  }

  const reviewer = workspace.viewer.kind === "reviewer";
  const open_ = workspace.cases.filter((c) => c.state !== "closed");
  const closed = workspace.cases.filter((c) => c.state === "closed");

  return (
    <div className="flex flex-col gap-7">
      <div aria-live="polite" className="min-h-0">
        {notice && <p key={notice.id} role={notice.tone === "error" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm ${notice.tone === "error" ? "border-destructive/40 bg-destructive/5" : "border-primary/30 bg-primary/5"}`}>{notice.text}</p>}
      </div>

      {reviewer && <Candidates candidates={workspace.candidates} withheld={workspace.withheld ?? []} busy={busy} onOpen={open} onShow={setSelected} />}

      <section aria-labelledby="cases-heading" className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="cases-heading" className="font-display text-xl">{reviewer ? "Casi" : "I casi della tua Azienda"}</h2>
          <button type="button" className={button} onClick={load}><RefreshCw size={15} aria-hidden="true" />Aggiorna</button>
        </div>
        {!reviewer && <p className="mt-2 text-sm text-muted-foreground">Qui trovi i casi assegnati a una persona della tua Azienda. Chi ne è titolare li prende in carico, registra la decisione e, a conclusione, l’esito.</p>}
        <CaseList title="Aperti" cases={open_} selected={selected} onSelect={setSelected} empty={reviewer ? "Nessun caso aperto." : "Nessun caso aperto per la tua Azienda."} />
        {closed.length > 0 && <CaseList title="Chiusi" cases={closed} selected={selected} onSelect={setSelected} empty="" />}
      </section>

      {selected && <CaseDetail key={selected} id={selected} onSaved={(text) => { say(text, "ok"); load(); }} onError={(code) => say(errorText(code), "error")} onClose={() => setSelected(null)} />}
    </div>
  );
}

function Candidates({ candidates, withheld, busy, onOpen, onShow }: {
  candidates: Candidate[] | null; withheld: string[]; busy: boolean;
  onOpen: (c: Candidate) => void; onShow: (id: string) => void;
}) {
  if (candidates === null) {
    return <p className="rounded-2xl border border-border bg-card p-5 text-sm">I risultati del rilascio attivo non sono leggibili in questo momento; i casi già aperti restano lavorabili.</p>;
  }
  const groups: FindingKind[] = ["biosimilar", "benchmark"];
  return (
    <section aria-labelledby="candidates-heading" className="rounded-2xl border border-border bg-card p-5">
      <h2 id="candidates-heading" className="font-display text-xl">Risultati da esaminare</h2>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Ogni risultato riguarda una sola Azienda del rilascio attivo. Aprire un caso non lo rende un obiettivo: serve ad assegnare chi lo esamina e a tenere traccia della decisione e dell’esito.
      </p>
      {groups.map((kind) => {
        const rows = candidates.filter((c) => c.kind === kind);
        return (
          <div key={kind} className="mt-5">
            <h3 className="text-sm font-semibold">{FINDING_KIND_LABELS[kind]}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {kind === "biosimilar"
                ? "Per ogni Azienda, fino a cinque sostanze con la maggiore spesa di riferimento dopo il primo biosimilare locale, 2024–2025, tutti i canali. Non è un risparmio."
                : "Aziende con costo unitario sopra il prezzo del gruppo per lo stesso mix di prodotti (indice oltre 100), calcolato su almeno metà della loro spesa."}
            </p>
            {rows.length === 0
              ? <p className="mt-2 text-sm text-muted-foreground">Nessun risultato in questo rilascio.</p>
              : (
                <ul className="mt-2 divide-y divide-border">
                  {rows.map((c) => (
                    <li key={`${c.kind}|${c.asl_code}|${c.subject}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{c.subject_label} · {c.org_label}</p>
                        <p className="text-xs text-muted-foreground">{candidateLine(c)}</p>
                      </div>
                      {c.case_id
                        ? <button type="button" className={button} onClick={() => onShow(c.case_id!)}>Caso aperto: vedi</button>
                        : <button type="button" className={button} disabled={busy} onClick={() => onOpen(c)}><ClipboardCheck size={15} aria-hidden="true" />Apri un caso</button>}
                    </li>
                  ))}
                </ul>
              )}
          </div>
        );
      })}
      {withheld.length > 0 && (
        <p className="mt-4 text-xs text-muted-foreground">
          Biosimilari non proposti per {withheld.join(", ")}: come nella pagina Pillar B, la lista resta trattenuta quando il ponte della spesa non quadra o contiene saldi netti negativi.
        </p>
      )}
    </section>
  );
}

function candidateLine(c: FindingCandidate) {
  if (c.kind === "biosimilar") {
    return `${itNumber(Number(c.value), { style: "currency", currency: "EUR", maximumFractionDigits: 0 })} dal primo biosimilare locale (${c.detail}).`;
  }
  return `Indice ${itNumber(Number(c.value), { minimumFractionDigits: 1, maximumFractionDigits: 1 })}, su ${Math.round(Number(c.detail) * 100)}% della spesa.`;
}

function CaseList({ title, cases, selected, onSelect, empty }: {
  title: string; cases: Case[]; selected: string | null; onSelect: (id: string) => void; empty: string;
}) {
  return (
    <div className="mt-5">
      <h3 className="text-sm font-semibold">{title}</h3>
      {cases.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">{empty}</p> : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <caption className="sr-only">{title}: tema, Azienda, stato, scadenza</caption>
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th scope="col" className="py-2 pr-3 font-medium">Tema</th>
                <th scope="col" className="py-2 pr-3 font-medium">Risultato</th>
                <th scope="col" className="py-2 pr-3 font-medium">Stato</th>
                <th scope="col" className="py-2 pr-3 font-medium">Scadenza</th>
                <th scope="col" className="py-2 font-medium"><span className="sr-only">Azione</span></th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => {
                const late = c.state !== "closed" && c.due_date !== null && c.due_date < today();
                return (
                  <tr key={`${c.id}-${c.revision}`} className={`border-b border-border last:border-0 ${selected === c.id ? "bg-primary/5" : ""}`}>
                    <td className="py-2 pr-3">{FINDING_KIND_LABELS[c.kind]}</td>
                    <td className="py-2 pr-3">{caseTitle(c)}</td>
                    <td className="py-2 pr-3">{FINDING_STATE_LABELS[c.state]}</td>
                    <td className="py-2 pr-3">{day(c.due_date)}{late && <span className="ml-2 font-semibold text-rose-700 dark:text-rose-300">scaduta</span>}</td>
                    <td className="py-2 text-right">
                      <button type="button" className={button} aria-pressed={selected === c.id} onClick={() => onSelect(c.id)}>Apri<span className="sr-only"> {caseTitle(c)}</span></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CaseDetail({ id, onSaved, onError, onClose }: {
  id: string; onSaved: (text: string) => void; onError: (code: string) => void; onClose: () => void;
}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [round, setRound] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const formId = useId();
  const [owner, setOwner] = useState("");
  const [due, setDue] = useState("");
  const [decision, setDecision] = useState<FindingDecision | "">("");
  const [note, setNote] = useState("");
  const [outcome, setOutcome] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    let alive = true;
    request<Detail>(`/api/findings/${id}`).then((d) => {
      if (!alive) return;
      setDetail(d);
      setOwner(d.case.owner_id ?? ""); setDue(d.case.due_date ?? "");
      setDecision(d.case.decision ?? ""); setNote(d.case.decision_note ?? "");
    }, (e) => { if (alive) setError(e instanceof Error ? e.message : "unavailable"); });
    return () => { alive = false; };
  }, [id, round]);

  async function step(action: FindingAction, payload: Record<string, unknown>, done: string) {
    if (!detail) return;
    setBusy(true);
    try {
      const saved = await send<{ case: Case; notified: boolean | null }>("PATCH", { caseId: id, revision: detail.case.revision, action, payload });
      const mail = saved.notified === true ? " La persona assegnata riceve un’email." : saved.notified === false ? " L’email di avviso non è partita: avvisa la persona in altro modo." : "";
      setOutcome(""); setReason("");
      onSaved(done + mail);
      setRound((r) => r + 1);
    } catch (e) { onError(e instanceof Error ? e.message : "unavailable"); }
    finally { setBusy(false); }
  }

  if (error) return <p key={`e-${error}`} role="alert" className="rounded-2xl border border-border bg-card p-5 text-sm">{error === "not_found" ? "Caso non trovato o non visibile da questa sessione." : "Il caso non è leggibile al momento."}</p>;
  if (!detail) return <p role="status" className="text-sm text-muted-foreground">Caricamento del caso…</p>;
  const c = detail.case, allowed = new Set(c.allowed);
  const name = (uid: string | null) => (uid ? detail.people[uid] ?? "Utente" : "nessuno");

  return (
    <section key={`${c.id}-${c.revision}`} aria-labelledby={`${formId}-title`} className="rounded-2xl border border-primary/30 bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">{FINDING_KIND_LABELS[c.kind]} · {FINDING_STATE_LABELS[c.state]}</p>
          <h2 id={`${formId}-title`} className="font-display mt-1 text-xl">{caseTitle(c)}</h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{findingSummary(c.source)}</p>
        </div>
        <button type="button" className={button} onClick={onClose}>Chiudi il pannello</button>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div><dt className="text-xs text-muted-foreground">Titolare</dt><dd>{name(c.owner_id)}{c.owner_org && c.owner_org !== c.org_code ? " (verifica interna, non visibile all’Azienda)" : ""}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Scadenza</dt><dd>{day(c.due_date)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Decisione</dt><dd>{c.decision ? FINDING_DECISION_LABELS[c.decision] : "non ancora registrata"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Esito</dt><dd>{c.outcome ?? "non ancora registrato"}</dd></div>
      </dl>

      {allowed.size === 0 && c.state !== "closed" && <p className="mt-4 text-sm text-muted-foreground">Puoi leggere questo caso; i passaggi spettano al titolare o a chi lo ha assegnato.</p>}

      {allowed.has("assign") && detail.owners && (
        <form className="mt-5 grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-end"
          onSubmit={(e) => { e.preventDefault(); void step("assign", { owner_id: owner, due_date: due }, "Assegnazione registrata."); }}>
          <label className="text-sm">Titolare
            <select className={field} value={owner} required onChange={(e) => setOwner(e.target.value)}>
              <option value="">Scegli…</option>
              {detail.owners.map((o) => <option key={o.id} value={o.id}>{o.label}{o.internal ? " · verifica interna" : ""}</option>)}
            </select>
          </label>
          <label className="text-sm">Scadenza
            <input type="date" className={field} value={due} min={today()} required onChange={(e) => setDue(e.target.value)} />
          </label>
          <button type="submit" className={primary} disabled={busy || !owner || !due}>{FINDING_ACTION_LABELS.assign}</button>
          {detail.owners.every((o) => o.internal) && (
            <p className="text-xs text-muted-foreground sm:col-span-3">Nessun utente di questa Azienda ha ancora un’adesione approvata: per ora il caso può restare in verifica interna.</p>
          )}
        </form>
      )}

      {allowed.has("start") && (
        <div className="mt-5">
          <button type="button" className={primary} disabled={busy} onClick={() => void step("start", {}, "Caso preso in carico.")}>{FINDING_ACTION_LABELS.start}</button>
        </div>
      )}

      {allowed.has("record_decision") && (
        <form className="mt-5 grid gap-3 rounded-xl border border-border p-4"
          onSubmit={(e) => { e.preventDefault(); void step("record_decision", { decision, note }, "Decisione registrata."); }}>
          <label className="text-sm">Decisione
            <select className={field} value={decision} required onChange={(e) => setDecision(e.target.value as FindingDecision)}>
              <option value="">Scegli…</option>
              {FINDING_DECISIONS.map((d) => <option key={d} value={d}>{FINDING_DECISION_LABELS[d]}</option>)}
            </select>
          </label>
          <label className="text-sm">Motivazione
            <textarea className={`${field} min-h-24`} value={note} required maxLength={2400} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div><button type="submit" className={primary} disabled={busy || !decision || !note.trim()}>{FINDING_ACTION_LABELS.record_decision}</button></div>
        </form>
      )}

      {allowed.has("close") && (
        <form className="mt-5 grid gap-3 rounded-xl border border-border p-4"
          onSubmit={(e) => { e.preventDefault(); void step("close", { outcome }, "Caso chiuso con l’esito."); }}>
          <label className="text-sm">Esito
            <textarea className={`${field} min-h-24`} value={outcome} required maxLength={2400} onChange={(e) => setOutcome(e.target.value)} />
          </label>
          <div><button type="submit" className={primary} disabled={busy || !outcome.trim()}>{FINDING_ACTION_LABELS.close}</button></div>
        </form>
      )}

      {allowed.has("reopen") && (
        <form className="mt-5 grid gap-3 rounded-xl border border-border p-4"
          onSubmit={(e) => { e.preventDefault(); void step("reopen", { note: reason }, "Caso riaperto: serve una nuova decisione."); }}>
          <label className="text-sm">Motivo della riapertura
            <textarea className={`${field} min-h-20`} value={reason} required maxLength={2400} onChange={(e) => setReason(e.target.value)} />
          </label>
          <div><button type="submit" className={button} disabled={busy || !reason.trim()}>{FINDING_ACTION_LABELS.reopen}</button></div>
        </form>
      )}

      <details className="mt-5">
        <summary className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium"><History size={15} aria-hidden="true" />Storia del caso ({detail.events.length})</summary>
        <ol className="mt-3 space-y-3 border-l border-border pl-4 text-sm">
          {detail.events.map((e) => (
            <li key={e.revision}>
              <p className="font-medium">{EVENT_LABELS[e.action] ?? e.action} · {when(e.created_at)}</p>
              <p className="text-xs text-muted-foreground">da {name(e.actor_id)}</p>
              {eventLines(e, name).map((line, i) => <p key={i} className="text-xs">{line}</p>)}
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}

function eventLines(e: Event, name: (id: string | null) => string): string[] {
  const p = e.payload ?? {}, v = (k: string) => (typeof p[k] === "string" ? (p[k] as string).trim() : "");
  const lines: string[] = [];
  if (e.action === "assign") {
    if (v("owner_id")) lines.push(`Titolare: ${name(v("owner_id"))}`);
    if (v("due_date")) lines.push(`Scadenza: ${day(v("due_date"))}`);
  }
  if (v("decision")) lines.push(`Decisione: ${FINDING_DECISION_LABELS[v("decision") as FindingDecision] ?? v("decision")}`);
  if (v("note")) lines.push(`${e.action === "reopen" ? "Motivo" : "Motivazione"}: ${v("note")}`);
  if (v("outcome")) lines.push(`Esito: ${v("outcome")}`);
  return lines;
}
