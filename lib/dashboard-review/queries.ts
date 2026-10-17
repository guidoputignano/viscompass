// Typed data-access layer for the dashboard-review modules.
//
// Ordinary members always query through their session and RLS. Approved
// reviewers reuse the existing server-only pillar scope resolver; that explicit
// exception is never selected from a query parameter or browser-supplied role.
//
// Only ever called from Server Components. searchMolecules and
// submitFeatureRequest are called from Client Components instead, and
// live in ./actions.ts as Server Actions — see that file for why they
// can't just be exported from here too.

import { cache } from "react";
import { after } from "next/server";
import { isArchivedUpload } from "@/lib/uploads/archive";
import { resolvePrivateScope } from "@/lib/analytics/private-scope";
import { isDeepStrictEqual } from "node:util";
import { CANONICAL_COMPACT_COLUMNS, CANONICAL_DASHBOARD_COLUMNS, decodeCompactFacts, factLanes, readCanonicalById } from "./canonical-pages";
import { resolvePillarBScope } from "./pillar-b/scope";
import { readActiveRelease, type PillarBDb } from "./pillar-b/rpc";
import { createServerCache, pillarBCacheKey } from "./pillar-b/server-cache";
import { organizationBiosimilarRows, organizationHeadroomByMolecule, type OrganizationComparison } from "./organization-biosimilar";
import { indicatorsFromTotals, type CategoryTotals } from "@/lib/analytics/antibiotic-indicators";
import {reportedRoundingBounds} from '@/lib/analytics/cost-basis-reconciliation';
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/auth/get-current-org";
import { getReviewerEmail } from "@/lib/auth/reviewer";
import { createServiceRoleClient, hasServiceRoleConfig } from "@/lib/supabase/service-role";
import { classifyTherapeuticArea, combineTherapeuticAreas } from "@/lib/dashboard-review/therapeutic-area";
import {
  chooseActiveRelease, costPerPack, maxOf, minOf, packCoverage, selectReportingPeriod,
  sumPacks,
} from "@/lib/dashboard-review/release-scope";
import {
  buildBiosimilarRows as buildBiosimilarRowsImpl,
  commonPenetrationBasis,
  comparableMassMg,
  comparableQuantityShare,
  headroomTotal,
  normalizationCoverage,
  penetration as biosimilarPenetration,
  penetrationOn,
} from "./biosimilar";
import { isUnresolvedRecord } from "./normalization";
import { unitCostIndexByOrg } from "./unit-cost-index";
import type {
  AntibioticConsumptionFact,
  AntibioticIndicatorSet,
  AntibioticStewardshipData,
  AwareCategory,
  AwareYearRow,
  BiosimilarComparisonRow,
  BenchmarkData,
  BenchmarkRow,
  CanonicalFact,
  ExplorerData,
  ExplorerFilters,
  ExplorerLevel,
  ExplorerNode,
  LineageData,
  LineageSource,
  MoleculeSignal,
  Objective,
  ObjectiveRank,
  ReviewSignal,
  ReviewWorkspaceData,
  SpendFlowData,
  SpendFlowNode,
  SpendFlowLink,
  SpendFlowClass,
  SpendDashboardData,
  UploadRecord,
} from "./types";

// Supabase/PostgREST caps a response at the configured API page size (1,000
// in this project). The previous implementation silently analysed only that
// first page. Fetch every RLS-visible page so totals remain reconcilable to
// the source. React cache keeps repeated reads inside one server render from
// refetching the same tenant-scoped dataset.
/**
 * The release the dashboard is allowed to read, or null when none is declared.
 *
 * Declared, never inferred. Without this filter a second release loaded beside
 * the first would silently double every total while the figures still looked
 * plausible, and nothing downstream could tell.
 */
const activeReleaseId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pillar_b_active_release")
    .select("release_id")
    .limit(2);
  if (error) throw new Error(`active release lookup failed: ${error.message}`);
  return chooseActiveRelease(data as Array<{ release_id: string }> | null);
});

// Re-use the already-tested Pillar B identity decision, never a client scope.
// Authorization and the active-release stamp are re-read before cache lookup.
const getCoreScope = cache(async () => {
  const scope = await resolvePillarBScope();
  if (scope?.reviewerScopeUnavailable) throw new Error("CORE_REVIEWER_SCOPE_UNAVAILABLE");
  return scope?.viewerCode ? scope : null;
});
// Ten minutes, the staleness bound the Pillar B page cache already documents.
// The stamp is read before every lookup and again after it, so an activation
// (or a re-activation of the same id) is seen at once; what can be stale for up
// to ten minutes is a correction made in place to the active release's rows
// without re-activating it (two minutes before). At 120 s every page opened
// after a two-minute pause paid the full cold read (12-20 s) again.
const coreFactCache = createServerCache({ ttlMs: 10 * 60_000, max: 1 });
let lanesWarned = false;
// Compact transport (canonical-pages.ts) unless DASHBOARD_FACT_TRANSPORT=json,
// or for 15 minutes after a fault of the compact transport (COMPACT_FAULT).
const COMPACT_SUSPENSION_MS = 15 * 60_000;
const CANARY_ROWS = 200;
// One budget for a load, fallback included: it stays inside the reviewer
// cache's 60 s single-flight window, and a JSON re-read starts only with time
// left for a cold read.
const FACT_DEADLINE_MS = 45_000;
// Rows asked for per page. Measured 17 Oct 2026 (Supabase gateway logs): every
// PostgREST request costs ~250-330 ms at the gateway even for one row, while
// Postgres spends 40-70 ms on a 1000-row page, so a cold read of ~264 pages is
// mostly per-request overhead. PostgREST returns at most its Data API
// "Max rows" whatever is asked, and readCanonicalById reads on until a range
// is exhausted, so a smaller cap only means more pages. The owner raised it
// from 1000 to 5000 on 17 Oct 2026: ~56 requests instead of ~264.
const FACT_PAGE_ROWS = 5000;
const FALLBACK_MIN_BUDGET_MS = 25_000;
// Faults the compact transport itself can cause: the request refused, a page
// that does not decode, a canary that disagrees. Anything else (a timeout, a
// 5xx, a statement timeout, rows changing during the read, a canary that could
// not be read) would fail the same way in JSON, so it fails the load as before.
const COMPACT_FAULT = /CANONICAL_COMPACT_(REJECTED|INVALID|MISMATCH)/;
let compactSuspendedUntil = 0;
function factTransport(): "compact" | "json" {
  return process.env.DASHBOARD_FACT_TRANSPORT?.trim() === "json" || Date.now() < compactSuspendedUntil ? "json" : "compact";
}
/**
 * One read of the whole active release through `db`: the service-role client
 * for a widened reviewer, the viewer's own session otherwise. `reviewer` only
 * decides what the load's log line may carry.
 */
