/** Portfolio spending dossiers. ATC groupings are not observed clinical-area allocations. */
import { C_ATTR_CHANNELS, C_ATTR_ORGS, C_ATTR_PERIODS, C_ATTR_STATES, cAttrAtoms, cAttrDecimal, cAttrSum, type CAttrChannel, type CAttrInput, type CAttrOrg, type CAttrPeriod, type CAttrPortfolio, type CAttrState, type CAttrStats } from "./attribution.ts";

export type CPortfolioProduct = CAttrStats & { key: string; label: string; atc: string; state: "S2" | "S3"; candidates: string[] };
export type CPortfolioMonth = { month: number; fixed: CAttrStats | null; shared: CAttrStats | null };
export type CPortfolioSummary = CAttrPortfolio & { fixed: CAttrStats; shared: CAttrStats; lower1: string; upper1: string; lower2: string; upper2: string };
export type CPortfolioDossier = CPortfolioSummary & { observedAllocation: null; monthly: CPortfolioMonth[]; products: CPortfolioProduct[]; sharedProducts: CPortfolioProduct[] };
export type CPortfolioScopeSummary = { period: CAttrPeriod; org: CAttrOrg; channel: CAttrChannel; total: CAttrStats; states: Record<CAttrState, CAttrStats> };
export type CPortfolioScope = CPortfolioScopeSummary & { dossiers: CPortfolioDossier[] };
export type CPortfolioPacket = {
  schema: "pillar-c-portfolio-v1"; precision: "exact-source-literals-21"; sourceSha256: string;
  classificationSha256: string; mappingVersion: string; portfolios: CAttrPortfolio[]; scopes: CPortfolioScope[];
};
export type CPortfolioProductChange = { key: string; label: string; atc: string; current: CAttrStats | null; previous: CAttrStats | null; delta: string; kind: "continuing" | "entry" | "exit" };
export type CPortfolioView = {
  schema: "pillar-c-portfolio-view-v1"; precision: "exact-source-literals-21"; sourceSha256: string; classificationSha256: string; sourceSnapshot: string;
  mappingVersion: string; mappingStatus: "draft"; attributionBasis: "atc-portfolio-proxy"; portfolios: CAttrPortfolio[];
  scope: CPortfolioScopeSummary; summaries: CPortfolioSummary[]; dossier: CPortfolioDossier;
  comparison: { scope: CPortfolioScopeSummary; dossier: CPortfolioDossier } | null; productChanges: CPortfolioProductChange[]; change: string | null;
  changeSemantic: "later-minus-earlier"; changePeriods: { from: CAttrPeriod; to: CAttrPeriod };
};

type Mutable = { n: number; net: bigint; abs: bigint; positive: bigint; negative: bigint };
const empty = (): Mutable => ({ n: 0, net: BigInt(0), abs: BigInt(0), positive: BigInt(0), negative: BigInt(0) });
function add(s: Mutable, v: bigint) { s.n++; s.net += v; s.abs += v < BigInt(0) ? -v : v; if (v < BigInt(0)) s.negative += v; else s.positive += v; }
function packed(s: Mutable): CAttrStats { return { n: s.n, net: cAttrDecimal(s.net), abs: cAttrDecimal(s.abs), positive: cAttrDecimal(s.positive), negative: cAttrDecimal(s.negative) }; }
type ProductMutable = { meta: Pick<CPortfolioProduct, "key" | "label" | "atc" | "state" | "candidates">; amounts: Mutable };
type DossierMutable = { fixed: Mutable; shared: Mutable; monthly: Map<number, { fixed: Mutable; shared: Mutable }>; products: Map<string, ProductMutable>; sharedProducts: Map<string, ProductMutable> };
type ScopeMutable = CPortfolioScopeSummary & { amounts: Mutable; statusAmounts: Record<CAttrState, Mutable>; items: Map<string, DossierMutable> };
export const cPortfolioOtherPeriod = (p: CAttrPeriod): CAttrPeriod => p === "FY2024" ? "FY2025" : p === "FY2025" ? "FY2024" : p === "JM2025" ? "JM2026" : "JM2025";
export const cPortfolioMonths = (period: CAttrPeriod) => Array.from({ length: period.startsWith("FY") ? 12 : 5 }, (_, i) => i + 1);
const productIdentity = (r: Pick<CPortfolioProduct, "key" | "atc">) => JSON.stringify([r.key, r.atc]);
const emptyStats = () => packed(empty());

