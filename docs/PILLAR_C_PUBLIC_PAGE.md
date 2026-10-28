# Public Pillar C

Owner authorization: 28 October 2026. Public-source regional forecast and public regional analyses may be shown without signing in. Institutional data and private-derived aggregates remain restricted.

`/pillar-c` contains five sections with one shared layout: spending trends; regional spending per resident; reimbursement/ATC composition; SSN activity context; Abruzzo 2026 forecast. Each section has local controls, a chart/table switch and source information. Public A/B/C pages share their header. The homepage and access portal link to the public page; reserved destinations retain their existing gates.

The page imports a dedicated public-only projection, `data/public-compiled/pillar-c.json`. It imports no private dashboard loader, session, database client, Storage client or workbook. No public bulk endpoint is added. `/pillar-c` is allowlisted by exact path only.

## Source and analytical coverage

- AIFA direct-purchase spending: 2018–2025; annual snapshots differ and 2025 is provisional. The comparison is Abruzzo and Italy excluding Abruzzo.
- AIFA/ISTAT spending per resident: 2024 only, with matching population date. Direct purchases and conventional dispensing remain separate.
- Reimbursement composition: 2018–2025; ATC1 composition: 2024–2025. These describe products and reimbursement, not observed clinical attribution.
- Ministry SSN context: 2023, using its stated 2022 population basis. It is displayed separately from pharmaceutical spending and is not used as that spending's denominator.
- Abruzzo forecast: the existing reviewed 2026 total, class A and class H results with monthly 80%/95% prediction intervals. Class C is excluded. Annual intervals are supplementary and their coverage has not been separately verified for the annual horizon.

Missing amounts remain missing. No institutional data, model diagnostics, clinical-budget attribution or unsupported cross-perimeter cost/admission ratio is published.

## Verification

The build script requires held, pinned evidence inputs and emits result fields through an explicit projection. Private build/recalculation receipts stay outside this repository. A fresh independent raw-source check reproduced 968 numeric comparator cells and 94 text checks; the forecast projection was compared with the reviewed result file. Regression tests cover the import graph, public-only field set, admission/bounds, parameter validation, section variants and missing-versus-zero behavior. Browser checks cover local controls, URL persistence, keyboard activation/scrolling and mobile widths.

Rebuild with `python scripts/build_pillar_c_public.py --evidence-root <private-evidence-root> --receipt <private-receipt-path>`. The evidence repository is required only for rebuilding, not for serving the public page.
