// The regional comparator for an ordinary Azienda (PB-V5-01): when the page
// asks for it, how its answer is read, and the Italian that explains it.
//
// PURE. The database function (migration 20261009120000) derives the caller's
// Azienda and Region from the session, applies the disclosure rule and returns
// pooled PERCENTAGES only; this module never sees an amount, a peer's code or
// name, or a count, and it refuses an answer of any other shape rather than
// show part of it.
//
// WHEN IT IS ASKED. Only for an Azienda account: a Regione and a platform
// reviewer read the Region's Aziende directly and keep their own comparator.
// Only without a channel or molecule filter: the comparator's scope is fixed
// (CO, DD and DPC together, whole biosimilar perimeter), because finer selections could
// be combined to single out another Azienda. Only for the comparable years.

import { PILLAR_B_YEARS } from "@/lib/dashboard-review/pillar-b/review-data";

export const REGIONAL_CHANNELS = ["CO", "DD", "DPC"] as const;
export type RegionalChannel = typeof REGIONAL_CHANNELS[number];

/** One pooled share, or why there is none. Never a zero standing in for "none". */
export type RegionalShare =
  | { available: true; share: number }
  | { available: false; why: string };

export interface RegionalMixYear {
  year: number;
  /** Each channel's share of the Region's reported spend on CO, DD and DPC in the year; null when withheld. */
  shares: Record<RegionalChannel, number> | null;
  why: string | null;
}

export type RegionalComparator =
  | { kind: "answered"; years: number[]; quota1: RegionalShare; quota2: RegionalShare; mix: RegionalMixYear[] }
  | { kind: "unavailable"; why: string };

// ------------------------------------------------------------------ wording

export const REGIONAL_LABEL = "Regione";

/**
 * The regional quota 2 is NOT the Region's own quota 2: each Azienda counts
 * from its own first use (as the reader's own card does), where a Regione
 * account's Region counts from the first use by any Azienda. The label says so.
 */
export const REGIONAL_QUOTA2_LABEL = "Regione, ciascuna Azienda dal proprio primo uso";

/** How the regional quotas are formed, said once beside the two cards. */
export const REGIONAL_UPTAKE_METHOD =
  "Regione: tutte le Aziende della Regione, compresa la tua. Ogni quota regionale è il rapporto tra la somma dei " +
  "numeratori e la somma dei denominatori di tutte le Aziende, non la media delle loro percentuali; stessi anni, " +
  "tutti i canali e l'intero perimetro biosimilare. Nella quota 2 ogni Azienda conta dai propri mesi di primo uso " +
  "locale, come per la tua; per questo non coincide con la quota 2 calcolata per la Regione nel suo insieme, che " +
  "conta dal primo uso della prima Azienda, e un'Azienda che non ha mai dispensato il biosimilare di una sostanza " +
  "non entra nella quota 2 regionale per quella sostanza. Una differenza dalla Regione può dipendere anche dalle " +
  "molecole su cui si concentra la spesa, non solo dall'adozione: non indica un risultato migliore o peggiore. Della " +
  "Regione sono mostrate solo quote: nessun importo e nessun valore di una singola altra Azienda.";

/** The same for the channel mix. */
export const REGIONAL_MIX_METHOD =
  "Sotto la barra della tua Azienda, la Regione nello stesso anno: tutte le Aziende della Regione, compresa la tua, " +
  "con la spesa sommata prima di calcolare le quote (non la media delle quote aziendali). Per la Regione solo " +
  "quote, nessun importo.";

export const REGIONAL_FILTER_NOTE =
  "Il confronto con la Regione è mostrato solo senza filtri di canale o di molecola: è calcolato su tutti i canali e " +
  "sull'intero perimetro, perché selezioni più fini potrebbero rendere riconoscibili i dati di singole Aziende.";

export const REGIONAL_NOT_DEPLOYED = "Il confronto con la Regione non è ancora disponibile.";

export const REGIONAL_FAILED = "Il confronto con la Regione non è disponibile in questo momento.";

