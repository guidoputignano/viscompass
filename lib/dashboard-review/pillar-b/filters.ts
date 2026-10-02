// The Pillar B filter model, shared by every section of the review page.
//
// PURE. URL params in, a typed state out; a typed state in, a URL out. Nothing
// here touches a database or a session, which is what lets the harness and the
// unit tests exercise the exact parsing the page runs.
//
// THE STATE LIVES IN THE URL AND IS APPLIED SERVER-SIDE. Changing a filter is a
// navigation; the server re-queries with the narrowed scope; the browser never
// receives rows it then filters locally. That is what keeps an Azienda from
// holding another Azienda's ledger, and it is why every control on the page
// writes a URL rather than mutating a client-side dataset.
//
// WHAT CANNOT BE EXPRESSED, by construction:
//   - 2026 as a year. It holds five months and zero comparable-eligible rows,
//     so it is not a term in any comparison. `?anno=2026` is dropped, and the
//     type has no member for it.
//   - an empty set of years. "No year" would be a null to the RPC, and the RPC
//     refuses a null for the same reason.
//   - an Azienda the server did not list. `ambito` is accepted only against the
//     codes the caller is actually allowed to narrow to; anything else is
//     ignored, not forwarded.

export const PILLAR_B_CHANNELS = ["CO", "DD", "DPC"] as const;
export type PillarBChannel = (typeof PILLAR_B_CHANNELS)[number];

export const PILLAR_B_FILTER_YEARS = [2024, 2025] as const;
export type PillarBFilterYear = (typeof PILLAR_B_FILTER_YEARS)[number];

export interface PillarBFilters {
  /** Never empty, never 2026. Both years is the default. */
  years: ReadonlyArray<PillarBFilterYear>;
  /** Subset of PILLAR_B_CHANNELS. Empty means all three. */
  channels: ReadonlyArray<PillarBChannel>;
  substance: string | null;
  /** org_code of one Azienda ("201"), or null for the whole visible perimeter. */
  asl: string | null;
}

export const DEFAULT_PILLAR_B_FILTERS: PillarBFilters = {
  years: PILLAR_B_FILTER_YEARS,
  channels: [],
  substance: null,
  asl: null,
};

type Params = Record<string, string | string[] | undefined>;

function one(params: Params, key: string): string | null {
  const v = params[key];
  const s = Array.isArray(v) ? v[0] : v;
  return s === undefined || s === "" ? null : s;
}

/**
 * Parse the URL.
 *
 * @param allowedAsl the org_codes this caller may narrow to. The page derives
 *   it from the resolved scope, so an Azienda's list is empty and a Regione's
 *   is its own ASLs. A code outside the list is dropped silently: forwarding it
 *   would be harmless under RLS but would render a scope line naming an
 *   Azienda the reader cannot see.
 */
export function parsePillarBFilters(
  params: Params,
  allowedAsl: ReadonlyArray<string> = [],
): PillarBFilters {
  const rawYear = one(params, "anno");
  const years: ReadonlyArray<PillarBFilterYear> =
    rawYear === "2024" ? [2024] : rawYear === "2025" ? [2025] : PILLAR_B_FILTER_YEARS;

  const rawChannels = one(params, "canale");
  const channels = rawChannels === null
    ? []
    : (rawChannels.split(",")
        .map((c) => c.trim())
        .filter((c): c is PillarBChannel =>
          (PILLAR_B_CHANNELS as readonly string[]).includes(c)));
  // Selecting all three is the same as selecting none; normalise so the URL and
  // the scope line do not have two spellings of "every channel".
  const uniqueChannels = [...new Set(channels)];
  const channelsOrAll = uniqueChannels.length === PILLAR_B_CHANNELS.length ? [] : uniqueChannels;

  const rawAsl = one(params, "ambito");
  const asl = rawAsl !== null && allowedAsl.includes(rawAsl) ? rawAsl : null;

  return { years, channels: channelsOrAll, substance: one(params, "molecola"), asl };
}

/**
 * A shareable URL. Absent keys mean "all".
 *
 * @param keep entries to carry unchanged (the panel-local view options, which
 *   are not filters and must survive a filter change). They never override a
 *   filter key.
 */