function readReleaseFacts(db: PillarBDb, releaseId: string, reviewer: boolean): Promise<CanonicalFact[]> {
  const loadWith = async (transport: "compact" | "json", deadline: AbortSignal, fallback = false) => {
    const cancelled=new AbortController();
    const signal=()=>AbortSignal.any([cancelled.signal,deadline,AbortSignal.timeout(12_000)]);
    const lanes=factLanes(process.env.DASHBOARD_FACT_LANES,message=>{if(!lanesWarned){lanesWarned=true;console.warn(message);}});
    const started=Date.now();let pages=0,slowest=0,rowCount=0;
    let outcome:"ok"|"error"="error",failure:string|undefined;
    // The canary: the release's first rows in the full-name form, read beside
    // a compact load and compared with the decoded rows of the same ids. The
    // builder only sends on then(), so Promise.resolve starts it now; it
    // resolves with {error} rather than rejecting, so a failed load leaves no
    // unhandled rejection behind.
    const canary = transport === "compact"
      ? Promise.resolve(db.from("canonical_fact").select(CANONICAL_DASHBOARD_COLUMNS)
          .eq("source_version_id",releaseId).order("id",{ascending:true}).limit(CANARY_ROWS)
          .abortSignal(signal()).returns<CanonicalFact[]>())
      : null;
    try {
      const rows = await readCanonicalById(
        edge=>db.from("canonical_fact").select("id",edge==='first'?{count:"exact"}:undefined)
          .eq("source_version_id",releaseId).order("id",{ascending:edge==='first'}).limit(1)
          .abortSignal(signal()).returns<{id:number}[]>(),
        async (after,through,size)=>{
          const t=Date.now();
          const page = transport === "json"
            ? await db.from("canonical_fact").select(CANONICAL_DASHBOARD_COLUMNS)
                .eq("source_version_id",releaseId).gt("id",after).lte("id",through)
                .order("id",{ascending:true}).limit(size).abortSignal(signal()).returns<CanonicalFact[]>()
            : await db.from("canonical_fact").select(CANONICAL_COMPACT_COLUMNS)
                .eq("source_version_id",releaseId).gt("id",after).lte("id",through)
                .order("id",{ascending:true}).limit(size).stripNulls().abortSignal(signal()).returns<unknown[]>()
                // Refused: 406 (the nulls=stripped media type) or a PGRST1xx request
                // parse error (the alias select). Any other error, a 400 from
                // Postgres included, is passed on as the JSON read would.
                .then(p => p.error
                  ? { data: null, error: p.status === 406 || (p.status === 400 && /^PGRST1\d\d$/.test(p.error.code ?? "")) ? { message: "CANONICAL_COMPACT_REJECTED" } : p.error }
                  : { data: decodeCompactFacts(p.data, releaseId), error: null });
          pages++;slowest=Math.max(slowest,Date.now()-t);
          return page;
        },
        FACT_PAGE_ROWS,lanes,
      );
      if (canary) {
        const sample = await canary;
        if (sample.error || !sample.data) throw new Error("CANONICAL_COMPACT_CANARY_UNAVAILABLE");
        // The canary may come back shorter than asked under a small API row cap,
        // never longer than the read and never empty when the read is not.
        const n = sample.data.length;
        if (n > Math.min(CANARY_ROWS, rows.length) || (rows.length > 0 && n === 0) || !sample.data.every((row, i) => isDeepStrictEqual(row, rows[i]))) {
          throw new Error("CANONICAL_COMPACT_MISMATCH");
        }
      }
      outcome="ok";rowCount=rows.length;
      return rows;
    } catch(cause) {
      cancelled.abort();
      // A fixed class only, never the message: it can carry query text.
      const message=cause instanceof Error?cause.message:"";
      failure=message.match(/CANONICAL_[A-Z_]+/)?.[0]??(deadline.aborted?"deadline_45s"
        :/TimeoutError|AbortError/.test(message)?"page_timeout_12s":"query_error");
      throw cause;
    } finally {
      // One line per read attempt, successful or not, for the cold-load
      // measurement; a compact load that falls back adds a json line marked
      // fallback, whose ms covers the re-read only.
      // Page time is client wall time (pool wait, transfer, parse, event loop),
      // not database time. Rows and pages only for the reviewer read, which is
      // the whole release: under RLS they would reveal the member's Azienda.
      const line={event:"dashboard_fact_load",outcome,...(failure?{error:failure}:{}),transport,...(fallback?{fallback:true}:{}),lanes,ms:Date.now()-started,slowest_page_ms:slowest};
      console.info(JSON.stringify(reviewer?{...line,perimeter:"reviewer",rows:rowCount,pages}:{...line,perimeter:"rls"}));
    }
  };
  // A compact read that the transport itself broke (COMPACT_FAULT) is read
  // again in full-name JSON within the same 45 s budget when 25 s remain, and
  // this instance stays on JSON for 15 minutes either way. Any other
  // failure is not retried: a second full read would only double the wait
  // before the same error.
  const load = async () => {
    const started = Date.now(), deadline = AbortSignal.timeout(FACT_DEADLINE_MS);
    const transport = factTransport();
    try {
      return await loadWith(transport, deadline);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "";
      const fault = transport === "compact" && !deadline.aborted ? message.match(COMPACT_FAULT)?.[0] : undefined;
      if (!fault) throw cause;
      compactSuspendedUntil = Date.now() + COMPACT_SUSPENSION_MS;
      const retried = FACT_DEADLINE_MS - (Date.now() - started) >= FALLBACK_MIN_BUDGET_MS;
      console.error(JSON.stringify({ event: "dashboard_fact_compact_fallback", reason: fault, retried }));
      if (!retried) throw cause;
      return await loadWith("json", deadline, true);
    }
  };
  return load();
}

// The reviewer's read does not depend on the reviewer directory that
// resolvePillarBScope reads first (pillar_b_facets, 1.5 s on a cold instance,
// measured 17 Oct 2026): it needs only the live reviewer check, the
// service-role client and the active release. It therefore starts as soon as
// those are known, into the reviewer cache entry, and the scoped read below
// joins that entry instead of starting its own. The rows are returned only
// through that same key, which only a request whose resolved scope is the
// widened reviewer scope reads; a failed widening never reads them and the
// entry expires like any other. getReviewerEmail is the same per-request
// check scope.ts uses before creating its own service-role client.
//
// It starts only when this request could consume it: getCoreScope returns
// null without an approved membership (viewerCode), so a reviewer without one
// never reads the entry. A reviewer whose widening then fails (directory
// error) still starts it once; the entry then serves the next widened request
// or expires. getCurrentOrg is the same per-request promise the scope
// awaits. The load is registered with after() (waitUntil on Vercel), so a load
// no request awaits is never frozen mid-read and later joined, and a failure
// pauses the prefetch for a minute rather than repeating a full read on every
// view while the database is failing. Known cost, accepted: a release activated
// between this lookup and the scope's leaves one stale-stamp read running, at
// most the 45 s budget.
const PREFETCH_PAUSE_MS = 60_000;
let prefetchPausedUntil = 0;
type ReviewerPrefetch = { key: string; facts: Promise<CanonicalFact[]> } | null;
const prefetchReviewerFacts = cache(async (): Promise<ReviewerPrefetch> => {
  // The live reviewer check reads the session first: with cacheComponents a
  // clock read before any request data fails the build's prerender.
  if (!(await getReviewerEmail()) || !hasServiceRoleConfig()) return null;
  if (Date.now() < prefetchPausedUntil) return null;
  const admin = createServiceRoleClient();
  const [org, release] = await Promise.all([getCurrentOrg(), readActiveRelease(admin)]);
  if (!org || !release) return null;
  const key = pillarBCacheKey("reviewer:service-role", release.stamp, "core-facts");
  // Returned inside an object: an async function returning the bare promise
  // would wait for the whole read before the caller could continue.
  const facts = coreFactCache.get(key, () => readReleaseFacts(admin, release.id, true));
  after(facts.then(() => {}, () => { prefetchPausedUntil = Date.now() + PREFETCH_PAUSE_MS; }));
  return { key, facts };
});

const selectCanonicalFacts = cache(async (): Promise<CanonicalFact[]> => {
  // Started now, consumed below only under the same key.
  const prefetch = prefetchReviewerFacts().catch((cause): ReviewerPrefetch => {
    // A fixed class only, never the message. The scoped read below still runs.
    const message = cause instanceof Error ? cause.message : "";
    console.error(JSON.stringify({ event: "dashboard_fact_prefetch_error", error: message.match(/CANONICAL_[A-Z_]+/)?.[0] ?? "error" }));
    return null;
  });
  const scope = await getCoreScope();
  if (!scope) return [];
  const release = await readActiveRelease(scope.db);
  if (!release) return [];
  // Reviewer service reads have an identical, explicitly approved cohort.
  // Do not persist RLS rows across requests: a secondary membership could be
  // revoked without changing the viewer's primary-org cache identity.
  const key = scope.allOrganizations && scope.cacheScope
    ? pillarBCacheKey(scope.cacheScope, release.stamp, "core-facts")
    : null;
  // Only a widened reviewer's key can equal the prefetch key, so a failed
  // widening (key null) never touches the prefetched rows. A load the prefetch
  // started is awaited, never read a second time: its failure is this
  // request's failure, as with a single read.
  const started = key ? await prefetch : null;
  const facts = key
    ? await (started?.key === key
        ? started.facts
        : coreFactCache.get(key, () => readReleaseFacts(scope.db, release.id, scope.allOrganizations)))
    : await readReleaseFacts(scope.db, release.id, scope.allOrganizations);
  // A release removed/switched during a load must not publish the old response.
  // Only this request's own (old-stamp) entry is dropped: clear() would also
  // drop the new release's in-flight load and start a second full read.
  if ((await readActiveRelease(scope.db))?.stamp !== release.stamp) {
    if (key) coreFactCache.delete(key);
    throw new Error("CANONICAL_RELEASE_CHANGED");
  }
  return facts;
});