/** Reuses exact source-literal arithmetic. No allocation or observed patient count is inferred. */
export function buildCPortfolioPacket(rows: Iterable<CAttrInput>, portfolios: CAttrPortfolio[], labels: Map<string, string>, sourceSha256: string, classificationSha256: string, mappingVersion: string): CPortfolioPacket {
  const vocabulary = new Set(portfolios.map(p => p.id));
  if (vocabulary.size !== portfolios.length || !portfolios.length) throw Error("C_PORTFOLIO_VOCABULARY");
  const scopes = new Map<string, ScopeMutable>();
  for (const period of C_ATTR_PERIODS) for (const org of C_ATTR_ORGS) for (const channel of C_ATTR_CHANNELS) scopes.set(`${period}|${org}|${channel}`, {
    period, org, channel, total: emptyStats(), states: { S2: emptyStats(), S3: emptyStats(), S4: emptyStats(), S5: emptyStats() }, amounts: empty(), statusAmounts: { S2: empty(), S3: empty(), S4: empty(), S5: empty() }, items: new Map(),
  });
  for (const row of rows) {
    if (!C_ATTR_ORGS.includes(row.asl as CAttrOrg) || row.asl === "Regione" || !["CO", "DD", "DPC"].includes(row.canale) || !Number.isInteger(row.mese) || row.mese < 1 || row.mese > 12 || ![2024, 2025, 2026].includes(row.anno) || (row.anno === 2026 && row.mese > 5)) throw Error("C_PORTFOLIO_SOURCE_SCOPE");
    const state = row.attribution_status as CAttrState, candidates = [...row.candidate_portfolios].sort();
    if (!C_ATTR_STATES.includes(state) || new Set(candidates).size !== candidates.length || candidates.some(p => !vocabulary.has(p)) || (state === "S2" ? candidates.length !== 1 : state === "S3" ? candidates.length < 2 : candidates.length !== 0)) throw Error("C_PORTFOLIO_CLASSIFICATION");
    if (typeof row.prodotto_key !== "string" || !row.prodotto_key || row.prodotto_key.length > 64 || typeof row.atc !== "string" || row.atc.length > 12) throw Error("C_PORTFOLIO_IDENTITY");
    const periods: CAttrPeriod[] = row.anno === 2024 ? ["FY2024"] : row.anno === 2025 ? ["FY2025", ...(row.mese <= 5 ? ["JM2025" as const] : [])] : ["JM2026"];
    const value = cAttrAtoms(row.c);
    for (const period of periods) for (const org of ["Regione", row.asl] as CAttrOrg[]) for (const channel of ["Tutti", row.canale] as CAttrChannel[]) {
      const scope = scopes.get(`${period}|${org}|${channel}`)!; add(scope.amounts, value); add(scope.statusAmounts[state], value);
      if (state !== "S2" && state !== "S3") continue;
      for (const id of candidates) {
        let dossier = scope.items.get(id);
        if (!dossier) { dossier = { fixed: empty(), shared: empty(), monthly: new Map(), products: new Map(), sharedProducts: new Map() }; scope.items.set(id, dossier); }
        const lane = state === "S2" ? "fixed" : "shared";
        add(dossier[lane], value);
        let month = dossier.monthly.get(row.mese); if (!month) { month = { fixed: empty(), shared: empty() }; dossier.monthly.set(row.mese, month); } add(month[lane], value);
        // Candidate membership can differ over time. Preserve separate S3 evidence groups.
        const products = state === "S2" ? dossier.products : dossier.sharedProducts;
        const identity = JSON.stringify([row.prodotto_key, row.atc, candidates]);
        let product = products.get(identity);
        if (!product) { product = { meta: { key: row.prodotto_key, atc: row.atc, label: labels.get(`${row.prodotto_key}|${row.atc}`) ?? labels.get(row.prodotto_key) ?? row.prodotto_key, state, candidates }, amounts: empty() }; products.set(identity, product); }
        add(product.amounts, value);
      }
    }
  }
  const productList = (items: Map<string, ProductMutable>) => [...items.values()].map(p => ({ ...p.meta, ...packed(p.amounts) })).sort((a, b) => productIdentity(a).localeCompare(productIdentity(b)) || a.candidates.join("|").localeCompare(b.candidates.join("|")));
  return {
    schema: "pillar-c-portfolio-v1", precision: "exact-source-literals-21", sourceSha256, classificationSha256, mappingVersion, portfolios,
    scopes: [...scopes.values()].map(s => ({
      period: s.period, org: s.org, channel: s.channel, total: packed(s.amounts), states: { S2: packed(s.statusAmounts.S2), S3: packed(s.statusAmounts.S3), S4: packed(s.statusAmounts.S4), S5: packed(s.statusAmounts.S5) },
      dossiers: portfolios.map(p => {
        const d = s.items.get(p.id), fixed = packed(d?.fixed ?? empty()), shared = packed(d?.shared ?? empty());
        const lower1 = cAttrSum([fixed.net, shared.negative]), upper1 = cAttrSum([fixed.net, shared.positive]);
        return { ...p, fixed, shared, lower1, upper1, lower2: cAttrSum([lower1, cAttrDecimal(s.statusAmounts.S4.negative), cAttrDecimal(s.statusAmounts.S5.negative)]), upper2: cAttrSum([upper1, cAttrDecimal(s.statusAmounts.S4.positive), cAttrDecimal(s.statusAmounts.S5.positive)]), observedAllocation: null,
          monthly: cPortfolioMonths(s.period).map(month => { const m = d?.monthly.get(month); return { month, fixed: m?.fixed.n ? packed(m.fixed) : null, shared: m?.shared.n ? packed(m.shared) : null }; }), products: d ? productList(d.products) : [], sharedProducts: d ? productList(d.sharedProducts) : [],
        };
      }),
    })),
  };
}

