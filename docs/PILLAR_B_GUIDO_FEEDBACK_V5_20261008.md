# Pillar B feedback round 5 — Guido, 8 October 2026

Source: the three-page `Feedback v5 (2).pdf` and Guido's nine previously supplied HTML examples. These IDs extend the 5 October `PB-GA` tracker; do not renumber them. PDF comments are requests or questions, not authority to publish private rows or unvalidated measures. Baseline statuses are code-inspection findings at `16aee3d`, not live acceptance.

Status: **Open** = absent; **Partial** = related measure exists but the need is not met; **Evidence gate** = data or access contract first; **Decision** = owner/reviewer choice needed; **Verified** = independent arithmetic, access and live checks complete. The HTML figures are not a numerical source.

## A. Comparisons and chart meaning

| ID | Request | Baseline | Acceptance |
| --- | --- | --- | --- |
| **PB-V5-01** | With one Azienda selected, show a same-year regional channel-mix comparator below it (PDF p. 1; extends PB-GA-08/13). | **Evidence gate.** Azienda CO/DD/DPC composition exists; comparator absent. | Same year, channel and supported filters; exact euros and separate 100% bases. Regione/reviewer may use authorised rows. For an Azienda account, first approve regional-aggregate disclosure and build an aggregate-only RLS-safe function—never deliver peer rows/identities for browser aggregation. Test all account roles and zero bases. |
| **PB-V5-02** | Explain the two uptake dots, their overlap and connecting line (p. 1). | **Partial.** The axis already runs 0–100%, but a dot is easily mistaken for a bar start; equal dots overlap. | Say each dot is a share under a different month window; its nonzero position is the measured percentage. The segment is a percentage-point gap, not time/causation. Distinguish equal dots, show both exact values in a keyboard-accessible table/tooltip, and test missing/0/100% states and narrow screens. |

## B. Decision relevance and denominators

| ID | Request | Baseline | Acceptance |
| --- | --- | --- | --- |
| **PB-V5-03** | Put useful post-first-use reference spending ahead of Bridge B's less actionable early gates (p. 1). | **Partial.** Reconciled bridge and two review queues exist; audit gates remain prominent. | Lead with a substance-level organisational review question, never a savings or treatment claim. Put early/outside/boundary gates in a collapsed reconciliation, retaining every euro and the independent tie-out. Keep EU-only status as an evidence question until Italian status is verified. |
| **PB-V5-04** | Make the relevant biosimilar perimeter the 100% base rather than visually dominating the decision view with outside spend (p. 1). | **Partial.** Bars are absolute euros; current shares use all reported spend. | If adding a composition view, print `100% = biosimilar + reference spend in the selected scope/period`. Retain whole-ledger reconciliation separately. Never relabel perimeter composition as uptake. Reconcile both bases under every offered filter, including adjustments and empty bases. |
| **PB-V5-05** | Shorten the two review lists' explanation and show why a hospital team should use them (p. 1). | **Partial.** Lists link to evidence but technical prose leads. | Each list states one practical question, evidence to check, likely team and next organisational review step. Put detailed method a click away; no automatic substitution/saving. Guido/Alberto should be able to explain one row without a long preamble. |

## C. Customer-facing versus internal language

| ID | Request | Baseline | Acceptance |
| --- | --- | --- | --- |
| **PB-V5-06** | Remove `B_ADDRESSABLE_REFERENCE`, `B10`, `libro mastro` and similar internal identifiers from hospital-facing copy (pp. 1–2). | **Open.** These remain in rendered text. | Use precise Italian descriptions such as `spesa rendicontata` and `spesa del riferimento dopo il primo uso locale`. Keep IDs in code and internal evidence only. Search headings, legends, notes and accessible labels; retain necessary numerators/denominators. |
| **PB-V5-07** | Keep the frozen workbook and sheet-status inventory internal (p. 2). | **Open.** The private page still renders the 25-sheet map and sheet-number references. | Remove them from the customer page or move them to an explicitly internal reviewer/admin surface. Keep concise source, period, method and coverage disclosures needed to interpret figures. Verify no workbook/build-gate language reaches an ordinary Azienda page. |