const ATC1_NAMES: Record<string, string> = {
  A: "Apparato gastrointestinale e metabolismo",
  B: "Sangue e organi emopoietici",
  C: "Sistema cardiovascolare",
  D: "Dermatologici",
  G: "Sistema genito-urinario e ormoni sessuali",
  H: "Preparati ormonali sistemici",
  J: "Antimicrobici per uso sistemico",
  L: "Antineoplastici e immunomodulatori",
  M: "Sistema muscolo-scheletrico",
  N: "Sistema nervoso",
  P: "Antiparassitari, insetticidi e repellenti",
  R: "Sistema respiratorio",
  S: "Organi di senso",
  V: "Vari",
};

const EXPLORER_LEVEL_LABEL: Record<ExplorerLevel, string> = {
  asl: "Azienda sanitaria",
  atc1: "ATC livello 1",
  atc2: "ATC livello 2",
  atc3: "ATC livello 3",
  atc4: "ATC livello 4",
  atc5: "ATC livello 5",
  molecule: "Molecola",
  aic: "Confezione AIC",
};

/**
 * Latest of a list of epoch milliseconds, as an ISO string.
 *
 * Uses `maxOf` rather than `Math.max(...times)`: these lists carry one entry per
 * canonical fact row, and spreading 261,153 arguments throws RangeError.
 */
function latestIso(times: ReadonlyArray<number>): string | null {
  const latest = maxOf(times);
  return latest === null ? null : new Date(latest).toISOString();
}

function ratio(change: number, baseline: number): number | null {
  return baseline !== 0 ? (change - baseline) / baseline : null;
}

// «Irrisolti» = not eligible for a normalised €/mg or €/DDD comparison. It no
// longer reads mapping_confidence (the ATC-mapping confidence): see normalization.ts.
const isUnresolved = isUnresolvedRecord;




// Cross-Azienda comparison basis. See docs/M6_DECISION.md: within a perimeter
// purchases can be procured centrally by one Azienda while dispensing is
// recorded locally, so acquistato totals are attributed to the buyer rather
// than to the Azienda that consumed them. Only the dispensed (erogato) basis is
// attributable per Azienda, and only it may feed a cross-Azienda comparison.
// Returns null when a fact carries no value that is safe to compare.
/** A share with the measure it was computed on, as one molecule row carries it. */
function moleculeShare(share: ReturnType<typeof biosimilarPenetration>) {
  return {
    biosimilar_penetration: share.value,
    biosimilar_penetration_basis: share.basis,
    biosimilar_penetration_quantity_coverage: share.quantity_coverage,
  };
}

function comparableSpendEur(fact: CanonicalFact): number | null {
  const erogato = fact.erogato_cost_eur ?? null;
  if (erogato !== null) return erogato;
  // total_cost_eur is usable only when it is known not to be a purchase total.
  // Legacy rows carry no cost_basis at all; those are treated as unspecified.
  const basis = fact.cost_basis ?? "unspecified";
  if (basis === "acquistato") return null;
  return fact.total_cost_eur ?? null;
}

// A fact that carries a value, but only one that cannot be compared between
// Aziende. Used to tell "acquistato-only perimeter" apart from "no data".
function isAcquistatoOnlyFact(fact: CanonicalFact): boolean {
  if (comparableSpendEur(fact) !== null) return false;
  return (fact.acquistato_cost_eur ?? null) !== null || (fact.total_cost_eur ?? null) !== null;
}

const ACQUISTATO_ONLY_LIMITATION =
  "Per questo perimetro sono disponibili soltanto valori di acquistato. Gli acquisti possono essere attribuiti centralmente a una sola Azienda del perimetro, mentre l’erogazione è registrata localmente: i totali di acquisto non sono quindi confrontabili tra Aziende. Il confronto viene pubblicato solo quando è disponibile l’erogato.";

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0
    ? (ordered[middle - 1] + ordered[middle]) / 2
    : ordered[middle];
}

const CHANNEL_LABELS: Record<string, string> = {
  DD: "Distribuzione diretta",
  DPC: "Distribuzione per conto",
  CO: "Consumi ospedalieri",
};
const RESIDUAL_NODE = "Residuo non erogato";
const UNCLASSIFIED_CLASS = "Classe non attribuita";

// Purchased → dispensed → undispensed, by ATC1 class. Each class node carries its
// acquistato, which splits into the three dispensing channels and whatever is left
// over. Classes that dispensed more than they purchased produce a negative residual;
// a Sankey has no way to draw that, so they are separated out here rather than
// clamped to zero, and the view renders them as their own band. The negative
// residuals are the central-purchasing artefact described in docs/M6_DECISION.md,
// not stock movement.
function spendFlowsFromFacts(facts: CanonicalFact[]): SpendFlowData {
  const classLabel = (fact: CanonicalFact) =>
    fact.atc1 === null ? UNCLASSIFIED_CLASS : ATC1_NAMES[fact.atc1] ?? fact.atc1;

  const byClass = new Map<
    string,
    { code: string; label: string; acquistato: number; channels: Map<string, number> }
  >();
  for (const fact of facts) {
    const code = fact.atc1 ?? UNCLASSIFIED_CLASS;
    const entry = byClass.get(code) ?? {
      code,
      label: classLabel(fact),
      acquistato: 0,
      channels: new Map<string, number>(),
    };
    entry.acquistato += fact.acquistato_cost_eur ?? 0;
    const dispensed = fact.erogato_cost_eur ?? 0;
    if (dispensed !== 0) {
      const channel = fact.channel ?? "Non specificato";
      entry.channels.set(channel, (entry.channels.get(channel) ?? 0) + dispensed);
    }
    byClass.set(code, entry);
  }

  const summaries: (SpendFlowClass & { channels: Map<string, number> })[] = Array.from(
    byClass.values(),
  ).map((entry) => {
    const erogato = Array.from(entry.channels.values()).reduce((sum, value) => sum + value, 0);
    const residual = entry.acquistato - erogato;
    return {
      code: entry.code,
      label: entry.label,
      acquistato_eur: entry.acquistato,
      erogato_eur: erogato,
      residual_eur: residual,
      residual_share: entry.acquistato > 0 ? residual / entry.acquistato : null,
      channels: entry.channels,
    };
  });

  // Drop the per-channel working map; it is an implementation detail of the
  // aggregation, not part of the shape the view consumes.
  const strip = (summary: (typeof summaries)[number]): SpendFlowClass => ({
    code: summary.code,
    label: summary.label,
    acquistato_eur: summary.acquistato_eur,
    erogato_eur: summary.erogato_eur,
    residual_eur: summary.residual_eur,
    residual_share: summary.residual_share,
  });
  const drawable = summaries
    .filter((summary) => summary.residual_eur >= 0 && summary.acquistato_eur > 0)
    .sort((a, b) => b.residual_eur - a.residual_eur);
  const negative = summaries
    .filter((summary) => summary.residual_eur < 0)
    .sort((a, b) => a.residual_eur - b.residual_eur)
    .map(strip);

  // Node order sets the Sankey's columns: classes first, then the destinations.
  const channelCodes = Array.from(
    new Set(drawable.flatMap((summary) => Array.from(summary.channels.keys()))),
  ).sort(
    (a, b) => Object.keys(CHANNEL_LABELS).indexOf(a) - Object.keys(CHANNEL_LABELS).indexOf(b),
  );
  const nodes: SpendFlowNode[] = [
    ...drawable.map((summary) => ({ name: summary.label, kind: "class" as const })),
    ...channelCodes.map((code) => ({ name: CHANNEL_LABELS[code] ?? code, kind: "channel" as const })),
    { name: RESIDUAL_NODE, kind: "residual" as const },
  ];
  const channelNodeIndex = new Map(
    channelCodes.map((code, offset) => [code, drawable.length + offset]),
  );
  const residualNodeIndex = nodes.length - 1;

  const links: SpendFlowLink[] = [];
  drawable.forEach((summary, index) => {
    for (const [code, value] of summary.channels) {
      if (value <= 0) continue;
      links.push({ source: index, target: channelNodeIndex.get(code)!, value, kind: "dispensed" });
    }
    if (summary.residual_eur > 0) {
      links.push({
        source: index,
        target: residualNodeIndex,
        value: summary.residual_eur,
        kind: "residual",
      });
    }
  });

  const totalAcquistato = summaries.reduce((sum, summary) => sum + summary.acquistato_eur, 0);
  const totalErogato = summaries.reduce((sum, summary) => sum + summary.erogato_eur, 0);

  // Is there an acquistato figure AT ALL? `acquistato_cost_eur ?? 0` turns "this
  // release records no purchase figure" into "nothing was purchased", and the
  // consequences are not confined to one tile: every class's residual becomes
  // 0 - erogato, so EVERY class falls into negative_classes and the page reports
  // "dispensed more than purchased" for all of them as though it were a finding.
  //
  // This is not hypothetical. The Pillar B loader writes total_cost_eur and
  // erogato_cost_eur and never writes acquistato_cost_eur, so the first page load
  // after the import would have shown "Acquistato EUR 0", "Differenza -100,0%
  // dell'erogato", and a complete inversion of the flow attributed to named Aziende.
  const acquistatoRows = facts.filter(
    (fact) => fact.acquistato_cost_eur !== null && fact.acquistato_cost_eur !== undefined,
  ).length;
  const acquistatoKnown = acquistatoRows > 0;

  return {
    nodes,
    links,
    classes: drawable.map(strip),
    negative_classes: negative,
    total_acquistato_eur: acquistatoKnown ? totalAcquistato : null,
    total_erogato_eur: totalErogato,
    net_eur: acquistatoKnown ? totalAcquistato - totalErogato : null,
    acquistato_coverage: facts.length === 0 ? null : acquistatoRows / facts.length,
  };
}