function check(ok: unknown): asserts ok { if (!ok) throw Error("C_PORTFOLIO_INVALID"); }
function record(v: unknown): Record<string, unknown> { check(v && typeof v === "object" && !Array.isArray(v)); return v as Record<string, unknown>; }
function keys(r: Record<string, unknown>, wanted: string[]) { check(Object.keys(r).length === wanted.length && wanted.every(k => Object.hasOwn(r, k))); }
function text(v: unknown, max = 500): asserts v is string { check(typeof v === "string" && v.length <= max && !/[\u0000-\u0008]/.test(v)); }
function amount(v: unknown): asserts v is string { text(v, 64); check(cAttrDecimal(cAttrAtoms(v)) === v); }
function stats(raw: unknown): CAttrStats {
  const s = record(raw); keys(s, ["n", "net", "abs", "positive", "negative"]);
  check(Number.isSafeInteger(s.n) && Number(s.n) >= 0 && Number(s.n) <= 300_000);
  for (const m of ["net", "abs", "positive", "negative"]) amount(s[m]);
  const net = cAttrAtoms(s.net as string), pos = cAttrAtoms(s.positive as string), neg = cAttrAtoms(s.negative as string), abs = cAttrAtoms(s.abs as string);
  check(pos >= BigInt(0) && neg <= BigInt(0) && net === pos + neg && abs === pos - neg && (s.n !== 0 || abs === BigInt(0)));
  return s as CAttrStats;
}
function reconcile(total: CAttrStats, parts: CAttrStats[]) {
  check(total.n === parts.reduce((n, p) => n + p.n, 0));
  for (const m of ["net", "abs", "positive", "negative"] as const) check(total[m] === cAttrSum(parts.map(p => p[m])));
}
function portfolio(raw: unknown): CAttrPortfolio {
  const p = record(raw); keys(p, ["id", "label", "kind"]); text(p.id, 12); text(p.label); text(p.kind, 80); check(/^[A-Z0-9]{2,12}$/.test(p.id)); return p as CAttrPortfolio;
}
/** Strict shape and conservation checks also prevent accidental private row metadata escaping. `orgs` is the
 * organisation vocabulary the scopes may carry: the reviewer's five keys by default, or exactly one scoped unit
 * key for a scoped read (Pillar C recommendation 5), so a shard of another unit is refused. */