/** Both regional quotas are shown, or neither: the page reads its two quotas only together. */
const pairWithheld = (which: 1 | 2) =>
  `non disponibile (le due quote regionali si mostrano solo insieme, e in questo periodo la quota ${which} regionale non è disponibile)`;

const REASONS: Record<string, string> = {
  // The disclosure rule failed: fewer than two of the other Aziende have the
  // amount, one of them prevails, or one has a negative (adjusted) amount.
  cell_rule:
    "non disponibile (per tutela dei dati delle altre Aziende il valore regionale si mostra solo se almeno due di " +
    "esse vi contribuiscono, nessuna prevale e nessuna ha importi negativi per rettifiche: in questo periodo non è così)",
  not_computable: "non calcolabile (importi regionali del periodo assenti, nulli o negativi per rettifiche)",
};

const STATUSES: Record<string, string> = {
  no_release: REGIONAL_FAILED,
  invalid_filter: "Il confronto con la Regione non è disponibile per il periodo selezionato.",
  no_session: "Il confronto con la Regione non è disponibile per questo accesso.",
  no_membership: "Il confronto con la Regione non è disponibile per questo accesso.",
  ambiguous_membership: "Il confronto con la Regione non è disponibile per questo accesso.",
  not_an_azienda: "Il confronto con la Regione non è disponibile per questo accesso.",
  no_region: "Il confronto con la Regione non è disponibile: l'Azienda non ha una Regione registrata.",
  unresolved_rows: REGIONAL_FAILED,
  unexpected_channel: REGIONAL_FAILED,
};

/** Every sentence this module can put on the page, for the copy checks. */
export function regionalSentences(): string[] {
  return [
    REGIONAL_LABEL, REGIONAL_QUOTA2_LABEL, REGIONAL_UPTAKE_METHOD, REGIONAL_MIX_METHOD, REGIONAL_FILTER_NOTE,
    REGIONAL_NOT_DEPLOYED, REGIONAL_FAILED, pairWithheld(1), pairWithheld(2),
    ...Object.values(REASONS), ...Object.values(STATUSES),
  ];
}

const lookup = (table: Record<string, string>, key: unknown): string | null =>
  typeof key === "string" && Object.hasOwn(table, key) ? table[key] : null;

// ----------------------------------------------------------------- request

export type RegionalRequest =
  | { ask: true; years: number[] }
  | { ask: false; note: string | null };

/**
 * Whether the page asks for the comparator, and what it says when it does not.
 * A Regione or a reviewer is never asked for (no note: they have their own).
 */
export function regionalComparatorRequest(input: {
  aziendaAccount: boolean;
  years: ReadonlyArray<number>;
  channels: ReadonlyArray<string>;
  substance: string | null;
}): RegionalRequest {
  if (!input.aziendaAccount) return { ask: false, note: null };
  if (input.channels.length > 0 || input.substance !== null) return { ask: false, note: REGIONAL_FILTER_NOTE };
  const years = [...new Set(input.years)].sort((a, b) => a - b);
  if (years.length === 0 || !years.every((y) => (PILLAR_B_YEARS as ReadonlyArray<number>).includes(y))) {
    return { ask: false, note: STATUSES.invalid_filter };
  }
  return { ask: true, years };
}

// ------------------------------------------------------------------ parsing

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isShare = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;
/** Exactly these keys, no more and no fewer. */
const hasKeys = (v: Record<string, unknown>, keys: ReadonlyArray<string>): boolean => {
  const own = Object.keys(v);
  return own.length === keys.length && keys.every((k) => Object.hasOwn(v, k));
};

function share(v: unknown): RegionalShare | null {
  if (!isObject(v) || !hasKeys(v, ["available", "reason", "share"])) return null;
  if (v.available === true) return v.reason === null && isShare(v.share) ? { available: true, share: v.share } : null;
  if (v.available === false && v.share === null) {
    const why = lookup(REASONS, v.reason);
    return why === null ? null : { available: false, why };
  }
  return null;
}