export async function getSpendFlows(): Promise<SpendFlowData> {
  return spendFlowsFromFacts(await selectCanonicalFacts());
}

// Every caller of buildBiosimilarRows classifies areas the same way. Defining it
// once stops the three call sites drifting apart — they already did once, which is
// how two of them ended up calling a function that no longer existed.
const BIOSIMILAR_BUILD_OPTIONS = {
  classifyArea: (fact: CanonicalFact) =>
    classifyTherapeuticArea(fact.atc5, fact.atc4, fact.atc3, fact.atc2, fact.atc1),
};

export async function getSpendDashboardData(): Promise<SpendDashboardData> {
  const [facts, uploads, objectives] = await Promise.all([
    selectCanonicalFacts(),
    getUploads(),
    getObjectives(),
  ]);
  // The latest year with TWELVE MONTHS OBSERVED, not simply the latest. Math.max
  // picks a partial year -- 2026 holds five months -- and comparing it to a
  // twelve-month year publishes the calendar as a collapse. Twelve months
  // observed is not a claim the year is complete: see MONTHS_OBSERVED_CAVEAT.
  const period = selectReportingPeriod(facts);
  const latestYear = period.year;
  const previousYear = period.previousYear;
  const currentFacts = latestYear === null ? [] : facts.filter((f) => f.year === latestYear);
  const previousFacts = previousYear === null ? [] : facts.filter((f) => f.year === previousYear);

  const totalSpendEur = currentFacts.reduce((sum, f) => sum + (f.total_cost_eur ?? 0), 0);
  // null unless EVERY row states a package count -- the loader leaves
  // quantity_packs null because the source convention is unconfirmed, and a sum
  // over only the rows that state one is the total of an unnamed subset.
  const packs = packCoverage(currentFacts);
  const totalPacks = packs.packs;
  const previousSpendEur = previousFacts.reduce((sum, f) => sum + (f.total_cost_eur ?? 0), 0);
  const previousPacks = sumPacks(previousFacts);
  const normalizationEligible = currentFacts.filter((f) => (f.total_cost_eur ?? 0) > 0);
  const normalizedRecordCount = normalizationEligible.filter(
    (f) => f.cost_per_mg !== null || f.cost_per_ddd !== null || comparableMassMg(f) !== null,
  ).length;
  const unresolvedRecordCount = currentFacts.filter(
    (f) =>
      isUnresolved(f),
  ).length;

  const atcTotals = new Map<string, number>();
  for (const fact of currentFacts) {
    const code = fact.atc1 ?? "Altro";
    atcTotals.set(code, (atcTotals.get(code) ?? 0) + (fact.total_cost_eur ?? 0));
  }
  const atcBreakdown = Array.from(atcTotals.entries())
    .map(([code, spend]) => ({
      code,
      label: ATC1_NAMES[code] ?? "Categoria non classificata",
      spend_eur: spend,
      share: totalSpendEur > 0 ? spend / totalSpendEur : 0,
    }))
    .sort((a, b) => b.spend_eur - a.spend_eur)
    .slice(0, 6);

  const hasMonthlyFacts = currentFacts.some(
    (f) => f.month !== null && f.month >= 1 && f.month <= 12,
  );
  const monthLabels = [
    "Gen",
    "Feb",
    "Mar",
    "Apr",
    "Mag",
    "Giu",
    "Lug",
    "Ago",
    "Set",
    "Ott",
    "Nov",
    "Dic",
  ];

  let trend: SpendDashboardData["trend"];
  let trendGranularity: SpendDashboardData["trend_granularity"];
  if (hasMonthlyFacts) {
    const monthlyTotals = new Map<number, number>();
    for (const fact of currentFacts) {
      if (fact.month === null || fact.month < 1 || fact.month > 12) continue;
      monthlyTotals.set(
        fact.month,
        (monthlyTotals.get(fact.month) ?? 0) + (fact.total_cost_eur ?? 0),
      );
    }
    trend = Array.from(monthlyTotals.entries())
      .sort(([a], [b]) => a - b)
      .map(([month, spend]) => ({
        key: `${latestYear}-${String(month).padStart(2, "0")}`,
        label: monthLabels[month - 1],
        spend_eur: spend,
      }));
    trendGranularity = "month";
  } else {
    const annualTotals = new Map<number, number>();
    for (const fact of facts) {
      annualTotals.set(fact.year, (annualTotals.get(fact.year) ?? 0) + (fact.total_cost_eur ?? 0));
    }
    trend = Array.from(annualTotals.entries())
      .sort(([a], [b]) => a - b)
      .map(([year, spend]) => ({ key: String(year), label: String(year), spend_eur: spend }));
    trendGranularity = "year";
  }

  const sourceVersionCount = new Set(currentFacts.map((f) => f.source_version_id)).size;
  const geographyCount = new Set(
    currentFacts.map((f) => f.asl_code ?? f.region_code).filter((value): value is string => !!value),
  ).size;
  const loadedTimes = currentFacts
    .map((f) => Date.parse(f.created_at))
    .filter((value) => Number.isFinite(value));

  // The WHOLE fact set, not currentFacts: first local dispensing has to be read
  // across every year, or a biosimilar first dispensed in an earlier year looks
  // new in this one and the substitutable window opens far too late.
  const currentBio = organizationBiosimilarRows(facts, latestYear, BIOSIMILAR_BUILD_OPTIONS);
  const overallPenetration = biosimilarPenetration(currentFacts);
  const headroom = headroomTotal(currentBio.map(item => item.row));

  const previousMoleculeSpend = new Map<string, number>();
  for (const fact of previousFacts) {
    if (!fact.active_substance) continue;
    previousMoleculeSpend.set(
      fact.active_substance,
      (previousMoleculeSpend.get(fact.active_substance) ?? 0) + (fact.total_cost_eur ?? 0),
    );
  }
  const currentMoleculeFacts = new Map<string, CanonicalFact[]>();
  for (const fact of currentFacts) {
    if (!fact.active_substance) continue;
    const group = currentMoleculeFacts.get(fact.active_substance) ?? [];
    group.push(fact);
    currentMoleculeFacts.set(fact.active_substance, group);
  }
  const headroomByMolecule = organizationHeadroomByMolecule(currentBio);
  const topMolecules: MoleculeSignal[] = Array.from(currentMoleculeFacts.entries())
    .map(([activeSubstance, group]) => {
      const spend = group.reduce((sum, fact) => sum + (fact.total_cost_eur ?? 0), 0);
      const previousSpend = previousMoleculeSpend.get(activeSubstance) ?? 0;
      const atcCode = group.find((fact) => fact.atc5)?.atc5 ?? group[0]?.atc4 ?? null;
      // Classified from the SAME inputs as BIOSIMILAR_BUILD_OPTIONS above, not from
      // the loose display code: two areas for one molecule on one page is a bug.
      const therapeuticArea = BIOSIMILAR_BUILD_OPTIONS.classifyArea(group[0]);
      return {
        active_substance: activeSubstance,
        atc_code: atcCode,
        therapeutic_area: therapeuticArea.label,
        therapeutic_area_status: therapeuticArea.status,
        spend_eur: spend,
        spend_yoy: ratio(spend, previousSpend),
        ...moleculeShare(biosimilarPenetration(group)),
        headroom_eur: headroomByMolecule.get(activeSubstance) ?? null,
      };
    })
    .sort((a, b) => b.spend_eur - a.spend_eur)
    .slice(0, 8);

  const reviewSignals = buildReviewSignals({
    biosimilarRows: currentBio,
    organizationLabels: (await getCoreScope())?.aslLabels ?? {},
    unresolvedRecordCount,
    currentRecordCount: currentFacts.length,
    uploads,
    objectives: objectives.filter(
      (objective) => latestYear === null || new Date(objective.period_end).getUTCFullYear() >= latestYear,
    ),
  });

  return {
    flows: spendFlowsFromFacts(currentFacts),
    latest_year: latestYear,
    // Surfaced, not dropped: 44,005 rows of 2026 are excluded from every
    // headline figure above, and the UI says so rather than leaving the gap silent.
    partial_years: period.partialYears,
    total_spend_eur: totalSpendEur,
    total_packs: totalPacks,
    packs_coverage: packs.coverage,
    cost_per_pack_eur: costPerPack(totalSpendEur, totalPacks),
    record_count: currentFacts.length,
    source_version_count: sourceVersionCount,
    geography_count: geographyCount,
    latest_loaded_at: latestIso(loadedTimes),
    normalized_record_count: normalizedRecordCount,
    normalization_eligible_count: normalizationEligible.length,
    normalization_coverage:
      normalizationEligible.length > 0
        ? normalizedRecordCount / normalizationEligible.length
        : null,
    unresolved_record_count: unresolvedRecordCount,
    trend_granularity: trendGranularity,
    trend,
    atc_breakdown: atcBreakdown,
    previous_year: previousYear,
    spend_yoy: ratio(totalSpendEur, previousSpendEur),
    // null when either side has no stated package count -- a change from
    // "unknown" is not a change of zero.
    packs_yoy: totalPacks === null || previousPacks === null
      ? null
      : ratio(totalPacks, previousPacks),
    biosimilar_penetration: overallPenetration.value,
    biosimilar_penetration_basis: overallPenetration.basis,
    biosimilar_penetration_quantity_coverage: overallPenetration.quantity_coverage,
    biosimilar_headroom_eur: headroom.total,
    biosimilar_headroom_measurable: { measurable: headroom.measurable, molecules: headroom.molecules },
    active_review_count: reviewSignals.length,
    review_items: reviewSignals.slice(0, 6),
    top_molecules: topMolecules,
  };
}