export function pillarBHref(
  base: string, state: PillarBFilters, patch: Partial<PillarBFilters>, keep?: URLSearchParams,
): string {
  const next: PillarBFilters = { ...state, ...patch };
  const q = new URLSearchParams();
  if (next.years.length === 1) q.set("anno", String(next.years[0]));
  if (next.channels.length > 0 && next.channels.length < PILLAR_B_CHANNELS.length) {
    q.set("canale", next.channels.join(","));
  }
  if (next.substance !== null) q.set("molecola", next.substance);
  if (next.asl !== null) q.set("ambito", next.asl);
  const FILTER_KEYS = new Set(["anno", "canale", "molecola", "ambito"]);
  keep?.forEach((v, k) => { if (!FILTER_KEYS.has(k) && v !== "") q.set(k, v); });
  const s = q.toString();
  return s === "" ? base : `${base}?${s}`;
}

/** Toggle one channel in or out of the selection. */
export function toggleChannel(
  state: PillarBFilters, channel: PillarBChannel,
): ReadonlyArray<PillarBChannel> {
  const current = state.channels.length === 0 ? [...PILLAR_B_CHANNELS] : [...state.channels];
  const next = current.includes(channel)
    ? current.filter((c) => c !== channel)
    : [...current, channel];
  // Deselecting the last channel would mean "nothing", which no view can show.
  // Treat it as "all" instead, which is what a reader who clears every box
  // most plausibly wants.
  if (next.length === 0 || next.length === PILLAR_B_CHANNELS.length) return [];
  return PILLAR_B_CHANNELS.filter((c) => next.includes(c));
}

export function activePillarBFilterCount(state: PillarBFilters): number {
  return (state.years.length === 1 ? 1 : 0)
    + (state.channels.length > 0 ? 1 : 0)
    + (state.substance !== null ? 1 : 0)
    + (state.asl !== null ? 1 : 0);
}

/**
 * The selection in words, for the scope line.
 *
 * @param aslLabel how to name the narrowed Azienda. The page passes the
 *   display name already resolved against the pseudonym rule, so this module
 *   never sees a real name it should not print.
 */
export function describePillarBFilters(
  state: PillarBFilters, aslLabel: string | null = null,
): string {
  const parts: string[] = [];
  parts.push(aslLabel ?? "intero perimetro visibile");
  parts.push(state.years.length === 1 ? String(state.years[0]) : "2024 e 2025");
  parts.push(state.channels.length === 0 ? "tutti i canali" : state.channels.join(" + "));
  if (state.substance !== null) parts.push(state.substance);
  return parts.join(" · ");
}

// ------------------------------------------------------- asl_code <-> org_code

/**
 * canonical_fact.asl_code is region-prefixed ("130201"); memberships and the
 * pseudonym table key on the bare org_code ("201"). The RLS policy accepts
 * both forms; the application must translate explicitly rather than assume.
 */
export function aslCodeFor(orgCode: string, regionCode: string): string {
  return orgCode.startsWith(regionCode) && orgCode.length > regionCode.length
    ? orgCode
    : `${regionCode}${orgCode}`;
}

export function orgCodeFromAsl(aslCode: string, regionCode: string): string {
  return aslCode.startsWith(regionCode) && aslCode.length > regionCode.length
    ? aslCode.slice(regionCode.length)
    : aslCode;
}

/** The years as the RPC wants them: an explicit array, never null. */
export function yearsArg(state: PillarBFilters): number[] {
  return [...state.years];
}

/** The channels as the RPC wants them: null for all, else the subset. */
export function channelsArg(state: PillarBFilters): string[] | null {
  return state.channels.length === 0 ? null : [...state.channels];
}

// ------------------------------------------------- Azienda keys in the URL

/**
 * The key an Azienda carries in the URL (`ambito`) and in the filter bar.
 *
 * A reviewer sees real names, so the org_code is fine. Everyone else sees
 * pseudonyms, and an org_code beside "ASL 1" is no pseudonym: 201-204 are
 * public codes. For them the key is derived from the label they already see
 * ("asl-1"), and the server maps it back. Keys are unique within the list;
 * a collision falls back to a positional key, never to the code.
 */
export function aziendaKeys(
  orgs: ReadonlyArray<{ orgCode: string; label: string }>, realNames: boolean,
): Map<string, string> {
  const out = new Map<string, string>();
  const used = new Set<string>();
  orgs.forEach((o, i) => {
    let key = realNames
      ? o.orgCode
      : o.label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!key || used.has(key)) key = `azienda-${i + 1}`;
    used.add(key);
    out.set(o.orgCode, key);
  });
  return out;
}
