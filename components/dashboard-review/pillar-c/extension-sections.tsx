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
const pct = (v: number | null, digits = 1) => (v === null ? "—" : `${itNumber(v * 100, { minimumFractionDigits: digits, maximumFractionDigits: digits })} %`);
const num = (v: number | null, digits = 0) => (v === null ? "—" : itNumber(v, { minimumFractionDigits: digits, maximumFractionDigits: digits }));
const eur = (v: number | null) => (v === null ? "—" : cMoneyLabel(v));
const eur0 = (v: number) => itNumber(v, { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const signedEur = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${eur0(Math.abs(v))}`;
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
        { label: "Quota di costo del 10 % con costo maggiore", values: units.map((u) => pct(u.data.january.cost.top10)) },
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
      <Panel title="Principi attivi distinti per destinatario" description="Codici ATC di quinto livello ricevuti nel mese."><DistMatrix caption="Destinatari per numero di principi attivi" units={units} pick={(u) => u.january.ingredients} /></Panel>
    </div>
    <Panel title="Servizio di distribuzione e tempi di erogazione" description="Compenso DPC su tutte le righe del flusso; intervallo fra prescrizione ed erogazione sui contatti ammissibili (date registrate, non tempi di attesa).">
      <Matrix caption="Servizio di distribuzione e tempi" units={units} rows={[
        { label: "Quota del servizio sul costo", values: units.map((u) => pct(u.data.january.services.serviceShare)) },
        { label: "Servizio per confezione", values: units.map((u) => eur(u.data.january.services.servicePerPack)) },
        { label: "Confezioni sotto 10 € di acquisto", values: units.map((u) => pct(u.data.january.services.under10Packs)) },
        { label: "… quota del servizio sul loro costo", values: units.map((u) => pct(u.data.january.services.under10Service)) },
        { label: "Farmacie che erogano", values: units.map((u) => num(u.data.january.services.pharmacies)) },
        { label: "Giorni fra prescrizione ed erogazione, mediana", values: units.map((u) => num(u.data.january.services.intervalMedian)) },
        { label: "Erogato entro 7 giorni", values: units.map((u) => pct(u.data.january.services.within7)) },
      ]} />
      <p className="mt-4 text-xs leading-5 text-muted-foreground">Per i prodotti economici il compenso di distribuzione supera il costo del medicinale: è un tema di revisione dell’elenco DPC, non una misura di inefficienza. Nessuna farmacia è indicata.</p>
    </Panel>
    {fileF && <FileFRecipients fileF={fileF} />}
    {asl.length === 0 && <Empty>Nessuna ASL in questa vista.</Empty>}
  </div>;
}

function FileFRecipients({ fileF }: { fileF: NonNullable<CExtUnitPacket["fileF"]> }) {
  const c = fileF.concentration;
  return <Panel title="File F 2025 · ASL 3: identificativi, concentrazione e frequenza" description={`${C_EXT_SOURCE.fileF}. Identificativi distinti nel flusso, non pazienti certificati; nessun confronto con le altre ASL.`}>
    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[["Identificativi distinti nell’anno", num(fileF.identifiers)], ["65 anni e oltre", pct(over65(fileF.age))], ["Importo per identificativo, mediana", eur0(c.median)], ["Quota del 10 % con importo maggiore", pct(c.top10)],
        ["Quota dell’1 % con importo maggiore", pct(c.top1)], ["Senza modalità 09: quota del 10 %", pct(c.top10WithoutMode09)], ["Contatti per identificativo, mediana", num(fileF.medianContacts)], ["Mesi attivi, mediana", num(fileF.medianMonths)]]
        .map(([k, v]) => <div key={k} className="rounded-xl border border-border p-3"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{v}</dd></div>)}
    </dl>
    <ExactTable caption="Contatti e mesi attivi per identificativo" headers={["Classe", "Contatti: quota", "Classe", "Mesi attivi: quota"]}
      rows={fileF.contacts.cells.map((cell, i) => [cell.label, pct(cell.share), fileF.monthsActive.cells[i]?.label ?? "", fileF.monthsActive.cells[i] ? pct(fileF.monthsActive.cells[i].share) : ""])} />
    <p className="mt-4 text-xs leading-5 text-muted-foreground">La distribuzione diretta concentra le terapie ad alto costo: l’importo è molto più concentrato che nella DPC. Un solo anno di una sola Azienda.</p>
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
  { key: "narrowed", label: "Condivisi, ristretti a un’area da un’esenzione coerente", className: "bg-primary/55" },
  { key: "indicative", label: "Condivisi, esenzione oncologica o da trapianto (indicativa)", className: "bg-amber-500/80" },
  { key: "notInformative", label: "Condivisi, senza esenzione informativa", className: "bg-muted-foreground/35" },
] as const;

/** Section 3 addition: how much January DPC spending an exemption code can attribute to one area. */
export function PillarCAttributionEvidence({ view }: { view: CExtensionView }) {
  const units = view.units, agreement = units.flatMap((u) => u.data.january.attribution.agreementLines ?? []);
  return <Panel title="Quanta spesa DPC si attribuisce a un’area? · gennaio 2026" description="Quota della spesa dei destinatari ammissibili. L’esenzione per patologia restringe un prodotto condiviso solo se il farmaco appartiene alle classi correlate a quella patologia (regola trasparente: elenco della Regione Toscana, DGR 865/2018).">
    <div className="space-y-4">{units.map((u) => { const a = u.data.january.attribution; return <div key={u.key}>
      <p className="mb-1.5 flex flex-wrap justify-between gap-2 text-xs"><span className="font-medium">{u.label}</span><span className="text-muted-foreground">{`Senza prova informativa: ${pct(a.notInformative)}`}</span></p>
      <div className="flex h-4 overflow-hidden rounded-full bg-secondary" role="img" aria-label={`${u.label}: ${SEGMENTS.map((s) => `${s.label} ${pct(a[s.key])}`).join("; ")}`}>{SEGMENTS.map((s) => <span key={s.key} className={s.className} style={{ width: `${a[s.key] * 100}%` }} />)}</div>
    </div>; })}</div>
    <ul className="mt-4 grid gap-2 text-xs sm:grid-cols-2">{SEGMENTS.map((s) => <li key={s.key} className="flex items-center gap-2"><span aria-hidden="true" className={`inline-block h-3 w-3 rounded-sm ${s.className}`} />{s.label}</li>)}</ul>
    <ExactTable caption="Spesa per prova di attribuzione" headers={["Segmento", ...units.map((u) => u.label)]} rows={[
      ...SEGMENTS.map((s) => [s.label, ...units.map((u) => pct(u.data.january.attribution[s.key]))]),
      ["Accordo esenzione–portafoglio sui prodotti a candidato singolo", ...units.map((u) => pct(u.data.january.attribution.agreementLines))],
    ]} />
    {agreement.length > 0 && <p className="mt-4 text-xs leading-5 text-muted-foreground">{`Sui prodotti a un solo candidato l’esenzione coerente indica la stessa area nel ${agreement.length > 1 && Math.min(...agreement) !== Math.max(...agreement) ? `${pct(Math.min(...agreement))} – ${pct(Math.max(...agreement))}` : pct(agreement[0])} delle righe: la mappatura regge al confronto con un segnale clinico indipendente. Resta una bozza farmacologica, non un’attribuzione clinica.`}</p>}
  </Panel>;
}

/** Section 4 addition: File F monthly reported amount, with dispensing mode 09 pooled and shown apart. */
export function PillarCFileFMonthly({ view }: { view: CExtensionView }) {
  const f = view.units.find((u) => u.data.fileF)?.data.fileF;
  if (!f) return null;
  const max = Math.max(1, ...f.months.map((m) => m.amount));
  const mean = f.months.reduce((a, m) => a + m.withoutMode09, 0) / f.months.length;
  const lowestWithout = f.months.reduce((low, m, i) => (m.withoutMode09 < f.months[low].withoutMode09 ? i : low), 0);
  return <Panel title="File F 2025 · ASL 3: importo mensile" description={`${C_EXT_SOURCE.fileF}. In arancione le righe in modalità di erogazione 09 («Terapie CAR-T» nella specifica 2025), registrate solo a dicembre.`}>
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
    <p className="mt-4 text-xs leading-5 text-muted-foreground">{`La modalità 09 comprende due prodotti CAR-T e due altri medicinali: è una classificazione amministrativa, mostrata solo in forma aggregata. ${lowestWithout === f.months.length - 1 ? "Senza di essa dicembre è il mese più basso. " : ""}Le variazioni mensili coinvolgono oltre mille prodotti; un solo anno non stabilisce stagionalità né crescita.`}</p>
    <ExactTable caption="Modalità di erogazione" headers={["Modalità", "Quota delle righe", "Quota dell’importo"]} rows={f.modes.map((m) => [m.label, pct(m.rowsShare), pct(m.amountShare)])} />
  </Panel>;
}

const FACTORS = [["reach", "Destinatari per 1.000 residenti"], ["intensity", "Confezioni per destinatario"], ["mix", "Composizione dei prodotti"], ["acquisition", "Costo di acquisto per confezione"], ["service", "Servizio per confezione"]] as const;

/** Section 4, reviewer only (owner decision O1): why DPC spending per resident differs, exact Shapley decomposition. */
export function PillarCResidentDrivers({ view }: { view: CExtensionView }) {
  const d = view.drivers;
  if (!d) return null;
  const label = (key: string) => view.units.find((u) => u.key === key)?.label ?? key;
  const max = Math.max(1, ...d.units.flatMap((u) => FACTORS.map(([k]) => Math.abs(u[k]))));
  return <Panel title="Perché la spesa DPC per residente differisce fra le ASL? · gennaio 2026" description={`Euro per 1.000 residenti sui ${d.supportProducts} prodotti identici presenti in tutte le ASL, rispetto al riferimento delle quattro ASL (${eur0(d.referencePer1000)}). Scomposizione esatta: i cinque contributi sommano la differenza. Solo revisori.`}>
    <div className="grid gap-5 lg:grid-cols-2">{d.units.map((u) => <div key={u.unit} className="rounded-xl border border-border p-4">
      <p className="text-sm font-semibold">{label(u.unit)}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{`Differenza ${signedEur(u.difference)} per 1.000 residenti · ${num(u.reachPer1000, 1)} destinatari per 1.000 · ${num(u.packsPerRecipient, 2)} confezioni ciascuno`}</p>
      <ul className="mt-3 space-y-1.5">{FACTORS.map(([k, text]) => <li key={k} className="grid grid-cols-[minmax(0,11rem)_1fr_4.5rem] items-center gap-2 text-xs">
        <span>{text}</span>
        <span aria-hidden="true" className="relative h-2.5 rounded-full bg-secondary"><span className={`absolute top-0 h-2.5 rounded-full ${u[k] >= 0 ? "left-1/2 bg-primary" : "right-1/2 bg-amber-500/80"}`} style={{ width: `${(Math.abs(u[k]) / max) * 50}%` }} /></span>
        <span className="text-right tabular-nums">{signedEur(u[k])}</span>
      </li>)}</ul>
    </div>)}</div>
    {view.baskets && <ExactTable caption="Indici del paniere comune" headers={["Indice (riferimento = 100)", ...view.baskets.units.map((u) => label(u.unit))]} rows={(["acquisition", "service", "combined"] as const).map((k) => [k === "acquisition" ? "Acquisto" : k === "service" ? "Servizio" : "Combinato", ...view.baskets!.units.map((u) => num(u[k], 2))])} />}
    <p className="mt-4 text-xs leading-5 text-muted-foreground">Contributi contabili, non cause cliniche né risparmi. Destinatari e confezioni per destinatario dipendono dalla cadenza di dispensazione e vanno letti insieme. Sul paniere, il costo per confezione sposta la spesa di poco; il confronto è descrittivo, non standardizzato per età. Residenti al 31/12/2024 (Ministero della Salute, dati ISTAT).</p>
  </Panel>;
}
