# Pillar C workbook-to-dashboard delivery

Owner request: represent the remaining workbook analyses in the authenticated dashboard, with purpose-based sections and suitable interactive views. This is a presentation/integration release, not a clinical sign-off or an instruction to overwrite the frozen workbook.

## Delivery order

1. Freeze source identity and build an exhaustive output-to-section register, including supporting/withheld outputs.
2. Extract exact cached workbook values into immutable private section artifacts. Preserve units, missingness, synthetic qualifiers, fixed scopes and refusal states. Do not commit payloads or source figures to this public repository.
3. Add strict parsers and reviewer-only lazy data delivery. Keep the ordinary approved-member forecast projection unchanged; no private-access expansion, database import or security migration.
4. Add composition, attribution, contribution detail, PVM, comparisons, public context, budget evidence, trends, sensitivity and priorities alongside the existing spending/budget/count/forecast panels. Each analytical family has local controls; controls must not imply a grain absent from its source table.
5. Independently compare every extracted cell with the original workbook using a second reader. Test numerical formatting, zero/missing distinctions, table filtering, chart selection, withheld states and negative authorization paths.
6. Run the compiler, lint, tests, production build, local visual checks and production checks after deployment. Record unperformed role checks explicitly.

## Section mapping

| Section | Purpose and workbook families |
|---|---|
| Spesa | Baseline, representation, identifier/sign-quality diagnostics (08) |
| Composizione | ATC/portfolio shares, changes in share, concentration and adjustments (09) |
| Attribuzione | State coverage, shared exposure/bounds, mapping comparison and product dictionary (04–07, 05A) |
| Variazioni | Existing accounting bridge plus product/class contributions and reconciliation (10) |
| Prezzo, volume e mix | Comparable support/exclusions and the separate real/imputed PVM routes (11, 12, 12A) |
| Confronti | Supported raw/standardized comparisons and source comparability decisions (13, 13A) |
| Attività e contesto | Public historical spending, population/activity and geography context (13A, 14, 14A) |
| Budget | Published schedules, matching gates, allocation coverage/bounds and modelled plans (15–16B) |
| Numerosità | Existing CO scenarios and their sensitivity/withheld-channel decisions (14B) |
| Andamenti | Trend summaries and method admission; unresolved anomaly outputs stay withheld (17) |
| Previsione | Existing AIFA regional forecast plus organizational-method refusal/scenario records (18, 18A) |
| Sensibilità | Registered alternative assumptions and interpretation (19) |
| Priorità | Evidence-resolution priorities and organizational investigation questions (20) |
| Evidenza | Source, validation, release and output coverage/navigation records (00–03, 21–23) |

## Binding interpretation

- An ATC portfolio is not a department or indication. Draft mapping qualifiers stay visible.
- Do not publish the PC-17 individual anomaly signals or held-out series before their registered disposition. Implement their availability state, not their values.
- A rejected method produces its documented reason/support, not a fabricated plot. Missing values are never changed to zero.
- Keep real and imputed PVM separate; do not convert partial descriptive decomposition into a full-coverage unit-cost claim.
- Public AIFA and private ledger estimands stay separate. No ledger/AIFA ratios where comparability failed.
- Budget differences with unmatched perimeters are not organizational performance judgments. Allocated actuals and synthesized budgets remain identified.
- Exact tables, workbook ranges and fixed-scope notes accompany charts. A plot is a view of source rows, not an unregistered aggregation.
- Global controls apply only to their existing families. Local output facets are derived from actual columns and never manufacture missing organization/year/channel support.
- Register all workbook outputs, but distinguish analytical views from dictionaries, technical checks, duplicates and explicit refusals. Do not call a support sheet a new numerical analysis.

Owner amendment during implementation: ignore withheld workbook outputs. They are removed from the dashboard catalogue, selectors and server payloads, not represented by warning panels. Their exclusion is recorded only in the private handover. This supersedes the availability-state presentation above.

Status starts at implementation, not delivered. Production activation and complete workbook acceptance remain separate statements requiring their own evidence.

## Implementation and verification checkpoint

- The catalogue contains 84 non-withheld analytical/supporting outputs in 14 families, represented by 99 explicit source-table blocks. Source headings and cached cells stay traceable to their original ranges. The six owner-excluded outputs never enter the catalogue or section responses.
- Existing spending, change, allocation, CO scenarios and regional-forecast panels are preserved. Additional blocks use local output/block selection, real column-derived categorical facets, search, stable sorting, pagination, and metric/label controls. Compatible second measures can be overlaid; unlike units cannot share an overlay. Percentage axes respect the source percentage scale.
- Bars compare categories, ordered lines retain missing-value gaps, and scatter views show paired measures without imputing or aggregating. Negative amounts stay signed. Exact tables retain missing cells and source row numbers. Text-only method/refusal/evidence blocks remain readable tables rather than invented charts.
- ATC1 and the two registered ATC2 selection windows are distinct blocks. Extraction extends the old navigation map's truncated ATC1 range through the actual final column, restoring its fourth-period share and signed-adjustment columns without changing the workbook.
- Frozen workbook identity is unchanged. A separate XML reader checks every extracted cached cell and number-format identity. An application reader exercises the actual parser, formatter, filters and chart adapters. Neither check is described as re-approval of the original clinical/statistical methods.
- Delivery uses immutable, hash-addressed objects in the existing private review bucket. The server checks approval plus reviewer/admin identity before reading artifacts, verifies their hashes, validates the closed schema, and returns private/no-store responses. Ordinary approved members retain their separately scoped regional forecast only. No RLS/policy, membership, ledger import or release-gate changes are included.
- Use `scripts/build_pillar_c_workbook_catalogue.py` with the frozen source and an output directory outside this public checkout. Use `scripts/stage_pillar_c_workbook.mjs --dir <private-directory>` to verify staged objects, or explicitly add `--upload` to create missing immutable objects after parity receipts pass. Never commit extracted payloads or private receipts here.

Build/deployment and live interaction results belong in the final delivery receipt; this checkpoint alone does not assert they have happened.

## Final quality scope

The final source comparison passed for 263,913 cached cells, including 78,278 numeric cells, across all 99 blocks. The actual application parser/formatter/filter/chart-adapter run passed 449,364 assertions. The final application suite has 584 tests: 576 pass, eight pre-existing skips, zero failures. The actual TypeScript compiler, targeted ESLint and production webpack build pass.

Private storage staging verified all 15 immutable objects (index plus 14 sections) byte-for-byte. Both anonymous public-object and authenticated-object reads were refused for every object. Seven independent HTTP checks confirm anonymous private-page/API redirects and working public home/A/B pages. No private catalogue marker was present in those anonymous responses.

Live reviewer inspection observed the expanded navigation and real workbook controls/results for spending, composition, attribution, contribution detail, PVM, comparisons, public historical context and evidence. Desktop and the browser's narrower existing viewport were observed. The inspection caught and corrected a category-label selection defect. URL output/metric selection now follows navigation state, total rows remain in exact tables with an explicit plot toggle, and mixed-unit columns require a single-unit selection before plotting. PVM and standardized-comparison defaults now select their substantive measures rather than a support count.

These are bounded checks, not a claim that every combination of the 84 outputs, 99 blocks, local filters, browser roles and device/theme states was manually exercised live. A separate real ordinary-member session was unavailable and is not claimed. Its private-delivery refusal/projection tests pass; no new ordinary-member institutional access was added. The private release receipt records final deployment identity and these limits. Whole-workbook clinical/domain acceptance and the withheld findings remain separate.