/**
 * Is this page's figure set superseded by a gated release?
 *
 * Import blocker condition 3: any uptake or €/unit figure must come from
 * `pillar_b_uptake` with its withheld counterpart displayed, never from raw
 * facts. Every figure in `BiosimilarComparisonRow` — penetration, cost per mg,
 * the substitution headroom — is computed in JavaScript over unfiltered
 * `canonical_fact` rows. There is no way to "release-scope" those numbers into
 * correctness: the comparability gate, the quantity-basis gate and the withheld
 * complement all live in SQL now, and this path predates all three.
 *
 * So under an active release this page is RETIRED rather than scoped, which is
 * the other branch condition 1 allows. It is not silently blanked: the view says
 * what superseded it and links there. The code is kept, not deleted, because it
 * remains the only path for a dataset that is not a gated Pillar B release.
 */
export const getBiosimilarRetirement = cache(async (): Promise<string | null> => {
  return activeReleaseId();
});

export async function getBiosimilarComparison(): Promise<BiosimilarComparisonRow[]> {
  // Retired under a gated release — see getBiosimilarRetirement.
  if ((await activeReleaseId()) !== null) return [];

  const facts = await selectCanonicalFacts();
  const latestYear = selectReportingPeriod(facts).year;
  // The whole fact set goes in and `latestYear` selects what is reported. The
  // previous version pre-filtered to the latest year before calling, which hid
  // every earlier year's first biosimilar dispensing from the window test.
  return buildBiosimilarRowsImpl(facts, latestYear, BIOSIMILAR_BUILD_OPTIONS);
}

