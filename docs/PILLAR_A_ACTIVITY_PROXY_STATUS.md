# Pillar A public activity proxy status

Status: proxy table built and audited; no proxy value is certified or connected to the dashboard  
Checked: 2026-09-18  
Builder: `scripts/build_pillar_a_activity_proxy.mjs` (`npm run build:activity-proxy`)  
Outputs: `data/derived/pillar_a/` (regenerated, not hand-edited)

## Question

The workbook denominator is selected as A2 and described verbatim as
`DEGENZA + ACCESSI - ESCLUDI ONERE "4" E DRG 391` (`Report!A2`). No public
source publishes the record-level exclusions needed to reproduce it. This
document records which public activity values can legitimately sit next to the
trusted A2 values, what the observed differences are, and what remains
unknown. The public figure is labelled `public_inpatient_activity_proxy`
everywhere. It is never called A2, and `A2` is a reserved label that the
builder refuses.

## Trusted A2 cases (workbook extract)

Source: `tmp/pillar_a_inputs.json`, extracted from `Dati_Analisi_v02 (1).xlsm`
(`Dati_Rpt!D4:F8`). Region attribution is verified at build time: codes
201–204 exist under region 130 (Abruzzo) in `asl_registry_2010_2026.csv` for
2023–2025, and the row coded 130 equals the sum of 201–204 in every year.

| Year | 201 Avezzano-Sulmona-L'Aquila | 202 Lanciano-Vasto-Chieti | 203 Pescara | 204 Teramo | 130 regional total |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2023 | 237,235 | 236,856 | 245,894 | 228,195 | 948,180 |
| 2024 | 243,208 | 236,469 | 247,985 | 235,383 | 963,045 |
| 2025 | 238,048 | 238,298 | 248,922 | 227,497 | 952,765 |

The same Azienda numbers (201–204) are live codes in several other regions in
2023–2025 (and Piemonte still uses 203 and 204), so every join in the proxy
table is keyed by region and Azienda together; the composite `organization_code` is `regionCode + aziendaCode`
(for example `130201`), matching the application's scope convention.

## Public sources and their grain

| Source (staged file) | Year | Grain | Activity content | Institute scope | Usable against A2 |
| --- | --- | --- | --- | --- | --- |
| `sdo_reports/2024/Cap2_2024.xlsx`, Tavola 2.1.6 / 2.1.5 | 2024 | Region | giornate and accessi (and dimissioni) by activity type and regime | all SDO-reporting institutes | Yes: same year and grain as the 2024 regional A2 |
| `Cap2_2024.xlsx`, Tavola 2.2.1 / 2.2.2 | 2024 | Region | acute dimissioni by institute type | all | Context: public vs private accredited share (discharges only) |
| `Cap6_2024.xlsx`, Tavola 6.22–6.26 | 2024 | Region | dimissioni by onere della degenza | public and private accredited | Context for the ONERE exclusion (discharges only) |
| `Cap8_2024.xlsx`, Tavola 8.1 (21 regional sheets) | 2024 | Region × DRG | acute ordinary-regime dimissioni and giorni di degenza per DRG | all | Cross-check of Tavola 2.1.6 and DRG 391 handling |
| `hospital_structure_activity_2022.csv` | 2022 | Facility × ward | giornate_degenza, num_dimessi, beds | public and equiparati presidi only | Azienda-level activity, but 2022 does not overlap 2023–2025 |
| `beds_2023.csv` | 2023 | Facility × discipline type | beds | public and private accredited | Capacity only, never compared with activity |
| `discharges_by_institute.csv` | 2022 | Institute (8-digit) | dimissioni by discharge type | all | Activity count, 2022 only, cells suppressed (`***`) |
| `sdo_discharges_age_sex_2022.csv` | 2022 | Institute × sex × age | dimissioni | all | Activity count, 2022 only, heavy suppression |
| `asl_structures_activity.csv` | 2022 | ASL | residents | n/a | Population context only |
| `asl_registry_2010_2026.csv`, `ao_aou_irccs_registry_2010_2022.csv` | 2010–2026 / 2010–2022 | Azienda / facility | identifiers | n/a | Attribution and region resolution |

