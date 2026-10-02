# The public Pillar B page (/pillar-b): source, boundary, verification

**2 October 2026.** Built under the owner's binding decisions: every figure
derived from the confidential Abruzzo workbook stays behind login, including
regional aggregates; the public page uses independently published public
sources only; "Pillar B · Biosimilari ed esclusività" sits beside Pillar A in
the public navigation.

## The source

AIFA, Ufficio Monitoraggio della Spesa Farmaceutica e Rapporti con le Regioni,
*Biosimilari: distribuzione dei consumi e della spesa secondo la forma di
somministrazione* — direct-purchase channel, January–December 2025, NSIS /
Tracciabilità del farmaco updated to December 2025.

| | |
|---|---|
| URL | https://www.aifa.gov.it/documents/20142/3423405/5_FocusForme_EV_SC_gen_dic_2025.pdf |
| SHA-256 | `c8f12948f1162a9062920a50b53c3514644429bc6934d46d7fb73e41b00831ce` (492,008 bytes) |
| Fetched | 2 October 2026, `curl`, HTTP 200, `application/pdf` (Codex's earlier attempts were blocked; this one was not) |
| Filed | evidence repository `public-sources/AIFA_5_FocusForme_EV_SC_gen_dic_2025.pdf` (outside the application repository) |
| Pages | 13 physical; **printed page = physical page − 1** (page 1 is the cover with the table of contents) |
| Tables | 9: infliximab, rituximab, trastuzumab × confezioni, DDD, spesa, on physical pages 3–5, 7–9, 11–13 |
| Rows | 21 territories (19 regions + the two autonomous provinces) + ITALIA per table; 198 rows in all |
| Columns | originator EV · biosimilar EV · originator SC · biosimilar SC · Totale 100.0 % |

**Scope is exactly this and nothing more:** three molecules, one year, one
channel, percentages of a molecule's total in a territory. The source
publishes no volumes and no euros, so the page shows no totals, no sums across
molecules and no absolute spend.

## Extraction: VERIFIED-EXACT by code

`scripts/build_pillar_b_public_aifa_ev_sc.py` reads the PDF with `pdfplumber`
**by coordinates** (`extract_words`, rows rebuilt by vertical position). The
plain text layer could not be used: `pdftotext -layout` interleaves the label
column and the number columns in different orders, so a text dump pairs the
wrong region with the wrong row. The builder asserts, for every table:

- the page title names the molecule and the measure, and the page says
  "gen-dic 2025" and "acquisti diretti";
- 22 rows, the last one ITALIA, labels identical across all nine tables;
- every row has exactly five percentages, the first four summing to 100
  within 0.02 (rounding of the published two decimals), the fifth exactly 100.

Observed in the data and asserted by the builder and the tests, not assumed:
infliximab's SC column is biosimilar-only (originator SC = 0.00 % in every
territory); rituximab's and trastuzumab's SC columns are originator-only
(biosimilar SC = 0.00 % everywhere). The page states these as facts about the
table, not as pharmacological claims.

Outputs:

- `data/public-compiled/pillar-b-aifa-ev-sc-2025.json` — the public asset:
  198 rows, territory codes shared with `/pillar-a` ("000" = Italia, "041" /
  "042" = the two provinces), no digest, no internal key, no path;
- `data/provenance/pillar-b-aifa-ev-sc-2025.json` — the digest, page titles,
  row checks and method, kept apart from the asset.

## What the page computes (and what it refuses)

Only sums of published columns with the same base and differences in
percentage points (`lib/pillar-b-public/ev-sc-view.ts`, pure, tested):

- quota biosimilare, tutte le forme = biosimilar EV + biosimilar SC;
- quota della forma SC = originator SC + biosimilar SC;
- differenza da Italia = quota del territorio − quota dell'Italia, same
  molecule and measure, in percentage points;
- ranking of the 21 territories by biosimilar share with standard competition
  positions (ties share a position and the next skips; ties decided on the
  published two decimals), Italia excluded as the reference.

Not computed: an "EV-only biosimilar share" (it would need biosimilar EV ÷
(originator EV + biosimilar EV), a base the source does not publish); any
total, average or sum across molecules, measures or territories.

## The confidentiality boundary, as tests

`tests/pillar-b-public-surface.test.mjs`:

- the middleware allow-list (`lib/supabase/proxy.ts`) releases `/pillar-b` and
  `/pillar-a` only; no `/dashboard-review` path, no `/api/pillar-b` (none exists);
- `app/pillar-b/page.tsx`, `components/pillar-b-public.tsx` and
  `lib/pillar-b-public/*` import nothing from `@/lib/supabase`,
  `@/lib/dashboard-review/pillar-b`, the private scope rules or the service
  role, and reference no `canonical_fact` or `pillar_b_*` function;
- the public asset carries no digest, no internal key, no path, no "ASL 1–4",
  no Azienda code, no "Azienda", "workbook" or "canonical", and no numeric
  field above 100 except the page number;
- nothing of Pillar B is served from `public/`;
- the home navigation links `/pillar-a` and `/pillar-b` with the subtitle, and
  the public page links into the reserved analysis.

`tests/pillar-b-public.test.mjs` pins seven cells to the AIFA tables, checks
the nine-table shape, the SC-column facts, the derived shares, the ranking
(including tie positions on a synthetic case), selection parsing and the
chart rows.

## Design

Mirrors `/pillar-a`: hero, source card, one selector card (Territorio ·
Molecola · Misura), four tiles, a scope banner, panels with their own
controls, a reading guide and a source panel. Three charts: composition per
territory (stacked 100 % bars, 22 rows, selection highlighted, Italia marked),
the same molecule across the three measures (territory vs Italia), the three
molecules at the same measure; plus the ranking table with its own direction
control. Every chart has an accessible name and a numeric table.

The selection lives in the URL (`?territorio=130&molecola=rituximab&misura=spesa`,
defaults omitted) through `history.replaceState`, and the server parses the
same keys on a fresh load.
