import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire, register } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  REGIONAL_FAILED, REGIONAL_FILTER_NOTE, REGIONAL_MIX_METHOD, REGIONAL_NOT_DEPLOYED, REGIONAL_QUOTA2_LABEL, REGIONAL_UPTAKE_METHOD,
  parseRegionalComparator, regionalComparatorRequest, regionalSentences, regionalViewProps,
} from "../lib/dashboard-review/pillar-b/regional-comparator.ts";
import { formatPercent } from "../lib/dashboard-review/format.ts";

// PB-V5-01 FOR AN ORDINARY AZIENDA: its own figures beside a POOLED aggregate
// of its own Region, from the aggregate-only, caller-bound database function
// (supabase/migrations/20261009120000). The function is reconciled and
// attacked on the frozen release in outputs/pillar-b/logs/b49; here: how the
// page asks for it, how strictly its answer is read, who may call it, and that
// what reaches the markup is shares and sentences, never a peer or an amount.

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (f) => fs.readFileSync(`${root}${f}`, "utf8").replace(/\r\n/g, "\n");

// SYNTHETIC values only: this repository is public, and the real pooled
// shares belong to the private workbook (they live in the evidence logs).
const ok = (over = {}) => ({
  status: "ok", years: [2024, 2025],
  uptake: { quota1: { available: true, reason: null, share: 0.4 }, quota2: { available: true, reason: null, share: 0.6 } },
  channel_mix: [
    { year: 2024, available: true, reason: null, shares: { CO: 0.25, DD: 0.5, DPC: 0.25 } },
    { year: 2025, available: true, reason: null, shares: { CO: 0.2, DD: 0.55, DPC: 0.25 } },
  ],
  ...over,
});

// ------------------------------------------------------------------ request

test("asked only for an Azienda account, only without a channel or molecule filter, only for 2024/2025", () => {
  assert.deepEqual(regionalComparatorRequest({ aziendaAccount: false, years: [2025], channels: [], substance: null }), { ask: false, note: null },
    "a Regione or a reviewer has its own comparator: no call, no note");
  assert.deepEqual(regionalComparatorRequest({ aziendaAccount: true, years: [2025, 2024, 2025], channels: [], substance: null }), { ask: true, years: [2024, 2025] });
  assert.deepEqual(regionalComparatorRequest({ aziendaAccount: true, years: [2025], channels: ["CO"], substance: null }), { ask: false, note: REGIONAL_FILTER_NOTE });
  assert.deepEqual(regionalComparatorRequest({ aziendaAccount: true, years: [2025], channels: [], substance: "adalimumab" }), { ask: false, note: REGIONAL_FILTER_NOTE });
  const partial = regionalComparatorRequest({ aziendaAccount: true, years: [2026], channels: [], substance: null });
  assert.equal(partial.ask, false, "2026 is partial and never asked for");
  assert.match(REGIONAL_FILTER_NOTE, /tutti i canali/);
});

// ------------------------------------------------------------------ parsing