## D. Analysis inspired by the HTML files

| ID | Request | Baseline | Measure contract |
| --- | --- | --- | --- |
| **PB-V5-08** | Explore price movement over time (p. 2; `price_cut_propagation_by_asl`). | **Evidence gate.** Spend trends are live; a monthly comparable unit-value timeline is not. | First show *observed gross unit cost*, same AIC/presentation, compatible unit, channel and Azienda, with cost/quantity numerator and denominator, coverage and missing months. B04/B06/B07 supply rules, not a contractual/net price. Do not claim a “cut” or causal propagation. Restrict cross-Azienda details to authorised reviewer/Regione scope. Reconcile every point to rows. |
| **PB-V5-09** | Assess a waterfall explaining the annual spend change and price component (p. 3; `expenditure_change_bridge_2024_2025`). | **Evidence gate.** Annual change is live; B06 decomposition is frozen but not served. | Import a provenance-tagged B06 result or independently rederive it for every offered filter, including price-plausibility adjudication, matched/unmatched, entry/exit and residual. Call it a decomposition of gross reported spend, not savings or causality. Import/check B13 separately before drawing intervals. Never compare five months of 2026 as a full year. |
| **PB-V5-10** | Decide whether raw versus standardised Azienda uptake is useful (p. 3; `uptake_raw_vs_standardised_by_asl`). | **Evidence gate / Decision.** Frozen B09 shows mix sensitivity; the page refuses a raw league table. | An authorised Regione/reviewer sensitivity plot may show raw and **substance-mix-standardised** values with identical cohort/years, weights and uncertainty. This is not clinical case-mix adjustment or a performance rank. Import/reproduce B09, test leave-one-out sensitivity, then ask Guido whether the explanatory view deserves screen space. No peer values for ordinary Azienda users. |
| **PB-V5-11** | Turn useful ideas in all nine HTML examples into genuine filter-responsive exploration, not copied pictures (owner request). | **Partial.** Several live panels have controls; the prototype set has not been systematically translated. | For each adopted view specify decision question, grain, unit, eligible population, exclusions, access, controls and drill-down. Compute each filtered output from validated server data and reconcile it independently. Supply exact-value tables. Keep workbook-derived visuals behind login and never copy embedded HTML figures. |

## HTML triage

The eight small files are essentially saved charts without native selector/input controls; the larger Spend overview has controls but mixes claims not validated for publication. All embed concrete figures. They are visual references, not source data, and none belongs in this public repository.

| Example | Reusable idea | Gate or refusal |
| --- | --- | --- |
| `monthly_spend_and_comparability_coverage.html` | Two linked monthly panels on one time axis; year/channel/molecule drill-down. | **Near-term:** both measures are live. Keep 2026 separate and missing months distinct from zero. |
| `biosimilar_watchlist_by_substance (1).html` | Searchable substance review list with an evidence drawer. | **Partial:** two live lists can grow from this; Italian product status must be verified before “available alternative”. |
| `biosimilar_volume_vs_value_uptake (1).html` | Paired compatible volume and value shares. | **Evidence gate:** reconcile the eligible volume pairs, each unit/route and excluded spend. No implied price ratio on mismatched bases. |
| `price_cut_propagation_by_asl (1).html` | Product-level small-multiple timeline with exact observed months. | **PB-V5-08:** observed unit values, not contractual cuts or causal propagation. |
| `uptake_raw_vs_standardised_by_asl (1).html` | Paired marks to reveal substance-mix sensitivity. | **PB-V5-10:** reviewer/Regione only after B09 verification; no performance ranking. |
| `expenditure_change_bridge_2024_2025 (1).html` | Reconciled waterfall with entry, exit, unmatched and residual visible. | **PB-V5-09:** B06/B13 provenance first; no saving claim. |
| `biosimilar_opportunity_funnel (1).html` | Stage/remaining-spend layout linked to review queues. | **Near-term design idea** for PB-V5-03/04; reject the prototype's Scenario A amount/interval as an operational result. |
| `comparability_exclusions_by_gate (1).html` | Named exclusion bars, separating remediable from structural exclusions. | **Evidence gate:** workbook sheet 08's nine euros need a versioned import or live per-gate function. |
| `Spend overview · VIS Pharma Compass prototype (1).html` | Expandable trends, concentration and drill-down patterns. | **Design only:** no projection, price effect or monetary opportunity without separate contracts. |

