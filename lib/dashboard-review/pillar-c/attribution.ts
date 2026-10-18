/** Aggregated therapeutic uncertainty, never an observed department allocation. */
export const C_ATTR_PERIODS = ["FY2024", "FY2025", "JM2025", "JM2026"] as const;
export const C_ATTR_ORGS = ["Regione", "AQ", "CH", "PE", "TE"] as const;
export const C_ATTR_CHANNELS = ["Tutti", "CO", "DD", "DPC"] as const;
export const C_ATTR_STATES = ["S2", "S3", "S4", "S5"] as const;
export type CAttrPeriod = typeof C_ATTR_PERIODS[number];
export type CAttrOrg = typeof C_ATTR_ORGS[number];
export type CAttrChannel = typeof C_ATTR_CHANNELS[number];
export type CAttrState = typeof C_ATTR_STATES[number];
export type CAttrStats = { n: number; net: string; abs: string; positive: string; negative: string };
export type CAttrPortfolio = { id: string; label: string; kind: string };
export type CAttrProduct = CAttrStats & { key: string; label: string; atc: string; state: Exclude<CAttrState, "S2">; candidates: string[] };
export type CAttrBound = { id: string; fixed: string; shared: CAttrStats; lower1: string; upper1: string; lower2: string; upper2: string };
export type CAttrScope = {
  period: CAttrPeriod; org: CAttrOrg; channel: CAttrChannel; total: CAttrStats;
  states: Record<CAttrState, CAttrStats>; observedAllocation: null;
  bounds: CAttrBound[]; products: CAttrProduct[];
};
export type CAttrPacket = {
  schema: "pillar-c-attribution-v1"; sourceSha256: string; classificationSha256: string;
  mappingVersion: string; precision: "exact-source-literals-21";
  portfolios: CAttrPortfolio[]; scopes: CAttrScope[];
};
const SCALE = BigInt(10) ** BigInt(21);
const decimal = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/;
/** PC-02: exact source decimal, no binary conversion or row quantization. */
export function cAttrAtoms(raw: string): bigint {
  if (typeof raw !== "string" || raw.length > 96) throw new Error("C_ATTR_DECIMAL");
  const match = raw.match(decimal); if (!match) throw new Error("C_ATTR_DECIMAL");
  const fraction = match[3] ?? "", shift = 21 + Number(match[4] ?? 0) - fraction.length;
  if (!Number.isSafeInteger(shift) || Math.abs(shift) > 100) throw new Error("C_ATTR_PRECISION");
  let value = BigInt(match[2] + fraction);
  if (shift >= 0) value *= BigInt(10) ** BigInt(shift);
  else {
    const divisor = BigInt(10) ** BigInt(-shift);
    if (value % divisor !== BigInt(0)) throw new Error("C_ATTR_PRECISION");
    value /= divisor;
  }
  return match[1] ? -value : value;
}
export function cAttrDecimal(value: bigint): string {
  const negative = value < BigInt(0), magnitude = negative ? -value : value;
  const fraction = (magnitude % SCALE).toString().padStart(21, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${magnitude / SCALE}${fraction ? `.${fraction}` : ""}`;
}
export const cAttrSum = (values: string[]) => cAttrDecimal(values.reduce((sum, v) => sum + cAttrAtoms(v), BigInt(0)));
type Mutable = { n: number; net: bigint; abs: bigint; positive: bigint; negative: bigint };
const empty = (): Mutable => ({ n: 0, net: BigInt(0), abs: BigInt(0), positive: BigInt(0), negative: BigInt(0) });
function add(s: Mutable, value: bigint) {
  s.n++; s.net += value; s.abs += value < BigInt(0) ? -value : value;
  if (value < BigInt(0)) s.negative += value; else s.positive += value;
}
function packed(s: Mutable): CAttrStats { return { n: s.n, net: cAttrDecimal(s.net), abs: cAttrDecimal(s.abs), positive: cAttrDecimal(s.positive), negative: cAttrDecimal(s.negative) }; }
export type CAttrInput = { anno: number; mese: number; asl: string; canale: string; prodotto_key: string; atc: string; c: string; attribution_status: string; candidate_portfolios: string[] };

/** Builder entry point. Only aggregates and derived ranges leave this function. */
export function buildCAttrPacket(rows: Iterable<CAttrInput>, portfolios: CAttrPortfolio[], labels: Map<string, string>, sourceSha256: string, classificationSha256: string, mappingVersion: string): CAttrPacket {
  const vocabulary = new Set(portfolios.map(p => p.id));
  const scopes = new Map<string, {period: CAttrPeriod; org: CAttrOrg; channel: CAttrChannel; total: Mutable; states: Record<CAttrState, Mutable>; fixed: Map<string, bigint>; shared: Map<string, Mutable>; products: Map<string, {meta: Omit<CAttrProduct, keyof CAttrStats>; amounts: Mutable}>}>();
  for (const row of rows) {
    if (!C_ATTR_ORGS.includes(row.asl as CAttrOrg) || row.asl === "Regione" || !["CO", "DD", "DPC"].includes(row.canale) || !Number.isInteger(row.mese) || row.mese < 1 || row.mese > 12 || ![2024, 2025, 2026].includes(row.anno) || (row.anno === 2026 && row.mese > 5)) throw new Error("C_ATTR_SOURCE_SCOPE");
    const state = row.attribution_status as CAttrState, candidates = [...row.candidate_portfolios].sort();
    if (!C_ATTR_STATES.includes(state) || new Set(candidates).size !== candidates.length || candidates.some(p => !vocabulary.has(p)) || (state === "S2" ? candidates.length !== 1 : state === "S3" ? candidates.length < 2 : candidates.length !== 0)) throw new Error("C_ATTR_CLASSIFICATION");
    const periods: CAttrPeriod[] = row.anno === 2024 ? ["FY2024"] : row.anno === 2025 ? ["FY2025", ...(row.mese <= 5 ? ["JM2025" as const] : [])] : ["JM2026"];
    const value = cAttrAtoms(row.c);
    for (const period of periods) for (const org of ["Regione", row.asl] as CAttrOrg[]) for (const channel of ["Tutti", row.canale] as CAttrChannel[]) {
      const key = `${period}|${org}|${channel}`;
      let scope = scopes.get(key);
      if (!scope) {
        scope = { period, org, channel, total: empty(), states: {S2: empty(), S3: empty(), S4: empty(), S5: empty()}, fixed: new Map(), shared: new Map(), products: new Map() };
        scopes.set(key, scope);
      }
      add(scope.total, value); add(scope.states[state], value);
      if (state === "S2") scope.fixed.set(candidates[0], (scope.fixed.get(candidates[0]) ?? BigInt(0)) + value);
      else {
        if (state === "S3") for (const candidate of candidates) {
          const exposure = scope.shared.get(candidate) ?? empty(); add(exposure, value); scope.shared.set(candidate, exposure);
        }
        // Preserve a product whose candidate set changes within the period as
        // distinct evidence groups, rather than applying a last-write-wins map.
        const productKey = `${row.prodotto_key}|${state}|${candidates.join("+")}|${row.atc}`;
        let product = scope.products.get(productKey);
        if (!product) {
          product = {meta: {key: row.prodotto_key, label: labels.get(row.prodotto_key) ?? row.prodotto_key, atc: row.atc, state, candidates}, amounts: empty()};
          scope.products.set(productKey, product);
        }
        add(product.amounts, value);
      }
    }
  }
  return { schema: "pillar-c-attribution-v1", sourceSha256, classificationSha256, mappingVersion, precision: "exact-source-literals-21", portfolios,
    scopes: [...scopes.values()].sort((a,b) => `${a.period}|${a.org}|${a.channel}`.localeCompare(`${b.period}|${b.org}|${b.channel}`)).map(s => ({
      period: s.period, org: s.org, channel: s.channel, observedAllocation: null, total: packed(s.total),
      states: { S2: packed(s.states.S2), S3: packed(s.states.S3), S4: packed(s.states.S4), S5: packed(s.states.S5) },
      bounds: portfolios.map(p => {
        const f = s.fixed.get(p.id) ?? BigInt(0), shared = s.shared.get(p.id) ?? empty();
        const lo = f + shared.negative, hi = f + shared.positive;
        return { id: p.id, fixed: cAttrDecimal(f), shared: packed(shared), lower1: cAttrDecimal(lo), upper1: cAttrDecimal(hi), lower2: cAttrDecimal(lo + s.states.S4.negative + s.states.S5.negative), upper2: cAttrDecimal(hi + s.states.S4.positive + s.states.S5.positive) };
      }),
      products: [...s.products.values()].map(p => ({...p.meta, ...packed(p.amounts)})),
    })) };
}

function requireValue(ok: unknown): asserts ok { if (!ok) throw new Error("C_ATTR_INVALID"); }
function record(value: unknown): Record<string, unknown> { requireValue(value && typeof value === "object" && !Array.isArray(value)); return value as Record<string, unknown>; }
function exact(value: Record<string,unknown>, keys: string[]) { requireValue(Object.keys(value).length === keys.length && keys.every(k => Object.hasOwn(value,k))); }
function text(value: unknown, max = 500): asserts value is string { requireValue(typeof value === "string" && value.length <= max && !/[\u0000-\u0008]/.test(value)); }
function amount(value: unknown): asserts value is string { text(value, 64); requireValue(cAttrDecimal(cAttrAtoms(value)) === value); }
function statsCheck(value: unknown): CAttrStats {
  const s = record(value); requireValue(Object.keys(s).length === 5 && Number.isSafeInteger(s.n) && Number(s.n) >= 0 && Number(s.n) <= 300_000);
  for (const k of ["net", "abs", "positive", "negative"]) amount(s[k]);
  const net = cAttrAtoms(s.net as string), pos = cAttrAtoms(s.positive as string), neg = cAttrAtoms(s.negative as string), abs = cAttrAtoms(s.abs as string);
  requireValue(pos >= BigInt(0) && neg <= BigInt(0) && net === pos + neg && abs === pos - neg);
  requireValue(s.n !== 0 || (net === BigInt(0) && abs === BigInt(0)));
  return s as CAttrStats;
}
/** Validate pinned private aggregates before returning them through a reviewer API. */
export function parseCAttrPacket(raw: unknown): CAttrPacket {
  const p = record(raw);
  requireValue(p.schema === "pillar-c-attribution-v1" && p.precision === "exact-source-literals-21" && Object.keys(p).length === 7);
  for (const k of ["sourceSha256", "classificationSha256"]) requireValue(typeof p[k] === "string" && /^[a-f0-9]{64}$/.test(p[k] as string));
  text(p.mappingVersion, 100); requireValue(Array.isArray(p.portfolios) && p.portfolios.length > 0 && p.portfolios.length <= 40);
  const vocabulary = new Set<string>();
  for (const value of p.portfolios) { const v = record(value); exact(v,["id","label","kind"]); text(v.id, 12); text(v.label); text(v.kind, 80); requireValue(/^[A-Z0-9]{2,12}$/.test(v.id) && !vocabulary.has(v.id)); vocabulary.add(v.id); }
  requireValue(Array.isArray(p.scopes) && p.scopes.length > 0 && p.scopes.length <= 80); const seen = new Set<string>();
  for (const value of p.scopes) {
    const s = record(value), key = `${s.period}|${s.org}|${s.channel}`;
    exact(s,["period","org","channel","total","states","observedAllocation","bounds","products"]);
    requireValue(C_ATTR_PERIODS.includes(s.period as CAttrPeriod) && C_ATTR_ORGS.includes(s.org as CAttrOrg) && C_ATTR_CHANNELS.includes(s.channel as CAttrChannel) && !seen.has(key) && s.observedAllocation === null); seen.add(key);
    const total = statsCheck(s.total), states = record(s.states);
    requireValue(Object.keys(states).length === 4); const status = C_ATTR_STATES.map(id => statsCheck(states[id]));
    requireValue(total.n === status.reduce((sum, r) => sum + r.n, 0));
    for (const m of ["net", "abs", "positive", "negative"] as const) requireValue(total[m] === cAttrSum(status.map(r => r[m])));
    requireValue(Array.isArray(s.bounds) && s.bounds.length === vocabulary.size); const bounds = new Set<string>();
    for (const value of s.bounds) {
      const b = record(value); text(b.id, 12); requireValue(vocabulary.has(b.id) && !bounds.has(b.id)); bounds.add(b.id);
      exact(b,["id","fixed","shared","lower1","upper1","lower2","upper2"]);
      for (const m of ["fixed", "lower1", "upper1", "lower2", "upper2"]) amount(b[m]);
      const shared = statsCheck(b.shared), fixed = b.fixed as string;
      requireValue(b.lower1 === cAttrSum([fixed, shared.negative]) && b.upper1 === cAttrSum([fixed, shared.positive]));
      requireValue(b.lower2 === cAttrSum([b.lower1 as string, status[2].negative, status[3].negative]) && b.upper2 === cAttrSum([b.upper1 as string, status[2].positive, status[3].positive]));
    }
    requireValue(Array.isArray(s.products) && s.products.length <= 6500);
    const products = new Set<string>();
    const sums: Record<string, CAttrStats[]> = { S3: [], S4: [], S5: [] };
    for (const value of s.products) {
      const r = record(value); text(r.key, 64); text(r.label); text(r.atc, 12); requireValue(["S3", "S4", "S5"].includes(r.state as string) && Array.isArray(r.candidates));
      exact(r,["key","label","atc","state","candidates","n","net","abs","positive","negative"]);
      const candidates = r.candidates; requireValue(new Set(candidates).size === candidates.length && candidates.every(c => typeof c === "string" && vocabulary.has(c)) && (r.state === "S3" ? candidates.length >= 2 : candidates.length === 0));
      const key = `${r.key}|${r.state}|${candidates.join("+")}|${r.atc}`; requireValue(!products.has(key)); products.add(key);
      sums[r.state as string].push(statsCheck({n:r.n,net:r.net,abs:r.abs,positive:r.positive,negative:r.negative}));
    }
    for (const state of ["S3", "S4", "S5"] as const) {
      const expected = states[state] as CAttrStats;
      requireValue(expected.n === sums[state].reduce((sum,r) => sum+r.n,0));
      for (const m of ["net", "abs", "positive", "negative"] as const) requireValue(expected[m] === cAttrSum(sums[state].map(r => r[m])));
    }
  }
  return p as CAttrPacket;
}

export function cAttrScope(packet: CAttrPacket, period: CAttrPeriod, org: CAttrOrg, channel: CAttrChannel) { return packet.scopes.find(s => s.period === period && s.org === org && s.channel === channel); }
export function cAttrUncertain(s: CAttrScope) { return { net: cAttrSum([s.states.S3.net, s.states.S4.net, s.states.S5.net]), abs: cAttrSum([s.states.S3.abs, s.states.S4.abs, s.states.S5.abs]) }; }
export function cAttrShare(value: string, denominator: string): number | null { return cAttrAtoms(denominator) > BigInt(0) ? Number(value) / Number(denominator) : null; }
export function cAttrPriority(scope: CAttrScope, state: "therapeutic" | "all" | "S3" | "S4" | "S5" = "therapeutic", query = "", portfolios: CAttrPortfolio[] = []) {
  const eligible = scope.products.filter(r => (state === "all" || (state === "therapeutic" ? r.state === "S3" || r.state === "S4" : r.state === state)) && cAttrAtoms(r.abs) > BigInt(0)).sort((a,b) => {
    const d = cAttrAtoms(b.abs) - cAttrAtoms(a.abs); return d > BigInt(0) ? 1 : d < BigInt(0) ? -1 : `${a.key}|${a.state}|${a.candidates}`.localeCompare(`${b.key}|${b.state}|${b.candidates}`);
  });
  const total = cAttrSum(eligible.map(r => r.abs)); let running = BigInt(0), n80: number | null = null;
  const ranked = eligible.map((r,i) => { running += cAttrAtoms(r.abs); if (n80 === null && running * BigInt(5) >= cAttrAtoms(total) * BigInt(4)) n80 = i + 1; return {...r, rank: i + 1, cumulative: cAttrDecimal(running)}; });
  const tokens = query.trim().toLocaleLowerCase("it").split(/\s+/).filter(Boolean);
  const names = new Map(portfolios.map(p => [p.id,p.label]));
  return { total, n80, count: eligible.length, rows: ranked.filter(r => tokens.every(t => `${r.key} ${r.label} ${r.atc} ${r.candidates.map(c => `${c} ${names.get(c)??""}`).join(" ")}`.toLocaleLowerCase("it").includes(t))) };
}
