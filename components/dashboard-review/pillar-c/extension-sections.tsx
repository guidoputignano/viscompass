"use client";

/** Pillar C extension blocks (points 15-16): January 2026 DPC of the four Aziende and File F 2025 of ASL 3.
 * Shared by the reviewer and the organisation-scoped workspaces. They read the units they are given, labelled by the
 * server for the audience, and import nothing reviewer-only (tests/pillar-c-scoped-client-graph.test.mjs). Tables with
 * inline bars, no chart library: every value is text, so nothing is conveyed by colour alone. */
import { itNumber } from "@/lib/format/it-number";
import { cMoneyLabel } from "@/lib/dashboard-review/pillar-c/review";
import { CReviewEmpty as Empty, CReviewExactTable as ExactTable, CReviewHeading as Heading, CReviewPanel as Panel } from "@/components/dashboard-review/pillar-c/review-blocks";
import { C_EXT_SOURCE, type CExtDist, type CExtensionView, type CExtUnitPacket } from "@/lib/dashboard-review/pillar-c/extension";

type Unit = CExtensionView["units"][number];
const pct = (v: number | null, digits = 1) => (v === null ? "—" : `${itNumber(v * 100, { minimumFractionDigits: digits, maximumFractionDigits: digits })}\u00a0%`);
const num = (v: number | null, digits = 0) => (v === null ? "—" : itNumber(v, { minimumFractionDigits: digits, maximumFractionDigits: digits }));
const eur = (v: number | null) => (v === null ? "—" : cMoneyLabel(v));
const eur0 = (v: number) => itNumber(v, { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const MONTHS = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
const th = "whitespace-nowrap border-b border-border px-2 py-3 text-right font-semibold first:text-left";
const thUnit = "border-b border-border px-2 py-3 text-right align-bottom font-semibold";
const td = "whitespace-nowrap border-b border-border/50 px-2 py-2.5 text-right tabular-nums";

/** Rows of values, one column per unit. */
function Matrix({ caption, units, rows }: { caption: string; units: Unit[]; rows: { label: string; values: string[] }[] }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[34rem] text-xs"><caption className="sr-only">{caption}</caption>
    <thead><tr><th scope="col" className={th}>Misura</th>{units.map((u) => <th key={u.key} scope="col" className={thUnit}>{u.label}</th>)}</tr></thead>
    <tbody>{rows.map((r) => <tr key={r.label}><th scope="row" className="border-b border-border/50 px-2 py-2.5 text-left font-medium">{r.label}</th>{r.values.map((v, i) => <td key={units[i].key} className={td}>{v}</td>)}</tr>)}</tbody></table></div>;
}

/** A distribution as shares, one column per unit, with a bar under each share scaled to the largest share shown. */
function DistMatrix({ caption, units, pick }: { caption: string; units: Unit[]; pick: (u: CExtUnitPacket) => CExtDist }) {
  const dists = units.map((u) => pick(u.data));
  const first = dists.find((d) => d.status === "released");
  if (!first) return <Empty>La distribuzione non è mostrata: almeno una classe conta meno di 5 persone. Nessun valore viene sostituito.</Empty>;
  const max = Math.max(0.0001, ...dists.flatMap((d) => d.cells.map((c) => c.share)));
  // A class with no person in any column is named under the table instead of drawn as a row of zeros.
  const empty = first.cells.filter((_, k) => dists.every((d) => d.status !== "released" || d.cells[k].count === 0)).map((c) => c.label);
  return <div className="overflow-x-auto"><table className="w-full min-w-[34rem] text-xs"><caption className="sr-only">{caption}</caption>
    <thead><tr><th scope="col" className={th}>Classe</th>{units.map((u) => <th key={u.key} scope="col" className={thUnit}>{u.label}</th>)}</tr></thead>
    <tbody>{first.cells.map((cell, k) => empty.includes(cell.label) ? null : <tr key={cell.id}><th scope="row" className="border-b border-border/50 px-2 py-2 text-left font-medium">{cell.label}</th>{dists.map((d, i) => {
      const c = d.status === "released" ? d.cells[k] : null;
      return <td key={units[i].key} className="border-b border-border/50 px-2 py-2 text-right tabular-nums"><span>{c ? pct(c.share) : "—"}</span>
        {c && <span aria-hidden="true" className="ml-auto mt-1 block h-1.5 w-20 rounded-full bg-secondary"><span className="block h-1.5 rounded-full bg-primary" style={{ width: `${(c.share / max) * 100}%` }} /></span>}</td>;
    })}</tr>)}</tbody></table>{empty.length > 0 && <p className="mt-2 text-xs text-muted-foreground">{`Nessun destinatario nelle classi: ${empty.join(", ")}.`}</p>}</div>;
}

const over65 = (d: CExtDist) => d.status === "released" ? d.cells.filter((c) => ["65-74", "75-84", "85+"].includes(c.id)).reduce((a, c) => a + c.count, 0) / (d.total || 1) : null;

/** Section 2, «Destinatari e utilizzo». */
export function PillarCRecipientsSection({ view }: { view: CExtensionView }) {
  const units = view.units, asl = units.filter((u) => u.key !== "aggregato"), hasAggregate = units.some((u) => u.key === "aggregato");
  const fileF = units.find((u) => u.data.fileF)?.data.fileF ?? null;
  return <div className="space-y-6">
    <Heading inner id="destinatari-dpc" title="Chi riceve i medicinali DPC e con quale utilizzo?">{`${C_EXT_SOURCE.january}. Un solo mese di riferimento: le confezioni e i contatti dipendono anche dalla cadenza di dispensazione.`}</Heading>
    <Panel title="Destinatari, età e costo per destinatario · gennaio 2026" description={hasAggregate ? "L’aggregato somma i destinatari delle quattro ASL: non è un conteggio di persone uniche regionali. Quartili e concentrazione sono calcolati per ASL e non si sommano." : "Destinatari ammissibili distinti entro l’ASL."}>
      <Matrix caption="Destinatari e costo per destinatario" units={units} rows={[
        { label: "Destinatari", values: units.map((u) => num(u.data.january.recipients)) },
        { label: "65 anni e oltre", values: units.map((u) => pct(over65(u.data.january.age))) },
        { label: "Donne (sul sesso noto)", values: units.map((u) => pct(u.data.january.sex.female)) },
        { label: "Costo per destinatario, mediana", values: units.map((u) => eur(u.data.january.cost.quartiles?.median ?? null)) },
        { label: "Costo per destinatario, 1° – 3° quartile", values: units.map((u) => u.data.january.cost.quartiles ? `${eur0(u.data.january.cost.quartiles.q1)} – ${eur0(u.data.january.cost.quartiles.q3)}` : "—") },
        { label: "Quota di costo del 10\u00a0% con costo maggiore", values: units.map((u) => pct(u.data.january.cost.top10)) },
        { label: "Indice di Gini", values: units.map((u) => num(u.data.january.cost.gini, 2)) },
      ]} />
      <p className="mt-4 text-xs leading-5 text-muted-foreground">Costo registrato nel flusso: acquisto più compenso di servizio. Età raggiunta nel 2026, ricavata dall’anno di nascita; fasce OsMed.</p>
    </Panel>
    <div className="grid gap-6 xl:grid-cols-2">
      <Panel title="Fasce d’età" description="Quota dei destinatari di ciascuna colonna."><DistMatrix caption="Destinatari per fascia d’età" units={units} pick={(u) => u.january.age} /></Panel>
      <Panel title="Classi di costo per destinatario" description="Quota dei destinatari per costo registrato nel mese."><DistMatrix caption="Destinatari per classe di costo" units={units} pick={(u) => u.january.cost.bins} /></Panel>
    </div>
    <div className="grid gap-6 xl:grid-cols-2">
      <Panel title="Confezioni per destinatario" description="Confezioni registrate nel mese, con segno; non dosi né giorni di terapia."><DistMatrix caption="Destinatari per numero di confezioni" units={units} pick={(u) => u.january.use.packs.bins} /></Panel>
      <Panel title="Sostanze e combinazioni ATC5 per destinatario" description="Codici ATC di quinto livello distinti nel mese: una combinazione può contenere più principi attivi, quindi non è un conteggio di ingredienti unici."><DistMatrix caption="Destinatari per numero di sostanze e combinazioni ATC5" units={units} pick={(u) => u.january.ingredients} /></Panel>
    </div>
    <Panel title="Servizio di distribuzione e tempi di erogazione" description="Compenso DPC su tutte le righe del flusso; intervallo fra prescrizione ed erogazione sui contatti ammissibili (date registrate, non tempi di attesa).">
      <Matrix caption="Servizio di distribuzione e tempi" units={units} rows={[
        { label: "Quota del servizio sul costo", values: units.map((u) => pct(u.data.january.services.serviceShare)) },
        { label: "Servizio per confezione", values: units.map((u) => eur(u.data.january.services.servicePerPack)) },
        { label: "Confezioni sotto 10\u00a0€ di acquisto", values: units.map((u) => pct(u.data.january.services.under10Packs)) },
        { label: "… quota del servizio sul loro costo", values: units.map((u) => pct(u.data.january.services.under10Service)) },
        { label: "Farmacie che erogano", values: units.map((u) => num(u.data.january.services.pharmacies)) },
        { label: "Giorni fra prescrizione ed erogazione, mediana", values: units.map((u) => num(u.data.january.services.intervalMedian)) },
        { label: "Erogato entro 7 giorni", values: units.map((u) => pct(u.data.january.services.within7)) },
      ]} />
      <p className="mt-4 text-xs leading-5 text-muted-foreground">{`${units.some((u) => (u.data.january.services.under10Service ?? 0) > 0.5) ? "Dove la quota del servizio supera la metà del costo, il compenso di distribuzione pesa più del medicinale: è un tema di scelta del canale, non una misura di inefficienza. " : ""}Nessuna farmacia è indicata.`}</p>
    </Panel>
    {fileF && <FileFRecipients fileF={fileF} unitLabel={units.find((u) => u.data.fileF)?.label ?? ""} januaryTop10={units.find((u) => u.data.fileF)?.data.january.cost.top10 ?? null} />}
    {asl.length === 0 && <Empty>Nessuna ASL in questa vista.</Empty>}
  </div>;
}

function FileFRecipients({ fileF, unitLabel, januaryTop10 }: { fileF: NonNullable<CExtUnitPacket["fileF"]>; unitLabel: string; januaryTop10: number | null }) {
  const c = fileF.concentration;
  return <Panel title={`File F 2025 · ${unitLabel}: identificativi, concentrazione e frequenza`} description={`${C_EXT_SOURCE.fileF}. Identificativi distinti nel flusso, non pazienti certificati; nessun confronto con le altre ASL.`}>
    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[["Identificativi distinti nell’anno", num(fileF.identifiers)], ["65 anni e oltre", pct(over65(fileF.age))], ["Importo per identificativo, mediana", eur0(c.median)], ["Quota del 10\u00a0% con importo maggiore", pct(c.top10)],
        ["Quota dell’1\u00a0% con importo maggiore", pct(c.top1)], ["Senza modalità 09: quota del 10\u00a0%", pct(c.top10WithoutMode09)], ["Contatti per identificativo, mediana", num(fileF.medianContacts)], ["Mesi attivi, mediana", num(fileF.medianMonths)]]
        .map(([k, v]) => <div key={k} className="rounded-xl border border-border p-3"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{v}</dd></div>)}
    </dl>
    <ExactTable caption="Contatti e mesi attivi per identificativo" headers={["Classe", "Contatti: quota", "Classe", "Mesi attivi: quota"]}
      rows={fileF.contacts.cells.map((cell, i) => [cell.label, pct(cell.share), fileF.monthsActive.cells[i]?.label ?? "", fileF.monthsActive.cells[i] ? pct(fileF.monthsActive.cells[i].share) : ""])} />
    <p className="mt-4 text-xs leading-5 text-muted-foreground">{`${januaryTop10 === null ? "" : `L’importo per identificativo è ${c.top10 > januaryTop10 ? "più" : "meno"} concentrato che nella DPC di gennaio della stessa ASL (quota del 10\u00a0% con importo maggiore: ${pct(c.top10)} contro ${pct(januaryTop10)}). `}Un solo anno di una sola Azienda.`}</p>
  </Panel>;
}

/** The third card of «Quadro decisionale»: recipients are now counted for January 2026 DPC, but one month shows no change over time. */
export function cExtensionRecipientsCard(view: CExtensionView | null): { title: string; value: string; detail: string } {
  const lead = view?.units[0];
  if (!lead) return { title: "Persone trattate osservate", value: "Non disponibili", detail: "Gli scenari CO stimano il denominatore; non misurano più persone trattate." };
  return { title: `Destinatari DPC · ${lead.label}`, value: num(lead.data.january.recipients),
    detail: `Gennaio 2026${lead.data.january.recipientsAreSum ? ", somma delle quattro ASL" : ""}: un solo mese, nessuna variazione nel tempo. La variazione della spesa resta non attribuibile a un aumento dei pazienti.` };
}

const SEGMENTS = [
  { key: "single", label: "Prodotti a un solo portafoglio candidato", className: "bg-primary" },
  { key: "narrowed", label: "Condivisi, candidati ristretti a uno da un’esenzione coerente", className: "bg-primary/55" },
  { key: "indicative", label: "Condivisi, esenzione oncologica o da trapianto (indicativa)", className: "bg-amber-500/80" },
  { key: "notInformative", label: "Condivisi, senza esenzione informativa", className: "bg-muted-foreground/35" },
] as const;

/** Section 3 addition: how far an exemption code narrows the candidate portfolios of January DPC spending (wording per Codex review, 22 Oct 2026). */
export function PillarCAttributionEvidence({ view }: { view: CExtensionView }) {
  const units = view.units, agreement = units.flatMap((u) => u.data.january.attribution.agreementLines ?? []);
  return <Panel title="Quanto si restringe il campo dei portafogli candidati? · gennaio 2026" description="Quota della spesa dei destinatari ammissibili. L’esenzione restringe i candidati soltanto se il farmaco rientra nelle classi correlate alla patologia secondo l’elenco della Regione Toscana, DGR 865/2018. È un riferimento esterno: non dimostra quale area abbia sostenuto il costo in questa ASL.">
    <div className="space-y-4">{units.map((u) => { const a = u.data.january.attribution; return <div key={u.key}>
      <p className="mb-1.5 flex flex-wrap justify-between gap-2 text-xs"><span className="font-medium">{u.label}</span><span className="text-muted-foreground">{`Senza prova informativa: ${pct(a.notInformative)}`}</span></p>
      <div className="flex h-4 overflow-hidden rounded-full bg-secondary" role="img" aria-label={`${u.label}: ${SEGMENTS.map((s) => `${s.label} ${pct(a[s.key])}`).join("; ")}`}>{SEGMENTS.map((s) => <span key={s.key} className={s.className} style={{ width: `${a[s.key] * 100}%` }} />)}</div>
    </div>; })}</div>
    <ul className="mt-4 grid gap-2 text-xs sm:grid-cols-2">{SEGMENTS.map((s) => <li key={s.key} className="flex items-center gap-2"><span aria-hidden="true" className={`inline-block h-3 w-3 rounded-sm ${s.className}`} />{s.label}</li>)}</ul>
    <ExactTable caption="Spesa per prova di attribuzione" headers={["Segmento", ...units.map((u) => u.label)]} rows={[
      ...SEGMENTS.map((s) => [s.label, ...units.map((u) => pct(u.data.january.attribution[s.key]))]),
      ["Accordo esenzione–portafoglio sui prodotti a candidato singolo", ...units.map((u) => pct(u.data.january.attribution.agreementLines))],
    ]} />
    {agreement.length > 0 && <p className="mt-4 text-xs leading-5 text-muted-foreground">{`Sui prodotti a un solo candidato l’esenzione coerente indica lo stesso portafoglio nel ${agreement.length > 1 && Math.min(...agreement) !== Math.max(...agreement) ? `${pct(Math.min(...agreement))} – ${pct(Math.max(...agreement))}` : pct(agreement[0])} delle righe. È un controllo di coerenza fra segnali, non una conferma indipendente dell’attribuzione clinica: i portafogli restano candidati farmacologici.`}</p>}
  </Panel>;
}

/** Section 4 addition: File F monthly reported amount, with dispensing mode 09 pooled and shown apart. */
export function PillarCFileFMonthly({ view }: { view: CExtensionView }) {
  const holder = view.units.find((u) => u.data.fileF), f = holder?.data.fileF, note = holder?.data.notes.fileFMode09 ?? "";
  if (!f) return null;
  const max = Math.max(1, ...f.months.map((m) => m.amount));
  const mean = f.months.reduce((a, m) => a + m.withoutMode09, 0) / f.months.length;
  const lowestWithout = f.months.reduce((low, m, i) => (m.withoutMode09 < f.months[low].withoutMode09 ? i : low), 0);
  const withMode09 = f.months.flatMap((m, i) => (m.mode09 ? [MONTHS[i]] : []));
  return <Panel title={`File F 2025 · ${holder?.label ?? ""}: importo mensile`} description={`${C_EXT_SOURCE.fileF}. In arancione le righe in modalità di erogazione 09 («Terapie CAR-T» nella specifica 2025)${withMode09.length ? `, presenti in: ${withMode09.join(", ")}` : ", assenti in questo anno"}.`}>
    <div role="img" aria-label={`Importo mensile: ${f.months.map((m, i) => `${MONTHS[i]} ${eur0(m.amount)}`).join("; ")}`}>
      <div className="flex h-44 items-end gap-1.5 border-b border-border">{f.months.map((m) => <div key={m.month} className="flex h-full min-w-0 flex-1 flex-col justify-end">
        <span className="block rounded-t bg-amber-500/80" style={{ height: `${(m.mode09 / max) * 100}%` }} />
        <span className={`block bg-primary ${m.mode09 ? "" : "rounded-t"}`} style={{ height: `${(m.withoutMode09 / max) * 100}%` }} />
      </div>)}</div>
      <div className="mt-1 flex gap-1.5">{f.months.map((m, i) => <span key={m.month} className="min-w-0 flex-1 text-center text-xs text-muted-foreground">{MONTHS[i]}</span>)}</div>
    </div>
    <ul className="mt-3 flex flex-wrap gap-4 text-xs"><li className="flex items-center gap-2"><span aria-hidden="true" className="inline-block h-3 w-3 rounded-sm bg-primary" />Altri medicinali</li><li className="flex items-center gap-2"><span aria-hidden="true" className="inline-block h-3 w-3 rounded-sm bg-amber-500/80" />Modalità 09</li></ul>
    <ExactTable caption="Importo mensile e identificativi" headers={["Mese", "Importo riportato", "Modalità 09", "Senza modalità 09", "Indice senza 09 (media = 100)", "Identificativi distinti"]}
      rows={f.months.map((m, i) => [MONTHS[i], eur0(m.amount), m.mode09 ? eur0(m.mode09) : "—", eur0(m.withoutMode09), num((m.withoutMode09 / mean) * 100, 1), num(f.identifiersByMonth[i]?.count ?? null)])} />
    <p className="mt-4 text-xs leading-5 text-muted-foreground">{`${lowestWithout === f.months.length - 1 && withMode09.includes(MONTHS[f.months.length - 1]) ? "Senza la modalità 09 l’ultimo mese è il più basso. " : ""}${note}`}</p>
    <ExactTable caption="Modalità di erogazione" headers={["Modalità", "Quota delle righe", "Quota dell’importo"]} rows={f.modes.map((m) => [m.label, pct(m.rowsShare), pct(m.amountShare)])} />
  </Panel>;
}