function mixYear(v: unknown): RegionalMixYear | null {
  if (!isObject(v) || !hasKeys(v, ["year", "available", "reason", "shares"]) || typeof v.year !== "number") return null;
  if (v.available === false) {
    const why = lookup(REASONS, v.reason);
    return v.shares === null && why !== null ? { year: v.year, shares: null, why } : null;
  }
  if (v.available !== true || v.reason !== null || !isObject(v.shares) || !hasKeys(v.shares, REGIONAL_CHANNELS)) return null;
  const shares = {} as Record<RegionalChannel, number>;
  for (const c of REGIONAL_CHANNELS) {
    const s = v.shares[c];
    if (!isShare(s)) return null;
    shares[c] = s;
  }
  const sum = REGIONAL_CHANNELS.reduce((t, c) => t + shares[c], 0);
  if (Math.abs(sum - 1) > 1e-9) return null;
  return { year: v.year, shares, why: null };
}

/**
 * Reads the function's jsonb for the years the page asked for. Anything other
 * than the documented shape — an unexpected key, a numeric string, a share
 * outside 0-1, channel shares not summing to 100%, other years — becomes
 * "unavailable": a partly understood answer is not shown.
 */
export function parseRegionalComparator(raw: unknown, askedYears: ReadonlyArray<number>): RegionalComparator {
  const invalid: RegionalComparator = { kind: "unavailable", why: REGIONAL_FAILED };
  if (!isObject(raw) || typeof raw.status !== "string") return invalid;
  if (raw.status !== "ok") return { kind: "unavailable", why: lookup(STATUSES, raw.status) ?? REGIONAL_FAILED };
  if (!hasKeys(raw, ["status", "years", "uptake", "channel_mix"])) return invalid;
  const years = Array.isArray(raw.years) ? raw.years : null;
  const asked = [...new Set(askedYears)].sort((a, b) => a - b);
  if (!years || years.length !== asked.length || !years.every((y, i) => y === asked[i])) return invalid;
  if (!isObject(raw.uptake) || !hasKeys(raw.uptake, ["quota1", "quota2"]) || !Array.isArray(raw.channel_mix)) return invalid;
  const quota1 = share(raw.uptake.quota1), quota2 = share(raw.uptake.quota2);
  const mix = raw.channel_mix.map(mixYear);
  if (!quota1 || !quota2 || mix.some((m) => m === null)) return invalid;
  const mixYears = (mix as RegionalMixYear[]).map((m) => m.year);
  if (mixYears.length !== asked.length || !mixYears.every((y, i) => y === asked[i])) return invalid;
  return { kind: "answered", years: asked, quota1, quota2, mix: mix as RegionalMixYear[] };
}

// ------------------------------------------------------------- view props

/** What the two quota cards receive: a regional line each, or a note. */
export interface RegionalUptakeProps {
  quota1: RegionalShare | null;
  quota2: RegionalShare | null;
  /** The method when answered; why not, otherwise. */
  note: string;
}

/** What the channel-mix card receives: share-only regional bars per year, or a note. */
export interface RegionalMixProps {
  label: string;
  years: RegionalMixYear[] | null;
  note: string;
}

/**
 * The page's view of an answer. The two quotas are shown together or not at
 * all, as the Azienda's own are ("Le due quote si leggono solo insieme"): the
 * database answers each on its own parts, the page pairs them.
 */
export function regionalViewProps(state: RegionalComparator | { kind: "note"; why: string }): {
  uptake: RegionalUptakeProps; mix: RegionalMixProps;
} {
  if (state.kind === "answered") {
    const both = state.quota1.available && state.quota2.available;
    const q1: RegionalShare = both || !state.quota1.available ? state.quota1 : { available: false, why: pairWithheld(2) };
    const q2: RegionalShare = both || !state.quota2.available ? state.quota2 : { available: false, why: pairWithheld(1) };
    return {
      uptake: { quota1: q1, quota2: q2, note: REGIONAL_UPTAKE_METHOD },
      mix: { label: REGIONAL_LABEL, years: state.mix, note: REGIONAL_MIX_METHOD },
    };
  }
  return {
    uptake: { quota1: null, quota2: null, note: state.why },
    mix: { label: REGIONAL_LABEL, years: null, note: state.why },
  };
}
