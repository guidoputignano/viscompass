/** Planning workspace engine (reviewers and organisation-scoped audiences): the observed partition of one scope, the joint conditional interval of a
 * group of portfolios (PC-08 §4.6 applied to a set), at most two declared variants and the labelled split scenarios
 * admitted by PC-08-A13. Pure and browser-safe. It never produces a forecast, a budget, a saving or a scope total
 * under assumption, and it never mutates the view it reads. */
import { C_ATTR_CHANNELS, C_ATTR_ORGS, C_ATTR_PERIODS, cAttrAtoms, cAttrPriority, parseCAttrPacket, type CAttrChannel, type CAttrOrg, type CAttrPeriod, type CAttrPortfolio, type CAttrProduct, type CAttrScope } from "@/lib/dashboard-review/pillar-c/attribution";
import type { CAttrView } from "@/lib/dashboard-review/pillar-c/attribution-loader";
import { cWorkbookDecimal } from "@/lib/dashboard-review/pillar-c/workbook";

export type CPlanningView = CAttrView;
/** The key of the organisation a plan reads: a reviewer key, or the unit key of an organisation-scoped audience
 * (Pillar C recommendation 5; the same keys as C_SCOPED_UNITS, checked at compile time in audience-view.ts). The engine
 * only compares it and writes it into keys and file names. */
export type CPlanningOrg = CAttrOrg | "asl-1" | "asl-2" | "asl-3" | "asl-4" | "aggregato";
export const C_PLANNING_ORGS: readonly CPlanningOrg[] = [...C_ATTR_ORGS, "asl-1", "asl-2", "asl-3", "asl-4", "aggregato"];
export const C_PLANNING_RULES = ["eq", "prop", "user"] as const;
export type CPlanningRule = typeof C_PLANNING_RULES[number];
export const C_PLANNING_MAX_GROUP = 6, C_PLANNING_MAX_VARIANTS = 2, C_PLANNING_MAX_SHARES = 100;
export const C_PLANNING_BPS_MIN = -5000, C_PLANNING_BPS_MAX = 10000, C_PLANNING_SHARE_MAX = 10000;
/** Dated amendment that admits the labelled split scenarios (owner decision of 2026-10-19). Export only, never UI copy. */
export const C_PLANNING_ADMISSION = "PC-08-A13";
/** The only URL keys this workspace writes. The dossier scope keys are read, never written. */
export const C_PLANNING_PARAMS = ["c_plan_ids", "c_plan_v1", "c_plan_v2", "c_plan_split", "c_plan_shares"] as const;
export const C_PLANNING_SCOPE_PARAMS = ["c_port_period", "c_port_org", "c_port_channel"] as const;
export const C_PLANNING_MATCHED: Record<CAttrPeriod, CAttrPeriod> = { FY2024: "FY2025", FY2025: "FY2024", JM2025: "JM2026", JM2026: "JM2025" };
export const cPlanningMonths = (period: CAttrPeriod): 12 | 5 => period.startsWith("JM") ? 5 : 12;

/** Exact amount: a finite decimal string ("-12.5") or, only for a split whose weights do not terminate, a reduced fraction ("-25/3"), both in euros. */
export type CPlanningAmount = string;
export type CPlanningVariant = { bps: number; sharedBps: number | null; fixedBps: Record<string, number> };
export type CPlanningPlan = { ids: string[]; variants: CPlanningVariant[]; rule: CPlanningRule | null; shares: Record<string, number> };
export type CPlanningState = CPlanningPlan & { period: CAttrPeriod; org: CPlanningOrg; channel: CAttrChannel };
export type CPlanningPart = "fixed" | "inside" | "crossing" | "otherFixed" | "otherShared" | "unattributed";
export type CPlanningPartRow = { key: string; part: CPlanningPart; id: string | null; label: string; value: CPlanningAmount; entries: number | null; zero: boolean };
export type CPlanningPartition = { rows: CPlanningPartRow[]; total: CPlanningAmount; crossingAbs: CPlanningAmount; crossingEntries: number };
export type CPlanningMember = { id: string; label: string; fixed: CPlanningAmount; zero: boolean; lower1: CPlanningAmount; upper1: CPlanningAmount };
/** `referenceZero`: the reference is only single-portfolio parts that are all exactly 0 (nothing stays in the group), so it reads
 * L.observed.zeroFixed instead of a zero amount (PC-08-A12 item 9); always the case for a one-portfolio group with F_p = 0. */
export type CPlanningBounds = { fixed: CPlanningAmount; inside: CPlanningAmount; reference: CPlanningAmount; referenceZero: boolean; crossing: { net: CPlanningAmount; negative: CPlanningAmount; positive: CPlanningAmount }; lower1: CPlanningAmount; upper1: CPlanningAmount; width1: CPlanningAmount; lower2: CPlanningAmount; upper2: CPlanningAmount; full: boolean };
export type CPlanningEffect = { reference: CPlanningAmount; fixed: CPlanningAmount; inside: CPlanningAmount; lower: CPlanningAmount; upper: CPlanningAmount };
export type CPlanningVariantResult = { index: 1 | 2; name: string; assumption: { bps: number; sharedBps: number; fixedBps: Record<string, number> }; members: CPlanningMember[]; bounds: CPlanningBounds; effect: CPlanningEffect };
export type CPlanningSplitBand = { lower: CPlanningAmount; upper: CPlanningAmount; complete: boolean;
  covered: { entries: number; sets: number; net: CPlanningAmount; group: CPlanningAmount; outside: CPlanningAmount };
  uncovered: { entries: number; sets: number; net: CPlanningAmount; negative: CPlanningAmount; positive: CPlanningAmount } };
export type CPlanningSplit = { rule: CPlanningRule; observed: CPlanningSplitBand; variants: CPlanningSplitBand[]; unusedShares: string[] };
export type CPlanningCrossingSet = { set: string; candidates: string[]; inGroup: string[]; entries: number; net: CPlanningAmount; abs: CPlanningAmount; share: number | null };
export type CPlanningRanking = ReturnType<typeof cAttrPriority>;
export type CPlanningResult = {
  key: string; scope: { period: CAttrPeriod; org: CAttrOrg; channel: CAttrChannel; months: 12 | 5; partial: boolean };
  ids: string[]; partition: CPlanningPartition; members: CPlanningMember[]; observed: CPlanningBounds;
  variants: CPlanningVariantResult[]; split: CPlanningSplit | null; crossingSets: CPlanningCrossingSet[]; ranking: CPlanningRanking;
};