Only one public source overlaps a trusted year at a compatible grain: the
2024 SDO report at regional grain. No public source gives Azienda-level
activity for 2023, 2024 or 2025.

## What the public source states about the two A2 exclusions

- **DRG 391.** Tavola 2.1.2 footnote: "La voce 'Nido' comprende le dimissioni
  di 'Neonati sani' (DRG 391) in Regime ordinario." Nido is a separate activity
  line, and the per-DRG regional tables (Tavola 8.1) contain no DRG 391 row; the
  Abruzzo TOTALE GENERALE (121,601 dimissioni; 910,332 giorni) equals the Tavola
  2.1.5 (dimissioni) and Tavola 2.1.6 (giornate) acute ordinary-regime values. The acute regional figures therefore
  already exclude DRG 391. Confidence: `VERIFIED-SOURCE`.
- **ONERE "4".** Tavola 6.22–6.26 break discharges down by "onere della
  degenza" in ten columns. The fourth column is labelled "A prevalente carico
  del SSN (in conv. con libera professione)". Column order is not a verified
  SDO code; the mapping from the workbook's ONERE "4" to a column remains
  `INFERRED` until confirmed against the SDO record layout (DM 380/2000 and
  later updates). For Abruzzo 2024 the fourth column holds 2 acute
  ordinary-regime and 2 acute day-regime discharges; the third column ("Senza
  oneri per il SSN") holds 459 and 832. Under the fourth-column reading the
  exclusion is 4 of 157,078 acute discharges (below 0.01%); under the
  third-column reading it is 1,291 of 157,078 (0.82%), including 832 of 35,477
  acute day-regime discharges (2.3%). Giornate by onere are not published.

## Same-year, same-grain comparison (2024, region 130)

Trusted A2 (`Dati_Rpt!E8`): 963,045. Public values from Tavola 2.1.6 row 20.

| Composition | Public components | Public value | A2 / public | Public vs A2 |
| --- | --- | ---: | ---: | ---: |
| `sdo_region_acute_ro_days_plus_dh_accesses` | acute RO giornate 910,332 + acute RD accessi 111,999 | 1,022,331 | 0.9420 | +6.16% |
| `sdo_region_acute_ro_days_only` | acute RO giornate | 910,332 | 1.0579 | −5.47% |
| `sdo_region_all_days_excluding_accesses` | acute RO 910,332 + rehab RO 148,865 + long-term 27,982 | 1,087,179 | 0.8858 | +12.89% |
| `sdo_region_all_activity_days_plus_accesses` | previous row + acute RD accessi 111,999 + rehab RD accessi 163 | 1,199,341 | 0.8030 | +24.54% |

All four compositions are `PROXY-CANDIDATE`. None is the observed A2. The
composition closest to the A2 wording (acute giornate + accessi, DRG 391 already
excluded) exceeds A2 by 59,286 units (6.16%).

Known differences that the public composition cannot remove:

1. Institute scope. The regional table covers all SDO-reporting institutes.
   In Abruzzo 2024, "Ospedali a gestione diretta" account for 102,502 of
   121,601 acute ordinary-regime discharges (84.3%) and 27,775 of 35,477 acute
   day-regime discharges (78.3%); the remainder are "Case di cura private
   accreditate". The corresponding giornate/accessi split is not published.
2. Activity types. Whether A2 includes rehabilitation and long-term wards of
   the public presidi is not stated in the workbook. Abruzzo public presidi do
   operate such wards (`beds_2023.csv`).
3. Onere. The regional giornate include all onere classes.
4. Unit semantics. The exact counting rule behind DEGENZA (giornate di degenza
   as in SDO, or another rule) and ACCESSI (day hospital and/or day surgery
   accesses) must come from the Azienda.

Illustrative arithmetic, not emitted in any table: applying the discharge
shares above to the giornate/accessi gives a "public acute only" reading of
about 855,000, which is 11% below A2, while the all-institute acute reading is
6% above it. Neither simple reading reproduces A2, which is why the Azienda
data request below is still required.

## Variability

Not quantifiable from public data. There is exactly one overlapping
observation (2024, region 130). `summarizeCalibrationEvidence` reports
`distinctAziende = 0` (regional rows never count as Azienda evidence),
`distinctYears = 1`, and `generalization = blocked`. No correction factor is
derived, stored or applied.

## Values shown side by side without a ratio

The calibration table records these pairs with `comparison_status =
year_mismatch` and no ratio, because the years do not overlap:

| Azienda | Public 2022 ordinary-regime giornate, public presidi (`hospital_structure_activity_2022.csv`) | Facilities / wards | Trusted A2 2023 | Trusted A2 2024 |
| --- | ---: | ---: | ---: | ---: |
| 130201 | 211,038 | 5 / 62 | 237,235 | 243,208 |
| 130202 | 209,880 | 5 / 57 | 236,856 | 236,469 |
| 130203 | 215,714 | 3 / 39 | 245,894 | 247,985 |
| 130204 | 188,757 | 4 / 45 | 228,195 | 235,383 |

The 2022 public source has no accessi column and no private accredited
facilities. Whether an adjacent-year orientation may ever be shown internally
is an owner decision (see below); the builder does not form these ratios.

Also recorded for context only (`capacity_not_activity_not_compared`):
`beds_2023.csv` totals attributed to the four ASL codes (1,188; 1,072; 1,333;
838 beds, private accredited included) and 2022 residents (288,956; 373,717;
313,631; 299,646) against the workbook's weighted population (297,215;
385,031; 315,891; 301,717 for 2023). The residents figure is not the workbook's
weighted population.

