# New Drive source package audit

Source folder: https://drive.google.com/drive/folders/1JRRou9PA2bxeph8D5ai4J3AHsqs3HUbS

Stored locally under `data/raw/pillar-a-drive-20260922/`. No workbook macros
executed and no source workbook saved. Raw files are deliberately not in Git.
This package supersedes earlier workbook defaults for this feedback pass only.

| File | Bytes | SHA-256 |
|---|---:|---|
| Allegato 1 - Dati_Anagrafiche.xlsx | 192438 | a511f59239b5d473e3d60f36ec4bc22e57ef6d6dc1c0135704339d236f265dc6 |
| Allegato 2 - Dati_Analisi.xlsm | 422588 | c0a492d4e00e05a26194b331491505f38aa505512a2e8f4722a2647059051c99 |
| Allegato 3 - Rapporto_OSMED_2023 - Estratto.pdf | 523350 | c2366ac252ceef679d082c6c9282662292b843182842e4a99809fd135924a18e |
| Allegato 4 - Rapporto_OSMED_2024 - Estratto.pdf | 450972 | 89b86c8c7c0e10a4a78a6849847db1a8f5f480cca1192f00751cfb588b923ad9 |
| Relazione Antibiotici in Assistenza Ospedaliera - Anni 2023-2025.pdf | 406296 | 4ffeaa67d567977b50bdaded7dff033be0e2d910dd5620b4e8ef1d2777d1a92c |

## Independent checks

- `Ana_Dati_CO`: 1,316 rows, 2023–2025, four organizations, 238 observed AIC,
  64 observed ATC5, no repeated year/organization/AIC key.
- `Ana_ATC`: 78 J01 references: 20 A, 39 W, 17 R, 2 WR. Ambiguous WR retained.
- Each observed product joins its supplied AIC and ATC references.
- DDD recomputed as QMR × supplied DDD_AIC, not from package counts alone.
- 240 independent checks against `Dati_CO` for CF/CMR and DDD pass.
  Cost tolerance EUR 0.02; DDD tolerance 1, largest observed residual 0.0983.
- Report selects A3/CO1. A3 activity uses T1, not T. Each of 12 selected
  organization/year values matches `Dati_Rpt`; regional total is their sum.
- ABC sorts by CF descending, then AIC. Band A is assigned when cumulative
  share before the item is <80%, B <95%, otherwise C. Zero-total groups are
  unclassified. This is a reproducible expenditure-concentration convention.
- Composition links partition CF and DDD by AWaRe and ATC4 and reconcile to
  every organization/year total. They do not track movement through time.

Detailed private outputs: `private-staging/closure/{source-manifest,audit,
indicators,product-analysis,composition-links}.json`. These must not be copied
to public assets or client bundles.

## Additional public evidence

Historical ISTAT archives are in `data/raw/istat-reconstruction/`; URL/hash
manifest and 66 validated 2016–2018 denominators are in
`data/derived/pillar_a/population_2016_2018.json`. Sex, geographic and age-based
aggregation checks run in `build_pillar_a_population_history.py`.

OSMED public extract is in `public/data/pillar-a-osmed.json`, generated directly
from the 2024 edition table 5.2 (printed p165 / PDF page 4). All nine years use
that edition, including revised 2023 values. PNCAR J01 hospital target is a
reduction strictly greater than 5% in 2025 vs 2022. The 2024 observation is
interim positioning only, not a final attainment claim.
