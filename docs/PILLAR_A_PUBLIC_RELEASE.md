# Public Pillar A release — 2026-09-20

The owner requested the updated analysis, workbook and themed website plots.
This isolated release starts from current production commit 80154ff; earlier
uncommitted work in the other checkout is preserved and not bundled.

New public route: `/pillar-a`, linked from home and dashboard navigation.
Exact public data routes: `/data/pillar-a.json` and `/data/pillar-a-annual.csv`.
Existing dashboard authentication and RLS are unchanged. Only public AIFA,
ISTAT, SDO and classification reference data are included; private hospital
rows, local A2 values and local coverage/cost figures are not published.

Scope: separate J01, J02A and J04A groups, applied as a retrospective working
scope to 2016–2025 ATC4 public series. No ATC4-to-molecule/AWaRe inference.
Antifungals always have AWaRe not applicable. WHO 2025 matches are reference
annotations, not verified historical assignments. No DDD is inferred from
packages. Public direct acquisitions and convenzionata remain distinct from
the hospital DD/CO selection.

Dataset: 1,320 annual observations, 720 national monthly observations,
88 SDO regional/national observations (2021–2024). January 1 ISTAT population
supports 2019–2025 regional/national rates. Bolzano/Trento remain unavailable
individually because this regional source combines them. Source hashes and
missing-value counts are retained. Reported numeric sums are not proof that
blank source cells have zero activity.

Validation: decimal-arithmetic national/regional AIFA reconciliation and
ISTAT age/region identity checks in the builder; executable public-output
tests; real TypeScript typecheck; production webpack build. The local
Turbopack attempt could not use a linked node_modules outside its root.
Local lint uses the sibling current Next flat config because this checkout's
legacy eslint config is incompatible with the linked newer lint dependency.
The deployment uses the production lockfile, unchanged.

The workbook is a separate private deliverable, not a public download. It
preserves the original local source inputs and adds public sheets, corrects
2024 daily rates to 366 days, labels fixed-volume decomposition and benchmark
scenarios, and exposes the local A2 comparison only in that private file.

Remaining scope: no national correction factor, forecast, certified
product-level DDD conversion, or replacement OSMED benchmark is introduced.

Reproduction: `scripts/build_pillar_a_public_series.py` uses the staged AIFA
manifest/CSV files, ISTAT ZIPs, audited SDO CSV and candidate coverage CSV.
These inputs remain in the sibling `viscompass` checkout under `data/` and
`outputs/pillar-a-scope/`; they are not all committed in this release.
The Excel builder and private deliverable remain there under
`outputs/pillar-a-update/`. Do not publish that workbook in public assets.
SDO display joins normalize `Friuli V.G.` to `Friuli Venezia Giulia`, while
the original source labels remain in the downloadable evidence.
