"use client";

/** Pillar C extension blocks (points 15-16): January 2026 DPC of the four Aziende and File F 2025 of ASL 3.
 * Shared by the reviewer and the organisation-scoped workspaces. They read the units they are given, labelled by the
 * server for the audience, and import nothing reviewer-only (tests/pillar-c-scoped-client-graph.test.mjs). Tables with
 * inline bars, no chart library: every value is text, so nothing is conveyed by colour alone. */
import { useState, type ReactNode } from "react";
import { itNumber } from "@/lib/format/it-number";
import { CReviewEmpty as Empty, CReviewExactTable as ExactTable, CReviewHeading as Heading, CReviewPanel as Panel } from "@/components/dashboard-review/pillar-c/review-blocks";
import { C_EXT_SOURCE, type CExtDist, type CExtensionView, type CExtFileF } from "@/lib/dashboard-review/pillar-c/extension";
import { cFileFHolders, usePillarCPeriodCatalog } from "@/components/dashboard-review/pillar-c/period-context";
import { PillarCCostConcentration, PillarCCostPerRecipient, PillarCDispensingIntervals, PillarCDistributionExplorer, PillarCPharmacyFees, PillarCRecipientCoverage, PillarCRecipientSummary, PillarCServiceBurden, PillarCTypicalUse } from "@/components/dashboard-review/pillar-c/recipient-views";