## Proxy table contract

`data/derived/pillar_a/public_activity_proxy_components.csv` (23,291 rows in
the current build) carries one row per source × entity × component with:
`source_file`, `source_sha256`, `source_year`, `source_locator` (cell address
or entity code), `grain`, `region_code`, `azienda_code`, `organization_code`,
`azienda_attribution_basis`, `territorial_asl_code`, `facility_code`,
`source_entity_code`, `activity_component`, `dimension`, `value`, `unit`,
`suppression_flag`, `null_reason`, `proxy_status`, `confidence_status`, and
`notes`.

Rules enforced by the builder and its tests:

- `***` stays null with `suppression_flag = true`; sums that would include a
  suppressed cell are null with `null_reason = age_cells_suppressed=…`.
- A dash in an SDO table is null (`dash_in_source`), not zero.
- Ward rows are summed to facility and Azienda; wards are not emitted because
  they are below the approved granularity.
- Facilities are attributed to an Azienda only through a stated basis: the
  2022 AO/AOU/IRCCS registry when the facility code is listed there (this
  overrides `codice_asl` for the 27 Lombardy ASSTs, which the HSP file codes
  as type 1 under their ATS but which are Aziende 701–727 in the registry;
  the ATS stays in `territorial_asl_code`), otherwise `codice_asl` for ASL
  presidi (type 1/8), and `null` for classified, research or private
  institutes. 71 of 504 facilities remain unattributed by design.
- Eight-digit SDO institute codes are joined on their six-digit prefix; 315
  rows belong to institutes absent from both staged registries and keep only
  the region from the code prefix.
- The Ministry flags erroneous records by repeating an institute code with the
  name `DATO ERRATO` (4 rows in the discharge-type file, 7 in the age/sex
  file). They are kept with `value` null, `null_reason =
  source_row_flagged_dato_errato`, and a `;flag=DATO_ERRATO` locator suffix,
  so no two rows share a source locator.
- Doubled CSV quotes inside names (`""ISTIT.NAZ.LE TUMORI""`) are unescaped.
- `num_dimessi` in the 2022 facility file is ordinary-regime: `giornate_degenza
  / num_dimessi` reproduces `degenza_media_ordinaria` on all 6,756 ward rows
  with discharges, so it is labelled `ordinary`, not `ordinary_and_day`.