## Execution and sign-off with Claude Code

1. **First pass:** PB-V5-02–07. These are interpretation and presentation changes over already validated figures. Keep exact audit arithmetic while moving internal code/sheet labels out of customer copy. Add discriminating visual, accessibility, empty-state and denominator tests.
2. **Comparator:** PB-V5-01. Build the reviewer/Regione result first. Stop before widening an Azienda's access until the owner accepts a precise regional-aggregate disclosure contract and the database function passes role-isolation tests.
3. **Advanced analysis:** PB-V5-08–10, one measure at a time. Start from frozen B04/B06/B09 calculations and their caveats—not the HTML numbers. The annual waterfall is the practical first candidate; the monthly unit-value timeline needs stricter comparability; the mix-standardised view is explanatory, not a ranking.
4. **For every ID:** record commit, independent filtered reconciliation, identity/access checks, a live screenshot at normal and narrow widths, and Guido/Alberto's interpretation check where specified. `Verified` requires all of these, not only a build. No private workbook-derived figure goes on the public page.

This tracker alone authorises no production migration, data import, access change or deployment.

## Round 5 record (8 October 2026)

This section records, for each ID, what was changed, how it was checked and what remains. Release figures stay in the private evidence repository (`outputs/pillar-b`); this file names only statuses, methods and tests. Commits carry the IDs.

**Nothing here is `Verified` yet.** That needs live screenshots at normal and narrow width after the push, and Guido/Alberto's interpretation check where the acceptance asks for one.

Status words: **Done (local)** = implemented, unit-tested, reconciled on the real release in the PGlite harness and built; live check pending. **Evidence gate** and **Decision** keep the meanings given above.

