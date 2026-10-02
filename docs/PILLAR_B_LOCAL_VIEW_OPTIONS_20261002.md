# Pillar B panel-local controls: what each panel can switch, and what it may not

**2 October 2026.** Built after the owner asked whether the four global
filters (Azienda, period, channel, molecule) were "the only category switches
or selectors we can get for the whole of Pillar B". They were. Each panel now
has its own controls, and the limits of what a control may do are written
down here so nobody later adds a switch that forms a forbidden ratio.

## The rule

A global filter changes **which rows** the server fetches. A panel-local
control changes **how a panel reads rows the reader already holds**: it
re-sorts, re-slices, re-colours or narrows them. It never forms a new ratio.
Every variant a panel can switch to is shaped on the server by the same pure
functions the harness reconciles, and sent to the panel already sliced; the
browser only chooses among them. State lives in the URL (`history.replaceState`,
no server round trip), so a shared link opens on the same view.

## The controls

| panel | control | URL key | values | what it does |
|---|---|---|---|---|
| Profilo mensile | period | `serie` | `confronto` · `2024` · `2025` · `2026` | the two complete years side by side on one axis, or one year alone; 2026 only alone, flagged partial, never compared |
| Profilo mensile | metric | `cal` | `spesa` · `comparabile` · `perimetro` | reported spend · share of spend with a comparable quantity (fixed 0–100 % scale, never offered for 2026) · spend inside the biosimilar perimeter by status, **an amount, not a share** |
| Aziende | metric | `az` | `spesa` · `comparabile` · `record` | spend per year (two bars) · comparable share (one bar) · record count (one bar) |
| Variazioni per molecola | order | `ord` | `delta` · `pct` · `spesa` | by euro change · by rate, null rates (change from a zero base) always last · by 2025 spend |
| | top N | `n` | `10` · `25` · `50` | rows shown; the server sends 50 per order and perimeter |
| | perimeter | `perimetro` | `tutto` · `biosimilare` | whole ledger · only the substances of the biosimilar perimeter (**substance-level**, see below) |
| Concentrazione | year | `conc` | `2024` · `2025` | the ranking of one complete year; 2026 is never offered |
| | perimeter | `concperimetro` | `tutto` · `biosimilare` | its own key: two panels holding separate state behind one key would read differently after a click until a reload |
| Uptake in volume | route | `via` | a route present in the rows | exact filter on the route of administration; a route the rows do not contain is dropped, so the table cannot be narrowed to nothing by a URL |

Unknown values fall back to the default and a default value removes its key,
so a link never carries noise. All of this is in
`lib/dashboard-review/pillar-b/view-options.ts`, pure, with
`tests/pillar-b-view-options.test.mjs` (8 tests).

## What a control may not do, and why

- **The monthly chart draws no bar for a month with no record** (the former
  heatmap drew a hatched cell); a month observed with a known zero keeps its
  zero bar. 2026 is drawn only alone, flagged partial, never beside a complete
  year, and its comparable share is not assessable (the comparable-quantity
  basis covers the complete years only).
- **The calendar's `perimetro` metric is a spend, never a biosimilar share.**
  A monthly share of biosimilar over perimeter would be an adoption ratio
  without the monthly validity rule: a third denominator. The adoption
  section already shows the two legitimate denominators side by side.
- **The perimeter switch is substance-level and every label says so.** The
  molecule rows carry no product status; keeping "perimeter substances" keeps
  every presentation of those substances, including sheet 07's four
  "same substance, non-biosimilar" AICs. An AIC-exact perimeter
  needs a predicate in the database and is not claimed.
- **No control touches 2026.** The concentration year list is `[2024, 2025]`;
  the monthly profile draws 2026 only on its own, flagged partial, and never
  as a comparable share (the rule is applied to the period actually drawn,
  including a fallback, by `effectiveCalendarState`).
- **The route filter narrows the table, not the coverage measure above it.**
  The coverage card covers all routes; the table says so when a route is set.

## The empty set, explained

When a selection holds no perimeter row and a narrowing filter is active, the
filter bar shows one amber sentence built by `emptySelectionHint` in
`facets.ts` from one wider facets call (same substance and Azienda, every
channel, both complete years):

> Nessun record nel perimetro biosimilare per denosumab in ASL 1 con questi
> canali e anni. Record del perimetro presenti in: DD (2024) · DPC (2024, 2025).

or, when there is no perimeter row anywhere: "l'insieme è vuoto, non uno zero."
Presence is judged on the perimeter amounts of the wider call, not on its
record count, because the trigger counts perimeter rows: a channel holding
only out-of-perimeter rows of the substance is not offered as "present".

## Evidence

`outputs/pillar-b/logs/b43_view_variants_reconciliation.mjs` (variants) and
`b44_plotted_layer_reconciliation.mjs` (what the charts draw), both in the
local evidence repository, run on the real release rows under the Regione
user's RLS and the reviewer's service role, oracle = SQL on `canonical_fact`
and the frozen workbook. They check, to the cent: perimeter-only and
whole-ledger trend totals per year; that the three orders are permutations,
with null rates last and ties stable; concentration top-5 share, group count
and sampled curve per year and perimeter; calendar perimeter amounts per
month; the route list and its partition; the empty-state hint's channels and
years. The figures themselves are in the logs, not here: this repository is
public, and workbook-derived figures stay behind login.

## Not built here (the groups the owner was told about)

- the funnel gate drill-down and any Azienda/channel/molecule narrowing of the
  funnel: needs SQL (a per-gate function), not a local control;
- the import-dependent sheets (B07/B11/B13/B15/B16): statistical results that
  cannot be recomputed in SQL, pending the owner's decision.