function compactEur(value: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function buildReviewSignals({
  biosimilarRows,
  organizationLabels,
  unresolvedRecordCount,
  currentRecordCount,
  uploads,
  objectives,
}: {
  biosimilarRows: OrganizationComparison[];
  organizationLabels: Record<string,string>;
  unresolvedRecordCount: number;
  currentRecordCount: number;
  uploads: UploadRecord[];
  objectives: Objective[];
}): ReviewSignal[] {
  const signals: ReviewSignal[] = biosimilarRows
    .filter(({row}) => row.substitution_headroom_eur > 0)
    .sort((a,b)=>b.row.substitution_headroom_eur-a.row.substitution_headroom_eur)
    .slice(0, 5)
    .map(({organizationCode,row}) => ({
      id: `bio-${organizationCode}-${row.active_substance}`,
      kind: "biosimilar" as const,
      title: row.active_substance,
      // The margin is a €/unit differential inside one comparability stratum;
      // it is never computed on spend, whatever basis the share uses.
      context: `${organizationLabels[organizationCode] ?? organizationCode} · differenza €/unità tra originator e biosimilare nello stesso strato (via, forma, unità).`,
      value_label: `${compactEur(row.substitution_headroom_eur)} margine (limite superiore)`,
      href: "/dashboard-review/revisione-pillar-b",
      severity: row.substitution_headroom_eur >= 100000 ? "high" as const : "medium" as const,
    }));

  if (unresolvedRecordCount > 0) {
    signals.push({
      id: "quality-unresolved",
      kind: "quality",
      title: "Normalizzazione da completare",
      context: `${unresolvedRecordCount} record non sono ancora idonei a un confronto €/mg o €/DDD.`,
      value_label: currentRecordCount > 0
        ? `${Math.round((unresolvedRecordCount / currentRecordCount) * 100)}% dei record`
        : `${unresolvedRecordCount} record`,
      href: "/dashboard-review/dati",
      severity: "high",
    });
  }

  const discrepancies = uploads.filter((upload) => upload.status === "discrepancy_found");
  if (discrepancies.length > 0) {
    signals.push({
      id: "upload-discrepancies",
      kind: "upload",
      title: "Scarti di riconciliazione",
      context: "Uno o più caricamenti richiedono una verifica prima della pubblicazione.",
      value_label: `${discrepancies.length} file`,
      href: "/dashboard-review/dati",
      severity: "high",
    });
  }

  for (const objective of objectives.slice(0, 3)) {
    signals.push({
      id: `objective-${objective.id}`,
      kind: "objective",
      title: objective.metric,
      context: `Periodo ${objective.period_start} – ${objective.period_end}`,
      value_label: `Target ${objective.target_value}`,
      href: "/dashboard-review/obiettivi",
      severity: "info",
    });
  }

  const priority = { high: 0, medium: 1, info: 2 } as const;
  return signals.sort((a, b) => priority[a.severity] - priority[b.severity]);
}

export async function getObjectives(): Promise<Objective[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("objectives")
    .select("*")
    .order("period_start", { ascending: false });
  if (error) throw new Error(`objectives query failed: ${error.message}`);
  return (data ?? []) as Objective[];
}

// Calls the my_objective_rank(p_metric) SECURITY DEFINER function (see
// supabase_schema.sql, section 6). It derives the caller's own org from
// auth.uid() server-side and returns only the caller's own row — never
// another org's identity or value. null means no ranking is available for
// this metric (no approved ASL membership, or no confirmed formula for an
// objective without an atc_scope), which the UI must show distinctly from
// an actual last-place rank.
export async function getObjectiveRank(metric: string): Promise<ObjectiveRank | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_objective_rank", { p_metric: metric });
  if (error) {
    console.error("my_objective_rank failed:", error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  return (row as ObjectiveRank | undefined) ?? null;
}

export async function getUploads(): Promise<UploadRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("uploads")
    .select("*")
    .order("uploaded_at", { ascending: false });
  if (error) throw new Error(`uploads query failed: ${error.message}`);
  return ((data ?? []) as UploadRecord[]).filter(upload => !isArchivedUpload(upload));
}

export async function getBenchmarkData(): Promise<BenchmarkData> {
  const [facts, org, scope] = await Promise.all([selectCanonicalFacts(), getCurrentOrg(), getCoreScope()]);
  const latestYear = selectReportingPeriod(facts).year;
  if (!org || latestYear === null) {
    return {
      latest_year: latestYear,
      rows: [],
      peer_count: 0,
      biosimilar_penetration_basis: null,
      median_spend_eur: null,
      unit_cost_strata: 0,
      median_biosimilar_penetration: null,
      benchmark_available: false,
      limitation: "Nessun perimetro territoriale disponibile.",
    };
  }

  const orgNames = new Map((scope?.scopedOrgs ?? []).flatMap(o => [[o.aslCode, o.label], [o.orgCode, o.label]]));

  // The previous COMPLETE year, from the same selector as latestYear.
  const previousYear = selectReportingPeriod(facts).previousYear;
  const currentAll = facts.filter((fact) => fact.year === latestYear && fact.asl_code);
  // Cross-Azienda comparison is computed on the dispensed basis only.
  const current = currentAll.filter((fact) => comparableSpendEur(fact) !== null);
  if (current.length === 0 && currentAll.some(isAcquistatoOnlyFact)) {
    return {
      latest_year: latestYear,
      rows: [],
      peer_count: 0,
      biosimilar_penetration_basis: null,
      median_spend_eur: null,
      unit_cost_strata: 0,
      median_biosimilar_penetration: null,
      benchmark_available: false,
      limitation: ACQUISTATO_ONLY_LIMITATION,
    };
  }
  const previous = previousYear === null
    ? []
    : facts.filter(
        (fact) =>
          fact.year === previousYear && fact.asl_code && comparableSpendEur(fact) !== null,
      );
  const byOrg = new Map<string, CanonicalFact[]>();
  const previousSpend = new Map<string, number>();
  for (const fact of current) {
    const code = fact.asl_code!;
    const group = byOrg.get(code) ?? [];
    group.push(fact);
    byOrg.set(code, group);
  }
  for (const fact of previous) {
    const code = fact.asl_code!;
    previousSpend.set(code, (previousSpend.get(code) ?? 0) + (comparableSpendEur(fact) ?? 0));
  }

  // One basis for the WHOLE cohort. Letting each ASL pick its own would set a
  // mg-based percentage beside a packs-based one in the same column, and median
  // them together, as though they were the same measure.
  const cohortBasis = commonPenetrationBasis(Array.from(byOrg.values()));
  const unitCost = unitCostIndexByOrg(byOrg, comparableSpendEur);
  const baseRows = Array.from(byOrg.entries()).map(([code, group]) => {
    const spend = group.reduce((sum, fact) => sum + (comparableSpendEur(fact) ?? 0), 0);
    const packs = sumPacks(group);
    return {
      org_code: code,
      org_name: orgNames.get(code) ?? code,
      spend_eur: spend,
      packs,
      spend_yoy: ratio(spend, previousSpend.get(code) ?? 0),
      unit_cost_index: unitCost.byOrg.get(code)?.index ?? null,
      unit_cost_coverage: unitCost.byOrg.get(code)?.coverage ?? null,
      biosimilar_penetration: cohortBasis === null ? null : penetrationOn(group, cohortBasis),
      biosimilar_penetration_quantity_coverage:
        cohortBasis === "comparable_quantity" ? comparableQuantityShare(group).quantity_coverage : null,
      normalization_coverage: normalizationCoverage(group),
      is_current_org: scope?.scopedOrgs.some(o => o.orgCode === org.org_code && o.aslCode === code) ?? false,
    };
  });
  const medianSpend = median(baseRows.map((row) => row.spend_eur));
  const rows: BenchmarkRow[] = baseRows
    .map((row) => ({
      ...row,
      spend_index: medianSpend && medianSpend > 0 ? (row.spend_eur / medianSpend) * 100 : null,
    }))
    .sort((a, b) => b.spend_eur - a.spend_eur);
  const benchmarkAvailable = rows.length > 1;

  return {
    latest_year: latestYear,
    rows,
    peer_count: scope?.allOrganizations || scope?.regional ? rows.length : Math.max(rows.length - 1, 0),
    median_spend_eur: medianSpend,
    unit_cost_strata: unitCost.sharedStrata,
    biosimilar_penetration_basis: cohortBasis,
    median_biosimilar_penetration: median(
      rows
        .map((row) => row.biosimilar_penetration)
        .filter((value): value is number => value !== null),
    ),
    benchmark_available: benchmarkAvailable,
    limitation: benchmarkAvailable
      ? null
      : org.org_type === "asl"
        ? "La policy RLS dell’ASL espone solo i dati della propria azienda. Il confronto identificabile è disponibile esclusivamente alla Regione."
        : "Servono almeno due ASL con dati nello stesso periodo per costruire il benchmark.",
  };
}

const UNCLASSIFIED = "__unclassified__";

function filterExplorerFacts(facts: CanonicalFact[], filters: ExplorerFilters): CanonicalFact[] {
  const matches = (actual: string | null, expected: string | undefined) =>
    !expected || (actual ?? UNCLASSIFIED) === expected;
  return facts.filter(
    (fact) =>
      matches(fact.asl_code, filters.asl) &&
      matches(fact.atc1, filters.atc1) &&
      matches(fact.atc2, filters.atc2) &&
      matches(fact.atc3, filters.atc3) &&
      matches(fact.atc4, filters.atc4) &&
      matches(fact.atc5, filters.atc5) &&
      matches(fact.active_substance, filters.molecule),
  );
}

function explorerValue(fact: CanonicalFact, level: ExplorerLevel): string {
  if (level === "asl") return fact.asl_code ?? UNCLASSIFIED;
  if (level === "molecule") return fact.active_substance ?? UNCLASSIFIED;
  if (level === "aic") return fact.aic ?? UNCLASSIFIED;
  return fact[level] ?? UNCLASSIFIED;
}

function explorerLabel(
  code: string,
  level: ExplorerLevel,
  facts: CanonicalFact[],
  orgNames: Map<string, string>,
): string {
  if (code === UNCLASSIFIED) return "Non classificato";
  if (level === "asl") return orgNames.get(code) ?? code;
  if (level === "atc1") return ATC1_NAMES[code] ?? code;
  if (level === "aic") {
    const match = facts.find((fact) => fact.aic === code);
    return match?.brand_name ?? match?.product_description_raw ?? code;
  }
  return code;
}

function explorerHref(filters: ExplorerFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `/dashboard-review/ricerca?${query}` : "/dashboard-review/ricerca";
}

export async function getExplorerData(filters: ExplorerFilters): Promise<ExplorerData> {
  const [facts, org, scope] = await Promise.all([selectCanonicalFacts(), getCurrentOrg(), getCoreScope()]);
  const latestYear = selectReportingPeriod(facts).year;
  const levels: ExplorerLevel[] = scope?.allOrganizations || scope?.regional
    ? ["asl", "atc1", "atc2", "atc3", "atc4", "atc5", "molecule", "aic"]
    : ["atc1", "atc2", "atc3", "atc4", "atc5", "molecule", "aic"];
  const filterOrder: Array<[ExplorerLevel, keyof ExplorerFilters]> = [
    ["asl", "asl"],
    ["atc1", "atc1"],
    ["atc2", "atc2"],
    ["atc3", "atc3"],
    ["atc4", "atc4"],
    ["atc5", "atc5"],
    ["molecule", "molecule"],
  ];
  const level = levels.find((candidate) => {
    const filterKey = filterOrder.find(([item]) => item === candidate)?.[1];
    return candidate === "aic" || (filterKey ? !filters[filterKey] : false);
  }) ?? "aic";

  const orgNames = new Map((scope?.scopedOrgs ?? []).flatMap(o => [[o.aslCode, o.label], [o.orgCode, o.label]]));

  const previousYear = selectReportingPeriod(facts).previousYear;
  const currentBase = filterExplorerFacts(
    latestYear === null ? [] : facts.filter((fact) => fact.year === latestYear),
    filters,
  );
  const previousBase = filterExplorerFacts(
    previousYear === null ? [] : facts.filter((fact) => fact.year === previousYear),
    filters,
  );
  const totalSpend = currentBase.reduce((sum, fact) => sum + (fact.total_cost_eur ?? 0), 0);
  const currentGroups = new Map<string, CanonicalFact[]>();
  const previousSpend = new Map<string, number>();
  for (const fact of currentBase) {
    const key = explorerValue(fact, level);
    const group = currentGroups.get(key) ?? [];
    group.push(fact);
    currentGroups.set(key, group);
  }
  for (const fact of previousBase) {
    const key = explorerValue(fact, level);
    previousSpend.set(key, (previousSpend.get(key) ?? 0) + (fact.total_cost_eur ?? 0));
  }
  const explorerPacks = packCoverage(currentBase);
  const filterKey = filterOrder.find(([candidate]) => candidate === level)?.[1];
  // Siblings at one level share a basis, for the same reason the benchmark cohort
  // does: a parent shown on mg beside children shown on packs makes the figure
  // appear to jump on drill-in when only the denominator changed.
  const levelBasis = commonPenetrationBasis(Array.from(currentGroups.values()));
  const nodes: ExplorerNode[] = Array.from(currentGroups.entries())
    .map(([key, group]) => {
      const spend = group.reduce((sum, fact) => sum + (fact.total_cost_eur ?? 0), 0);
      const packs = sumPacks(group);
      const nextFilters = filterKey ? { ...filters, [filterKey]: key } : filters;
      const therapeuticArea = combineTherapeuticAreas(
        group.map((fact) => classifyTherapeuticArea(fact.atc5, fact.atc4, fact.atc3, fact.atc2, fact.atc1)),
      );
      return {
        key,
        code: key === UNCLASSIFIED ? "—" : key,
        label: explorerLabel(key, level, group, orgNames),
        href: level === "aic" ? null : explorerHref(nextFilters),
        spend_eur: spend,
        spend_share: totalSpend > 0 ? spend / totalSpend : 0,
        packs,
        spend_yoy: ratio(spend, previousSpend.get(key) ?? 0),
        biosimilar_penetration: levelBasis === null ? null : penetrationOn(group, levelBasis),
        normalization_coverage: normalizationCoverage(group),
        record_count: group.length,
        therapeutic_area: therapeuticArea.label,
        therapeutic_area_status: therapeuticArea.status,
      };
    })
    .sort((a, b) => b.spend_eur - a.spend_eur);

  const breadcrumbs = [{ label: scope?.allOrganizations ? "Tutte le Aziende del rilascio" : org?.org_name ?? "Perimetro", href: "/dashboard-review/ricerca" }];
  const accumulated: ExplorerFilters = {};
  for (const [candidate, key] of filterOrder) {
    const value = filters[key];
    if (!value || !levels.includes(candidate)) continue;
    accumulated[key] = value;
    breadcrumbs.push({
      label: explorerLabel(value, candidate, currentBase, orgNames),
      href: explorerHref(accumulated),
    });
  }

  return {
    latest_year: latestYear,
    level,
    level_label: EXPLORER_LEVEL_LABEL[level],
    breadcrumbs,
    nodes,
    total_spend_eur: totalSpend,
    total_packs: explorerPacks.packs,
    packs_coverage: explorerPacks.coverage,
    filters,
  };
}

export async function getLineageData(): Promise<LineageData> {
  const facts = await selectCanonicalFacts();
  const bySource = new Map<string, CanonicalFact[]>();
  for (const fact of facts) {
    const group = bySource.get(fact.source_version_id) ?? [];
    group.push(fact);
    bySource.set(fact.source_version_id, group);
  }
  const sources: LineageSource[] = Array.from(bySource.entries())
    .map(([sourceVersionId, group]) => {
      const timestamps = group
        .map((fact) => Date.parse(fact.created_at))
        .filter(Number.isFinite);
      const years = group.map((fact) => fact.year).filter(Number.isFinite);
      return {
        source_version_id: sourceVersionId,
        latest_loaded_at: latestIso(timestamps),
        // A SPAN, not a reporting period: first..latest year this source covers.
        // The extreme is right here and must not be swapped for the complete-year
        // selector, which answers a different question. It is computed by
        // iteration because `group` is every row of one release — 261,153 of
        // them — and spreading that many arguments throws RangeError.
        first_year: minOf(years),
        latest_year: maxOf(years),
        record_count: group.length,
        spend_eur: group.reduce((sum, fact) => sum + (fact.total_cost_eur ?? 0), 0),
        geography_count: new Set(
          group.map((fact) => fact.asl_code ?? fact.region_code).filter(Boolean),
        ).size,
        normalized_coverage: normalizationCoverage(group),
        unresolved_count: group.filter(isUnresolved).length,
      };
    })
    .sort((a, b) => (b.latest_loaded_at ?? "").localeCompare(a.latest_loaded_at ?? ""));
  const allTimestamps = facts.map((fact) => Date.parse(fact.created_at)).filter(Number.isFinite);

  return {
    sources,
    total_records: facts.length,
    latest_loaded_at: latestIso(allTimestamps),
    unresolved_records: facts.filter(isUnresolved).length,
    normalization_coverage: normalizationCoverage(facts),
  };
}

export async function getReviewWorkspaceData(): Promise<ReviewWorkspaceData> {
  const [facts, objectives, uploads] = await Promise.all([
    selectCanonicalFacts(),
    getObjectives(),
    getUploads(),
  ]);
  const latestYear = selectReportingPeriod(facts).year;
  const current = latestYear === null ? [] : facts.filter((fact) => fact.year === latestYear);
  const signals = buildReviewSignals({
    // `facts`, not `current`, for the same reason as in getSpendDashboardData.
    biosimilarRows: organizationBiosimilarRows(facts, latestYear, BIOSIMILAR_BUILD_OPTIONS),
    organizationLabels: (await getCoreScope())?.aslLabels ?? {},
    unresolvedRecordCount: current.filter(isUnresolved).length,
    currentRecordCount: current.length,
    uploads,
    objectives: objectives.filter(
      (objective) => latestYear === null || new Date(objective.period_end).getUTCFullYear() >= latestYear,
    ),
  });
  return {
    latest_year: latestYear,
    signals,
    objectives,
    discrepancy_uploads: uploads.filter((upload) => upload.status === "discrepancy_found"),
    high_priority_count: signals.filter((signal) => signal.severity === "high").length,
  };
}

function average(values: number[]): number | null {
  return values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : null;
}

function antibioticSchemaIsMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = error.message?.toLowerCase() ?? "";
  return error.code === "42P01" || error.code === "PGRST205" || message.includes("does not exist") || message.includes("schema cache");
}