| ID | Baseline (16aee3d) | Change | Source of the figures | Reconciliation | Authorisation test | Visual check | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **PB-V5-01** | Channel mix for the Azienda only, with years pooled. | One 100% bar per year for the selected Azienda, with an exact-value table. Reviewer and Regione accounts with an Azienda selected also see the Region's bar beneath it: same year, channels and molecule. The lead says the Region includes the selected Azienda. An Azienda account sees a one-line note instead, and the page never makes the regional call for it. | The `pillar_b_facets` channels facet. It is called a second time, without the Azienda, only when `regionalComparatorAllowed` is true. | b47 §B, for the Azienda and for the Region:<br>• every year × channel cell equals direct SQL; an absent cell stays empty, never 0;<br>• each year sums to 100%;<br>• a filtered-out channel has no value;<br>• the reviewer's Region equals the Regione's Region;<br>• the four Aziende add up to the Region, cell by cell. | b47 §C:<br>• an Azienda calling without an Azienda filter gets exactly its own rows, not the Region's;<br>• an Azienda naming a peer gets nothing;<br>• anonymous is refused;<br>• the rule is false for a one-Azienda or empty scope.<br>A unit test ties the page's call to the rule. | Pending live. | **Done (local)** for reviewer and Regione.<br>**Decision** for ordinary Azienda accounts: the regional aggregate is computed from peers' rows, so it first needs an owner-approved disclosure contract and an aggregate-only function. |
| **PB-V5-02** | Two dots on a 0–100% axis. The marks are not explained, and equal values overlap. | The lead explains three things: where a mark sits, what each mark is, and what the line means (a gap in percentage points, not time or cause). Quota 1 is a hollow ring and quota 2 a filled dot, so equal values stay distinguishable. Each row prints the gap in p.p. Each mark's title and accessible label give the share with its numerator and denominator in euros, or "non calcolabile" with the reason. | Value-uptake view; arithmetic unchanged. | Unit tests cover labels for present, missing, 0% and 100% values, and the gap's sign and rounding. | Scope unchanged. | Pending live, at normal and narrow width. | **Done (local).** |
| **PB-V5-03** | The Bridge B chart led the Adozione section. | Adozione now leads with the two review questions. The full bridge moves into a collapsed "Riconciliazione della spesa del perimetro, soglia per soglia", keeping every euro and the perimeter cross-check. | Unchanged. | b46 unchanged: gates to the cent, lists equal to gates. | Unchanged. | Pending live. | **Done (local).** |
| **PB-V5-04** | Perimeter bars in absolute euros, with shares of all reported spend. | New view "Composizione della spesa nel perimetro biosimilare". The chart states `100% = spesa per biosimilari e medicinali di riferimento`. Other statuses appear as context outside the 100%, as shares of reported spend. The bar is suppressed when the base is not positive or a part is negative. The view is withheld under a molecule filter, as before. The lead says it is not an adoption share. | The `pillar_b_facets` perimeter facet. | b47 §A, across seven scopes: reviewer, Regione, Azienda under RLS, and channel and molecule filters.<br>• base = SQL biosimilar + reference = the bridge-B perimeter (computed by a different function);<br>• parts = SQL by status;<br>• shares sum to 1;<br>• context + base = reported. | Same scopes, under RLS. | Pending live. | **Done (local)**, plus a **Decision** for Guido. An earlier rule says no status-based share is shown as adoption; he should confirm this composition, labelled as composition rather than uptake, is acceptable beside it. |
| **PB-V5-05** | Two long technical introductions. | Each list becomes a "domanda di revisione": the question, the evidence to check, the likely team and the next step. The method is one click away, and rows link to the molecule. | Review queues; arithmetic unchanged. | b46 §D: lists equal the gates in every scope. | Unchanged. | Pending live. Guido/Alberto to explain one row. | **Done (local)**; interpretation check pending. |
| **PB-V5-06** | Gate ids, block codes, sheet numbers, "libro mastro" and function names appeared in rendered text. | Replaced with plain Italian ("spesa rendicontata", "riferimento dopo il primo uso", "ricostruzione mese per mese", …). The Limiti labels no longer carry codes. | — | A source-scan test covers the rendered components and the strings they import, excluding comments and imports. | The reviewer-only internal block is left out of the scan by design. | Pending live text check per role. | **Done (local).** |
| **PB-V5-07** | The 25-sheet workbook map and the release id were shown to every viewer. | Both render only for platform reviewers, in a block marked "Interno · visibile solo ai revisori". The Fonte section keeps a plain line on source, period and method. | — | A unit test pins the reviewer-only condition. | Pending live, as Azienda and as Regione. | Pending live. | **Done (local).** |
| **PB-V5-08** | Not served. | Nothing on the page. | Read-only assessment on the frozen release. | Feasibility was reproduced from the frozen rows with the shipped loader's functions. An independent challenger corrected the screening rule and the coverage identity. | — | — | **Evidence gate + Decision.** Needs:<br>• a new SECURITY INVOKER function (production migration, owner approval);<br>• an explicit 2024–2025 year filter;<br>• a level-change screen that does not erase real changes;<br>• a four-class coverage identity. |
| **PB-V5-09** | Not served. | Nothing on the page. | Read-only assessment of the frozen B06/B13 artefacts. | Rederived from frozen inputs. The assessor and an independent challenger both found a defect in the frozen decomposition: the matching key for pack-tier strata. Details and counts are in the private evidence note. | — | — | **Evidence gate.** First, owner decisions on:<br>• re-freezing B06/B13;<br>• the grain;<br>• the quantity basis for contested pairs;<br>• the default scope;<br>• what Aziende may see.<br>Then an import table and a function (migrations, owner approval). |
| **PB-V5-10** | Not served. Limiti refuses a raw ranking of Aziende. | Nothing on the page: a justified omission. | Read-only assessment. B09 was reproduced with the live function, per Azienda. | Reproduced to the cent. The frozen B09 compares different cohorts and pools part of 2026. The order of Aziende is not stable under leave-one-out, channel strata or resampling. | Would be reviewer/Regione only, and only when the scope holds every Azienda in the release. | — | **Decision** for Guido. Either a collapsed reviewer/Regione sensitivity panel, or one sentence plus a per-substance spread table (recommended). Never a ranking. |
| **PB-V5-11** | The prototypes had not been translated. | Triage below. Two ideas are integrated this round. | — | — | — | — | **Partial.** The integrated ideas are done (local); the rest are gated or rejected as listed. |