export const C_PLANNING_LABELS = {
  section: {
    nav: "Scenari",
    navDescription: "Ipotesi e intervalli per portafogli",
    eyebrow: "Spazio scenari · bozza locale",
    title: "Quale riferimento ottieni con le tue ipotesi?",
    lead: "Parti dalla spesa osservata dell’ambito scelto nel dossier, seleziona da uno a sei portafogli da pianificare insieme e confronta fino a due varianti dichiarate con la base osservata.",
    separation: "Spesa osservata e valori sotto ipotesi restano separati, ciascuno con la propria etichetta, e nessun valore osservato viene modificato. Una ripartizione dichiarata aggiunge alla parte del gruppo che non dipende dalla ripartizione la quota dichiarata della spesa condivisa con portafogli fuori dal gruppo ed è mostrata dentro l’intervallo del gruppo.",
    scope: "Periodo, organizzazione e canale sono quelli del dossier del portafoglio: si cambiano nel dossier.",
    mapping: "Mappatura terapeutica in bozza (v0.1): la parte a portafoglio singolo è un raggruppamento per ATC, non un’attribuzione clinica; la sensibilità alla mappatura non è valutata.",
    /** Follows the name of a January–May base period (cPlanningPartialText); the name itself is never a label. */
    partial: "(parziale, 5 mesi): valori riferiti a cinque mesi, non annualizzati, da non confrontare con importi annuali.",
    duration: "Per un periodo della stessa durata del periodo di base.",
    durationInline: "per un periodo della stessa durata del periodo di base",
    draft: "Bozza locale: non salvata sul server, non condivisa, non approvata. Esporta il file per conservarla.",
    confidentiality: "Riservato ai revisori del progetto · contiene aggregati di più Aziende",
    loading: "Caricamento dell’ambito selezionato…",
    unavailable: "L’analisi non è disponibile per questa selezione. Nessun valore viene sostituito con zero.",
    forbidden: "Questa sessione non può leggere lo spazio scenari, riservato ai revisori del progetto: nessun valore viene mostrato.",
    retry: "Riprova",
    invalidUrl: "Alcune ipotesi dell’indirizzo non erano valide e sono state ignorate.",
    unknownPortfolio: "Uno o più portafogli dell’indirizzo non esistono in questa vista.",
    dossierLink: "Pianifica questo portafoglio nello spazio scenari",
    /** With a slider value other than 0: «{dossierLinkWith} +10% {dossierReplaces}», the whole text of the dossier link. */
    dossierLinkWith: "Apri nello spazio scenari questo portafoglio con",
    dossierReplaces: "(sostituisce le varianti già presenti)",
    dossierScope: "Cambia periodo, organizzazione o canale nel dossier",
    scopeTitle: "Ambito del dossier",
    copyLink: "Copia vista",
    copied: "Link copiato",
    reset: "Azzera",
    exportJson: "Esporta JSON",
    exportFailed: "Esportazione non riuscita: nessun file è stato creato.",
    updated: "Risultati ricalcolati",
  },
  group: {
    label: "Portafogli pianificati insieme",
    choose: "Scegli un portafoglio",
    add: "Aggiungi portafoglio",
    commit: "Aggiungi",
    remove: "Rimuovi dal gruppo",
    limit: "Puoi pianificare insieme da uno a sei portafogli.",
  },
  observed: {
    chip: "Spesa rendicontata osservata · registro aziendale · mappatura in bozza",
    title: "Quanto ha speso il gruppo e quanta parte non dipende da come si ripartisce la spesa condivisa?",
    fixed: "Portafogli del gruppo · parte a portafoglio singolo",
    inside: "Resta nel gruppo in ogni ripartizione",
    crossing: "Condivisa con portafogli fuori dal gruppo",
    otherFixed: "Altri portafogli · parte a portafoglio singolo",
    otherShared: "Condivisa solo fra altri portafogli",
    unattributed: "Non attribuita",
    total: "Totale dell’ambito",
    crossingAbs: "Esposizione assoluta condivisa con portafogli fuori dal gruppo: annotazione, non entra nella somma",
    zeroFixed: "Nessun importo netto a portafoglio singolo (righe assenti o compensate)",
    footer: "Le parti sommano al totale dell’ambito (verifica esatta).",
    parts: "Composizione della spesa dell’ambito",
    part: "Parte",
    amount: "Importo",
    entries: "Voci",
    matched: "Periodo omogeneo, solo contesto: non è la fonte di una variante.",
  },
  bounds: {
    chip: "Intervallo condizionale di attribuzione",
    title: "Quanta spesa condivisa potrebbe ricadere nel gruppo, al minimo e al massimo?",
    reference: "Parte del gruppo che non dipende dalla ripartizione",
    referenceDetail: "Parte a portafoglio singolo dei portafogli del gruppo più la spesa che resta nel gruppo in ogni ripartizione.",
    interval: "Intervallo condizionale del gruppo · solo candidati identificati",
    joint: "Intervallo congiunto del gruppo",
    /** The observed interval drawn as the container of the split at the observed base (PC-08-A13 item 4), named as observed. */
    observedJoint: "Intervallo congiunto del gruppo · spesa osservata",
    member: "Singolo portafoglio · intervallo proprio",
    members: "Intervalli propri dei portafogli del gruppo",
    lower: "Minimo",
    upper: "Massimo",
    width: "Ampiezza dovuta alla spesa condivisa con portafogli fuori dal gruppo",
    l2: "Se anche le voci non attribuite potessero ricadere nel gruppo:",
    full: "Il gruppo comprende tutti i portafogli: l’intervallo si riduce a un valore unico.",
    caption: "Sommare gli intervalli dei singoli portafogli conta più volte le voci condivise fra portafogli del gruppo; l’intervallo del gruppo le conta una volta.",
    scale: "Scala comune in euro di questo grafico",
    legendRange: "Barra con estremi: intervallo condizionale",
    legendDot: "Punto: parte che non dipende dalla ripartizione",
    legendZero: "Linea tratteggiata: zero euro",
    read: "Come leggere questi valori",
    /** The visible pointer beside every group interval: it opens the single «Come leggere questi valori» block (PC-08-A12 item 5). */
    readThis: "Come leggere questo intervallo",
  },
  variants: {
    chip: "Valori sotto ipotesi · varianti dichiarate dall’utente",
    title: "Se ipotizzi una variazione, quale riferimento e quale intervallo ottieni?",
    base: "Base osservata (nessuna ipotesi)",
    names: ["Variante 1", "Variante 2"],
    add: "Aggiungi variante",
    remove: "Rimuovi variante",
    input: "Variazione ipotizzata (%)",
    inputHelp: "Si applica alla parte a portafoglio singolo dei portafogli del gruppo e alla spesa condivisa che li riguarda; gli altri portafogli restano ai valori osservati.",
    range: "Variazioni ammesse: da -50% a +100%, con al massimo due decimali.",
    advanced: "Ipotesi avanzate",
    sharedInput: "Variazione separata della spesa condivisa che riguarda il gruppo (%)",
    fixedInput: "Variazione della parte a portafoglio singolo per questo portafoglio (%)",
    source: "Ipotesi dell’utente",
    /** F'_Q + I'_Q (PC-08-A12 item 3 under item 6), with L.bounds.referenceDetail as its definition. */
    reference: "Parte del gruppo che non dipende dalla ripartizione · sotto ipotesi",
    interval: "Intervallo condizionale del gruppo sotto ipotesi",
    effect: "Effetto dell’ipotesi rispetto alla spesa osservata del periodo di base, non risparmio",
    scenario: "Scenario (ipotesi dichiarata) — non è una previsione né un dato osservato; nessuna probabilità associata. Non è un budget, un tetto o un risparmio.",
    unvaried: "Non variano: la parte a portafoglio singolo degli altri portafogli, la spesa condivisa solo fra altri portafogli e le voci non attribuite.",
    /** One line under every variant's values (PC-08-A12 items 6 and 7 as corrected); `scenario` and the time reading head the lane. */
    compact: "Scenario (ipotesi dichiarata), per un periodo della stessa durata del periodo di base: non è una previsione né un dato osservato.",
    fixedPart: "Parte a portafoglio singolo",
    sharedPart: "Spesa condivisa che riguarda il gruppo",
    members: "Intervalli propri dei portafogli del gruppo sotto ipotesi",
    invalid: "Valore non valido: resta in vigore il valore precedente.",
    empty: "Aggiungi una variante o scegli una regola di ripartizione per vedere valori sotto ipotesi.",
    unset: "Se vuoto, si usa la variazione della variante.",
  },
  split: {
    chip: "Ripartizione dichiarata (ipotesi)",
    title: "Come cambia il gruppo con una regola dichiarata di ripartizione della spesa condivisa?",
    rule: "Regola di ripartizione",
    none: "Nessuna ripartizione (solo intervallo)",
    eq: "Quote uguali fra i candidati",
    prop: "In proporzione alla parte a portafoglio singolo osservata nello stesso ambito",
    user: "Quota del gruppo scelta dall’utente per insieme di candidati",
    statement: "Ripartizione dichiarata (ipotesi): non è un dato osservato né un’attribuzione clinica e non esprime una probabilità.",
    eqNote: "Quote uguali fra i candidati: un riferimento aritmetico, non un’evidenza.",
    propNote: "Quote proporzionali alla parte a portafoglio singolo osservata in questo ambito: un riferimento aritmetico, non un’evidenza; non additiva tra Aziende e canali.",
    userNote: "Quote scelte dall’utente: nessuna evidenza le sostiene.",
    inside: "La ripartizione dichiarata è un’ipotesi mostrata dentro l’intervallo condizionale del gruppo: non è il risultato e non lo sostituisce.",
    result: "Ripartizione dichiarata (ipotesi)",
    baseTitle: "Ripartizione dichiarata (ipotesi) sulla spesa osservata",
    nothing: "Nessuna voce condivisa con portafogli fuori dal gruppo: non c’è nulla da ripartire.",
    noneCovered: "Nessuna voce condivisa è coperta dalla regola: tutte restano non ripartite e nessun valore di ripartizione viene mostrato.",
    point: "Tutte le voci condivise con portafogli fuori dal gruppo sono coperte dalla regola: l’ipotesi dà un valore unico.",
    partial: "Voci che restano non ripartite: mantengono il loro intervallo",
    uncoveredOne: "resta non ripartita",
    uncoveredMany: "restano non ripartite",
    covered: "Voci coperte dalla regola",
    uncovered: "Voci non ripartite",
    propZero: "Se nessun portafoglio candidato ha una parte a portafoglio singolo positiva, la voce resta non ripartita.",
    propWeights: "I pesi usano la parte a portafoglio singolo osservata, anche nelle varianti.",
    propAdditive: "La ripartizione proporzionale non è additiva tra Aziende e canali.",
    userShare: "Quota del gruppo (%)",
    userUnset: "Le voci degli insiemi di candidati senza quota restano non ripartite.",
    unused: "Quote senza voci in questo ambito: non vengono usate.",
    legend: "Rombo o fascia ambrata: ripartizione dichiarata (ipotesi)",
    noEffect: "La ripartizione dichiarata non modifica la mappatura, l’analisi di attribuzione, il dossier né i totali e le esportazioni delle altre sezioni.",
    set: "Insieme di candidati",
    inGroup: "Nel gruppo",
    exposure: "Esposizione assoluta osservata (base osservata; le varianti la scalano con la variazione della spesa condivisa)",
    invalid: "Quota non valida: usa una percentuale da 0 a 100 con al massimo due decimali.",
    more: "Mostra tutti gli insiemi",
    fewer: "Mostra i primi dieci",
  },
  ranking: {
    title: "Revisione delle indicazioni del prodotto: riduzione massima dell’intervallo del gruppo",
    base: "Calcolata sulla spesa osservata, non sulle varianti: una variante cambia gli importi, non l’ordine.",
    show: "Mostra l’ordine di revisione",
    reduction: "Riduce l’ampiezza dell’intervallo del gruppo fino a",
    cumulative: "Quota cumulata dell’ampiezza",
    candidates: "Portafogli candidati",
    n80: "Prodotti che coprono l’80% dell’ampiezza",
    note: "Solo una revisione delle indicazioni che porta il prodotto tutto dentro o tutto fuori dal gruppo restringe l’intervallo: la riduzione indicata è un massimo.",
    organisational: "Una ripartizione per centro di costo è un dato organizzativo separato e da sola non restringe l’intervallo del gruppo.",
    order: "È un ordine di revisione, non una graduatoria clinica o di prestazione.",
    empty: "Nessuna voce condivisa con portafogli fuori dal gruppo: l’intervallo del gruppo è già un valore unico.",
    link: "Apri le verifiche",
    noAtc: "ATC non presente",
    more: "Mostra tutte le voci",
    fewer: "Mostra le prime dieci",
  },
  outside: {
    title: "Fuori da questa sezione",
    budgetNone: "Budget approvato: nessun atto con importi per portafoglio terapeutico in questo ambito; nessuno scostamento viene calcolato.",
    budgetAct: "Budget approvato: esiste un atto approvato per Dipartimento in questo ambito, non confrontabile con un portafoglio terapeutico; nessuno scostamento viene calcolato.",
    budgetWithin: "Budget approvato: nessun atto con importi per portafoglio terapeutico; atti approvati per Dipartimento solo per alcune Aziende del registro:",
    budgetWithinNote: "Non sono confrontabili con un portafoglio terapeutico e nessuno scostamento viene calcolato.",
    actsLink: "Vai agli atti approvati",
    regional: "Contesto regionale: previsione regionale, non aziendale, su dati pubblici AIFA (Regione Abruzzo). Non è ripartita per Azienda, canale o portafoglio e non entra in alcun calcolo di questa sezione.",
    noLocalForecast: "Nessuna previsione aziendale né per portafoglio: il metodo registrato non è ammissibile con lo storico locale disponibile.",
    selection: "La selezione di questa sezione non si applica alla previsione regionale.",
    regionalLink: "Apri la previsione regionale",
  },
  /** PC-08-A12 item 5, verbatim (house apostrophe), beside every group interval; `exact` and the rest are this section's own. */
  statements: {
    extremes: "Gli estremi dei singoli portafogli non sono raggiungibili contemporaneamente, e quelli del gruppo non lo sono insieme a quelli dei portafogli fuori dal gruppo.",
    conservation: "In ogni ripartizione possibile, il gruppo e gli altri portafogli ricevono insieme esattamente la spesa a portafoglio singolo e la spesa condivisa dell’ambito.",
    contains: "La parte del gruppo che non dipende dalla ripartizione è sempre compresa nell’intervallo del gruppo.",
    notConfidence: "Intervallo condizionale: non è un intervallo di confidenza e non esprime una probabilità.",
    rounding: "Gli arrotondamenti possono non sommare.",
    exact: "Gli importi sono arrotondati una sola volta, nella visualizzazione; le somme sono controllate sui valori esatti.",
    notMoney: "Nessun valore di questa sezione è un budget, un risparmio o uno scostamento.",
  },
  notComputed: {
    title: "Che cosa questa sezione non calcola",
    items: [
      "Non calcola un budget per portafoglio né uno scostamento: servirebbero atti approvati con importi per portafoglio terapeutico.",
      "Non calcola spesa di reparto o di area clinica: servirebbe una ripartizione locale per struttura con un raccordo documentato verso i portafogli.",
      "Non calcola persone trattate, pazienti o spesa per persona: servirebbe un denominatore di persone per portafoglio.",
      "Non calcola una previsione aziendale: il metodo registrato non è ammissibile con lo storico locale disponibile.",
      "Non calcola risparmi né costo netto: le varianti sono ipotesi dichiarate, non effetti di prezzo o di contratto.",
    ],
  },
} as const;
const L = C_PLANNING_LABELS;

