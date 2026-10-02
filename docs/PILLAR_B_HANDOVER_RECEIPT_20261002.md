# Pillar B handover receipt — 2 October 2026

Taken over from Codex on branch `pillar-b/gates-20261001`. Both agents'
uncommitted edits were reconciled in place (nothing reset or overwritten).
**No migration was applied. Nothing was deployed or pushed.** No figure from
the confidential workbook is quoted in this file or in any file added by this
handover: this repository is public (see blocker 1).

## Implemented and verified

| area | what | evidence |
|---|---|---|
| Public page `/pillar-b` | AIFA biosimilar EV/SC focus, 2025, direct purchases: territory · molecule · measure selectors (URL state), four tiles, composition chart for 22 territories (biosimilar teal, originator amber, SC hatched), measure and molecule comparisons with value labels, ranking (position always counted from the highest), reading guide, source panel, link into the reserved analysis; states plainly that it holds no exclusivity data | `docs/PILLAR_B_PUBLIC_PAGE_20261002.md` |
| Public asset | `data/public-compiled/pillar-b-aifa-ev-sc-2025.json`, 198 rows, built by `scripts/build_pillar_b_public_aifa_ev_sc.py` by coordinate extraction with header-order checks; provenance kept apart in `data/provenance/` | a second extraction by another method matched every row; the reviewer's independent re-extraction matched every cell; Abruzzo and Italia rows of all nine tables pinned in `tests/pillar-b-public.test.mjs` |
| Public navigation | "Pillar B · Biosimilari ed esclusività" beside Pillar A on the home page | `tests/pillar-b-public-surface.test.mjs` |
| Confidentiality boundary | exact public-path list in `lib/supabase/public-paths.ts` (adds `/pillar-b` only); the page's whole import graph stays outside the private modules; no client component imports the workbook map, the scope resolver, the RPC layer or the service role; `scope.ts` and `service-role.ts` are `server-only` | `tests/pillar-b-public-surface.test.mjs`, `tests/pillar-a-public-surface.test.mjs` |
| Reviewer scope | unchanged server-side path, now with stricter `REVIEWER_EMAILS` parsing (quotes, display names, `;` or newlines, zero-width characters), widening failures logged with `PBR-WIDEN-*` codes, a reviewer without a membership told why at the access portal, and the Control Center showing valid and refused counts, never addresses | `tests/pillar-b-scope.test.mjs` (three reviewers end to end to real names, Azienda isolation, Regione pseudonyms, failed widening flagged), `tests/reviewer-list.test.mjs` |
| Pseudonymity | a non-reviewer's Azienda selector and URL carry an opaque key (`ambito=asl-1`), never the org code; the withheld-groups table no longer puts an `asl_code` in a React key; the Azienda and volume panels receive only what they draw | `tests/pillar-b-scope.test.mjs`, `tests/pillar-b-filters.test.mjs` |
| Private page, merged | monthly grouped bars with every month slot kept (a missing month is a visible gap), period fallback and the 2026 metric rule in one tested function, a lead saying the profile does not follow the year selector; "nessun record" instead of 0 € for a year with no record; Azienda absent from a selection named; zero-total concentration explained; value-uptake footer totals only the listed rows; local options kept across filter changes and molecule links | b44, b43, b39, b42; unit tests |
| Workbook map | the 25 sheets in four states, rendered on the private page, figures stripped | `docs/PILLAR_B_WORKBOOK_MAP_20261002.md`, `tests/pillar-b-workbook-map.test.mjs` (states pinned sheet by sheet; no figure quoted) |

Reconciliation to the frozen workbook (harnesses in the local evidence
repository, real release rows, oracle = `derived/workbook_r2_sheets.json` or
SQL): b44 plotted layer, b43 local variants, b39 scoped views, b42 coverage.
Results in `outputs/pillar-b/logs/*.log`.

Adversarial review: six independent reviewers (boundary, AIFA fidelity,
public labels and accessibility, private-page truth, reviewer scope, test
gaps), each finding checked by two verifiers. The confirmed findings are fixed
above; the boundary reviewer found no reachable leak.

## Blocked or not done, with the reason

1. **The application repository is public, and it already publishes
   confidential Pillar B figures.** Committed before this handover: Pillar B
   docs, code comments, test fixtures and migration comments quote regional
   and per-Azienda euro amounts and record counts from the confidential
   workbook and ledger (about twenty tracked files; AGENTS.md also quotes
   figures from the 2025 gold file). This contradicts the owner's decision
   that every workbook figure stays behind login. Removing them from the
   working tree does not remove them from git history. Options for the owner:
   make the repository private; and/or scrub the tree and rewrite history
   (a force-push to a public repository, which only the owner should
   authorise). Nothing was rewritten.
2. **Visual review at desktop and mobile is incomplete.** The browser pane in
   this session is hidden: screenshots time out and frame-driven rendering is
   paused. Layout was checked by script (no horizontal overflow at 375 px),
   but the charts were not seen drawn.
3. **The authenticated page was not viewed after these edits**, and "all three
   reviewers in the deployed environment" is not verified: the local page
   needs a sign-in, the live session has expired, and credentials are not
   entered by the agent. After a deploy, the Control Center line gives the
   number of valid reviewer addresses (and any refused tokens).
4. **Workbook sheets 08, 13–18, 20, 21 stay blocked** pending a data contract
   or a migration; sheet 09 is implementable now.
5. **Not fixed, recorded:** the reviewer's release-wide Azienda list is built
   from 2024–2025 spend (a code with only 2026 rows would be unlabelled); the
   label map is keyed by org code (latent for a multi-region release); the
   scope resolver is checked by source pattern, not by injected dependencies.
6. **Deployment needs explicit authorization** for this redesign. The work is
   committed locally only. Note for the deploy: non-reviewer `?ambito=` links
   now use the opaque key, so old `?ambito=201` links open the unfiltered view
   for non-reviewers (reviewers keep org codes).