// Real rows always come from the RLS-scoped fact table. When the approved
// organization has not loaded antibiotic data yet, this returns null and the
// page says so. It used to fall back to a synthetic organization; the owner
// ruled on 13 Oct 2026 that synthesized data must not stand in for an
// organization's own figures.
export async function getAntibioticStewardship(): Promise<AntibioticStewardshipData | null> {
  const [org, privateScope] = await Promise.all([getCurrentOrg(), resolvePrivateScope()]);
  if (!org || !privateScope) return null;
  const supabase = privateScope.db;
  // No year filter. This previously read .gte("year", 2023).lte("year", 2025),
  // which silently dropped every year outside that window: a 2026 upload could
  // never reach latestYear below, and an organization whose ONLY year was 2026
  // got zero rows here and fell through to the synthetic fallback (since
  // removed), showing a real customer synthetic figures labelled "Dati autorizzati".
  //
  // Every sibling function in this file already derives its window from the
  // data (latestYear = the latest COMPLETE year); this was the sole outlier. RLS
  // scopes the read, so unfiltered returns exactly the rows it returned before.
  // A rolling window such as max(year) - 2 would not be an improvement: it
  // trades one silent truncation for another, dropping the earliest year from
  // the trend the moment a new one lands.
  const { data, error, count } = await supabase
    .from("antibiotic_consumption_fact")
    .select("*", { count: "exact" })
    .in("org_code", privateScope.orgCodes);
  if (antibioticSchemaIsMissing(error)) return null;
  if (error) throw new Error(`antibiotic_consumption_fact query failed: ${error.message}`);
  const rows = (data ?? []) as AntibioticConsumptionFact[];
  if (count === null || count !== rows.length) throw new Error('ANTIBIOTIC_INCOMPLETE_READ');
  if (rows.length === 0) return null;

  const isRegione = privateScope.regional || privateScope.allOrganizations;
  // An asl-type caller's RLS-scoped query only ever returns their own
  // org's rows anyway. A regione-type caller has no antibiotic row of its
  // own (data is uploaded per ASL) — RLS already hands them every ASL in
  // their region, so "their view" is the pooled total across those ASLs,
  // the same org.region_code join pattern the RLS policy itself uses.
  const codes = new Set(privateScope.orgCodes);
  const ownRows = rows.filter(r => codes.has(r.org_code));
  const summaryRows = ownRows.filter((row) => row.unit_code === null);
  if (summaryRows.length === 0) return null;

  const yearGroups = new Map<number, Map<AwareCategory, { cost: number; ddd: number }>>();
  for (const r of summaryRows) {
    const catMap = yearGroups.get(r.year) ?? new Map<AwareCategory, { cost: number; ddd: number }>();
    const current = catMap.get(r.aware_category) ?? { cost: 0, ddd: 0 };
    catMap.set(r.aware_category, {
      cost: current.cost + (r.cost_eur ?? 0),
      ddd: current.ddd + (r.ddd_count ?? 0),
    });
    yearGroups.set(r.year, catMap);
  }

  const awareByYear: AwareYearRow[] = Array.from(yearGroups.entries())
    .map(([year, cats]) => {
      const access = cats.get("A") ?? { cost: 0, ddd: 0 };
      const watch = cats.get("W") ?? { cost: 0, ddd: 0 };
      const reserve = cats.get("R") ?? { cost: 0, ddd: 0 };
      const total = cats.get("T");
      // No "T" row for this year means there's nothing to check the
      // breakdown against — show A/W/R as given rather than guessing at a
      // gap that can't actually be computed.
      const costGap = total !== undefined ? total.cost - (access.cost + watch.cost + reserve.cost) : 0;
      const dddGap = total !== undefined ? total.ddd - (access.ddd + watch.ddd + reserve.ddd) : 0;
      return {
        year,
        access: access.cost,
        watch: watch.cost,
        reserve: reserve.cost,
        unclassified: Math.max(costGap, 0),
        accessDdd: access.ddd,
        watchDdd: watch.ddd,
        reserveDdd: reserve.ddd,
        unclassifiedDdd: Math.max(dddGap, 0),
        hasNegativeGap: costGap < -0.01 || dddGap < -0.01,
      };
    })
    .sort((a, b) => a.year - b.year);

  // Org-level indicators come from the latest year's "T" (total) row —
  // DDD/100 bed-days, spend/bed-day and spend/DDD are overall stewardship
  // indicators, not per-AWaRe-category figures.
  const ownTotalsByYear = new Map<number, CategoryTotals>();
  for (const r of summaryRows) {
    if (r.aware_category !== "T") continue;
    const cur = ownTotalsByYear.get(r.year) ?? { cost: 0, ddd: 0, bedDays: 0, population: 0 };
    cur.cost += r.cost_eur ?? 0;
    cur.ddd += r.ddd_count ?? 0;
    cur.bedDays += r.bed_days ?? 0;
    cur.population += r.population ?? 0;
    ownTotalsByYear.set(r.year, cur);
  }
  const latestYear = ownTotalsByYear.size > 0 ? Math.max(...ownTotalsByYear.keys()) : null;
  const orgIndicators = latestYear !== null ? indicatorsFromTotals(ownTotalsByYear.get(latestYear), latestYear) : null;
  const annual = Array.from(ownTotalsByYear.entries())
    .sort(([a], [b]) => a - b)
    .map(([year, totals], index, all) => {
      const previous = all[index - 1]?.[0] === year - 1 ? all[index - 1][1] : undefined;
      return {
        year,
        costEur: totals.cost,
        dddCount: totals.ddd,
        bedDays: totals.bedDays,
        population: totals.population,
        ...reportedRoundingBounds(summaryRows.filter(r => r.year === year && r.aware_category === 'T')),
        ...indicatorsFromTotals(totals, year)!,
        costYoy: previous?.cost ? totals.cost / previous.cost - 1 : null,
        dddYoy: previous?.ddd ? totals.ddd / previous.ddd - 1 : null,
      };
    });

  // Regional average: the mean of each OTHER org's own indicator for the
  // same year (not a pooled ratio-of-sums) — for an asl-type caller,
  // peerRows is always empty, since RLS never hands them another org's
  // rows, so no benchmark is fabricated from data that isn't there.
  let regionalAverage: AntibioticStewardshipData["regionalAverage"] = null;
  if (latestYear !== null) {
    const peerRows = isRegione ? summaryRows : rows.filter((r) => r.unit_code === null && r.org_code !== org.org_code);
    const totalsByOrg = new Map<string, CategoryTotals>();
    for (const r of peerRows) {
      if (r.aware_category !== "T" || r.year !== latestYear) continue;
      totalsByOrg.set(r.org_code, {
        cost: r.cost_eur ?? 0,
        ddd: r.ddd_count ?? 0,
        bedDays: r.bed_days ?? 0,
        population: r.population ?? 0,
      });
    }
    const perOrg = Array.from(totalsByOrg.values())
      .map(t => indicatorsFromTotals(t, latestYear))
      .filter((i): i is AntibioticIndicatorSet => i !== null);

    if (perOrg.length > 0) {
      regionalAverage = {
        dddPer100BedDays: average(perOrg.map((i) => i.dddPer100BedDays).filter((v): v is number => v !== null)),
        costPerBedDay: average(perOrg.map((i) => i.costPerBedDay).filter((v): v is number => v !== null)),
        costPerDdd: average(perOrg.map((i) => i.costPerDdd).filter((v): v is number => v !== null)),
        dddPer1000ResidentsDay: average(perOrg.map((i) => i.dddPer1000ResidentsDay).filter((v): v is number => v !== null)),
        costPerCapita: average(perOrg.map((i) => i.costPerCapita).filter((v): v is number => v !== null)),
        peerOrgCount: perOrg.length,
      };
    }
  }

  const units = latestYear === null
    ? []
    : ownRows
        .filter((row) => row.unit_code !== null && row.aware_category === "T" && row.year === latestYear)
        .map((row) => {
          const totals: CategoryTotals = {
            cost: row.cost_eur ?? 0,
            ddd: row.ddd_count ?? 0,
            bedDays: row.bed_days ?? 0,
            population: 0,
          };
          return {
            orgCode: row.org_code,
            unitCode: row.unit_code!,
            unitName: row.unit_name?.trim() || row.unit_code!,
            costEur: totals.cost,
            dddCount: totals.ddd,
            bedDays: totals.bedDays,
            ...indicatorsFromTotals(totals, latestYear)!,
          };
        })
        .sort((a, b) => b.costEur - a.costEur);

  const provisional = summaryRows.some((row) => row.period_status === "provisional");
  return {
    mode: "real",
    summaryOrgCodesByYear: Object.fromEntries(
      [...ownTotalsByYear.keys()].map(year => [year,
        [...new Set(summaryRows.filter(row => row.year === year && row.aware_category === 'T').map(row => row.org_code))].sort(),
      ]),
    ),
    costBasis: summaryRows.every(row => row.source_note?.includes('CO1')) ? 'CO1' : 'source',
    sourceLabel: provisional
      ? "Dati reali del perimetro autorizzato · periodo provvisorio"
      : "Dati reali del perimetro autorizzato · annualità completa",
    awareByYear,
    annual,
    units,
    latestYear,
    orgIndicators,
    regionalAverage,
  };
}