/** The task's twelve substrings and the design's cap, target, overrun, verification and clinical-claim terms, with their
 * inflections (stems where a stem is unambiguous). They may appear only inside the exact negation sentences below. */
export const C_PLANNING_FORBIDDEN = ["risparmio", "risparmi", "budget", "scostamento", "scostamenti", "previsione aziendale", "previsioni aziendali", "intervallo di confidenza", "intervalli di confidenza", "probabilit", "reparto", "reparti", "area clinica", "aree cliniche", "costo netto", "costi netti", "persone trattate", "persona trattata", "pazienti", "paziente", "demo",
  "tetto", "tetti", "sforament", "obiettiv", "verificat", "dimostra", "spesa netta", "spese nette", "attribuzione clinica", "attribuzioni cliniche"] as const;
export const C_PLANNING_NEGATIONS: readonly string[] = [
  L.variants.effect, L.variants.scenario, L.statements.notConfidence, L.statements.notMoney, L.split.statement, L.section.mapping,
  L.outside.budgetNone, L.outside.budgetAct, L.outside.budgetWithin, L.outside.budgetWithinNote, L.outside.noLocalForecast,
  ...L.notComputed.items,
];
const quote = (s: string) => s.replace(/['\u2018\u2019]/g, "’");
const entity = (s: string) => s.replace(/&(?:#x27|#39|apos|rsquo);/gi, "’").replace(/&quot;/gi, "\"").replace(/&nbsp;|&#160;|&#xa0;/gi, " ").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&amp;/gi, "&");
const flat = (s: string) => quote(entity(s.replace(/<[^>]*>/g, " "))).replace(/[\s\u00a0]+/g, " ");
/** Copy lint for labels and rendered HTML: every forbidden substring must sit inside an allowlisted negation sentence. */
export function cPlanningCopyLint(text: string): { term: string; excerpt: string }[] {
  let rest = flat(text);
  for (const sentence of [...C_PLANNING_NEGATIONS].map(flat).sort((a, b) => b.length - a.length)) rest = rest.split(sentence).join(" ¶ ");
  const lower = rest.toLocaleLowerCase("it"), out: { term: string; excerpt: string }[] = [];
  for (const term of C_PLANNING_FORBIDDEN) for (let at = lower.indexOf(term); at >= 0; at = lower.indexOf(term, at + 1)) out.push({ term, excerpt: rest.slice(Math.max(0, at - 30), at + term.length + 30) });
  return out;
}
/** Every label string, for the copy lint and render tests. */
export function cPlanningLabelTexts(value: unknown = C_PLANNING_LABELS): string[] {
  return typeof value === "string" ? [value] : Array.isArray(value) ? value.flatMap(v => cPlanningLabelTexts(v)) : value && typeof value === "object" ? Object.values(value).flatMap(v => cPlanningLabelTexts(v)) : [];
}
/** The mandatory statements of PC-08-A12 item 5, in the registered order. */
export const C_PLANNING_GROUP_STATEMENTS: readonly string[] = [L.statements.extremes, L.statements.conservation, L.statements.contains, L.statements.notConfidence, L.bounds.caption, L.statements.rounding, L.section.mapping];
/** The single «Come leggere questi valori» block (PC-08-A12 item 5 as corrected): the group statements and the section's own two.
 * Every group interval carries a visible pointer to it (L.bounds.readThis). */
export const C_PLANNING_READING: readonly string[] = [...C_PLANNING_GROUP_STATEMENTS, L.statements.exact, L.statements.notMoney];
/** The registered note beside each split rule (PC-08-A13 item 4). */
export const C_PLANNING_RULE_NOTES = { eq: L.split.eqNote, prop: L.split.propNote, user: L.split.userNote } as const;
const PARTIAL_NAMES: Partial<Record<CAttrPeriod, string>> = { JM2025: "Gen–mag 2025", JM2026: "Gen–mag 2026" };
/** «{periodo di base} (parziale, 5 mesi): …» (PC-08-A12 item 7) for a January–May base, otherwise null. The names are C_PERIOD_LABELS'. */
export const cPlanningPartialText = (period: CAttrPeriod): string | null => PARTIAL_NAMES[period] ? `${PARTIAL_NAMES[period]} ${L.section.partial}` : null;

// ---------------------------------------------------------------- exact arithmetic
const ZERO = BigInt(0), ONE = BigInt(1), TWO = BigInt(2), FIVE = BigInt(5), TEN = BigInt(10), BASE = BigInt(10000), U25 = TEN ** BigInt(25);
const A = cAttrAtoms;
const fail = (code: string): never => { throw Error(code); };
const need = (ok: unknown, code: string) => { if (!ok) fail(code); };
function gcd(a: bigint, b: bigint): bigint { if (a < ZERO) a = -a; if (b < ZERO) b = -b; while (b !== ZERO) { const t = a % b; a = b; b = t; } return a; }
/** n/d in units of 10^-25 €, d > 0, reduced. */
type Rat = { n: bigint; d: bigint };
const whole = (n: bigint): Rat => ({ n, d: ONE });
function ratio(n: bigint, d: bigint): Rat { need(d > ZERO, "C_PLANNING_ARITHMETIC"); const g = gcd(n, d); return g > ONE ? { n: n / g, d: d / g } : { n, d }; }
/** Scaling by a small integer keeps the fraction reduced with a cheap gcd. */
function scale(v: Rat, k: bigint): Rat { const g = gcd(k, v.d); return { n: v.n * (k / g), d: v.d / g }; }
/** Lazy exact sum: equal denominators merge, the rest meet at their lcm, one reduction at the end. */
function sum(terms: Rat[]): Rat {
  const byDen = new Map<bigint, bigint>(); for (const t of terms) byDen.set(t.d, (byDen.get(t.d) ?? ZERO) + t.n);
  let n = ZERO, d = ONE;
  for (const [den, num] of byDen) { if (num === ZERO) continue; if (den === d) { n += num; continue; } const g = gcd(d, den); n = n * (den / g) + num * (d / g); d = d / g * den; }
  return ratio(n, d);
}
const cmp = (a: Rat, b: Rat) => { const x = a.n * b.d, y = b.n * a.d; return x < y ? -1 : x > y ? 1 : 0; };
/** Integer at 10^-places → exact decimal string without trailing zeros (the `scaled` rule of cPortfolioPlanning, any scale). */
function decimalText(value: bigint, places: number) {
  const neg = value < ZERO, m = neg ? -value : value, unit = TEN ** BigInt(places), f = places ? (m % unit).toString().padStart(places, "0").replace(/0+$/, "") : "";
  return `${neg ? "-" : ""}${m / unit}${f ? `.${f}` : ""}`;
}
const u25 = (value: bigint) => decimalText(value, 25);
/** Reduced n/d (10^-25 €): a finite decimal when d = 2^a·5^b, otherwise the reduced euro fraction "N/D". */
function amount(v: Rat): CPlanningAmount {
  if (v.d === ONE) return u25(v.n);
  let r = v.d, e2 = 0, e5 = 0; while (r % TWO === ZERO) { r /= TWO; e2++; } while (r % FIVE === ZERO) { r /= FIVE; e5++; }
  if (r === ONE) { const m = Math.max(e2, e5); return decimalText(v.n * TWO ** BigInt(m - e2) * FIVE ** BigInt(m - e5), 25 + m); }
  // gcd(n, d) = 1, so gcd(n, d·10^25) = gcd(n, 10^25).
  const g = gcd(v.n, U25); return `${v.n / g}/${v.d * (U25 / g)}`;
}
const PLAIN = /^-?\d+(?:\.\d+)?$/, FRACTION = /^-?\d+\/[1-9]\d*$/;
/** Parse a CPlanningAmount into an exact euro fraction (not reduced). */
function parseAmount(value: string): Rat {
  need(typeof value === "string" && value.length <= 20_000 && (PLAIN.test(value) || FRACTION.test(value)), "C_PLANNING_AMOUNT");
  if (value.includes("/")) { const [n, d] = value.split("/"); return { n: BigInt(n), d: BigInt(d) }; }
  const [i, f = ""] = value.split("."); return { n: BigInt(i + f), d: TEN ** BigInt(f.length) };
}
/** Sign of a − b for two exact amounts. */
export const cPlanningCompare = (a: CPlanningAmount, b: CPlanningAmount) => cmp(parseAmount(a), parseAmount(b));
/** One rounding, half away from zero, through the project's display rule (cWorkbookDecimal). A fraction is first truncated
 * toward zero at 30 places, which cannot move a rounding at ≤ 10 places across a tie. */
export function cPlanningDecimal(value: CPlanningAmount, digits = 0): string {
  const v = parseAmount(value); if (PLAIN.test(value)) return cWorkbookDecimal(value, digits);
  const neg = v.n < ZERO, m = (neg ? -v.n : v.n) * TEN ** BigInt(30) / v.d, s = m.toString().padStart(31, "0");
  return cWorkbookDecimal(`${neg ? "-" : ""}${s.slice(0, -30)}.${s.slice(-30)}`, digits);
}
export const cPlanningMoney = (value: CPlanningAmount, digits = 0) => `${cPlanningDecimal(value, digits)} €`;
/** Chart geometry only (pixel positions), never a displayed or exported value. Accepts fractions, unlike Number(). */
export function cPlanningNumber(value: CPlanningAmount): number { const v = parseAmount(value); return PLAIN.test(value) ? Number(value) : Number(v.n * TEN ** BigInt(12) / v.d) / 1e12; }
/** part / whole as an Italian percentage ("45,3%"), rounded once from the exact ratio; null when whole is zero. Never a float. */
export function cPlanningShareText(part: CPlanningAmount, whole: CPlanningAmount, digits = 1): string | null {
  const a = parseAmount(part), b = parseAmount(whole); if (b.n === ZERO) return null;
  let n = a.n * b.d * BigInt(100), d = a.d * b.n; if (d < ZERO) { n = -n; d = -d; }
  return `${cPlanningDecimal(`${n}/${d}`, digits)}%`;
}

// ---------------------------------------------------------------- percent and basis points
const PERCENT = /^\s*([+\-\u2212]?)(\d{1,3})(?:[.,](\d{1,2}))?\s*%?\s*$/;
/** "12,5" / "-3.25" / "+4 %" → integer basis points, exact; throws C_PLANNING_ASSUMPTION outside [min, max] or past two decimals. */
export function cPlanningPercentToBps(text: string, min = C_PLANNING_BPS_MIN, max = C_PLANNING_BPS_MAX): number {
  const m = typeof text === "string" ? PERCENT.exec(text) : null; if (!m) return fail("C_PLANNING_ASSUMPTION");
  const magnitude = Number(m[2]) * 100 + Number((m[3] ?? "").padEnd(2, "0")), bps = m[1] && m[1] !== "+" ? -magnitude : magnitude;
  need(bps >= min && bps <= max, "C_PLANNING_ASSUMPTION"); return bps === 0 ? 0 : bps;
}
const bpsText = (bps: number, separator: string) => { const m = Math.abs(bps), f = m % 100; return `${bps < 0 ? "-" : ""}${Math.floor(m / 100)}${f ? `${separator}${String(f).padStart(2, "0").replace(/0$/, "")}` : ""}`; };
/** Integer basis points → editable Italian percent text ("12,5"); cPlanningPercentToBps reads it back exactly. */
export const cPlanningBpsToPercent = (bps: number) => { need(Number.isSafeInteger(bps), "C_PLANNING_ASSUMPTION"); return bpsText(bps, ","); };
export const cPlanningPercentLabel = (bps: number, signed = true) => `${signed && bps > 0 ? "+" : ""}${cPlanningBpsToPercent(bps)}%`;
const bpsDecimal = (bps: number) => bpsText(bps, ".");

// ---------------------------------------------------------------- validation
const ID = /^[A-Z0-9]{2,12}$/;
const integer = (v: unknown, min: number, max: number) => typeof v === "number" && Number.isSafeInteger(v) && v >= min && v <= max;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
/** Canonical candidate-set key, as in the attribution packet: ascending codes joined by "+". */
export const cPlanningSetKey = (candidates: readonly string[]) => [...candidates].sort().join("+");
const crosses = (candidates: readonly string[], group: ReadonlySet<string>) => { const inside = candidates.filter(c => group.has(c)).length; return inside > 0 && inside < candidates.length; };
function idsCheck(ids: unknown): asserts ids is string[] {
  need(Array.isArray(ids) && ids.length >= 1 && ids.length <= C_PLANNING_MAX_GROUP && ids.every(id => typeof id === "string" && ID.test(id)) && new Set(ids).size === ids.length, "C_PLANNING_GROUP");
}
function variantCheck(v: unknown, ids: string[]): asserts v is CPlanningVariant {
  need(record(v) && Object.keys(v).length === 3 && Object.hasOwn(v, "bps") && Object.hasOwn(v, "sharedBps") && Object.hasOwn(v, "fixedBps"), "C_PLANNING_ASSUMPTION");
  const x = v as Record<string, unknown>;
  need(integer(x.bps, C_PLANNING_BPS_MIN, C_PLANNING_BPS_MAX) && (x.sharedBps === null || integer(x.sharedBps, C_PLANNING_BPS_MIN, C_PLANNING_BPS_MAX)) && record(x.fixedBps), "C_PLANNING_ASSUMPTION");
  const fixed = x.fixedBps as Record<string, unknown>;
  need(Object.entries(fixed).every(([id, b]) => ids.includes(id) && integer(b, C_PLANNING_BPS_MIN, C_PLANNING_BPS_MAX)), "C_PLANNING_ASSUMPTION");
}
function sharesCheck(shares: unknown, ids: string[]): asserts shares is Record<string, number> {
  need(record(shares) && Object.keys(shares).length <= C_PLANNING_MAX_SHARES, "C_PLANNING_SHARES");
  const group = new Set(ids);
  for (const [key, share] of Object.entries(shares as Record<string, unknown>)) {
    const set = key.split("+");
    need(set.length >= 2 && set.length <= 40 && set.every(id => ID.test(id)) && cPlanningSetKey(set) === key && new Set(set).size === set.length && crosses(set, group) && integer(share, 0, C_PLANNING_SHARE_MAX), "C_PLANNING_SHARES");
  }
}
/** Strict check of a plan (or a state). Throws C_PLANNING_GROUP / _ASSUMPTION / _SHARES / _STATE. */
export function cPlanningPlanCheck(plan: CPlanningPlan): CPlanningPlan {
  need(record(plan) && Object.keys(plan).every(k => ["ids", "variants", "rule", "shares", "period", "org", "channel"].includes(k)) && ["ids", "variants", "rule", "shares"].every(k => Object.hasOwn(plan, k)), "C_PLANNING_STATE");
  idsCheck(plan.ids);
  need(Array.isArray(plan.variants) && plan.variants.length <= C_PLANNING_MAX_VARIANTS, "C_PLANNING_ASSUMPTION");
  for (const v of plan.variants) variantCheck(v, plan.ids);
  need(plan.rule === null || C_PLANNING_RULES.includes(plan.rule), "C_PLANNING_STATE");
  sharesCheck(plan.shares, plan.ids);
  return plan;
}
/** True when every id of the plan exists in the view's vocabulary (the codec cannot know it). */
export const cPlanningKnownIds = (ids: readonly string[], portfolios: readonly CAttrPortfolio[]) => ids.every(id => portfolios.some(p => p.id === id));

// ---------------------------------------------------------------- C1: base partition check
type Stats = { n: number; net: bigint; abs: bigint; pos: bigint; neg: bigint };
const stats = (): Stats => ({ n: 0, net: ZERO, abs: ZERO, pos: ZERO, neg: ZERO });
function addStats(s: Stats, e: { n: number; net: string; abs: string; positive: string; negative: string }) { s.n += e.n; s.net += A(e.net); s.abs += A(e.abs); s.pos += A(e.positive); s.neg += A(e.negative); }
const sameStats = (s: Stats, e: { n: number; net: string; abs: string; positive: string; negative: string }) => s.n === e.n && s.net === A(e.net) && s.abs === A(e.abs) && s.pos === A(e.positive) && s.neg === A(e.negative);
/** C1: the scope partitions exactly (S2 by portfolio, S3 entries, S4/S5) and every bound is rebuilt from its rows. Throws C_PLANNING_BASE. */
export function cPlanningBase(scope: CAttrScope, portfolios: readonly CAttrPortfolio[]): void {
  const ok = (c: unknown) => need(c, "C_PLANNING_BASE");
  ok(record(scope) && Array.isArray(scope.bounds) && Array.isArray(scope.products) && Array.isArray(portfolios));
  const V = new Set(portfolios.map(p => p.id)); ok(V.size > 0 && V.size === portfolios.length);
  ok(scope.bounds.length === V.size && new Set(scope.bounds.map(b => b.id)).size === V.size && scope.bounds.every(b => V.has(b.id)));
  const st = scope.states; let fixed = ZERO; for (const b of scope.bounds) fixed += A(b.fixed);
  ok(fixed === A(st.S2.net) && A(scope.total.net) === A(st.S2.net) + A(st.S3.net) + A(st.S4.net) + A(st.S5.net));
  const shared = new Map([...V].map(id => [id, stats()])), states: Record<"S3" | "S4" | "S5", Stats> = { S3: stats(), S4: stats(), S5: stats() };
  for (const e of scope.products) {
    ok(e.state === "S3" || e.state === "S4" || e.state === "S5");
    const c = e.candidates; ok(Array.isArray(c) && new Set(c).size === c.length && c.every(p => V.has(p)) && (e.state === "S3" ? c.length >= 2 : c.length === 0));
    const net = A(e.net), pos = A(e.positive), neg = A(e.negative); ok(pos >= ZERO && neg <= ZERO && net === pos + neg && A(e.abs) === pos - neg);
    addStats(states[e.state], e); if (e.state === "S3") for (const p of c) addStats(shared.get(p)!, e);
  }
  for (const s of ["S3", "S4", "S5"] as const) ok(sameStats(states[s], st[s]));
  const u = { neg: A(st.S4.negative) + A(st.S5.negative), pos: A(st.S4.positive) + A(st.S5.positive) };
  for (const b of scope.bounds) {
    const f = A(b.fixed), s = shared.get(b.id)!; ok(sameStats(s, b.shared));
    ok(A(b.lower1) === f + s.neg && A(b.upper1) === f + s.pos && A(b.lower2) === f + s.neg + u.neg && A(b.upper2) === f + s.pos + u.pos);
  }
}
/** Validates a fetched /api/pillar-c/attribution payload for the planning workspace: exact keys, echoed scope, matched
 * comparison, the packet parser's conservation guard and C1. Throws C_PLANNING_VIEW or C_PLANNING_BASE. The view must
 * echo the one organisation key that was requested, and that key must be in `orgs` (every reviewer and scoped key by
 * default; the caller's own audience decided which one it requests, and the server which one it serves). */
export function cPlanningAccept(raw: unknown, period: CAttrPeriod, org: CPlanningOrg, channel: CAttrChannel, orgs: readonly string[] = C_PLANNING_ORGS): CPlanningView {
  const keys = ["schema", "sourceSha256", "classificationSha256", "mappingVersion", "sourceSnapshot", "portfolios", "scope", "comparison"];
  need(record(raw) && Object.keys(raw).length === keys.length && keys.every(k => Object.hasOwn(raw, k)), "C_PLANNING_VIEW");
  const v = raw as Record<string, unknown>, hash = (h: unknown) => typeof h === "string" && /^[a-f0-9]{64}$/.test(h);
  need(v.schema === "pillar-c-attribution-view-v1" && hash(v.sourceSha256) && hash(v.classificationSha256) && hash(v.sourceSnapshot), "C_PLANNING_VIEW");
  need(C_ATTR_PERIODS.includes(period) && orgs.includes(org) && C_ATTR_CHANNELS.includes(channel), "C_PLANNING_VIEW");
  const scope = v.scope as CAttrScope, comparison = v.comparison as CAttrScope | null;
  need(record(scope) && scope.period === period && scope.org === org && scope.channel === channel, "C_PLANNING_VIEW");
  need(comparison === null || (record(comparison) && comparison.period === C_PLANNING_MATCHED[period] && comparison.org === org && comparison.channel === channel), "C_PLANNING_VIEW");
  try { parseCAttrPacket({ schema: "pillar-c-attribution-v1", sourceSha256: v.sourceSha256, classificationSha256: v.classificationSha256, mappingVersion: v.mappingVersion, precision: "exact-source-literals-21", portfolios: v.portfolios, scopes: comparison ? [scope, comparison] : [scope] }, [org]); }
  catch { fail("C_PLANNING_VIEW"); }
  const view = raw as unknown as CPlanningView; parsed(scope, view.portfolios); if (comparison) parsed(comparison, view.portfolios);
  return view;
}

// ---------------------------------------------------------------- parsed scope (observed, atoms at 10^-21)
type Shared = { e: CAttrProduct; set: string; net: bigint; pos: bigint; neg: bigint; abs: bigint };
/** `u` comes from the states (S4 + S5), `u6` from the S4/S5 entries themselves: class 6 of the partition, re-checked against the states. */
type Parsed = { F: Map<string, bigint>; shared: Map<string, { neg: bigint; pos: bigint }>; s3: Shared[]; total: bigint; s3net: bigint; u: { net: bigint; neg: bigint; pos: bigint }; u6: Stats };
/** Views are read-only: each scope object passes C1 once and is parsed once (per vocabulary array). */
const cache = new WeakMap<CAttrScope, { portfolios: readonly CAttrPortfolio[]; parsed: Parsed }>();
function parsed(scope: CAttrScope, portfolios: readonly CAttrPortfolio[]): Parsed {
  const hit = cache.get(scope); if (hit && hit.portfolios === portfolios) return hit.parsed;
  cPlanningBase(scope, portfolios); const st = scope.states;
  const s3 = scope.products.filter(e => e.state === "S3").map((e): Shared => { const pos = A(e.positive), neg = A(e.negative); return { e, set: cPlanningSetKey(e.candidates), net: A(e.net), pos, neg, abs: pos - neg }; });
  const u6 = stats(); for (const e of scope.products) if (e.state !== "S3") addStats(u6, e);
  const out: Parsed = { F: new Map(scope.bounds.map(b => [b.id, A(b.fixed)])), shared: new Map(scope.bounds.map(b => [b.id, { neg: A(b.shared.negative), pos: A(b.shared.positive) }])), s3,
    total: A(scope.total.net), s3net: A(st.S3.net), u: { net: A(st.S4.net) + A(st.S5.net), neg: A(st.S4.negative) + A(st.S5.negative), pos: A(st.S4.positive) + A(st.S5.positive) }, u6 };
  cache.set(scope, { portfolios, parsed: out }); return out;
}

// ---------------------------------------------------------------- group preparation
type Entry = Shared & { inQ: string[]; out: string[] };
type Prep = Parsed & {
  view: CPlanningView; ids: string[]; group: Set<string>; full: boolean; labels: Map<string, string>;
  inside: Entry[]; crossing: Entry[]; others: Entry[];
  sums: { inside: bigint; crossing: bigint; others: bigint; otherFixed: bigint };
};
function prepare(view: CPlanningView, ids: string[]): Prep {
  idsCheck(ids); const { scope, portfolios } = view; need(cPlanningKnownIds(ids, portfolios), "C_PLANNING_GROUP");
  const base = parsed(scope, portfolios), group = new Set(ids), labels = new Map(portfolios.map(p => [p.id, p.label]));
  const inside: Entry[] = [], crossing: Entry[] = [], others: Entry[] = [];
  for (const r of base.s3) {
    const entry: Entry = { ...r, inQ: r.e.candidates.filter(c => group.has(c)), out: r.e.candidates.filter(c => !group.has(c)) };
    (entry.out.length === 0 ? inside : entry.inQ.length === 0 ? others : crossing).push(entry);
  }
  const total = (list: Entry[]) => list.reduce((s, r) => s + r.net, ZERO);
  let otherFixed = ZERO; for (const [id, f] of base.F) if (!group.has(id)) otherFixed += f;
  return { ...base, view, ids, group, full: portfolios.every(p => group.has(p.id)), labels, inside, crossing, others,
    sums: { inside: total(inside), crossing: total(crossing), others: total(others), otherFixed } };
}

/** 1. Observed partition Π-Q (PC-08-A12 item 2), checked against the view's own totals on every call: the Net of the six classes
 * sums to the scope net (R2); classes 2, 3 and 5 together carry exactly the n, Abs, G⁺ and G⁻ of S3, and class 6 those of S4 ∪ S5
 * (R1, R3, R4). The crossing absolute exposure is an annotation. */
function partition(p: Prep): CPlanningPartition {
  const st = p.view.scope.states, total = A(p.view.scope.total.net), fixed = p.ids.map(id => p.F.get(id)!);
  const parts: [CPlanningPart, bigint][] = [["inside", p.sums.inside], ["crossing", p.sums.crossing], ["otherFixed", p.sums.otherFixed], ["otherShared", p.sums.others], ["unattributed", p.u.net]];
  need(fixed.reduce((s, v) => s + v, ZERO) + parts.reduce((s, [, v]) => s + v, ZERO) === total, "C_PLANNING_PARTITION");
  const s3 = stats(); for (const list of [p.inside, p.crossing, p.others]) for (const r of list) addStats(s3, r.e);
  const s45 = stats(); addStats(s45, st.S4); addStats(s45, st.S5);
  need(sameStats(s3, st.S3) && p.u6.n === s45.n && p.u6.net === s45.net && p.u6.abs === s45.abs && p.u6.pos === s45.pos && p.u6.neg === s45.neg, "C_PLANNING_PARTITION");
  const entries: Partial<Record<CPlanningPart, number>> = { inside: p.inside.length, crossing: p.crossing.length, otherShared: p.others.length };
  return {
    rows: [...p.ids.map((id, i): CPlanningPartRow => ({ key: `fixed|${id}`, part: "fixed", id, label: p.labels.get(id) ?? id, value: u25(fixed[i] * BASE), entries: null, zero: fixed[i] === ZERO })),
      ...parts.map(([part, v]): CPlanningPartRow => ({ key: part, part, id: null, label: L.observed[part], value: u25(v * BASE), entries: entries[part] ?? null, zero: v === ZERO }))],
    total: u25(total * BASE), crossingAbs: u25(p.crossing.reduce((s, r) => s + r.abs, ZERO) * BASE), crossingEntries: p.crossing.length,
  };
}

// ---------------------------------------------------------------- 2./3. joint bounds, observed and under a declared variant
type Factors = { kf: Map<string, bigint>; k3: bigint };
const observedFactors = (p: Prep): Factors => ({ kf: new Map(p.ids.map(id => [id, BASE])), k3: BASE });
const variantFactors = (p: Prep, v: CPlanningVariant): Factors => ({ kf: new Map(p.ids.map(id => [id, BASE + BigInt(v.fixedBps[id] ?? v.bps)])), k3: BASE + BigInt(v.sharedBps ?? v.bps) });
type Raw = { fixed: bigint; inside: bigint; reference: bigint; xNet: bigint; xNeg: bigint; xPos: bigint; lower1: bigint; upper1: bigint; lower2: bigint; upper2: bigint };
/** LB1_Q = F_Q + I_Q + Σ_crossing c⁻, UB1_Q = F_Q + I_Q + Σ_crossing c⁺ (row-level parts); L2 adds G⁻/G⁺ of S4∪S5, or their net when Q = V. Units 10^-25 €. */
function joint(p: Prep, f: Factors): Raw {
  let fixed = ZERO; for (const id of p.ids) fixed += p.F.get(id)! * f.kf.get(id)!;
  const inside = p.sums.inside * f.k3, reference = fixed + inside;
  let xNeg = ZERO, xPos = ZERO; for (const r of p.crossing) { xNeg += r.neg; xPos += r.pos; }
  xNeg *= f.k3; xPos *= f.k3; const xNet = p.sums.crossing * f.k3, lower1 = reference + xNeg, upper1 = reference + xPos;
  const lower2 = p.full ? lower1 + p.u.net * BASE : lower1 + p.u.neg * BASE, upper2 = p.full ? upper1 + p.u.net * BASE : upper1 + p.u.pos * BASE;
  if (p.full) need(xNeg === ZERO && xPos === ZERO && lower2 === upper2, "C_PLANNING_BOUNDS");
  else need(lower2 <= lower1 && lower1 <= reference && reference <= upper1 && upper1 <= upper2, "C_PLANNING_BOUNDS");
  return { fixed, inside, reference, xNet, xNeg, xPos, lower1, upper1, lower2, upper2 };
}
const boundsText = (p: Prep, r: Raw): CPlanningBounds => ({ fixed: u25(r.fixed), inside: u25(r.inside), reference: u25(r.reference), referenceZero: !p.inside.length && p.ids.every(id => p.F.get(id) === ZERO), crossing: { net: u25(r.xNet), negative: u25(r.xNeg), positive: u25(r.xPos) },
  lower1: u25(r.lower1), upper1: u25(r.upper1), width1: u25(r.upper1 - r.lower1), lower2: u25(r.lower2), upper2: u25(r.upper2), full: p.full });
const members = (p: Prep, f: Factors): CPlanningMember[] => p.ids.map(id => {
  const fixed = p.F.get(id)! * f.kf.get(id)!, s = p.shared.get(id)!;
  return { id, label: p.labels.get(id) ?? id, fixed: u25(fixed), zero: p.F.get(id) === ZERO, lower1: u25(fixed + s.neg * f.k3), upper1: u25(fixed + s.pos * f.k3) };
});
/** Internal only: the scope under the assumption still conserves (entry-level path = aggregate path). Never returned. */
function conserve(p: Prep, f: Factors) {
  let entryLevel = p.u.net * BASE, aggregate = p.total * BASE + (f.k3 - BASE) * (p.sums.inside + p.sums.crossing);
  for (const [id, v] of p.F) entryLevel += v * (p.group.has(id) ? f.kf.get(id)! : BASE);
  for (const r of p.s3) entryLevel += r.net * (r.e.candidates.some(c => p.group.has(c)) ? f.k3 : BASE);
  for (const id of p.ids) aggregate += p.F.get(id)! * (f.kf.get(id)! - BASE);
  need(entryLevel === aggregate, "C_PLANNING_CONSERVATION");
}

// ---------------------------------------------------------------- 4. labelled split scenarios (PC-08-A13)
type Weight = { cover: boolean; gn: bigint; on: bigint; d: bigint };
function weight(p: Prep, rule: CPlanningRule, shares: Record<string, number>, r: Pick<Entry, "set" | "inQ" | "out" | "e">): Weight {
  if (rule === "eq") return { cover: true, gn: BigInt(r.inQ.length), on: BigInt(r.out.length), d: BigInt(r.e.candidates.length) };
  if (rule === "user") { const s = shares[r.set]; return s === undefined ? { cover: false, gn: ZERO, on: ZERO, d: ONE } : { cover: true, gn: BigInt(s), on: BASE - BigInt(s), d: BASE }; }
  const plus = (ids: string[]) => ids.reduce((s, id) => { const f = p.F.get(id)!; return s + (f > ZERO ? f : ZERO); }, ZERO);
  const d = plus(r.e.candidates); return d === ZERO ? { cover: false, gn: ZERO, on: ZERO, d: ONE } : { cover: true, gn: plus(r.inQ), on: plus(r.out), d };
}
type SplitBase = { coveredEntries: number; coveredSets: Set<string>; coveredNet: bigint; group: Rat; outside: Rat; uncoveredEntries: number; uncoveredSets: Set<string>; uncNet: bigint; uncNeg: bigint; uncPos: bigint };
function splitBase(p: Prep, rule: CPlanningRule, shares: Record<string, number>): SplitBase {
  const out: SplitBase = { coveredEntries: 0, coveredSets: new Set(), coveredNet: ZERO, group: whole(ZERO), outside: whole(ZERO), uncoveredEntries: 0, uncoveredSets: new Set(), uncNet: ZERO, uncNeg: ZERO, uncPos: ZERO };
  const g: Rat[] = [], o: Rat[] = [];
  for (const r of p.crossing) {
    const w = weight(p, rule, shares, r);
    if (!w.cover) { out.uncoveredEntries++; out.uncoveredSets.add(r.set); out.uncNet += r.net; out.uncNeg += r.neg; out.uncPos += r.pos; continue; }
    // Conservation per entry: group share + outside share = c_r, with the two weights computed independently of d.
    need(w.gn + w.on === w.d && w.gn >= ZERO && w.on >= ZERO && r.net * w.gn + r.net * w.on === r.net * w.d, "C_PLANNING_SPLIT");
    out.coveredEntries++; out.coveredSets.add(r.set); out.coveredNet += r.net; g.push(ratio(r.net * w.gn, w.d)); o.push(ratio(r.net * w.on, w.d));
  }
  out.group = sum(g); out.outside = sum(o);
  need(cmp(sum([out.group, out.outside]), whole(out.coveredNet)) === 0, "C_PLANNING_SPLIT");
  return out;
}
/** Internal only, for R-EQ and R-PROP: allocating every S3 entry of the scope to all its candidates adds up to the S3 net. */
function scopeSplitCheck(p: Prep, rule: CPlanningRule, f: Factors) {
  if (rule === "user") return;
  const sets = new Map<string, { candidates: string[]; net: bigint }>();
  for (const r of p.s3) {
    const s = sets.get(r.set) ?? { candidates: r.set.split("+"), net: ZERO };
    s.net += r.net * (r.e.candidates.some(c => p.group.has(c)) ? f.k3 : BASE); sets.set(r.set, s);
  }
  const w = (c: string[]) => rule === "eq" ? c.map(() => ONE) : c.map(id => { const v = p.F.get(id)!; return v > ZERO ? v : ZERO; });
  let common = ONE; const seen = new Set<bigint>();
  for (const s of sets.values()) { const d = w(s.candidates).reduce((a, b) => a + b, ZERO); if (d > ZERO && !seen.has(d)) { seen.add(d); common *= d / gcd(common, d); } }
  const alloc = new Map(p.view.portfolios.map(x => [x.id, ZERO])); let total = ZERO, residual = ZERO;
  for (const s of sets.values()) {
    total += s.net; const ws = w(s.candidates), d = ws.reduce((a, b) => a + b, ZERO);
    if (d === ZERO) { residual += s.net; continue; }
    s.candidates.forEach((c, i) => alloc.set(c, alloc.get(c)! + s.net * ws[i] * (common / d)));
  }
  let allocated = ZERO; for (const v of alloc.values()) allocated += v;
  need(allocated === (total - residual) * common, "C_PLANNING_SPLIT");
  need(total === p.s3net * BASE + (f.k3 - BASE) * (p.sums.inside + p.sums.crossing), "C_PLANNING_SPLIT");
}
function band(p: Prep, base: SplitBase, r: Raw, f: Factors): CPlanningSplitBand {
  const group = scale(base.group, f.k3), point = sum([whole(r.reference), group]);
  const lower = sum([point, whole(base.uncNeg * f.k3)]), upper = sum([point, whole(base.uncPos * f.k3)]);
  need(cmp(whole(r.lower1), lower) <= 0 && cmp(lower, upper) <= 0 && cmp(upper, whole(r.upper1)) <= 0, "C_PLANNING_SPLIT_RANGE");
  return { lower: amount(lower), upper: amount(upper), complete: base.uncoveredEntries === 0,
    covered: { entries: base.coveredEntries, sets: base.coveredSets.size, net: u25(base.coveredNet * f.k3), group: amount(group), outside: amount(scale(base.outside, f.k3)) },
    uncovered: { entries: base.uncoveredEntries, sets: base.uncoveredSets.size, net: u25(base.uncNet * f.k3), negative: u25(base.uncNeg * f.k3), positive: u25(base.uncPos * f.k3) } };
}

function crossingSets(p: Prep, shares: Record<string, number>): CPlanningCrossingSet[] {
  const sets = new Map<string, { candidates: string[]; inGroup: string[]; entries: number; net: bigint; abs: bigint }>();
  for (const r of p.crossing) { const s = sets.get(r.set) ?? { candidates: r.set.split("+"), inGroup: r.set.split("+").filter(c => p.group.has(c)), entries: 0, net: ZERO, abs: ZERO }; s.entries++; s.net += r.net; s.abs += r.abs; sets.set(r.set, s); }
  return [...sets.entries()].sort(([a, x], [b, y]) => x.abs !== y.abs ? (y.abs > x.abs ? 1 : -1) : a < b ? -1 : a > b ? 1 : 0)
    .map(([set, s]) => ({ set, candidates: s.candidates, inGroup: s.inGroup, entries: s.entries, net: u25(s.net * BASE), abs: u25(s.abs * BASE), share: shares[set] ?? null }));
}

/** 5. Boundary-crossing S3 entries ranked by the verified cAttrPriority (no new ranking code). Each row's abs is the most
 * the group's L1 width can shrink when that product's indications are reviewed («fino a»). */
export const cPlanningRanking = (view: CPlanningView, ids: string[]): CPlanningRanking => rank(prepare(view, ids));
function rank(p: Prep): CPlanningRanking {
  const ranked = cAttrPriority({ ...p.view.scope, products: p.crossing.map(r => r.e) }, "S3", "", p.view.portfolios);
  need(A(ranked.total) === p.crossing.reduce((s, r) => s + r.abs, ZERO), "C_PLANNING_RANKING"); return ranked;
}

/** The whole workspace for one fetched view and one plan. C1 runs on first use of each scope object; any failed identity throws. */
export function cPlanningWorkspace(view: CPlanningView, plan: CPlanningPlan): CPlanningResult {
  cPlanningPlanCheck(plan);
  const p = prepare(view, plan.ids), base = observedFactors(p), observed = joint(p, base);
  const variantRows = plan.variants.map((v, i) => { const f = variantFactors(p, v); conserve(p, f); return { v, f, r: joint(p, f), i }; });
  const variants = variantRows.map(({ v, f, r, i }): CPlanningVariantResult => ({
    index: (i + 1) as 1 | 2, name: L.variants.names[i],
    assumption: { bps: v.bps, sharedBps: v.sharedBps ?? v.bps, fixedBps: Object.fromEntries(p.ids.map(id => [id, v.fixedBps[id] ?? v.bps])) },
    members: members(p, f), bounds: boundsText(p, r),
    effect: { reference: u25(r.reference - observed.reference), fixed: u25(r.fixed - observed.fixed), inside: u25(r.inside - observed.inside), lower: u25(r.lower1 - observed.lower1), upper: u25(r.upper1 - observed.upper1) },
  }));
  let split: CPlanningSplit | null = null;
  if (plan.rule) {
    const rule = plan.rule, s = splitBase(p, rule, plan.shares), present = new Set(p.crossing.map(r => r.set));
    scopeSplitCheck(p, rule, base); for (const { f } of variantRows) scopeSplitCheck(p, rule, f);
    split = { rule, observed: band(p, s, observed, base), variants: variantRows.map(({ f, r }) => band(p, s, r, f)), unusedShares: rule === "user" ? Object.keys(plan.shares).filter(k => !present.has(k)).sort() : [] };
  }
  const { period, org, channel } = view.scope;
  return { key: `${period}|${org}|${channel}|${p.ids.join(".")}`, scope: { period, org, channel, months: cPlanningMonths(period), partial: period.startsWith("JM") },
    ids: [...p.ids], partition: partition(p), members: members(p, base), observed: boundsText(p, observed), variants, split,
    crossingSets: crossingSets(p, plan.shares), ranking: rank(p) };
}
/** Whether a declared split figure is shown (PC-08-A13): a rule is set, the group shares entries with outside portfolios and the
 * rule covers at least one of them. Coverage does not depend on the variant, so one status holds for every column; the page and
 * the export both follow it. */
export type CPlanningSplitStatus = "off" | "nothing" | "uncovered" | "shown";
export const cPlanningSplitStatus = (r: Pick<CPlanningResult, "split" | "partition">): CPlanningSplitStatus =>
  !r.split ? "off" : !r.partition.crossingEntries ? "nothing" : !r.split.observed.covered.entries ? "uncovered" : "shown";

// ---------------------------------------------------------------- «Fuori da questa sezione»
/** The reviewer's vocabulary for the strip: the four Azienda keys and the aggregate key. */
const C_PLANNING_ACT_VOCABULARY = { orgs: C_ATTR_ORGS.filter(o => o !== "Regione"), aggregate: "Regione" } as const;
/** Budget and regional context strip, keyed on org|period|channel. `acts` holds "<Azienda key>|FY2024|CO"-style keys of
 * published departmental acts (Azienda, period, CO/DD/DPC); no amount ever enters. The aggregate key and Tutti match any
 * Azienda / channel. `vocabulary` names the Azienda keys and the aggregate key: the reviewer's by default, or an
 * organisation-scoped audience's (its unit keys and `aggregato`). */
export function cPlanningOutside(scope: { period: CAttrPeriod; org: string; channel: CAttrChannel }, acts: Iterable<string>, vocabulary: { orgs: readonly string[]; aggregate: string } = C_PLANNING_ACT_VOCABULARY) {
  const parsed = [...acts].map(k => { const m = typeof k === "string" ? /^([a-z0-9-]{1,12}|[A-Z]{2})\|(FY2024|FY2025|JM2025|JM2026)\|(CO|DD|DPC)$/.exec(k) : null; return m && vocabulary.orgs.includes(m[1]) ? { org: m[1], period: m[2], channel: m[3] } : fail("C_PLANNING_ACTS"); });
  const match = parsed.filter(a => a.period === scope.period && (scope.channel === "Tutti" || a.channel === scope.channel) && (scope.org === vocabulary.aggregate || a.org === scope.org));
  const orgs = vocabulary.orgs.filter(o => match.some(a => a.org === o)), status: "none" | "act" | "within" = !orgs.length ? "none" : scope.org === vocabulary.aggregate ? "within" : "act";
  return { key: `${scope.org}|${scope.period}|${scope.channel}`, status, orgs,
    budget: status === "none" ? [L.outside.budgetNone] : status === "act" ? [L.outside.budgetAct] : [L.outside.budgetWithin, L.outside.budgetWithinNote],
    regional: [L.outside.regional, L.outside.noLocalForecast, L.outside.selection] };
}

// ---------------------------------------------------------------- 6. URL codec
const INT = /^-?(?:0|[1-9]\d{0,4})$/, NONNEG = /^(?:0|[1-9]\d{0,4})$/;
const int = (text: string | undefined, min: number, max: number) => text === undefined || !INT.test(text) || text === "-0" ? null : Number(text) >= min && Number(text) <= max ? Number(text) : null;
function idsParse(text: string | null): string[] | null {
  if (text === null || text.length > 80) return null; const ids = text.split(".");
  try { idsCheck(ids); return ids; } catch { return null; }
}
const variantText = (v: CPlanningVariant) => [String(v.bps), ...(v.sharedBps === null ? [] : [`s${v.sharedBps}`]), ...Object.keys(v.fixedBps).sort().map(id => `${id}.${v.fixedBps[id]}`)].join("_");
function variantParse(text: string | null, ids: string[]): CPlanningVariant | null {
  if (text === null || text.length > 200) return null;
  const parts = text.split("_"), bps = int(parts[0], C_PLANNING_BPS_MIN, C_PLANNING_BPS_MAX); if (bps === null) return null;
  let i = 1, sharedBps: number | null = null, last = "";
  if (parts[i]?.startsWith("s")) { sharedBps = int(parts[i].slice(1), C_PLANNING_BPS_MIN, C_PLANNING_BPS_MAX); if (sharedBps === null) return null; i++; }
  const fixedBps: Record<string, number> = {};
  for (; i < parts.length; i++) {
    const m = /^([A-Z0-9]{2,12})\.(-?\d{1,5})$/.exec(parts[i]); if (!m || m[1] <= last || !ids.includes(m[1])) return null;
    const b = int(m[2], C_PLANNING_BPS_MIN, C_PLANNING_BPS_MAX); if (b === null) return null; fixedBps[m[1]] = b; last = m[1];
  }
  return { bps, sharedBps, fixedBps };
}
const sharesText = (shares: Record<string, number>) => Object.keys(shares).sort().map(k => `${k.split("+").join("-")}.${shares[k]}`).join("_");
function sharesParse(text: string | null, ids: string[]): Record<string, number> | null {
  if (text === null || text.length > 4000) return null;
  const out: Record<string, number> = {}; let last = "";
  for (const token of text.split("_")) {
    const m = /^([A-Z0-9]{2,12}(?:-[A-Z0-9]{2,12})+)\.(\d{1,5})$/.exec(token); if (!m || !NONNEG.test(m[2])) return null;
    const key = m[1].split("-").join("+"); if (key <= last) return null; out[key] = Number(m[2]); last = key;
  }
  try { sharesCheck(out, ids); return out; } catch { return null; }
}
/** Reads the planning state. The scope comes from the dossier keys (c_port_*, same defaults as the dossier); the group
 * defaults to c_port_id, then ONC. An invalid c_plan_* value falls back to its default and is listed in `invalid`. */
export function cPlanningFilters(search: string | URLSearchParams): { state: CPlanningState; invalid: string[] } {
  const q = new URLSearchParams(search), invalid: string[] = [];
  const period = C_ATTR_PERIODS.includes(q.get("c_port_period") as CAttrPeriod) ? q.get("c_port_period") as CAttrPeriod : "FY2025";
  const org = C_ATTR_ORGS.includes(q.get("c_port_org") as CAttrOrg) ? q.get("c_port_org") as CAttrOrg : "Regione";
  const channel = C_ATTR_CHANNELS.includes(q.get("c_port_channel") as CAttrChannel) ? q.get("c_port_channel") as CAttrChannel : "Tutti";
  let ids = idsParse(q.get("c_plan_ids"));
  if (!ids) { if (q.has("c_plan_ids")) invalid.push("c_plan_ids"); const dossier = q.get("c_port_id") ?? ""; ids = ID.test(dossier) ? [dossier] : ["ONC"]; }
  const variants: CPlanningVariant[] = [];
  const v1 = q.has("c_plan_v1") ? variantParse(q.get("c_plan_v1"), ids) : null;
  if (q.has("c_plan_v1") && !v1) invalid.push("c_plan_v1"); if (v1) variants.push(v1);
  if (q.has("c_plan_v2")) { const v2 = v1 ? variantParse(q.get("c_plan_v2"), ids) : null; if (v2) variants.push(v2); else invalid.push("c_plan_v2"); }
  const raw = q.get("c_plan_split"), rule = C_PLANNING_RULES.includes(raw as CPlanningRule) ? raw as CPlanningRule : null;
  if (raw !== null && !rule) invalid.push("c_plan_split");
  const shares = q.has("c_plan_shares") ? sharesParse(q.get("c_plan_shares"), ids) : {};
  if (!shares) invalid.push("c_plan_shares");
  return { state: { period, org, channel, ids, variants, rule, shares: shares ?? {} }, invalid };
}
/** Writes the plan into the query string: only c_plan_* keys change; every other key (c_port_*, c_attr_*, …) is kept as is.
 * Throws on an invalid plan, so it never writes a URL that cPlanningFilters would reject. */
export function cPlanningSearch(search: string | URLSearchParams, plan: CPlanningPlan): string {
  cPlanningPlanCheck(plan); const q = new URLSearchParams(search);
  q.set("c_plan_ids", plan.ids.join("."));
  plan.variants.forEach((v, i) => q.set(`c_plan_v${i + 1}`, variantText(v))); for (let i = plan.variants.length; i < C_PLANNING_MAX_VARIANTS; i++) q.delete(`c_plan_v${i + 1}`);
  if (plan.rule) q.set("c_plan_split", plan.rule); else q.delete("c_plan_split");
  if (Object.keys(plan.shares).length) q.set("c_plan_shares", sharesText(plan.shares)); else q.delete("c_plan_shares");
  const s = q.toString(); return s ? `?${s}` : "";
}
/** Link from the dossier card: the dossier portfolio becomes the group; variants keep their values without overrides of other
 * portfolios, and shares that no longer cross the group are dropped. A slider value other than 0 replaces the variants with
 * one variant at that value on the single-portfolio part alone (shared spend at k = 1, as on the card), so the workspace
 * reproduces the card's reference, change and interval; the link text says so (L.section.dossierLinkWith, dossierReplaces).
 * Returns "?…#scenari". */
export function cPlanningDossierHref(search: string | URLSearchParams, portfolioId: string, sliderBps = 0): string {
  const plan = cPlanningRegroup(cPlanningFilters(search).state, [portfolioId]);
  return `${cPlanningSearch(search, sliderBps === 0 ? plan : { ...plan, variants: [{ bps: sliderBps, sharedBps: 0, fixedBps: {} }] })}#scenari`;
}
/** The plan for another group: overrides of portfolios that left and shares whose set no longer crosses the group are
 * dropped, everything else is kept. Throws C_PLANNING_GROUP for an invalid group. */
export function cPlanningRegroup(plan: CPlanningPlan, ids: string[]): CPlanningPlan {
  idsCheck(ids); const group = new Set(ids);
  return { ids: [...ids], rule: plan.rule,
    variants: plan.variants.map(v => ({ bps: v.bps, sharedBps: v.sharedBps, fixedBps: Object.fromEntries(Object.entries(v.fixedBps).filter(([id]) => group.has(id))) })),
    shares: Object.fromEntries(Object.entries(plan.shares).filter(([k]) => crosses(k.split("+"), group))) };
}

/// ---------------------------------------------------------------- 7. JSON export (local draft, labelled for its audience)
/** A labelled value as the page shows it. `value` is null exactly where the page reads `note` instead of a zero amount (A12 item 9). */
export type CPlanningExportValue = { label: string; value: CPlanningAmount | null; note?: string };
export type CPlanningExportRange = { label: string; lower: CPlanningAmount; upper: CPlanningAmount };
export type CPlanningExportSplitRow = { label: string; lower: CPlanningAmount; upper: CPlanningAmount; complete: boolean };
export type CPlanningExport = {
  schema: "pillar-c-planning-scenarios-v1"; mode: "local-export-only"; status: "bozza-locale"; confidentiality: string; exportedAt: string;
  source: { sourceSha256: string; classificationSha256: string; mappingVersion: string; mappingStatus: "bozza"; sourceSnapshot: string };
  scope: { period: CAttrPeriod; org: CAttrOrg; channel: CAttrChannel; months: 12 | 5; duration: string };
  group: { id: string; label: string }[];
  assumptions: { variants: { name: string; percent: string; sharedPercent: string; fixedPercent: Record<string, string> }[]; split: { rule: CPlanningRule | null; admission: string | null; sharesPercent: Record<string, string> } };
  results: {
    observed: { layer: string; partition: (CPlanningExportValue & { part: CPlanningPart; id: string | null; entries: number | null })[]; total: CPlanningExportValue; crossingAbs: CPlanningExportValue;
      reference: CPlanningExportValue; interval: CPlanningExportRange; width: CPlanningExportValue; l2: CPlanningExportRange | null; members: (CPlanningExportRange & { id: string })[] };
    variants: { name: string; layer: string; caption: string; reference: CPlanningExportValue; interval: CPlanningExportRange; l2: CPlanningExportRange | null; effect: CPlanningExportValue; members: (CPlanningExportRange & { id: string; fixed: CPlanningExportValue })[] }[];
    split: { label: string; rule: CPlanningRule; ruleLabel: string; coveredEntries: number; uncoveredEntries: number; observed: CPlanningExportSplitRow; variants: (CPlanningExportSplitRow & { name: string })[] } | null;
  };
  statements: string[];
};
/** The fixed sentences the page shows for one result, in page order; the export carries exactly these (render-tested). */
export function cPlanningStatements(r: CPlanningResult): string[] {
  const status = cPlanningSplitStatus(r), rule = r.split?.rule ?? null, variants = r.variants.length > 0;
  return [...(r.scope.partial ? [cPlanningPartialText(r.scope.period)!] : []), ...(rule ? [C_PLANNING_RULE_NOTES[rule]] : []),
    ...(rule === "user" && r.crossingSets.length && r.split!.unusedShares.length ? [L.split.unused] : []),
    ...(r.observed.full ? [L.bounds.full] : []), L.observed.footer, ...C_PLANNING_READING,
    ...(variants || rule ? [L.variants.scenario] : []), ...(variants ? [L.section.duration] : []),
    ...(status === "nothing" ? [L.split.nothing] : status === "uncovered" ? [L.split.noneCovered] : status === "shown" ? [L.split.statement, L.split.inside, L.split.noEffect, ...(rule === "prop" ? [L.split.propZero, L.split.propWeights] : [])] : []),
    ...(variants ? [L.variants.compact, L.variants.unvaried] : []), L.outside.regional];
}
const shownValue = (label: string, value: CPlanningAmount, zero: boolean): CPlanningExportValue => zero ? { label, value: null, note: L.observed.zeroFixed } : { label, value };
const l2Row = (b: CPlanningBounds): CPlanningExportRange | null => b.full ? null : { label: L.bounds.l2, lower: b.lower2, upper: b.upper2 };
const splitRow = (b: CPlanningSplitBand): CPlanningExportSplitRow => ({ label: L.split.result, lower: b.lower, upper: b.upper, complete: b.complete });
/** Builds the JSON export from the same engine and the same state as the page (PC-08-A13 item 7). It carries the confidentiality
 * label, the source identity (with sourceSnapshot and the mapping version), every assumption and, each under its page label,
 * only the values the page shows: the observed partition and group interval, each variant's reference, interval, L2 line,
 * effect and members, and the split rows only when the page shows a split. Never the outside remainder of a split, the
 * uncovered envelopes, endpoint differences, product rows, or a scope total under assumption. Shown values can still add up to
 * one in particular cases (e.g. a split covering every crossing entry plus the observed parts outside the group), as on the page.
 * `confidentiality` is the label shown beside the export button: the reviewers' by default, or the label of an
 * organisation-scoped audience. */
export function cPlanningExport(view: CPlanningView, state: CPlanningState, exportedAt: string, confidentiality: string = L.section.confidentiality): CPlanningExport {
  need(typeof exportedAt === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(exportedAt), "C_PLANNING_EXPORT");
  need(typeof confidentiality === "string" && confidentiality.trim().length > 0 && confidentiality.length <= 300 && !/[\u0000-\u001f\u007f]/.test(confidentiality), "C_PLANNING_EXPORT");
  need(state.period === view.scope.period && state.org === view.scope.org && state.channel === view.scope.channel, "C_PLANNING_EXPORT");
  need(/^[a-f0-9]{64}$/.test(view.sourceSnapshot ?? ""), "C_PLANNING_EXPORT");
  const r = cPlanningWorkspace(view, { ids: state.ids, variants: state.variants, rule: state.rule, shares: state.shares });
  const shares = state.rule === "user" ? state.shares : {}, o = r.observed, many = r.members.length > 1, split = cPlanningSplitStatus(r) === "shown" ? r.split : null;
  return {
    schema: "pillar-c-planning-scenarios-v1", mode: "local-export-only", status: "bozza-locale", confidentiality, exportedAt,
    source: { sourceSha256: view.sourceSha256, classificationSha256: view.classificationSha256, mappingVersion: view.mappingVersion, mappingStatus: "bozza", sourceSnapshot: view.sourceSnapshot },
    scope: { period: r.scope.period, org: r.scope.org, channel: r.scope.channel, months: r.scope.months, duration: L.section.duration },
    group: r.members.map(m => ({ id: m.id, label: m.label })),
    assumptions: {
      variants: r.variants.map(v => ({ name: v.name, percent: bpsDecimal(v.assumption.bps), sharedPercent: bpsDecimal(v.assumption.sharedBps), fixedPercent: Object.fromEntries(Object.entries(v.assumption.fixedBps).map(([id, b]) => [id, bpsDecimal(b)])) })),
      split: { rule: state.rule, admission: state.rule ? C_PLANNING_ADMISSION : null, sharesPercent: Object.fromEntries(Object.keys(shares).sort().map(k => [k, bpsDecimal(shares[k])])) },
    },
    results: {
      observed: { layer: L.observed.chip, partition: r.partition.rows.map(x => ({ part: x.part, id: x.id, ...shownValue(L.observed[x.part], x.value, x.part === "fixed" && x.zero), entries: x.entries })),
        total: { label: L.observed.total, value: r.partition.total }, crossingAbs: { label: L.observed.crossingAbs, value: r.partition.crossingAbs },
        reference: shownValue(L.bounds.reference, o.reference, o.referenceZero), interval: { label: L.bounds.joint, lower: o.lower1, upper: o.upper1 }, width: { label: L.bounds.width, value: o.width1 }, l2: l2Row(o),
        members: many ? r.members.map(m => ({ id: m.id, label: L.bounds.member, lower: m.lower1, upper: m.upper1 })) : [] },
      variants: r.variants.map(v => ({ name: v.name, layer: L.variants.chip, caption: L.variants.compact, reference: shownValue(L.variants.reference, v.bounds.reference, v.bounds.referenceZero),
        interval: { label: L.variants.interval, lower: v.bounds.lower1, upper: v.bounds.upper1 }, l2: l2Row(v.bounds), effect: { label: L.variants.effect, value: v.effect.reference },
        members: many ? v.members.map(m => ({ id: m.id, label: L.variants.members, lower: m.lower1, upper: m.upper1, fixed: shownValue(L.variants.fixedPart, m.fixed, m.zero) })) : [] })),
      split: split && { label: L.split.result, rule: split.rule, ruleLabel: L.split[split.rule], coveredEntries: split.observed.covered.entries, uncoveredEntries: split.observed.uncovered.entries,
        observed: splitRow(split.observed), variants: split.variants.map((b, i) => ({ name: r.variants[i].name, ...splitRow(b) })) },
    },
    statements: cPlanningStatements(r),
  };
}
export const cPlanningExportName = (state: CPlanningState) => `vis-scenari-${state.period}-${state.org}-${state.channel}-${state.ids.join("-")}.json`;