### PB-V5-11 triage

| Example | Verdict | What was taken, and what was refused |
| --- | --- | --- |
| `biosimilar_opportunity_funnel` | **Integrated (adapted)** | Taken: the reference-side stages, which are Bridge B's gates. This round leads with the actionable questions and collapses the full reconciliation (PB-V5-03). Refused: the "price differential" stage, and the Scenario A amount and interval (a savings claim). |
| `biosimilar_watchlist_by_substance` | **Integrated (adapted)** | Taken: the two review questions with molecule links (PB-V5-05). Refused: threshold verdicts ("converted", "slow"); the pooled 29-month total; "available alternative" until the Italian status is verified (PB-GA-10). A next step: one searchable table with an evidence drawer, built from data the page already has. |
| `monthly_spend_and_comparability_coverage` | **Adapted with restrictions** | Both monthly measures are already live and follow the filters, behind the Misura switch. Showing both on one month axis needs no migration; it is a candidate for the next round. Refused: truncated axes; a 2026 comparable share shown as 0% (it cannot be assessed); an internal gate code. |
| `biosimilar_volume_vs_value_uptake` | **Adapted with restrictions (evidence gate)** | A value share on the same rows as the volume share could be built server-side from an existing granted function, aggregated before it reaches the browser. First it must be reconciled to the frozen volume pairs, profiled against the statement timeout, and its label approved. Refused: iso-price curves and any implied price ratio. |
| `price_cut_propagation_by_asl` | **Adapted with restrictions (PB-V5-08)** | Taken: only the small-multiple timeline of observed monthly gross cost per comparable unit. Refused: "cut", "wave", "propagation"; ordering Aziende by who moved first; gaps to the minimum. |
| `uptake_raw_vs_standardised_by_asl` | **Adapted with restrictions (PB-V5-10)** | Taken: paired marks, as a reviewer/Regione sensitivity view only, if Guido wants it. Refused: rank annotations; Aziende ordered by value; any peer value for an Azienda account; the mismatched cohorts. |
| `expenditure_change_bridge_2024_2025` | **Adapted with restrictions (PB-V5-09)** | Taken: a waterfall that shows entry, exit, non-comparable spend and the residual, once the decomposition is re-frozen. Refused: reading the price bar as a saving; intervals under filters; any 2026 term. |
| `comparability_exclusions_by_gate` | **Adapted with restrictions (internal only)** | Taken: named exclusion bars, for the internal reviewer surface. The per-gate split cannot be computed live today; it needs a provenance-tagged import or a re-population of the exclusion reason. Refused: shares of the whole ledger; gate ids and remediation classes in hospital-facing copy. |
| `Spend overview · VIS Pharma Compass prototype` | **Design reference only** | Can be built from live data later: expandable rows, concentration thresholds, and a change by channel and Azienda (Regione/reviewer only, in fixed order). Refused: the 2026 projection; "lower prices saved"; "volume is the engine"; price detail across Aziende; manual category tags. |

### Decisions needed

1. **PB-V5-01, Azienda accounts:** may an ordinary Azienda see a regional channel aggregate? If yes, a disclosure contract (minimum number of Aziende, suppression rules) and an aggregate-only function come first.
2. **PB-V5-04:** Guido to confirm the composition view is acceptable beside the rule that a status-based share is never shown as adoption. Arithmetically, the biosimilar part of the composition IS biosimilar ÷ (biosimilar + reference) by product status, with no monthly validity rule, so it will differ from both quota 1 and quota 2. The page labels it a spend composition and withholds it under a molecule filter, where it would sit beside that molecule's two quotas and contradict them. Keep it as is, keep only the euro amounts, or remove it?
3. **PB-V5-08:**
   - owner approval of the new function;
   - whether to include the mixed-label series (recommended, with a label);
   - whether B04 method and confidence stay reviewer-only or are imported.