- Region names in the SDO workbooks resolve through the ASL registry, with
  explicit aliases for the two autonomous provinces; all 21 resolved. A
  region absent from a table is reported in the manifest warnings rather than
  silently skipped (Tavola 6.25, rehabilitation day regime, has no Valle
  d'Aosta row).
- Tavola 2.1.6 row 5 labels its percentage columns inconsistently; column
  semantics are fixed by position and verified numerically (`B / F × 100 = C`).
- Tavola 2.1.2 and the institute-type tables 2.2.1/2.2.2 exclude records from
  institutes not censused in the NSIS facility registry (Tavola 2.1.2
  footnote); their ITALIA totals (5,672,246 acute RO discharges) are lower
  than Tavola 2.1.5 (5,673,001), so they carry `institute_scope =
  institutes_censused_in_nsis_registry` rather than
  `all_sdo_reporting_institutes`.
- Every Cap8 per-DRG sheet is scanned for a DRG 391 row before anything is
  emitted; a hit stops the build because every regional composition's
  `drg391Handling` would be wrong.
- Composition rows carry unit `days` or `days_plus_accesses` according to
  their components.

Counts of the current build: 19,315 facility rows, 1,711 Azienda rows, 2,110
regional rows, 155 national rows; 2,381 suppressed rows; 19 `DATO ERRATO`
rows; 12,725 capacity rows; 195 Aziende with 2022 public-presidio activity
(27 of them Lombardy ASSTs attributed through the registry); one manifest
warning (Tavola 6.25, Valle d'Aosta);
83 `PROXY-CANDIDATE` composition rows (4 compositions × 21 regions, minus
Valle d'Aosta's all-activity composition, whose rehabilitation day-regime
accessi cell is a dash and is therefore kept null rather than assumed zero);
643 `INFERRED` onere rows.

## Reproduction

```bash
npm run build:activity-proxy
npm run test:pillar-a
```

The builder needs Node 22.18 or later (or 23.6+), the first releases that strip
TypeScript types without a flag, because it imports the TypeScript module
`lib/analytics/pillar-a-activity-proxy.ts` directly, as the existing tests do.
Source hashes, counts and warnings are written to
`public_activity_proxy_manifest.json`; comparisons to
`a2_public_proxy_calibration.csv` and `a2_public_proxy_calibration_summary.json`.

## Gaps

- No public Azienda-level activity exists for 2023–2025; the newest open-data
  facility extract is 2022 and the SDO report tables are regional.
- Only the 2024 SDO report is staged, so 2023 and 2025 regional A2 values have
  no overlapping public observation.
- The 2022 facility extract covers public and equiparati presidi only; private
  accredited activity is absent below regional grain.
- Giornate and accessi by institute type, by onere, or by DRG at Azienda grain
  are not published.
- The meaning of ONERE "4" is inferred from table order, not verified.

## Decisions requiring the project owner

1. Staging further SDO annual reports (at least Cap2 of the 2023 edition, and
   earlier editions for a trend) from the Ministry archive to obtain more
   overlapping regional observations. This is a download and needs approval.
2. Whether adjacent-year side-by-side values (2022 public vs 2023 A2) may
   appear in any internal view. The builder currently forms no such ratio.
3. Confirmation of the ONERE "4" definition from the SDO record layout, and
   of whether the workbook's exclusion means the fourth column of Tavola 6.22
   or a different class.
4. Confirmation from the Aziende of the A2 institute scope (ASL presidi only
   or including private accredited), activity types (acute only or including
   rehabilitation and long-term care), and the counting rules for DEGENZA and
   ACCESSI.
5. Whether regional proxy compositions may be shown in the product, separately
   from exact A2 metrics and with their `PROXY-CANDIDATE` label and the
   differences above, before any exact A2 data arrives.
6. Generalization thresholds (minimum Aziende and years) for any future
   correction factor. Until approved, `summarizeCalibrationEvidence` blocks
   generalization regardless of evidence.

## Related report from a parallel session

`docs/PILLAR_A_PUBLIC_DATA_CALIBRATION.md` and
`outputs/public-data-extracts/pillar_a_proxy_activity_table.csv` (3,824 rows)
were produced on the same day by a separate session and are left untouched
here. The two analyses agree on the source facts (Abruzzo = region 130, ASL
201–204, 2022 public giornate and dimessi per ASL, no AO/AOU/IRCCS in Abruzzo,
composite region+Azienda keys, suppression kept null). They differ in method,
and the owner should pick one before either table is used further:

- That report forms ratios between 2022 public values and 2023 A2 (92.6–99.8%)
  and labels the Abruzzo cases `PROXY_MODERATE_CONFIDENCE`; this builder forms
  no ratio across non-overlapping years and keeps every public composition at
  `PROXY-CANDIDATE`.
- That report treats `num_dimessi` (discharges) as an "ACCESSI-like" component
  and sums it with giornate; discharges are not day-regime accessi, so this
  builder keeps discharges as a separate component and uses the SDO report's
  own accessi column for the accessi term.
- That report compares a 2022 national public sum with the 2023 workbook
  national activity; this builder does not compare across years at any grain.
- Suppression counts differ (that report cites 1,900 cells per file; this build
  counts 497 `***` cells in the discharge-type file and 6,679 in the age/sex
  file, recorded in the manifest).

## Recommended positions recorded 2026-09-18 (not approvals)

Positions relayed by the project side on the decision list. Items 2, 5 and 6
still need an explicit owner answer; items 3 and 7 need the owner to resolve
the PA-D07/PA-D11 discrepancy described below; item 1 needs the source
Azienda, not a VIS assumption.

Discrepancy to resolve: on the same day the parallel session added
PA-D07–PA-D11 to `docs/PILLAR_A_DECISION_SHEET.md` marked "Approved:
2026-09-18", covering items 3–7 below. PA-D07 defines the public proxy as
`num_dimessi + giornate_degenza` and allows `PROXY_MODERATE_CONFIDENCE` for the
Abruzzo cases on the basis of cross-year ratios, and PA-D11 names that
session's table schema as canonical. Both points differ from this builder
(see "Related report from a parallel session"). The owner should confirm
whether PA-D07–PA-D11 are approvals or recommendations and which proxy
definition and schema stand; until then this builder's outputs remain
`PROXY-CANDIDATE` and are not connected to any product surface.

| # | Decision | Recommended position | Effect on this builder |
| --- | --- | --- | --- |
| 1 | A2 unit semantics | Pending source Azienda confirmation. Do not assume DEGENZA means bed-days or ACCESSI means admissions. | Already honoured: components carry the source's own labels (giornate, accessi, dimissioni) and are never renamed to A2 terms. |
| 2 | ATC perimeter | Needs owner approval. The code list is empty, so no antimicrobial consumption metric can run. Do not invent the list. | Out of scope here; `pillar-a-config.ts` keeps `codes: []`. |
| 3 | 2022 public file as proxy | Approve with restrictions: non-Abruzzo Aziende only, as a low-confidence public proxy, never labelled A2. | Azienda-level `ordinary_regime_days` totals from the 2022 file are emitted for all 195 attributed Aziende as `derived_aggregate` / `DERIVED`; the `hsp_azienda_public_ordinary_days` composition appears only in the calibration table for the four Abruzzo Aziende, with `year_mismatch` and no ratio. Labelling those totals as a low-confidence proxy for non-Abruzzo Aziende is a product decision not yet encoded. Nothing is connected to the dashboard. |
| 4 | National correction factor | Reject. | Enforced: `summarizeCalibrationEvidence` blocks generalization; no factor is stored. |
| 5 | Facility filter | ASL-managed facilities are `tipo_struttura` = "OSPED. A GESTIONE DIRETTA PRESIDIO A.S.L." or "ISTITUTO QUALIFICATO PRESIDIO DELLA A.S.L."; keep AO/AOU/IRCCS/private types separate. | Matches the attribution rule: type codes 1 and 8 → `asl_presidio_codice_asl`; codes 0/2/3 → owning Azienda from the AO registry; others → no Azienda. Awaiting owner confirmation. |
| 6 | OSMED benchmark | Use the official OSMED 2025 edition for the first release with table, perimeter and unit documented; historical years use matching editions. | Outside this builder (gate PA-G07). Awaiting owner confirmation. |
| 7 | Proxy schema | Approve the proposed schema; it must stay separate from exact A2 metrics. | Two schemas now exist (this builder's and the parallel session's table); the owner must name which one is approved. |

## Data request to participating Aziende (aggregate only)

For each reporting year and period: region code; Azienda code and name;
facility/presidio code and name; activity type and regime; DEGENZA; ACCESSI;
onere classification with the count of ONERE 4 records; DRG classification with
the count of DRG 391 records; units of measurement; explicit distinction between
zero and missing; and the official A2 total for reconciliation. No patient-level
records are requested.