export function parseCPortfolioPacket(raw: unknown): CPortfolioPacket;
export function parseCPortfolioPacket<O extends string>(raw: unknown, orgs: readonly O[]): Omit<CPortfolioPacket, "scopes"> & { scopes: (Omit<CPortfolioScope, "org"> & { org: O })[] };
export function parseCPortfolioPacket(raw: unknown, orgs: readonly string[] = C_ATTR_ORGS): Omit<CPortfolioPacket, "scopes"> & { scopes: (Omit<CPortfolioScope, "org"> & { org: string })[] } {
  const packet = record(raw); keys(packet, ["schema", "precision", "sourceSha256", "classificationSha256", "mappingVersion", "portfolios", "scopes"]);
  check(packet.schema === "pillar-c-portfolio-v1" && packet.precision === "exact-source-literals-21");
  for (const field of ["sourceSha256", "classificationSha256"]) check(typeof packet[field] === "string" && /^[a-f0-9]{64}$/.test(packet[field] as string));
  text(packet.mappingVersion, 100); check(Array.isArray(packet.portfolios) && packet.portfolios.length > 0 && packet.portfolios.length <= 40);
  const vocabulary = new Map(packet.portfolios.map(p => { const v = portfolio(p); return [v.id, v]; })); check(vocabulary.size === packet.portfolios.length);
  check(Array.isArray(packet.scopes) && packet.scopes.length > 0 && packet.scopes.length <= 80); const seen = new Set<string>();
  for (const value of packet.scopes) {
    const s = record(value); keys(s, ["period", "org", "channel", "total", "states", "dossiers"]);
    const identity = `${s.period}|${s.org}|${s.channel}`;
    check(C_ATTR_PERIODS.includes(s.period as CAttrPeriod) && orgs.includes(s.org as string) && C_ATTR_CHANNELS.includes(s.channel as CAttrChannel) && !seen.has(identity)); seen.add(identity);
    const total = stats(s.total), status = record(s.states); keys(status, [...C_ATTR_STATES]); const statuses = C_ATTR_STATES.map(id => stats(status[id])); reconcile(total, statuses);
    check(Array.isArray(s.dossiers) && s.dossiers.length === vocabulary.size); const ids = new Set<string>(), fixedTotals: CAttrStats[] = [];
    for (const value of s.dossiers) {
      const d = record(value); keys(d, ["id", "label", "kind", "fixed", "shared", "lower1", "upper1", "lower2", "upper2", "observedAllocation", "monthly", "products", "sharedProducts"]);
      text(d.id, 12); const v = vocabulary.get(d.id); check(v && d.label === v.label && d.kind === v.kind && !ids.has(d.id) && d.observedAllocation === null); ids.add(d.id);
      const fixed = stats(d.fixed), shared = stats(d.shared); fixedTotals.push(fixed);
      for (const m of ["lower1", "upper1", "lower2", "upper2"]) amount(d[m]);
      check(d.lower1 === cAttrSum([fixed.net, shared.negative]) && d.upper1 === cAttrSum([fixed.net, shared.positive]));
      check(d.lower2 === cAttrSum([d.lower1 as string, statuses[2].negative, statuses[3].negative]) && d.upper2 === cAttrSum([d.upper1 as string, statuses[2].positive, statuses[3].positive]));
      check(Array.isArray(d.monthly)); const months = cPortfolioMonths(s.period as CAttrPeriod); check(d.monthly.length === months.length);
      const monthlyFixed: CAttrStats[] = [], monthlyShared: CAttrStats[] = [];
      d.monthly.forEach((value, i) => { const m = record(value); keys(m, ["month", "fixed", "shared"]); check(m.month === months[i]); for (const lane of ["fixed", "shared"] as const) if (m[lane] !== null) { const a = stats(m[lane]); check(a.n > 0); (lane === "fixed" ? monthlyFixed : monthlyShared).push(a); } });
      reconcile(fixed, monthlyFixed); reconcile(shared, monthlyShared);
      for (const [field, state, expected] of [["products", "S2", fixed], ["sharedProducts", "S3", shared]] as const) {
        check(Array.isArray(d[field]) && d[field].length <= 6500); const productKeys = new Set<string>(), parts: CAttrStats[] = [];
        for (const value of d[field]) {
          const p = record(value); keys(p, ["key", "label", "atc", "state", "candidates", "n", "net", "abs", "positive", "negative"]); text(p.key, 64); text(p.label); text(p.atc, 12);
          check(p.state === state && Array.isArray(p.candidates) && p.candidates.includes(d.id) && p.candidates.every(id => typeof id === "string" && vocabulary.has(id)) && new Set(p.candidates).size === p.candidates.length && (state === "S2" ? p.candidates.length === 1 : p.candidates.length >= 2));
          const key = JSON.stringify([p.key, p.atc, p.candidates]); check(!productKeys.has(key)); productKeys.add(key);
          const a = stats({ n: p.n, net: p.net, abs: p.abs, positive: p.positive, negative: p.negative }); check(a.n > 0); parts.push(a);
        }
        reconcile(expected, parts);
      }
    }
    reconcile(statuses[0], fixedTotals);
  }
  return packet as CPortfolioPacket;
}