4. **PB-V5-09:**
   - re-freezing B06/B13 with the corrected key;
   - the grain;
   - the quantity basis for the contested pairs;
   - the default scope;
   - what Aziende may see.
5. **PB-V5-10:**
   - whether the sensitivity view earns screen space;
   - the same cohort for both marks;
   - a minimum-denominator rule;
   - Regione access, or reviewer only.
6. **PB-V5-05:** Guido/Alberto's check that one row can be explained in a sentence.
7. **Residual English terms (PB-V5-06 scope):** the module name "Pillar B" and the words "uptake" and "release" still appear in some visible headings and notes. They are not internal codes; whether they count as jargon for a hospital reader is the owner's call.
8. **Figures in public git history:** code comments carried release amounts, shares and row counts. They were scrubbed in this round, but earlier commits on the public `main` still hold them. Rewriting public history is an owner decision.

### Independent review of the round

Before commit, three reviewers read the diff, each with its own lens: arithmetic and meaning, access and disclosure, and visuals and accessibility. The access review found **no disclosure defect**:

- An Azienda account cannot trigger the regional call. Its scope has no Azienda list, and the URL's Azienda key is validated against that list.
- RLS bounds the call in any case.
- Nothing from the comparator reaches a client component.
- The reviewer-only block uses the flag that is true only after the service-role widening succeeded.

The defects found were fixed in this round, and each one is pinned by a test:

| Defect | What a viewer would have seen | Fix |
| --- | --- | --- |
| Reconciliation failure hidden inside a closed panel. | A bridge that does not tie sat behind a summary that still printed a euro amount. The review questions were absent, with no reason given. | The panel opens and its summary says "non riconciliata". A notice explains why the questions are absent. |
| A share outside 0–100% (credit notes) was clamped to the axis edge. | A mark at 0% or 100% labelled −14% or 150%. | Such a share is never drawn. It reads "non calcolabile: rettifiche" and the lead says so. |
| The gap's sign was taken before rounding. | "-0,0 p.p." beside two equal printed shares. | The gap is computed from the shares as displayed, and rounded first. |
| A status with no record showed as 0%. | "nessun record · 0%". | The share is empty and reads "nessun record — —". |
| A missing quota 2 read "uso fuori periodo". | False when the first use fell inside the period but a filter removed the spend. | Now reads "nessuna spesa in questa selezione dal primo uso qui". |
| The comparator lead had no verb and named the Azienda twice. | "Sotto ASL 2, Regione · 4 Aziende, compresa ASL 2, …" | "Sotto la barra di ASL 2, quella della Regione (4 Aziende, ASL 2 compresa), …" |
| The "account aziendale" note was keyed on the number of Aziende. | A Regione with one Azienda was called an Azienda account. | The note is keyed on the account type. |
| A failure in the optional regional read failed the whole page. | "Analisi non disponibile". | Its failure removes only the regional bar, and a note says so. |
| Database function names appeared in degraded-mode notices. | Function names such as `pillar_b_facets`. | Plain descriptions of what is missing. |
| Labels inside narrow bar segments wrapped and were clipped; the Region bar's opacity faded its text below contrast. | Clipped stacks of text at 375 px; lower-contrast labels. | Labels stay on one line, the percentage only inside the perimeter bar, and no opacity on the Region bar. |
| The second gate had three names, and its method text said "coincide" twice. | Contradictory names ("non ancora acquistato" beside "non è mai acquistato"). | One name, «EU-autorizzato, non ancora osservato qui», and the repeated sentence dropped. |
| The copy-scan test failed on a Windows checkout. | A false failure: CRLF line endings defeated the cut. | Line endings are normalised, and the test asserts that the cut was found. |