type Unit = CExtensionView["units"][number];
const pct = (v: number | null, digits = 1) => (v === null ? "—" : `${itNumber(v * 100, { minimumFractionDigits: digits, maximumFractionDigits: digits })}\u00a0%`);
const num = (v: number | null, digits = 0) => (v === null ? "—" : itNumber(v, { minimumFractionDigits: digits, maximumFractionDigits: digits }));
const eur0 = (v: number) => itNumber(v, { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const signed0 = (v: number) => itNumber(v, { style: "currency", currency: "EUR", maximumFractionDigits: 0, signDisplay: "exceptZero" });
const eur2 = (v: number) => itNumber(v, { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MONTHS = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
const thUnit = "border-b border-border px-2 py-3 text-right align-bottom font-semibold";
const thLeft = "border-b border-border px-2 py-3 text-left align-bottom font-semibold";
const td = "whitespace-nowrap border-b border-border/50 px-2 py-2.5 text-right tabular-nums";
const SELECT = "mt-2 h-11 w-full min-w-0 rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";

const over65 = (d: CExtDist) => d.status === "released" ? d.cells.filter((c) => ["65-74", "75-84", "85+"].includes(c.id)).reduce((a, c) => a + c.count, 0) / (d.total || 1) : null;
/** «2025-03» → «Mar»: a month is labelled from its own key, never from its position (a month the source lacks is absent). */
const monthLabel = (month: string) => MONTHS[Number(month.slice(5, 7)) - 1] ?? month;

/** The DPC view's recipients (redesigned for Guido's feedback 1, moved to its own view for G2-01/G2-02): what is counted, the totals that add up
 * across the ASLs, then one view per question (distributions, cost per recipient, concentration, typical use, service
 * burden, pharmacy fees, recorded intervals), each with its exact values. `residence` (the additions' P8-03 panel, or
 * its honest state) sits right after the totals it describes. */
export function PillarCRecipientsSection({ view, residence }: { view: CExtensionView; residence?: ReactNode }) {
  const units = view.units, asl = units.filter((u) => u.key !== "aggregato");
  return <div className="space-y-6">
    <Heading inner id="destinatari-dpc" title="Chi sono gli assistiti DPC e con quale utilizzo?">{`${C_EXT_SOURCE.january}.`}</Heading>
    <PillarCRecipientCoverage units={units} />
    <PillarCRecipientSummary units={units} />
    {residence}
    <PillarCDistributionExplorer units={units} />
    <PillarCCostPerRecipient units={units} />
    <PillarCCostConcentration units={units} />
    <PillarCTypicalUse units={units} />
    <PillarCServiceBurden units={units} />
    <PillarCPharmacyFees units={units} />
    <PillarCDispensingIntervals units={units} />
    {asl.length === 0 && <Empty>Nessuna ASL in questa vista.</Empty>}
  </div>;
}

const MONTH_NAMES = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
/** «2025-03» → «marzo 2025», from the month's own key. */
const monthName = (month: string) => `${MONTH_NAMES[Number(month.slice(5, 7)) - 1] ?? month} ${month.slice(0, 4)}`;

/** File F (G1-11): the holders the period catalogue lists for this view, one chosen at a time, and the coverage stated.
 * Each panel keeps its own choice (controls stay local to their source). Without a catalogue nothing is chosen. */
function useFileFHolder(view: CExtensionView, initialHolder = "") {
  const catalog = usePillarCPeriodCatalog();
  const { holders, missing } = cFileFHolders(catalog, view);
  const [selected, setSelected] = useState(initialHolder);
  const holder = holders.find((h) => h.entry.id === selected) ?? holders[0] ?? null;
  const control = holders.length > 1
    ? <label className="min-w-48 text-xs font-medium text-muted-foreground">Azienda del File F<select aria-label="Azienda del File F" className={SELECT} value={holder?.entry.id} onChange={(e) => setSelected(e.target.value)}>{holders.map((h) => <option key={h.entry.id} value={h.entry.id}>{`${h.unit.label} · ${h.fileF.year}`}</option>)}</select></label>
    : null;
  const coverage = holders.length ? `File F disponibile per: ${holders.map((h) => `${h.unit.label} (${h.fileF.year})`).join(", ")}.${missing.length ? ` Non ricevuto per: ${missing.join(", ")}; per loro nessun valore viene stimato.` : ""}` : "";
  return { holder, control, coverage, missing, unavailable: !catalog && view.units.some((u) => u.data.fileF) };
}

/** The File F view (G2-01/G2-02), the chosen holder: the year (identifiers, concentration, frequency, profile) or one month, which
 * carries only what the catalogue lists for it (reported amount, identifiers of the month): no annual distribution is
 * shown as if it were the month's. */
export function PillarCFileFRecipients({ view, initial }: { view: CExtensionView; initial?: { holder?: string; period?: string } }) {
  const { holder, control, coverage, missing, unavailable } = useFileFHolder(view, initial?.holder);
  const [period, setPeriod] = useState(initial?.period ?? "year");
  if (!holder) {
    if (unavailable) return <Empty>I dati File F non sono disponibili in questo momento: il catalogo dei periodi non è stato letto. Nessun valore viene sostituito.</Empty>;
    // A view without any File F states it for its own ASLs (Codex live check A26-02): `missing` lists only the units this
    // view holds, so nothing is said about another Azienda's sources, and no empty analysis is drawn.
    return missing.length ? <p data-c-filef-coverage="not-received" className="rounded-xl bg-secondary/50 p-4 text-sm leading-6 text-muted-foreground">{`File F: non ricevuto per ${missing.join(", ")}. Nessun valore File F viene mostrato né stimato.`}</p> : null;
  }
  const fileF = holder.fileF, unitLabel = holder.unit.label, januaryTop10 = holder.unit.data.january.cost.top10;
  const month = holder.months.find((m) => m.id === period) ?? null;
  const controls = <div className="flex flex-wrap gap-4">{control}
    <label className="min-w-48 text-xs font-medium text-muted-foreground">Periodo<select aria-label="Periodo del File F" className={SELECT} value={month ? month.id : "year"} onChange={(e) => setPeriod(e.target.value)}>
      <option value="year">{`Anno ${fileF.year}`}</option>{holder.months.map((m) => <option key={m.id} value={m.id}>{monthName(m.windowFrom)}</option>)}</select></label></div>;
  const c = fileF.concentration;
  // Owner decision D3: the unknown ages are pooled into the oldest band, so its label says so and «65 anni e oltre» includes them.
  const pooled = fileF.ageUnknownPooled;
  if (month) {
    const row = fileF.months.find((r) => r.month === month.windowFrom), ids = fileF.identifiersByMonth.find((r) => r.month === month.windowFrom);
    const amount = month.capabilities.includes("reported-amount") ? row ?? null : null, people = month.capabilities.includes("identifier-count") ? ids ?? null : null;
    const tiles: [string, string][] = [
      ["Importo riportato nel mese", amount ? eur0(amount.amount) : "non disponibile"],
      ["Di cui modalità 09", amount ? eur0(amount.mode09) : "non disponibile"],
      ["Senza modalità 09", amount ? eur0(amount.withoutMode09) : "non disponibile"],
      ["Identificativi distinti nel mese", people ? num(people.count) : "non disponibile"],
    ];
    return <Panel title={`File F · ${unitLabel}: ${monthName(month.windowFrom)}`} description={`${C_EXT_SOURCE.fileF}. Mese di erogazione registrato.`} controls={controls}>
      <div key={month.id} data-c-filef-period={month.id}>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{tiles.map(([k, v]) => <div key={k} className="rounded-xl border border-border p-3"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{v}</dd></div>)}</dl>
        <p className="mt-4 text-xs leading-5 text-muted-foreground">Per un singolo mese sono disponibili solo l’importo riportato e gli identificativi distinti del mese. Età, importo per identificativo, contatti e mesi attivi sono calcolati sull’anno: per il mese non sono stati calcolati né controllati, quindi non vengono mostrati. Gli identificativi dei mesi non si sommano: chi compare in più mesi conta in ciascuno.</p>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">{coverage}</p>
      </div>
    </Panel>;
  }
  return <Panel title={`File F ${fileF.year} · ${unitLabel}: identificativi, concentrazione e frequenza`} description={`${C_EXT_SOURCE.fileF}. Identificativi distinti nel flusso, non pazienti certificati; nessun confronto con le altre ASL.`} controls={controls}>
    <div key={`${holder.entry.id}|year`} data-c-filef-period={holder.entry.id}>
    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[["Identificativi distinti nell’anno", num(fileF.identifiers)], [pooled ? "65 anni e oltre, incluse le età non note" : "65 anni e oltre", pct(over65(fileF.age))], ["Importo per identificativo, mediana", eur0(c.median)],
        ["Importo per identificativo, 1° – 3° quartile", `${eur0(c.q1)} – ${eur0(c.q3)}`], ["Quota del 10 % con importo maggiore", pct(c.top10)], ["Quota dell’1 % con importo maggiore", pct(c.top1)], ["Indice di Gini", num(c.gini, 2)],
        ["Senza modalità 09: quota del 10 %", pct(c.top10WithoutMode09)], ["Senza modalità 09: quota dell’1 %", pct(c.top1WithoutMode09)], ["Contatti per identificativo, mediana", num(fileF.medianContacts)], ["Mesi attivi, mediana", num(fileF.medianMonths)]]
        .map(([k, v]) => <div key={k} className="rounded-xl border border-border p-3"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{v}</dd></div>)}
    </dl>
    <ExactTable caption="Contatti e mesi attivi per identificativo" headers={["Classe", "Contatti: quota", "Classe", "Mesi attivi: quota"]}
      rows={fileF.contacts.cells.map((cell, i) => [cell.label, pct(cell.share), fileF.monthsActive.cells[i]?.label ?? "", fileF.monthsActive.cells[i] ? pct(fileF.monthsActive.cells[i].share) : ""])} />
    <ExactTable caption="Profilo anagrafico degli identificativi" headers={["Profilo", "Quota"]} rows={[
      ["Donne (%)", pct(fileF.sex.female)], ["Uomini (%)", pct(fileF.sex.male)],
      ...(fileF.age.status === "released" ? fileF.age.cells.map((cell) => [`Età ${cell.label}`, pct(cell.share)]) : [["Fasce d’età", "Non mostrate: almeno una classe conta meno di 5 identificativi"]]),
    ]} />
    <p className="mt-3 text-xs leading-5 text-muted-foreground">{`Età raggiunta nel ${fileF.year}, dall’anno di nascita registrato; le quote per sesso sono calcolate sugli identificativi con il sesso indicato nel flusso.`}</p>
    <p className="mt-4 text-xs leading-5 text-muted-foreground">{`${januaryTop10 === null ? "" : `L’importo per identificativo è ${c.top10 > januaryTop10 ? "più" : "meno"} concentrato che nella DPC di gennaio della stessa ASL (quota del 10 % con importo maggiore: ${pct(c.top10)} contro ${pct(januaryTop10)}). `}${coverage}`}</p>
    </div>
  </Panel>;
}

/** The third card of «Quadro decisionale»: recipients are now counted for January 2026 DPC, but one month shows no change over time.
 * It follows the «Ambito» the page already shows (`selected`, an extension unit key the caller resolved from its own
 * authorised scope), like the two cards beside it (Codex live check A26-01, 26 Oct 2026). A key the view does not
 * hold has no count: never another organisation's, never the first unit's. */
export function cExtensionRecipientsCard(view: CExtensionView | null, unavailable: boolean, selected: string, channel: string = "DPC"): { title: string; value: string; detail: string } {
  // A page without the flows (neither read nor failed) has no source that counts people, whatever the channel.
  if (!view && !unavailable) return { title: "Persone trattate osservate", value: "Non disponibili", detail: "Gli scenari CO stimano il denominatore; non misurano più persone trattate." };
  // Only the DPC flows count people (joint feedback 2, G2-01/G2-02): under any other channel the card says so and points
  // to the DPC view, never showing a DPC count as if it were filtered to that channel.
  if (channel !== "DPC") return channel === "Tutti"
    ? { title: "Assistiti", value: "Solo per la DPC", detail: "Il registro della spesa non conta le persone. Gli assistiti sono contati solo nei flussi DPC riferiti a gennaio 2026: vista «Assistiti e servizio DPC»." }
    : { title: `Assistiti · ${channel}`, value: "Non disponibili", detail: `Per il canale ${channel} non ci sono dati sugli assistiti. Gli assistiti sono contati solo nei flussi DPC riferiti a gennaio 2026: vista «Assistiti e servizio DPC».` };
  if (!view) return { title: "Assistiti con erogazioni DPC", value: "Non disponibili in questo momento", detail: "La lettura dei dati DPC non è riuscita: nessun valore viene sostituito." };
  const unit = view.units.find((u) => u.key === selected);
  if (!unit) return { title: "Assistiti con erogazioni DPC", value: "Non disponibili", detail: "Nessun conteggio di gennaio 2026 per l’ambito selezionato: nessun valore viene sostituito." };
  return { title: `Assistiti con erogazioni DPC · ${unit.label}`, value: num(unit.data.january.recipients),
    detail: `Flussi riferiti a gennaio 2026${unit.data.january.recipientsAreSum ? ", somma dei conteggi delle ASL" : ""}: un solo mese, nessuna variazione nel tempo. La variazione della spesa resta non attribuibile a un aumento dei pazienti.` };
}

const SEGMENTS = [
  { key: "single", label: "Prodotti a un solo portafoglio candidato", className: "bg-primary" },
  { key: "narrowed", label: "Condivisi, candidati ristretti a uno da un’esenzione coerente", className: "bg-primary/55" },
  { key: "indicative", label: "Condivisi, esenzione oncologica o da trapianto (indicativa)", className: "bg-amber-500/80" },
  { key: "notInformative", label: "Condivisi, senza esenzione informativa", className: "bg-muted-foreground/35" },
] as const;

/** The DPC view's attribution evidence: how far an exemption code narrows the candidate portfolios of January DPC
 * spending (wording per Codex review, 22 Oct 2026), `narrowing` (P10-04, the narrowed spend by area) right after it, then
 * the recipients by product status and portfolio group. File F's own evidence is in the File F view (G2-01/G2-02). */
export function PillarCDpcAttributionEvidence({ view, narrowing }: { view: CExtensionView; narrowing?: ReactNode }) {
  return <div className="space-y-6"><AttributionNarrowing view={view} />{narrowing}<CandidateReach view={view} /></div>;
}

/** The File F view's portfolio evidence: the chosen holder's amount by product status and portfolio reach, with
 * `fileF` (P10-05, the File F attribution fields) right after it. */
export function PillarCFileFPortfolios({ view, fileF }: { view: CExtensionView; fileF?: ReactNode }) {
  return <div className="space-y-6"><FileFPortfolios view={view} />{fileF}</div>;
}

/** Recipients by the status of the products they received, and by single-candidate portfolio (R20-04). Overlapping:
 * a person can receive products of several statuses or portfolios, so the shares do not add up to 100. */
function CandidateReach({ view }: { view: CExtensionView }) {
  const units = view.units, lead = units[0]?.data.january;
  if (!lead) return null;
  const cell = (u: Unit, key: "portfolioStatus" | "singleCandidateReach", id: string) => {
    const c = u.data.january[key].find((x) => x.id === id);
    return c ? `${num(c.count)} (${pct(c.share)})` : "—";
  };
  const aggregate = units.some((u) => u.key === "aggregato");
  return <Panel title="Assistiti per stato del prodotto e gruppo di portafogli candidati · gennaio 2026" description={`Assistiti che hanno ricevuto almeno un prodotto di ciascuno stato o di ciascun gruppo. Le quote si sovrappongono e non ripartiscono la spesa.${aggregate ? " Il totale somma i conteggi delle singole ASL: un assistito presente nei dati di due ASL può essere contato due volte." : ""}`}>
    <ExactTable caption="Assistiti per stato del prodotto" headers={["Stato del prodotto", ...units.map((u) => u.label)]} rows={lead.portfolioStatus.map((s) => [s.label, ...units.map((u) => cell(u, "portfolioStatus", s.id))])} />
    <ExactTable caption="Assistiti per gruppo di portafogli candidati" headers={["Gruppo di portafogli (prodotti a candidato singolo)", ...units.map((u) => u.label)]} rows={lead.singleCandidateReach.map((g) => [g.label, ...units.map((u) => cell(u, "singleCandidateReach", g.id))])} />
    <p className="mt-3 text-xs leading-5 text-muted-foreground">Ogni gruppo riunisce più portafogli candidati, raggruppamenti farmacologici: non è confrontabile con un singolo portafoglio e non indica la diagnosi, l’indicazione effettiva né l’area che sostiene il costo.</p>
  </Panel>;
}

/** File F of the chosen holder: reported amount by product status and reach of the single-candidate portfolios (R20-04). */
function FileFPortfolios({ view }: { view: CExtensionView }) {
  const { holder, control, coverage } = useFileFHolder(view);
  if (!holder) return null;
  const f = holder.fileF;
  return <Panel title={`File F ${f.year} · ${holder.unit.label}: portafogli candidati`} description={`${C_EXT_SOURCE.fileF}. Composizione dell’importo riportato secondo il prodotto: non è un consuntivo per area clinica né una ripartizione fra reparti. ${coverage}`} controls={control ?? undefined}>
    <ExactTable caption="Importo riportato per stato del prodotto" headers={["Stato del prodotto", "Quota dell’importo"]} rows={[
      ["Un solo portafoglio candidato", pct(f.portfolioShares.single)], ["Più portafogli candidati", pct(f.portfolioShares.shared)], ["Non mappati o evidenza insufficiente", pct(f.portfolioShares.unmapped)],
    ]} />
    <ExactTable caption="Identificativi raggiunti per gruppo di portafogli candidati" headers={["Gruppo di portafogli (prodotti a candidato singolo)", "Quota degli identificativi"]} rows={f.singleCandidateReach.map((g) => [g.label, pct(g.share)])} />
    <p className="mt-3 text-xs leading-5 text-muted-foreground">Ogni gruppo riunisce più portafogli candidati. Le quote di identificativi si sovrappongono e non indicano diagnosi, indicazioni effettive o titolarità del budget.</p>
  </Panel>;
}

function AttributionNarrowing({ view }: { view: CExtensionView }) {
  const units = view.units, agreement = units.flatMap((u) => u.data.january.attribution.agreementLines ?? []);
  return <Panel title="Quanto si restringe il campo dei portafogli candidati? · gennaio 2026" description="Quota della spesa DPC degli assistiti contati. L’esenzione restringe i candidati soltanto se il farmaco rientra nelle classi correlate alla patologia secondo l’elenco della Regione Toscana, DGR 865/2018. È un riferimento esterno: non dimostra quale area abbia sostenuto il costo in questa ASL.">
    <div className="space-y-4">{units.map((u) => { const a = u.data.january.attribution; return <div key={u.key}>
      <p className="mb-1.5 flex flex-wrap justify-between gap-2 text-xs"><span className="font-medium">{u.label}</span><span className="text-muted-foreground">{`Senza prova informativa: ${pct(a.notInformative)}`}</span></p>
      <div className="flex h-4 overflow-hidden rounded-full bg-secondary" role="img" aria-label={`${u.label}: ${SEGMENTS.map((s) => `${s.label} ${pct(a[s.key])}`).join("; ")}`}>{SEGMENTS.map((s) => <span key={s.key} className={s.className} style={{ width: `${a[s.key] * 100}%` }} />)}</div>
    </div>; })}</div>
    <ul className="mt-4 grid gap-2 text-xs sm:grid-cols-2">{SEGMENTS.map((s) => <li key={s.key} className="flex items-center gap-2"><span aria-hidden="true" className={`inline-block h-3 w-3 rounded-sm ${s.className}`} />{s.label}</li>)}</ul>
    <ExactTable caption="Spesa per prova di attribuzione" headers={["Segmento", ...units.map((u) => u.label)]} rows={[
      ...SEGMENTS.map((s) => [s.label, ...units.map((u) => pct(u.data.january.attribution[s.key]))]),
      ["Accordo esenzione–portafoglio sui prodotti a candidato singolo", ...units.map((u) => pct(u.data.january.attribution.agreementLines))],
    ]} />
    {units.some((u) => u.data.january.attribution.sharedRecipientsNarrowed !== null) && <ExactTable caption="Assistiti con prodotti condivisi" headers={["Quota degli assistiti con prodotti condivisi", ...units.map((u) => u.label)]} rows={[
      ["Con almeno una riga ristretta a un candidato da un’esenzione coerente", ...units.map((u) => pct(u.data.january.attribution.sharedRecipientsNarrowed))],
    ]} />}
    {agreement.length > 0 && <p className="mt-4 text-xs leading-5 text-muted-foreground">{`Sui prodotti a un solo candidato l’esenzione coerente indica lo stesso portafoglio nel ${agreement.length > 1 && Math.min(...agreement) !== Math.max(...agreement) ? `${pct(Math.min(...agreement))} – ${pct(Math.max(...agreement))}` : pct(agreement[0])} delle righe. È un controllo di coerenza fra segnali, non una conferma indipendente dell’attribuzione clinica: i portafogli restano candidati farmacologici.`}</p>}
  </Panel>;
}

/** Section 4 addition: File F monthly reported amount, with dispensing mode 09 pooled and shown apart. */
export function PillarCFileFMonthly({ view }: { view: CExtensionView }) {
  const { holder, control, coverage } = useFileFHolder(view);
  if (!holder) return null;
  const f = holder.fileF, note = holder.unit.data.notes.fileFMode09 ?? "";
  const max = Math.max(1, ...f.months.map((m) => m.amount));
  const mean = f.months.reduce((a, m) => a + m.withoutMode09, 0) / f.months.length;
  const lowestWithout = f.months.reduce((low, m, i) => (m.withoutMode09 < f.months[low].withoutMode09 ? i : low), 0);
  const withMode09 = f.months.flatMap((m) => (m.mode09 ? [monthLabel(m.month)] : []));
  const identifiers = new Map(f.identifiersByMonth.map((m) => [m.month, m.count]));
  return <><Panel title={`File F ${f.year} · ${holder.unit.label}: importo mensile`} description={`${C_EXT_SOURCE.fileF}. In arancione le righe in modalità di erogazione 09 («Terapie CAR-T» nella specifica 2025)${withMode09.length ? `, presenti in: ${withMode09.join(", ")}` : ", assenti in questo anno"}. ${coverage}`} controls={control ?? undefined}>
    <div role="img" aria-label={`Importo mensile: ${f.months.map((m) => `${monthLabel(m.month)} ${eur0(m.amount)}`).join("; ")}`}>
      <div className="flex h-44 items-end gap-1.5 border-b border-border">{f.months.map((m) => <div key={m.month} className="flex h-full min-w-0 flex-1 flex-col justify-end">
        <span className="block rounded-t bg-amber-500/80" style={{ height: `${(m.mode09 / max) * 100}%` }} />
        <span className={`block bg-primary ${m.mode09 ? "" : "rounded-t"}`} style={{ height: `${(m.withoutMode09 / max) * 100}%` }} />
      </div>)}</div>
      <div className="mt-1 flex gap-1.5">{f.months.map((m) => <span key={m.month} className="min-w-0 flex-1 text-center text-xs text-muted-foreground">{monthLabel(m.month)}</span>)}</div>
    </div>
    <ul className="mt-3 flex flex-wrap gap-4 text-xs"><li className="flex items-center gap-2"><span aria-hidden="true" className="inline-block h-3 w-3 rounded-sm bg-primary" />Altri medicinali</li><li className="flex items-center gap-2"><span aria-hidden="true" className="inline-block h-3 w-3 rounded-sm bg-amber-500/80" />Modalità 09</li></ul>
    <ExactTable caption="Importo mensile e identificativi" headers={["Mese", "Importo riportato", "Modalità 09", "Senza modalità 09", "Indice senza 09 (media = 100)", "Identificativi distinti"]}
      rows={f.months.map((m) => [monthLabel(m.month), eur0(m.amount), eur0(m.mode09), eur0(m.withoutMode09), mean > 0 ? num((m.withoutMode09 / mean) * 100, 1) : "non calcolabile", identifiers.has(m.month) ? num(identifiers.get(m.month)!) : "non disponibile"])} />
    <p className="mt-4 text-xs leading-5 text-muted-foreground">{`${f.months.length < 12 ? `Mesi presenti nel flusso: ${f.months.length} su 12; un mese assente non vale zero. ` : ""}${lowestWithout === f.months.length - 1 && withMode09.includes(monthLabel(f.months[f.months.length - 1].month)) ? "Senza la modalità 09 l’ultimo mese è il più basso. " : ""}${note}`}</p>
    {!(mean > 0) && <p className="mt-2 text-xs leading-5 text-muted-foreground" data-c-index-base="none">L’indice senza modalità 09 non è calcolabile: la media mensile di riferimento è pari a zero o negativa. Gli importi restano quelli riportati.</p>}
    <ExactTable caption="Modalità di erogazione" headers={["Modalità", "Quota delle righe", "Quota dell’importo"]} rows={f.modes.map((m) => [m.label, pct(m.rowsShare), pct(m.amountShare)])} />
    <p className="mt-4 text-xs leading-5 text-muted-foreground" data-c-forecast-readiness="filef">Previsione mensile: non disponibile. Per questa serie non esiste un metodo di previsione registrato e controllato con prove retrospettive; un solo anno non basta. La previsione regionale della sezione 5 usa un’altra fonte (AIFA) e non riguarda questa Azienda.</p>
  </Panel>{f.bridges.length > 0 && <FileFBridges f={f} label={holder.unit.label} />}</>;
}

/** Section 4 addition (owner decision D1, 23 Oct 2026): each month-to-month change of the File F reported amount in four
 * product components. Contributions to an accounting change, not price or volume effects; a product entering or leaving
 * is absent from one of the two months of the file, not a new or departed patient. */
function FileFBridges({ f, label }: { f: CExtFileF; label: string }) {
  const cols = ["Mesi", "Variazione", "Prodotti presenti nei due mesi: aumenti", "Prodotti presenti nei due mesi: cali", "Prodotti in entrata", "Prodotti in uscita", "Di cui modalità 09", "Senza modalità 09", "Prodotti con variazione", "Quota dei 10 prodotti con variazione maggiore"];
  const concentrated = f.bridges.filter((b) => b.top10Share >= 0.5).map((b) => `${monthLabel(b.from)} → ${monthLabel(b.to)}`);
  return <Panel title={`File F ${f.year} · ${label}: variazione da un mese all’altro`} description={`${C_EXT_SOURCE.fileF}. Ogni variazione è la somma di quattro componenti di prodotto: prodotti presenti nei due mesi che aumentano o calano, prodotti osservati solo nel mese successivo (entrata) o solo nel precedente (uscita).`}>
    <div className="overflow-x-auto"><table className="w-full min-w-[60rem] text-xs"><caption className="sr-only">Variazione mensile dell’importo riportato per componente</caption>
      <thead><tr>{cols.map((c) => <th key={c} scope="col" className={`${thUnit} first:text-left`}>{c}</th>)}</tr></thead>
      <tbody>{f.bridges.map((b) => <tr key={b.from}><th scope="row" className="whitespace-nowrap border-b border-border/50 px-2 py-2.5 text-left font-medium">{`${monthLabel(b.from)} → ${monthLabel(b.to)}`}</th>
        {[signed0(b.change), signed0(b.continuingIncrease), signed0(b.continuingDecrease), signed0(b.entries), signed0(b.exits), signed0(b.mode09Change), signed0(b.withoutMode09), num(b.products), pct(b.top10Share)]
          .map((v, i) => <td key={cols[i + 1]} className={td}>{v}</td>)}</tr>)}</tbody></table></div>
    <p className="mt-4 text-xs leading-5 text-muted-foreground">{`Contributi a una variazione contabile, non effetti di prezzo o di volume. Un prodotto in entrata o in uscita manca in uno dei due mesi del flusso: non indica un nuovo paziente né una terapia sospesa. Le righe in modalità 09 sono contate a parte per prodotto.${concentrated.length ? ` Dove i 10 prodotti con variazione maggiore portano metà o più della variazione lorda (${concentrated.join(", ")}), la variazione dipende da pochi prodotti.` : ""}`}</p>
  </Panel>;
}

/** Section 4 addition (owner decision D2, 23 Oct 2026): an Azienda's own acquisition and service component per recorded
 * pack, January 2026 DPC, on the products present in all four ASLs. One unit at a time and no other ASL's value beside
 * it. An Azienda receives only its own list (O1); the reviewer and, under regional analytical parity, the Regione receive
 * each ASL's and choose one with the selector. */
export function PillarCUnitCosts({ view }: { view: CExtensionView }) {
  const holders = view.units.filter((u) => u.data.unitCosts);
  const [selected, setSelected] = useState<string>("");
  const [query, setQuery] = useState("");
  const holder = holders.find((u) => u.key === selected) ?? holders[0];
  if (!holder?.data.unitCosts) return null;
  const all = holder.data.unitCosts.products, q = query.trim().toLowerCase();
  const rows = q ? all.filter((r) => `${r.name} ${r.pack} ${r.atc} ${r.aic}`.toLowerCase().includes(q)) : all;
  return <Panel title={`Costo per confezione sugli stessi prodotti · ${holder.label} · gennaio 2026`} description={`Flussi NSIS DPC, gennaio 2026. Componenti riportate per confezione registrata sui ${num(all.length)} prodotti presenti in tutte e quattro le ASL e ricevuti da almeno 5 assistiti in ciascuna, arrotondate al centesimo. Non sono prezzi negoziati né una misura di efficienza d’acquisto.`}
    controls={holders.length > 1 ? <label className="min-w-40 text-xs font-medium text-muted-foreground">Azienda<select aria-label="Azienda dei costi per confezione" className={SELECT} value={holder.key} onChange={(e) => setSelected(e.target.value)}>{holders.map((u) => <option key={u.key} value={u.key}>{u.label}</option>)}</select></label> : undefined}>
    <label className="mb-3 block max-w-md text-xs font-medium text-muted-foreground">Cerca per nome, ATC o AIC<input type="search" value={query} onChange={(e) => setQuery(e.target.value)} className={SELECT} /></label>
    <p role="status" className="mb-2 text-xs text-muted-foreground">{q ? `${num(rows.length)} prodotti su ${num(all.length)}` : `${num(all.length)} prodotti`}</p>
    <div className="max-h-[32rem] overflow-auto rounded-xl border border-border"><table className="w-full min-w-[46rem] text-xs"><caption className="sr-only">{`Costo per confezione, ${holder.label}`}</caption>
      <thead className="sticky top-0 bg-card"><tr>{["Prodotto", "Confezione", "ATC", "AIC", "Acquisto", "Servizio", "Totale"].map((c, i) => <th key={c} scope="col" className={i < 4 ? thLeft : thUnit}>{c}</th>)}</tr></thead>
      <tbody>{rows.map((r) => <tr key={r.aic}><th scope="row" className="border-b border-border/50 px-2 py-2 text-left font-medium">{r.name}</th>
        <td className="min-w-64 border-b border-border/50 px-2 py-2 text-left text-muted-foreground">{r.pack}</td><td className="border-b border-border/50 px-2 py-2 text-left">{r.atc}</td><td className="border-b border-border/50 px-2 py-2 text-left tabular-nums">{r.aic}</td>
        <td className={td}>{eur2(r.acquisition)}</td><td className={td}>{eur2(r.service)}</td><td className={td}>{eur2(r.combined)}</td></tr>)}</tbody></table></div>
    <p className="mt-4 text-xs leading-5 text-muted-foreground">Acquisto e compenso di servizio della distribuzione per conto divisi per le confezioni registrate nel mese. Lo stesso prodotto può avere rettifiche o tempi di registrazione diversi; nessun valore di altre Aziende è mostrato.</p>
  </Panel>;
}