const scopeSummary = (s: CPortfolioScope): CPortfolioScopeSummary => ({ period: s.period, org: s.org, channel: s.channel, total: s.total, states: s.states });
const summary = (d: CPortfolioDossier): CPortfolioSummary => ({ id: d.id, label: d.label, kind: d.kind, fixed: d.fixed, shared: d.shared, lower1: d.lower1, upper1: d.upper1, lower2: d.lower2, upper2: d.upper2 });
/** Entry/exit is presence in the selected portfolio and matched period, not market entry or patient activity. */
export function cPortfolioProductChanges(current: CPortfolioDossier, previous: CPortfolioDossier): CPortfolioProductChange[] {
  if (current.id !== previous.id) throw Error("C_PORTFOLIO_COMPARISON");
  const before = new Map(previous.products.map(p => [productIdentity(p), p])), after = new Map(current.products.map(p => [productIdentity(p), p]));
  const result = [...new Set([...before.keys(), ...after.keys()])].map(key => {
    const a = after.get(key), b = before.get(key), meta = a ?? b!;
    const toStats = (p: CPortfolioProduct | undefined): CAttrStats | null => p ? { n: p.n, net: p.net, abs: p.abs, positive: p.positive, negative: p.negative } : null;
    return { key: meta.key, label: meta.label, atc: meta.atc, current: toStats(a), previous: toStats(b), delta: cAttrDecimal(cAttrAtoms(a?.net ?? "0") - cAttrAtoms(b?.net ?? "0")), kind: a && b ? "continuing" as const : a ? "entry" as const : "exit" as const };
  }).sort((a, b) => { const av = cAttrAtoms(a.delta), bv = cAttrAtoms(b.delta), diff = (bv < BigInt(0) ? -bv : bv) - (av < BigInt(0) ? -av : av); return diff > BigInt(0) ? 1 : diff < BigInt(0) ? -1 : productIdentity(a).localeCompare(productIdentity(b)); });
  if (cAttrSum(result.map(p => p.delta)) !== cAttrDecimal(cAttrAtoms(current.fixed.net) - cAttrAtoms(previous.fixed.net))) throw Error("C_PORTFOLIO_CHANGE");
  return result;
}
export function cPortfolioView(packet: CPortfolioPacket, period: CAttrPeriod, org: CAttrOrg, channel: CAttrChannel, id: string, sourceSnapshot: string): CPortfolioView {
  const scope = packet.scopes.find(s => s.period === period && s.org === org && s.channel === channel), other = packet.scopes.find(s => s.period === cPortfolioOtherPeriod(period) && s.org === org && s.channel === channel);
  const dossier = scope?.dossiers.find(d => d.id === id), previous = other?.dossiers.find(d => d.id === id);
  if (!scope || !dossier) throw Error("C_PORTFOLIO_SCOPE");
  const earlier = period === "FY2024" || period === "JM2025", from = earlier ? period : cPortfolioOtherPeriod(period), to = cPortfolioOtherPeriod(from);
  const before = earlier ? dossier : previous, after = earlier ? previous : dossier;
  return { schema: "pillar-c-portfolio-view-v1", precision: packet.precision, sourceSha256: packet.sourceSha256, classificationSha256: packet.classificationSha256, sourceSnapshot, mappingVersion: packet.mappingVersion, mappingStatus: "draft", attributionBasis: "atc-portfolio-proxy", portfolios: packet.portfolios,
    scope: scopeSummary(scope), summaries: scope.dossiers.map(summary), dossier,
    comparison: other && previous ? { scope: scopeSummary(other), dossier: previous } : null,
    productChanges: before && after ? cPortfolioProductChanges(after, before) : [], change: before && after && (before.fixed.n > 0 || after.fixed.n > 0) ? cAttrDecimal(cAttrAtoms(after.fixed.net) - cAttrAtoms(before.fixed.net)) : null,
    changeSemantic: "later-minus-earlier", changePeriods: { from, to },
  };
}