test("an answer is read in full, shares only, and each quota stands on its own", () => {
  const r = parseRegionalComparator(ok(), [2025, 2024]);
  assert.equal(r.kind, "answered");
  assert.deepEqual(r.quota1, { available: true, share: 0.4 });
  assert.deepEqual(r.mix.map((m) => m.year), [2024, 2025]);
  const half = parseRegionalComparator(ok({ uptake: { quota1: { available: true, reason: null, share: 0.5 }, quota2: { available: false, reason: "cell_rule", share: null } } }), [2024, 2025]);
  assert.equal(half.kind, "answered");
  assert.equal(half.quota1.available, true);
  assert.equal(half.quota2.available, false);
  assert.match(half.quota2.why, /^non disponibile \(per tutela dei dati delle altre Aziende/);
  assert.match(half.quota2.why, /almeno due di esse vi contribuiscono, nessuna prevale e nessuna ha importi negativi/);
  const nc = parseRegionalComparator(ok({ uptake: { quota1: { available: false, reason: "not_computable", share: null }, quota2: { available: false, reason: "cell_rule", share: null } } }), [2024, 2025]);
  assert.match(nc.quota1.why, /^non calcolabile \(importi regionali del periodo assenti, nulli o negativi per rettifiche\)$/);
  const mixOff = parseRegionalComparator(ok({ channel_mix: [{ year: 2024, available: true, reason: null, shares: { CO: 0.5, DD: 0.3, DPC: 0.2 } }, { year: 2025, available: false, reason: "cell_rule", shares: null }] }), [2024, 2025]);
  assert.equal(mixOff.mix[1].shares, null, "a withheld year stays null, never zeros");
  assert.match(mixOff.mix[1].why, /non disponibile/);
});

test("a status is a sentence, never a figure", () => {
  for (const status of ["no_release", "invalid_filter", "no_session", "no_membership", "ambiguous_membership", "not_an_azienda", "no_region", "unresolved_rows", "unexpected_channel"]) {
    const r = parseRegionalComparator({ status }, [2025]);
    assert.equal(r.kind, "unavailable", status);
    assert.match(r.why, /^Il confronto con la Regione non è disponibile/, status);
  }
});

test("anything other than the documented shape is refused whole (fail closed)", () => {
  const bad = [
    null, "ok", [], { status: "ok" }, { status: "weird" },
    ok({ years: [2025] }),                                                    // not the years asked
    ok({ years: [2024, 2026] }),
    ok({ uptake: { quota1: { available: true, reason: null, share: 1.2 }, quota2: { available: true, reason: null, share: 0.5 } } }),
    ok({ uptake: { quota1: { available: true, reason: null, share: -0.1 }, quota2: { available: true, reason: null, share: 0.5 } } }),
    ok({ uptake: { quota1: { available: false, reason: "cell_rule", share: 0 }, quota2: { available: true, reason: null, share: 0.5 } } }), // a zero for "withheld"
    ok({ uptake: { quota1: { available: false, reason: "made_up", share: null }, quota2: { available: true, reason: null, share: 0.5 } } }),
    ok({ channel_mix: [{ year: 2024, available: true, reason: null, shares: { CO: 0.5, DD: 0.3, DPC: 0.3 } }, ok().channel_mix[1]] }),  // not 100%
    ok({ channel_mix: [{ year: 2024, available: true, reason: null, shares: { CO: 0.5, DD: 0.5 } }, ok().channel_mix[1]] }),             // a channel missing
    ok({ channel_mix: [{ year: 2024, available: true, reason: null, shares: { CO: 0.4, DD: 0.3, DPC: 0.2, X: 0.1 } }, ok().channel_mix[1]] }),
    ok({ channel_mix: [ok().channel_mix[0]] }),                              // a year missing
    ok({ amount_eur: 123 }),                                                 // an unexpected key at the top
    ok({ uptake: { ...ok().uptake, peer_codes: ["x"] } }),                   // ... in the uptake
    ok({ uptake: { quota1: { available: true, reason: null, share: 0.4, eur: 1 }, quota2: ok().uptake.quota2 } }),
    ok({ channel_mix: [{ ...ok().channel_mix[0], total_eur: 1 }, ok().channel_mix[1]] }),
    ok({ uptake: { quota1: { available: true, reason: null, share: "0.4" }, quota2: ok().uptake.quota2 } }),    // a numeric string
    ok({ uptake: { quota1: { available: true, reason: "cell_rule", share: 0.4 }, quota2: ok().uptake.quota2 } }), // answered with a reason
    ok({ uptake: { quota1: { available: false, reason: "constructor", share: null }, quota2: ok().uptake.quota2 } }), // a prototype key
    ok({ uptake: { quota1: { available: false, reason: "no_denominator", share: null }, quota2: ok().uptake.quota2 } }), // a retired code
  ];
  for (const [i, raw] of bad.entries()) {
    const r = parseRegionalComparator(raw, [2024, 2025]);
    assert.equal(r.kind, "unavailable", `case ${i}`);
    assert.equal(typeof r.why, "string", `case ${i}: a sentence`);
  }
  assert.equal(parseRegionalComparator({ status: "constructor" }, [2025]).why, REGIONAL_FAILED, "a prototype key is not a status");
});

test("the two regional quotas are shown together or not at all, as the page's own are", () => {
  const half = regionalViewProps(parseRegionalComparator(ok({ uptake: {
    quota1: { available: true, reason: null, share: 0.4 }, quota2: { available: false, reason: "cell_rule", share: null } } }), [2024, 2025]));
  assert.equal(half.uptake.quota1.available, false, "quota 1 is withheld with its pair");
  assert.match(half.uptake.quota1.why, /le due quote regionali si mostrano solo insieme, e in questo periodo la quota 2 regionale non è disponibile/);
  assert.match(half.uptake.quota2.why, /per tutela dei dati delle altre Aziende/, "quota 2 keeps its own reason");
  const other = regionalViewProps(parseRegionalComparator(ok({ uptake: {
    quota1: { available: false, reason: "not_computable", share: null }, quota2: { available: true, reason: null, share: 0.6 } } }), [2024, 2025]));
  assert.match(other.uptake.quota2.why, /la quota 1 regionale non è disponibile/);
  assert.match(other.uptake.quota1.why, /^non calcolabile/);
  const both = regionalViewProps(parseRegionalComparator(ok(), [2024, 2025]));
  assert.deepEqual([both.uptake.quota1, both.uptake.quota2], [{ available: true, share: 0.4 }, { available: true, share: 0.6 }]);
});

test("view props: the method when answered, the reason otherwise, and no amount anywhere", () => {
  const answered = regionalViewProps(parseRegionalComparator(ok(), [2024, 2025]));
  assert.equal(answered.uptake.note, REGIONAL_UPTAKE_METHOD);
  assert.equal(answered.mix.note, REGIONAL_MIX_METHOD);
  assert.equal(answered.mix.years.length, 2);
  const note = regionalViewProps({ kind: "note", why: REGIONAL_NOT_DEPLOYED });
  assert.deepEqual(note.uptake, { quota1: null, quota2: null, note: REGIONAL_NOT_DEPLOYED });
  assert.equal(note.mix.years, null);
  // The method says what the brief requires, in the reader's language.
  assert.match(REGIONAL_UPTAKE_METHOD, /tutte le Aziende della Regione, compresa la tua/);
  assert.match(REGIONAL_UPTAKE_METHOD, /somma dei numeratori e la somma dei denominatori/);
  assert.match(REGIONAL_UPTAKE_METHOD, /non la media delle loro percentuali/);
  assert.match(REGIONAL_UPTAKE_METHOD, /propri mesi di primo uso locale/);
  assert.match(REGIONAL_UPTAKE_METHOD, /non coincide con la quota 2 calcolata per la Regione nel suo insieme, che conta dal primo uso della prima Azienda/);
  assert.match(REGIONAL_UPTAKE_METHOD, /non ha mai dispensato il biosimilare di una sostanza non entra nella quota 2 regionale/);
  assert.match(REGIONAL_UPTAKE_METHOD, /Della Regione sono mostrate solo quote: nessun importo e nessun valore di una singola altra Azienda/);
  assert.match(REGIONAL_UPTAKE_METHOD, /può dipendere anche dalle molecole su cui si concentra la spesa, non solo dall'adozione: non indica un risultato migliore o peggiore/,
    "a gap from the Region may be a matter of molecule mix (Simpson's paradox), and is no ranking");
  assert.match(REGIONAL_QUOTA2_LABEL, /ciascuna Azienda dal proprio primo uso/);
  assert.match(REGIONAL_MIX_METHOD, /compresa la tua/);
  assert.match(REGIONAL_MIX_METHOD, /non la media/);
  assert.match(REGIONAL_MIX_METHOD, /Per la Regione solo quote, nessun importo/);
  const all = regionalSentences();
  assert.ok(all.length >= 15 && all.includes(REGIONAL_UPTAKE_METHOD) && all.some((x) => /regionale non è disponibile/.test(x)), "every reason, status and pair sentence is scanned");
  for (const s of all) {
    assert.doesNotMatch(s, /nazional/i, "no national figure is implied");
    assert.doesNotMatch(s, /\bsua\b|\bLei\b/, "the page says tu, not Lei");
    assert.doesNotMatch(s, /funzione|database|rilascio|release|cell_rule|not_computable|unresolved|PB-V5|_/i, "no internal wording");
    assert.doesNotMatch(s, /miglior|peggior/.test(s) && !/non indica un risultato migliore o peggiore/.test(s) ? /./ : /$^/, "no ranking language");
  }
});

// --------------------------------------------------------------- source pins

test("the page asks only as an Azienda account, with the session client, and survives the call failing", () => {
  const page = read("app/dashboard-review/revisione-pillar-b/page.tsx");
  assert.match(page, /const aziendaAccount = !scope\.regional && !scope\.allOrganizations;/);
  assert.match(page, /regionalComparatorRequest\(\{\n\s*aziendaAccount, years: filters\.years, channels: filters\.channels, substance: filters\.substance,\n\s*\}\)/);
  assert.match(page, /shared\(\(\) => getRegionalComparator\(db, regionalYears\), "regional-comparator", regionalYears\.join\("\+"\)\)\n\s*\.catch\(/,
    "one call, with the page's own client (the Azienda's session), its failure caught on its own");
  assert.match(page, /isMissingFunction\(error\)\) return \{ kind: "note", why: REGIONAL_NOT_DEPLOYED \}/);
  assert.match(page, /return \{ kind: "note", why: REGIONAL_FAILED \}/);
  assert.equal((page.match(/getRegionalComparator\(/g) ?? []).length, 1);
  assert.match(page, /regional=\{aziendaAccount \? \(regionalProps\?\.uptake \?\? null\) : null\}/);
  assert.match(page, /channelsRegionalShares: aziendaAccount && regionalProps\?\.mix\.years/);
  // The Regione / reviewer comparator is untouched.
  assert.match(page, /comparatorAllowed\s*\?\s*getFacets\(db, \{ years, channels, substance: filters\.substance, aslCode: null, facets: \["channels"\] \}\)/);
  assert.doesNotMatch(page, /"[^"\n]*pillar_b_[a-z_]+[^"\n]*"/, "no database function name in a notice");
  assert.doesNotMatch(REGIONAL_FAILED + REGIONAL_NOT_DEPLOYED + REGIONAL_FILTER_NOTE, /pillar_b_/);
});

test("the reader sends the years only: no organisation, Region, user, channel or molecule", () => {
  const rpc = read("lib/dashboard-review/pillar-b/rpc.ts");
  assert.match(rpc, /db\.rpc\("pillar_b_regional_comparator", \{ p_years: \[\.\.\.years\] \}\)/);
  const mig = read("supabase/migrations/20261009120000_pillar_b_regional_comparator.sql");
  assert.match(mig, /create or replace function public\.pillar_b_regional_comparator\(p_years int\[\]\)\nreturns jsonb\nlanguage plpgsql\nstable\nsecurity definer\nset search_path = pg_catalog, pg_temp\n/,
    "built-in names first, the session's temporary schema last");
  assert.match(mig, /revoke all on function public\.pillar_b_regional_comparator\(int\[\]\) from public;/);
  assert.match(mig, /revoke all on function public\.pillar_b_regional_comparator\(int\[\]\) from anon;/);
  assert.match(mig, /revoke all on function public\.pillar_b_regional_comparator\(int\[\]\) from service_role;/);
  assert.match(mig, /grant execute on function public\.pillar_b_regional_comparator\(int\[\]\) to authenticated;/);
  assert.match(mig, /v_uid\s+uuid := auth\.uid\(\);/);
  assert.doesNotMatch(mig, /create temp|create temporary/i);
  assert.doesNotMatch(mig, /\b(alter|drop) (policy|table)\b/i, "canonical_fact's RLS and the tables are not touched");
  // Every relation read is schema-qualified.
  const body = mig.slice(mig.indexOf("as $$"), mig.lastIndexOf("$$;"));
  const rels = [...body.matchAll(/\b(?:from|join)\s+([a-z_][\w.]*)/gi)].map((m) => m[1].toLowerCase());
  const ctes = new Set(["codes", "claims", "resolved", "azienda", "base", "classified", "opened", "cells", "year_cells", "year_comps", "uptake_rule", "mix_rule", "totals", "uptake", "year_total", "mix", "unnest"]);
  assert.deepEqual([...new Set(rels.filter((r) => !ctes.has(r)))].sort(),
    ["public.canonical_fact", "public.organizations", "public.pillar_b_active_release", "public.user_organizations"]);
  // It calls no application function but auth.uid(): the release is read here.
  assert.doesNotMatch(body, /pillar_b_release\(\)/);
  assert.doesNotMatch(body, /exception when others/i);
  // Every row is attributed to one registered Azienda of the Region, or nothing.
  assert.match(body, /return jsonb_build_object\('status', 'unresolved_rows'\);/);
  // ... and every row carries CO, DD or DPC: a fourth channel would split the
  // quotas' channels from the mix's, and their difference is not a checked part.
  assert.match(body, /bool_or\(f\.channel is null or f\.channel not in \('CO', 'DD', 'DPC'\)\) as odd_channel/);
  assert.match(body, /return jsonb_build_object\('status', 'unexpected_channel'\);/);
  assert.match(body, /\(c\.az = v_org_code\) as own/);
});

// ------------------------------------------------------------- static render

const REPO_PKG = pathToFileURL(`${root}package.json`).href;
const hooks = `
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
let sucrase, stubs;
export async function initialize({ pkg }) {
  const req = createRequire(pkg);
  sucrase = req("sucrase");
  const react = pathToFileURL(req.resolve("react")).href;
  stubs = {
    "next/link": "import React from " + JSON.stringify(react) + "; export default function Link({ href, scroll, ...rest }) { return React.createElement('a', { href, ...rest }); }",
    "next/navigation": "export function useRouter() { return { replace() {}, push() {}, refresh() {} }; } export function usePathname() { return '/'; } export function useSearchParams() { return new URLSearchParams(); }",
  };
}
export async function resolve(specifier, context, nextResolve) {
  if (stubs[specifier]) return { url: "data:text/javascript," + encodeURIComponent(stubs[specifier]), shortCircuit: true };
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  if (url.startsWith("file:") && url.endsWith(".tsx")) {
    const file = fileURLToPath(url);
    const source = sucrase.transform(readFileSync(file, "utf8"), { transforms: ["typescript", "jsx"], jsxRuntime: "automatic", production: true, filePath: file }).code;
    return { format: "module", source, shortCircuit: true };
  }
  return nextLoad(url, context);
}`;
register("data:text/javascript," + encodeURIComponent(hooks), { data: { pkg: REPO_PKG } });
const req = createRequire(`${root}package.json`);
const React = req("react");
const { renderToStaticMarkup } = req("react-dom/server");
const V = await import(new URL("../components/dashboard-review/pillar-b-adoption-visuals.tsx", import.meta.url).href);
const h = React.createElement;

const ownRows = [
  { channel: "CO", spend_eur: 300, share: 0.3, byYear: { 2024: 140, 2025: 160 }, comparable_share: null },
  { channel: "DD", spend_eur: 500, share: 0.5, byYear: { 2024: 240, 2025: 260 }, comparable_share: null },
  { channel: "DPC", spend_eur: 200, share: 0.2, byYear: { 2024: 100, 2025: 100 }, comparable_share: null },
];

test("ChannelStack for an Azienda: its own bars with amounts, the Region's with shares only; a withheld year says why", () => {
  const parsed = parseRegionalComparator(ok({ channel_mix: [ok().channel_mix[0], { year: 2025, available: false, reason: "cell_rule", shares: null }] }), [2024, 2025]);
  const props = regionalViewProps(parsed);
  const markup = renderToStaticMarkup(h(V.ChannelStack, {
    rows: ownRows, years: [2024, 2025], selectedLabel: "ASL Esempio", comparatorNote: props.mix.note,
    regionalShares: { label: props.mix.label, years: props.mix.years },
  }));
  assert.match(markup, /Composizione per canale · Azienda e Regione/);
  assert.ok(markup.includes(REGIONAL_MIX_METHOD.replace(/'/g, "&#x27;")), "the method is in the lead");
  assert.ok(markup.includes(`aria-label="Composizione per canale, Regione, 2024: CO ${formatPercent(0.25)}, DD ${formatPercent(0.5)}, DPC ${formatPercent(0.25)}"`));
  assert.ok(markup.includes(`title="Regione, 2024 · CO: ${formatPercent(0.25)}"`), "a Region segment names its share and nothing else");
  assert.doesNotMatch(markup, /title="Regione, 2024 · [A-Z]+: [^"]*€/, "no amount in a Region segment");
  assert.match(markup, /non disponibile \(per tutela dei dati delle altre Aziende/);
  // The exact-value table: a share column for the Region, no amount column.
  assert.match(markup, /<th scope="col" class="px-3 py-2 text-right font-semibold">Quota Regione<\/th>/);
  assert.doesNotMatch(markup, /<th scope="col" class="px-3 py-2 text-right font-semibold">Regione<\/th>/);
  assert.match(markup, /min-w-\[27rem\]/);
  assert.ok(markup.includes(`>${formatPercent(0.25)}</td>`));
  assert.match(markup, />non disponibile<\/td>/);
});

test("ChannelStack for a Regione or reviewer is unchanged by the Azienda's props", () => {
  const comparator = { label: "Regione · 4 Aziende", aziende: 4, rows: ownRows };
  const a = renderToStaticMarkup(h(V.ChannelStack, { rows: ownRows, years: [2025], selectedLabel: "ASL 2", comparator }));
  const b = renderToStaticMarkup(h(V.ChannelStack, { rows: ownRows, years: [2025], selectedLabel: "ASL 2", comparator,
    regionalShares: { label: "Regione", years: [{ year: 2025, shares: { CO: 0.2, DD: 0.3, DPC: 0.5 }, why: null }] } }));
  assert.equal(a, b, "with the amount comparator present, the share-only bars are never drawn");
  assert.match(a, /min-w-\[34rem\]/);
});

const U = await import(new URL("../components/dashboard-review/pillar-b-value-uptake.tsx", import.meta.url).href);
const { buildValueUptake } = await import("../lib/dashboard-review/pillar-b/value-uptake.ts");
const { dumbbellRows, timelineModel } = await import("../lib/dashboard-review/pillar-b/adoption.ts");
const vrow = (s, v) => ({
  active_substance: s, first_local_month_key: v.first ?? null, perimeter_rows: 1, undated_rows: 0,
  inside_biosimilar_eur: v.ib ?? 0, inside_reference_eur: v.ir ?? 0, predates_biosimilar_eur: 0, predates_reference_eur: 0,
  boundary_biosimilar_eur: 0, boundary_reference_eur: 0, outside_biosimilar_eur: 0, outside_reference_eur: 0,
  unknown_biosimilar_eur: 0, unknown_reference_eur: 0, window_biosimilar_eur: v.wb ?? 0, window_reference_eur: v.wr ?? 0,
});
const uptakeMarkup = (regional) => {
  const view = buildValueUptake([vrow("alfa", { ib: 100, ir: 300, wb: 100, wr: 120, first: 2024 * 12 + 3 })]);
  return renderToStaticMarkup(h(U.PillarBValueUptake, {
    view, dumbbell: dumbbellRows(view), timeline: timelineModel(view, { fromKey: 2024 * 12 + 1, toKey: 2026 * 12 + 5 }),
    substanceHref: (s) => `/x?molecola=${s}`, resetHref: "/x", periodScope: "la tua Azienda · 2024 e 2025", regional,
  }));
};

test("the quota cards: each carries the Region's quota of the same kind under its own label, and the method is said once", () => {
  const markup = uptakeMarkup(regionalViewProps(parseRegionalComparator(ok(), [2024, 2025])).uptake);
  const q1 = markup.indexOf("Quota 1 · su mesi a validità riconosciuta"), q2 = markup.indexOf("Quota 2 · su mesi con biosimilare osservato qui");
  assert.ok(q1 >= 0 && q2 > q1);
  const r1 = markup.indexOf(`<strong class="text-foreground">Regione:</strong> <span class="font-mono text-foreground">${formatPercent(0.4)}</span>`);
  const r2 = markup.indexOf(`<strong class="text-foreground">${REGIONAL_QUOTA2_LABEL}:</strong> <span class="font-mono text-foreground">${formatPercent(0.6)}</span>`);
  assert.ok(r1 > q1 && r1 < q2, "quota 1's regional value in quota 1's card, labelled Regione");
  assert.ok(r2 > q2, "quota 2's in quota 2's card, labelled with its own clock");
  assert.equal(markup.split(">La tua Azienda<").length - 1, 2, "each card's own figure says whose it is");
  assert.match(markup, /dispensato nella tua Azienda in poi/);
  assert.match(markup, /Le due quote della tua Azienda differiscono di/);
  assert.match(markup, /nel valore della Regione, ciascuna Azienda conta dal proprio/);
  assert.equal(markup.split("non la media delle loro percentuali").length - 1, 1, "the method once");
});

test("the quota cards with one regional quota withheld: neither is shown, each says why", () => {
  const props = regionalViewProps(parseRegionalComparator(ok({ uptake: {
    quota1: { available: true, reason: null, share: 0.45 }, quota2: { available: false, reason: "cell_rule", share: null } } }), [2024, 2025]));
  const markup = uptakeMarkup(props.uptake);
  const q1 = markup.indexOf("Quota 1 · su mesi a validità riconosciuta"), q2 = markup.indexOf("Quota 2 · su mesi con biosimilare osservato qui");
  assert.ok(q1 >= 0 && q2 > q1);
  assert.ok(!markup.includes(`<span class="font-mono text-foreground">${formatPercent(0.45)}</span>`), "the lone quota 1 is not shown");
  const r1 = markup.indexOf("<strong class=\"text-foreground\">Regione:</strong> non disponibile (le due quote regionali si mostrano solo insieme, e in questo periodo la quota 2 regionale non è disponibile)");
  assert.ok(r1 > q1 && r1 < q2, "quota 1's card says it waits for its pair");
  const r2 = markup.indexOf(`<strong class="text-foreground">${REGIONAL_QUOTA2_LABEL}:</strong> non disponibile (per tutela dei dati delle altre Aziende`);
  assert.ok(r2 > q2, "quota 2 says why, in quota 2's card, with no figure");
  // Without the props (a Regione, a reviewer) nothing regional is drawn, and the copy is unchanged.
  const plain = uptakeMarkup(null);
  assert.doesNotMatch(plain, /Regione:|Regione, ciascuna/);
  assert.doesNotMatch(plain, /non la media delle loro percentuali|La tua Azienda/);
  assert.match(plain, /nell&#x27;ambito visibile \(l&#x27;Azienda selezionata, o la Regione\)/);
});

test("the quota cards with the comparator not asked (a filter) or not deployed: one sentence, no figure", () => {
  for (const why of [REGIONAL_FILTER_NOTE, REGIONAL_NOT_DEPLOYED, REGIONAL_FAILED]) {
    const markup = uptakeMarkup(regionalViewProps({ kind: "note", why }).uptake);
    assert.ok(markup.includes(why.replace(/'/g, "&#x27;")), why);
    assert.doesNotMatch(markup, /Regione:<\/strong>/);
  }
});

test("ChannelStack for an Azienda with no spend in the selection: its own card only, no comparison described", () => {
  const props = regionalViewProps(parseRegionalComparator(ok(), [2024, 2025]));
  const markup = renderToStaticMarkup(h(V.ChannelStack, {
    rows: [], years: [2024, 2025], selectedLabel: "ASL Esempio", comparatorNote: props.mix.note,
    regionalShares: { label: props.mix.label, years: props.mix.years },
  }));
  assert.match(markup, /Nessun canale osservato\./);
  assert.doesNotMatch(markup, /Azienda e Regione|Sotto la barra della tua Azienda|aria-label="Composizione per canale, Regione/);
});

test("the copy scan covers the comparator's sentences", () => {
  const v5 = read("tests/pillar-b-v5.test.mjs");
  assert.match(v5, /lib\/dashboard-review\/pillar-b\/regional-comparator\.ts/);
});

test("the note-only state (not deployed, a filter, a failed read): no sentence speaks of a regional value", () => {
  for (const why of [REGIONAL_NOT_DEPLOYED, REGIONAL_FILTER_NOTE, REGIONAL_FAILED]) {
    const markup = uptakeMarkup(regionalViewProps({ kind: "note", why }).uptake);
    assert.doesNotMatch(markup, /valore della Regione|La tua Azienda</, why);
    assert.match(markup, /Per la tua Azienda la quota 2 conta dal suo primo uso\./, why);
  }
});

test("ChannelStack for an Azienda: under a year with no bar of its own, no Region bar either", () => {
  const props = regionalViewProps(parseRegionalComparator(ok(), [2024, 2025]));
  const only2024 = ownRows.map((r) => ({ ...r, byYear: { 2024: r.byYear[2024] } }));
  const markup = renderToStaticMarkup(h(V.ChannelStack, {
    rows: only2024, years: [2024, 2025], selectedLabel: "ASL Esempio", comparatorNote: props.mix.note,
    regionalShares: { label: props.mix.label, years: props.mix.years },
  }));
  assert.match(markup, /aria-label="Composizione per canale, Regione, 2024:/);
  assert.doesNotMatch(markup, /aria-label="Composizione per canale, Regione, 2025:/);
  assert.ok(markup.includes("non mostrata: la tua Azienda non ha una barra per quest&#x27;anno"));
});

test("the national context card: separate, no figure, the AIFA source by title, a link to the public data, not a benchmark", async () => {
  const R = await import(new URL("../components/dashboard-review/pillar-b-review.tsx", import.meta.url).href);
  const src = read("components/dashboard-review/pillar-b-review.tsx");
  const fn = src.slice(src.indexOf("function NationalContextCard()"), src.indexOf("export function PillarBReview("));
  assert.ok(fn.length > 0, "the card is its own component");
  assert.match(src, /\{adoption\.valueUptakeSection\}\n\s*<\/Sub>\n\n\s*<NationalContextCard \/>/, "after the value-uptake section, outside it");
  const text = fn.replace(/<[^>]+>/g, " ").replace(/\{" "\}/g, " ");
  assert.doesNotMatch(text.replace(/2025|NSIS|quota [12]/g, ""), /\d|%|€/, "no figure, percentage or amount (only the source's year and the measures' names)");
  assert.match(fn, /non un termine di confronto/);
  assert.match(fn, /«Biosimilari: distribuzione dei consumi e della spesa secondo la forma di\s+somministrazione»/);
  assert.match(fn, /per territorio \(Regioni e Province\s+autonome\)/);
  assert.match(fn, /nei canali, nelle molecole e negli anni selezionati/);
  assert.match(fn, /non indica un risultato migliore o peggiore/);
  assert.match(fn, /quell&apos;ordine non si applica alle quote di questa pagina/);
  assert.match(fn, /<a href="\/pillar-b"/);
  assert.doesNotMatch(fn, /report 5/i, "named by title, as the linked page names it");
  assert.equal(typeof R.PillarBReview, "function");
});
