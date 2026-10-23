"use client";

/** Pillar C extension blocks (points 15-16): January 2026 DPC of the four Aziende and File F 2025 of ASL 3.
 * Shared by the reviewer and the organisation-scoped workspaces. They read the units they are given, labelled by the
 * server for the audience, and import nothing reviewer-only (tests/pillar-c-scoped-client-graph.test.mjs). Tables with
 * inline bars, no chart library: every value is text, so nothing is conveyed by colour alone. */
import { useState } from "react";
import { itNumber } from "@/lib/format/it-number";
import { cMoneyLabel } from "@/lib/dashboard-review/pillar-c/review";
import { CReviewEmpty as Empty, CReviewExactTable as ExactTable, CReviewHeading as Heading, CReviewPanel as Panel } from "@/components/dashboard-review/pillar-c/review-blocks";
import { C_EXT_SOURCE, type CExtDist, type CExtensionView, type CExtUnitPacket } from "@/lib/dashboard-review/pillar-c/extension";

type Unit = CExtensionView["units"][number];
const pct = (v: number | null, digits = 1) => (v === null ? "—" : `${itNumber(v * 100, { minimumFractionDigits: digits, maximumFractionDigits: digits })}\u00a0%`);
const num = (v: number | null, digits = 0) => (v === null ? "—" : itNumber(v, { minimumFractionDigits: digits, maximumFractionDigits: digits }));
const eur = (v: number | null) => (v === null ? "—" : cMoneyLabel(v));
const eur0 = (v: number) => itNumber(v, { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const signed0 = (v: number) => itNumber(v, { style: "currency", currency: "EUR", maximumFractionDigits: 0, signDisplay: "exceptZero" });
const eur2 = (v: number) => itNumber(v, { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MONTHS = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
const th = "whitespace-nowrap border-b border-border px-2 py-3 text-right font-semibold first:text-left";
const thUnit = "border-b border-border px-2 py-3 text-right align-bottom font-semibold";
const td = "whitespace-nowrap border-b border-border/50 px-2 py-2.5 text-right tabular-nums";
const SELECT = "mt-2 h-11 w-full min-w-0 rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";

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
const range = (q1: number | null, q3: number | null, digits = 0) => (q1 === null || q3 === null ? "—" : `${num(q1, digits)} – ${num(q3, digits)}`);
/** «2025-03» → «Mar»: a month is labelled from its own key, never from its position (a month the source lacks is absent). */
const monthLabel = (month: string) => MONTHS[Number(month.slice(5, 7)) - 1] ?? month;
const USE = [["packs", "Confezioni"], ["prescriptions", "Prescrizioni registrate"], ["distinctAICs", "Prodotti AIC distinti"]] as const;

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
        { label: "Quota di costo del 20\u00a0% con costo maggiore", values: units.map((u) => pct(u.data.january.cost.top20)) },
        { label: "Indice di Gini", values: units.map((u) => num(u.data.january.cost.gini, 2)) },
      ]} />
      <p className="mt-4 text-xs leading-5 text-muted-foreground">Costo registrato nel flusso: acquisto più compenso di servizio. Età raggiunta nel 2026, ricavata dall’anno di nascita; fasce OsMed.</p>
    </Panel>
    <div className="grid gap-6 xl:grid-cols-2">
      <Panel title="Fasce d’età" description="Quota dei destinatari di ciascuna colonna."><DistMatrix caption="Destinatari per fascia d’età" units={units} pick={(u) => u.january.age} /></Panel>
      <Panel title="Classi di costo per destinatario" description="Quota dei destinatari per costo registrato nel mese."><DistMatrix caption="Destinatari per classe di costo" units={units} pick={(u) => u.january.cost.bins} /></Panel>
    </div>
    <CostConcentration units={units} hasAggregate={hasAggregate} />
    <div className="grid gap-6 xl:grid-cols-2">
      <Panel title="Confezioni per destinatario" description="Confezioni registrate nel mese, con segno; non dosi né giorni di terapia."><DistMatrix caption="Destinatari per numero di confezioni" units={units} pick={(u) => u.january.use.packs.bins} /></Panel>
      <Panel title="Sostanze e combinazioni ATC5 per destinatario" description="Codici ATC di quinto livello distinti nel mese: una combinazione può contenere più principi attivi, quindi non è un conteggio di ingredienti unici."><DistMatrix caption="Destinatari per numero di sostanze e combinazioni ATC5" units={units} pick={(u) => u.january.ingredients} /></Panel>
    </div>
    <div className="grid gap-6 xl:grid-cols-2">
      <Panel title="Prescrizioni registrate per destinatario" description="Contatti di prescrizione distinti nel flusso del mese: non visite né nuove terapie."><DistMatrix caption="Destinatari per numero di prescrizioni registrate" units={units} pick={(u) => u.january.use.prescriptions.bins} /></Panel>
      <Panel title="Prodotti AIC distinti per destinatario" description="Confezioni commerciali distinte per codice AIC: più AIC possono contenere la stessa sostanza."><DistMatrix caption="Destinatari per numero di prodotti AIC distinti" units={units} pick={(u) => u.january.use.distinctAICs.bins} /></Panel>
    </div>
    <Panel title="Utilizzo tipico e dispersione" description={`Mediana e intervallo fra primo e terzo quartile per destinatario.${hasAggregate ? " Per l’aggregato non si calcolano: i quartili delle singole ASL non si sommano." : ""}`}>
      <Matrix caption="Mediane e quartili di utilizzo per destinatario" units={units} rows={USE.flatMap(([key, label]) => [
        { label: `${label}, mediana`, values: units.map((u) => num(u.data.january.use[key].quartiles?.median ?? null, 1)) },
        { label: `${label}, 1° – 3° quartile`, values: units.map((u) => range(u.data.january.use[key].quartiles?.q1 ?? null, u.data.january.use[key].quartiles?.q3 ?? null, 1)) },
      ])} />
    </Panel>
    <Panel title="Servizio di distribuzione e tempi di erogazione" description="Compenso DPC su tutte le righe del flusso; intervallo fra prescrizione ed erogazione sui contatti ammissibili (date registrate, non tempi di attesa).">
      <Matrix caption="Servizio di distribuzione e tempi" units={units} rows={[
        { label: "Quota del servizio sul costo", values: units.map((u) => pct(u.data.january.services.serviceShare)) },
        { label: "Servizio per confezione", values: units.map((u) => eur(u.data.january.services.servicePerPack)) },
        { label: "Confezioni sotto 10\u00a0€ di acquisto", values: units.map((u) => pct(u.data.january.services.under10Packs)) },
        { label: "… quota del servizio sul loro costo", values: units.map((u) => pct(u.data.january.services.under10Service)) },
        { label: "Farmacie che erogano", values: units.map((u) => num(u.data.january.services.pharmacies)) },
        { label: "Quota di costo del 10 % di farmacie con costo maggiore", values: units.map((u) => pct(u.data.january.services.pharmacyTop10)) },
        { label: "Servizio per confezione fra le farmacie, mediana", values: units.map((u) => eur(u.data.january.services.pharmacyFeeMedian)) },
        { label: "Servizio per confezione fra le farmacie, 1° – 3° quartile", values: units.map((u) => { const s = u.data.january.services; return s.pharmacyFeeQ1 === null || s.pharmacyFeeQ3 === null ? "—" : `${eur2(s.pharmacyFeeQ1)} – ${eur2(s.pharmacyFeeQ3)}`; }) },
        { label: "Giorni fra prescrizione ed erogazione, mediana", values: units.map((u) => num(u.data.january.services.intervalMedian)) },
        { label: "Giorni fra prescrizione ed erogazione, 1° – 3° quartile", values: units.map((u) => range(u.data.january.services.intervalQ1, u.data.january.services.intervalQ3)) },
        { label: "Prescrizione ed erogazione nello stesso giorno", values: units.map((u) => pct(u.data.january.services.sameDay)) },
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
  // Owner decision D3: the unknown ages are pooled into the oldest band, so its label says so and «65 anni e oltre» includes them.
  const pooled = fileF.age.status === "released" && fileF.age.cells.some((cell) => cell.id === "85+" && cell.label !== "85+");
  return <Panel title={`File F 2025 · ${unitLabel}: identificativi, concentrazione e frequenza`} description={`${C_EXT_SOURCE.fileF}. Identificativi distinti nel flusso, non pazienti certificati; nessun confronto con le altre ASL.`}>
    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[["Identificativi distinti nell’anno", num(fileF.identifiers)], [pooled ? "65 anni e oltre, incluse le età non note" : "65 anni e oltre", pct(over65(fileF.age))], ["Importo per identificativo, mediana", eur0(c.median)],
        ["Importo per identificativo, 1° – 3° quartile", `${eur0(c.q1)} – ${eur0(c.q3)}`], ["Quota del 10\u00a0% con importo maggiore", pct(c.top10)], ["Quota dell’1\u00a0% con importo maggiore", pct(c.top1)], ["Indice di Gini", num(c.gini, 2)],
        ["Senza modalità 09: quota del 10\u00a0%", pct(c.top10WithoutMode09)], ["Senza modalità 09: quota dell’1\u00a0%", pct(c.top1WithoutMode09)], ["Contatti per identificativo, mediana", num(fileF.medianContacts)], ["Mesi attivi, mediana", num(fileF.medianMonths)]]
        .map(([k, v]) => <div key={k} className="rounded-xl border border-border p-3"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{v}</dd></div>)}
    </dl>
    <ExactTable caption="Contatti e mesi attivi per identificativo" headers={["Classe", "Contatti: quota", "Classe", "Mesi attivi: quota"]}
      rows={fileF.contacts.cells.map((cell, i) => [cell.label, pct(cell.share), fileF.monthsActive.cells[i]?.label ?? "", fileF.monthsActive.cells[i] ? pct(fileF.monthsActive.cells[i].share) : ""])} />
    <ExactTable caption="Profilo anagrafico degli identificativi" headers={["Profilo", "Quota"]} rows={[
      ["Donne (sul sesso noto)", pct(fileF.sex.female)], ["Uomini (sul sesso noto)", pct(fileF.sex.male)],
      ...(fileF.age.status === "released" ? fileF.age.cells.map((cell) => [`Età ${cell.label}`, pct(cell.share)]) : [["Fasce d’età", "Non mostrate: almeno una classe conta meno di 5 identificativi"]]),
    ]} />
    <p className="mt-3 text-xs leading-5 text-muted-foreground">Età raggiunta nel 2025, dall’anno di nascita registrato; le quote per sesso escludono il sesso non noto.</p>
    <p className="mt-4 text-xs leading-5 text-muted-foreground">{`${januaryTop10 === null ? "" : `L’importo per identificativo è ${c.top10 > januaryTop10 ? "più" : "meno"} concentrato che nella DPC di gennaio della stessa ASL (quota del 10\u00a0% con importo maggiore: ${pct(c.top10)} contro ${pct(januaryTop10)}). `}Un solo anno di una sola Azienda.`}</p>
  </Panel>;
}

/** The third card of «Quadro decisionale»: recipients are now counted for January 2026 DPC, but one month shows no change over time. */
export function cExtensionRecipientsCard(view: CExtensionView | null, unavailable = false): { title: string; value: string; detail: string } {
  const lead = view?.units[0];
  if (!lead && unavailable) return { title: "Destinatari DPC", value: "Non disponibili in questo momento", detail: "La lettura dei dati su destinatari e utilizzo non è riuscita: nessun valore viene sostituito." };
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
  return <div className="space-y-6"><AttributionNarrowing view={view} /><CandidateReach view={view} /><FileFPortfolios view={view} /></div>;
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
  return <Panel title="Destinatari per stato del prodotto e gruppo di portafogli candidati · gennaio 2026" description={`Destinatari che hanno ricevuto almeno un prodotto di ciascuno stato o di ciascun gruppo. Le quote si sovrappongono e non ripartiscono la spesa.${aggregate ? " L’aggregato somma i destinatari delle quattro ASL: non è un conteggio di persone uniche regionali." : ""}`}>
    <ExactTable caption="Destinatari per stato del prodotto" headers={["Stato del prodotto", ...units.map((u) => u.label)]} rows={lead.portfolioStatus.map((s) => [s.label, ...units.map((u) => cell(u, "portfolioStatus", s.id))])} />
    <ExactTable caption="Destinatari per gruppo di portafogli candidati" headers={["Gruppo di portafogli (prodotti a candidato singolo)", ...units.map((u) => u.label)]} rows={lead.singleCandidateReach.map((g) => [g.label, ...units.map((u) => cell(u, "singleCandidateReach", g.id))])} />
    <p className="mt-3 text-xs leading-5 text-muted-foreground">Ogni gruppo riunisce più portafogli candidati, raggruppamenti farmacologici: non è confrontabile con un singolo portafoglio e non indica la diagnosi, l’indicazione effettiva né l’area che sostiene il costo.</p>
  </Panel>;
}

/** File F of its one Azienda: reported amount by product status and reach of the single-candidate portfolios (R20-04). */
function FileFPortfolios({ view }: { view: CExtensionView }) {
  const holder = view.units.find((u) => u.data.fileF), f = holder?.data.fileF;
  if (!f) return null;
  return <Panel title={`File F 2025 · ${holder?.label ?? ""}: portafogli candidati`} description={`${C_EXT_SOURCE.fileF}. Composizione dell’importo riportato secondo il prodotto: non è un consuntivo per area clinica né una ripartizione fra reparti.`}>
    <ExactTable caption="Importo riportato per stato del prodotto" headers={["Stato del prodotto", "Quota dell’importo"]} rows={[
      ["Un solo portafoglio candidato", pct(f.portfolioShares.single)], ["Più portafogli candidati", pct(f.portfolioShares.shared)], ["Non mappati o evidenza insufficiente", pct(f.portfolioShares.unmapped)],
    ]} />
    <ExactTable caption="Identificativi raggiunti per gruppo di portafogli candidati" headers={["Gruppo di portafogli (prodotti a candidato singolo)", "Quota degli identificativi"]} rows={f.singleCandidateReach.map((g) => [g.label, pct(g.share)])} />
    <p className="mt-3 text-xs leading-5 text-muted-foreground">Ogni gruppo riunisce più portafogli candidati. Le quote di identificativi si sovrappongono e non indicano diagnosi, indicazioni effettive o titolarità del budget.</p>
  </Panel>;
}

function AttributionNarrowing({ view }: { view: CExtensionView }) {
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
      ["Destinatari con prodotti condivisi che hanno almeno una riga ristretta a un candidato (quota dei destinatari)", ...units.map((u) => pct(u.data.january.attribution.sharedRecipientsNarrowed))],
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
  const withMode09 = f.months.flatMap((m) => (m.mode09 ? [monthLabel(m.month)] : []));
  const identifiers = new Map(f.identifiersByMonth.map((m) => [m.month, m.count]));
  return <><Panel title={`File F 2025 · ${holder?.label ?? ""}: importo mensile`} description={`${C_EXT_SOURCE.fileF}. In arancione le righe in modalità di erogazione 09 («Terapie CAR-T» nella specifica 2025)${withMode09.length ? `, presenti in: ${withMode09.join(", ")}` : ", assenti in questo anno"}.`}>
    <div role="img" aria-label={`Importo mensile: ${f.months.map((m) => `${monthLabel(m.month)} ${eur0(m.amount)}`).join("; ")}`}>
      <div className="flex h-44 items-end gap-1.5 border-b border-border">{f.months.map((m) => <div key={m.month} className="flex h-full min-w-0 flex-1 flex-col justify-end">
        <span className="block rounded-t bg-amber-500/80" style={{ height: `${(m.mode09 / max) * 100}%` }} />
        <span className={`block bg-primary ${m.mode09 ? "" : "rounded-t"}`} style={{ height: `${(m.withoutMode09 / max) * 100}%` }} />
      </div>)}</div>
      <div className="mt-1 flex gap-1.5">{f.months.map((m) => <span key={m.month} className="min-w-0 flex-1 text-center text-xs text-muted-foreground">{monthLabel(m.month)}</span>)}</div>
    </div>
    <ul className="mt-3 flex flex-wrap gap-4 text-xs"><li className="flex items-center gap-2"><span aria-hidden="true" className="inline-block h-3 w-3 rounded-sm bg-primary" />Altri medicinali</li><li className="flex items-center gap-2"><span aria-hidden="true" className="inline-block h-3 w-3 rounded-sm bg-amber-500/80" />Modalità 09</li></ul>
    <ExactTable caption="Importo mensile e identificativi" headers={["Mese", "Importo riportato", "Modalità 09", "Senza modalità 09", "Indice senza 09 (media = 100)", "Identificativi distinti"]}
      rows={f.months.map((m) => [monthLabel(m.month), eur0(m.amount), m.mode09 ? eur0(m.mode09) : "—", eur0(m.withoutMode09), num((m.withoutMode09 / mean) * 100, 1), num(identifiers.get(m.month) ?? null)])} />
    <p className="mt-4 text-xs leading-5 text-muted-foreground">{`${f.months.length < 12 ? `Mesi presenti nel flusso: ${f.months.length} su 12; un mese assente non vale zero. ` : ""}${lowestWithout === f.months.length - 1 && withMode09.includes(monthLabel(f.months[f.months.length - 1].month)) ? "Senza la modalità 09 l’ultimo mese è il più basso. " : ""}${note}`}</p>
    <ExactTable caption="Modalità di erogazione" headers={["Modalità", "Quota delle righe", "Quota dell’importo"]} rows={f.modes.map((m) => [m.label, pct(m.rowsShare), pct(m.amountShare)])} />
  </Panel>{f.bridges.length > 0 && <FileFBridges f={f} label={holder?.label ?? ""} />}</>;
}

/** Section 2 addition (D7): how the cost is spread over the recipients, from the per-ASL Lorenz deciles. The aggregate has
 * none (a sum of four Aziende is not one distribution). */
function CostConcentration({ units, hasAggregate }: { units: Unit[]; hasAggregate: boolean }) {
  const curves = units.filter((u) => u.data.january.cost.lorenz);
  if (!curves.length) return null;
  const tenths = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  return <Panel title="Come si distribuisce il costo fra i destinatari · gennaio 2026" description={`Quota cumulata del costo ricevuta dai destinatari con il costo più basso: più la quota è bassa, più il costo è concentrato su pochi destinatari.${hasAggregate ? " Per l’aggregato non si calcola: le distribuzioni delle singole ASL non si sommano." : ""}`}>
    <Matrix caption="Quota cumulata del costo per decimo di destinatari" units={curves} rows={tenths.map((k) => ({
      label: `Il ${k * 10}\u00a0% con costo più basso`, values: curves.map((u) => pct(u.data.january.cost.lorenz![k])),
    }))} />
    <p className="mt-4 text-xs leading-5 text-muted-foreground">Destinatari ordinati per costo registrato nel mese, dal più basso. Un solo mese: chi ritira a gennaio una confezione per più mesi compare fra i costi più alti.</p>
  </Panel>;
}

/** Section 4 addition (owner decision D1, 23 Oct 2026): each month-to-month change of the File F reported amount in four
 * product components. Contributions to an accounting change, not price or volume effects; a product entering or leaving
 * is absent from one of the two months of the file, not a new or departed patient. */
function FileFBridges({ f, label }: { f: NonNullable<CExtUnitPacket["fileF"]>; label: string }) {
  const cols = ["Mesi", "Variazione", "Prodotti presenti nei due mesi: aumenti", "Prodotti presenti nei due mesi: cali", "Prodotti in entrata", "Prodotti in uscita", "Di cui modalità 09", "Senza modalità 09", "Prodotti con variazione", "Quota dei 10 prodotti con variazione maggiore"];
  const concentrated = f.bridges.filter((b) => b.top10Share >= 0.5).map((b) => `${monthLabel(b.from)} → ${monthLabel(b.to)}`);
  return <Panel title={`File F 2025 · ${label}: variazione da un mese all’altro`} description={`${C_EXT_SOURCE.fileF}. Ogni variazione è la somma di quattro componenti di prodotto: prodotti presenti nei due mesi che aumentano o calano, prodotti osservati solo nel mese successivo (entrata) o solo nel precedente (uscita).`}>
    <div className="overflow-x-auto"><table className="w-full min-w-[60rem] text-xs"><caption className="sr-only">Variazione mensile dell’importo riportato per componente</caption>
      <thead><tr>{cols.map((c) => <th key={c} scope="col" className={`${thUnit} first:text-left`}>{c}</th>)}</tr></thead>
      <tbody>{f.bridges.map((b) => <tr key={b.from}><th scope="row" className="whitespace-nowrap border-b border-border/50 px-2 py-2.5 text-left font-medium">{`${monthLabel(b.from)} → ${monthLabel(b.to)}`}</th>
        {[signed0(b.change), signed0(b.continuingIncrease), signed0(b.continuingDecrease), signed0(b.entries), signed0(b.exits), b.mode09Change ? signed0(b.mode09Change) : "—", signed0(b.withoutMode09), num(b.products), pct(b.top10Share)]
          .map((v, i) => <td key={cols[i + 1]} className={td}>{v}</td>)}</tr>)}</tbody></table></div>
    <p className="mt-4 text-xs leading-5 text-muted-foreground">{`Contributi a una variazione contabile, non effetti di prezzo o di volume. Un prodotto in entrata o in uscita manca in uno dei due mesi del flusso: non indica un nuovo paziente né una terapia sospesa. Le righe in modalità 09 sono contate a parte per prodotto.${concentrated.length ? ` Dove i 10 prodotti con variazione maggiore portano metà o più della variazione lorda (${concentrated.join(", ")}), la variazione dipende da pochi prodotti.` : ""}`}</p>
  </Panel>;
}

/** Section 4 addition (owner decision D2, 23 Oct 2026): an Azienda's own acquisition and service component per recorded
 * pack, January 2026 DPC, on the products present in all four ASLs. One unit at a time and no other ASL's value: gaps
 * between Aziende stay with the reviewers (O1). The Regione view receives no list (the server removes it). */
export function PillarCUnitCosts({ view }: { view: CExtensionView }) {
  const holders = view.units.filter((u) => u.data.unitCosts);
  const [selected, setSelected] = useState<string>("");
  const [query, setQuery] = useState("");
  const holder = holders.find((u) => u.key === selected) ?? holders[0];
  if (!holder?.data.unitCosts) return null;
  const all = holder.data.unitCosts.products, q = query.trim().toLowerCase();
  const rows = q ? all.filter((r) => `${r.name} ${r.pack} ${r.atc} ${r.aic}`.toLowerCase().includes(q)) : all;
  return <Panel title={`Costo per confezione sugli stessi prodotti · ${holder.label} · gennaio 2026`} description={`Flussi NSIS DPC, gennaio 2026. Componenti riportate per confezione registrata sui ${num(all.length)} prodotti presenti in tutte e quattro le ASL, arrotondate al centesimo. Non sono prezzi negoziati né una misura di efficienza d’acquisto.`}
    controls={holders.length > 1 ? <label className="min-w-40 text-xs font-medium text-muted-foreground">Azienda<select aria-label="Azienda dei costi per confezione" className={SELECT} value={holder.key} onChange={(e) => setSelected(e.target.value)}>{holders.map((u) => <option key={u.key} value={u.key}>{u.label}</option>)}</select></label> : undefined}>
    <label className="mb-3 block max-w-md text-xs font-medium text-muted-foreground">Cerca per nome, ATC o AIC<input type="search" value={query} onChange={(e) => setQuery(e.target.value)} className={SELECT} /></label>
    <p role="status" className="mb-2 text-xs text-muted-foreground">{q ? `${num(rows.length)} prodotti su ${num(all.length)}` : `${num(all.length)} prodotti`}</p>
    <div className="max-h-[32rem] overflow-auto rounded-xl border border-border"><table className="w-full min-w-[46rem] text-xs"><caption className="sr-only">{`Costo per confezione, ${holder.label}`}</caption>
      <thead className="sticky top-0 bg-card"><tr>{["Prodotto", "Confezione", "ATC", "AIC", "Acquisto", "Servizio", "Totale"].map((c, i) => <th key={c} scope="col" className={`${thUnit} ${i < 4 ? "text-left" : ""}`}>{c}</th>)}</tr></thead>
      <tbody>{rows.map((r) => <tr key={r.aic}><th scope="row" className="border-b border-border/50 px-2 py-2 text-left font-medium">{r.name}</th>
        <td className="min-w-64 border-b border-border/50 px-2 py-2 text-left text-muted-foreground">{r.pack}</td><td className="border-b border-border/50 px-2 py-2 text-left">{r.atc}</td><td className="border-b border-border/50 px-2 py-2 text-left tabular-nums">{r.aic}</td>
        <td className={td}>{eur2(r.acquisition)}</td><td className={td}>{eur2(r.service)}</td><td className={td}>{eur2(r.combined)}</td></tr>)}</tbody></table></div>
    <p className="mt-4 text-xs leading-5 text-muted-foreground">Acquisto e compenso di servizio della distribuzione per conto divisi per le confezioni registrate nel mese. Lo stesso prodotto può avere rettifiche o tempi di registrazione diversi; nessun valore di altre Aziende è mostrato.</p>
  </Panel>;
}
