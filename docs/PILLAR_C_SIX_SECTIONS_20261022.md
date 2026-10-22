# Pillar C six-section page (presentation design, batch 1)

Date: 2026-10-22. Branch `ui/pillar-c-six-sections` from `cb3e98e`.

This document is the public design record for the Pillar C page redesign: one page of six named sections shared by every audience, a compact section bar in place of the long selector strip, and one navigation standard for the authenticated shell and the homepage. It contains no workbook figures, no euro amounts, no recipient data and no user identifiers. Those stay in the private Pillar C evidence repository.

Ownership (22 October 2026). Claude Code owns presentation only: Pillar C components, the authenticated shell and navigation, the homepage pillar links, the logo routes, the presentation tests and non-private UI documents. Codex owns loaders, auth, access, security, migrations, shared contracts and private analysis packets. Nothing in this plan changes query, auth or security behaviour or a login return destination; where the presentation needs a contract change, it is requested in section 8 and the interface keeps the current behaviour until the contract changes.

The inventory, the design and its critique were read at `cb3e98e`. The owner adopted the critique's simplifications: batch 1 regroups the existing blocks into the six sections and changes nothing in how they fetch or compute; the dossier and attribution blocks stay whole; no view providers are introduced; chart presentation is a separate commit; the removal of the reviewer's insight browser is its own revertible commit.

**Status on 2026-10-22: design recorded; commits 1.1 (shell and home), 1.2a (nav lib and frames, additive, nothing mounted) , 1.2b (reviewer regroup into the six sections) and 1.2c (organisation-scoped and forecast_only pages in the six sections; old navigation deleted) committed on `ui/pillar-c-six-sections` in the UI worktree, not pushed; nothing deployed. Section 5.3 records the 1.2b decisions, deviations and interim states.** A passing build does not make any data approved. Numerical acceptance, disclosure clearance and live activation stay separate owner and Codex gates.

## 1. Purpose and the six sections

Today the reviewer page is a strip of sixteen cards numbered 01–14 plus a «Vai alla sezione» select, three separate period · organisation · channel selectors (dossier, attribution, planning), and a generic browser over workbook outputs whose column headings still carry internal codes. A scoped Azienda or Regione member gets the same strip with nine cards; a forecast_only member gets a different page. The redesign gives every audience the same page, in the same order, with the same six questions, so that a member who moves from the forecast to a scoped delivery, or a reviewer who opens a scoped member's link, finds the same structure. Every accepted live analysis is kept and relocated; nothing accepted for scoped or forecast_only audiences is removed.

Each section answers one management question. Section ids are new (they avoid every existing inner anchor and every reviewer-only id guarded by the scoped leak regex), so old links to `#portafogli`, `#scenari`, `#spesa`, `#attribuzione`, `#cambiamento`, `#pianificazione`, `#numerosita`, `#previsione`, `#evidenza`, `#evidence-workflow` and `#portfolio-product-detail` still resolve as inner anchors.

| N | Id | Title (Italian) | The question it answers |
|---|---|---|---|
| 1 | `quadro` | Quadro decisionale | La spesa è cambiata perché più persone sono state trattate o perché i prodotti costano di più, e di quanto? |
| 2 | `destinatari` | Destinatari e utilizzo | Quante persone trattate raggiunge la spesa e con quale utilizzo? |
| 3 | `portafogli-attribuzione` | Portafogli e attribuzione | Quanto spende ciascun raggruppamento terapeutico e quanta spesa resta condivisa o incerta? |
| 4 | `fattori` | Fattori di spesa | Come cambia la spesa nel tempo e quali prodotti spiegano la variazione? |
| 5 | `budget-scenari` | Budget e scenari | Che cosa dicono gli atti di budget, le ipotesi dichiarate e la previsione regionale? |
| 6 | `priorita-evidenza` | Priorità ed evidenza | Che cosa verificare per primo e su quali fonti si basano le analisi? |

What each section holds at the end of batch 1:

1. **Quadro decisionale.** Page header (eyebrow «Pillar C», title «Spesa, budget e aree cliniche», scope pill), the page scope bar (organisation · channel), the three decision cards with the chosen comparison stated as text, one regional context card «Previsione regionale 2026 · stima annua indicativa» that links to section 5 and states the 80 % band beside the annual point (absent when the forecast is unavailable, never a placeholder), and three «Vai a» links. No chart.
2. **Destinatari e utilizzo.** An honest empty state: one `role=status` paragraph, «Le fonti attualmente disponibili in questa vista non contano le persone trattate e non misurano l’utilizzo. Nessun valore viene mostrato né sostituito.», followed by the link «Scenario di numerosità stimata →» to the modelled denominator in section 5. No controls, no tiles, no «in arrivo» wording. The section stays in the navigation so the question remains visible.
3. **Portafogli e attribuzione.** The portfolio dossier whole (lead card, tiles, monthly chart and table, drivers, products table, shared exposure, slider card, change summary, price-quantity-mix reading, review plan) minus its organisation and channel selects, then the attribution analysis whole (tiles, coverage, Pareto and register, ranges, comparison, method line) minus its three selects. Local controls: «Portafoglio» and «Periodo». Scope line «{org} · {canale} · {periodo} · raggruppamenti ATC in bozza».
4. **Fattori di spesa.** The spend timeline with its period select and «Vista» toggle, the three spend KPI cards and the exact monthly table; the reconciled scope bridge with the one «Confronto» toggle of the page; a cross-link «Per il portafoglio selezionato → Portafogli e attribuzione».
5. **Budget e scenari.** The budget comparison panel, the Spazio scenari whole, the estimated-count scenario with its denominator basis as the lead, and the regional forecast panel as the last block.
6. **Priorità ed evidenza.** A cross-link to the Pareto «Quali prodotti approfondire per primi? →» and to the review plan in section 3; the shared review queue (reviewer only); the reading criteria and the compact «Fonti e versione» list; for reviewers, the collapsed «Tracciabilità» details kept inside the reviewer chunk.

Audience rules are unchanged: reviewer blocks (queue, Tracciabilità, price-quantity-mix reading, modelled budgets) mount only from `analytical-workspace.tsx`, which is reachable solely through the dynamic boundary in `reviewer-workspace.tsx`; a scoped member never reaches them; a forecast_only member sees the section bar, section 5 with the forecast, and one sentence naming the five sections that are not available for the organisation («Questa sezione non è disponibile per la tua organizzazione. Nessun valore viene sostituito.» pattern, one sentence for the five). The `role=note` line in `page.tsx` stays the only organisation statement for that audience.

Every panel keeps its own source · organisation · channel · period line, and period stays a local control per section: the page scope bar carries organisation and channel only.

## 2. Old output to section map

Every element of the read-only inventory is listed with its batch-1 destination and action. «Section» is where the element renders after commit 1.2c; «—» means outside the page body (shell, homepage, auth, a library or a removed element). Actions: **keep** (relocated or untouched, markup and copy the same except where the note says), **merge** (folded into another element), **rework** (same data, new presentation or copy), **remove** (gone from the interface). Where the design's final state differs from the batch-1 state, the note says which later batch carries it. Line numbers refer to `cb3e98e`.

### 2.1 Dossier and drivers (`portfolio-dossier`, `portfolio-pvm`, `change-summary`, `change-bridge`, `review-plan` and their libs)

| Element | Section | Action | Batch-1 note and final state |
|---|---|---|---|
| `portfolio-dossier#section` | 3 | keep | Dossier mounted whole in section 3 after the section lead; inner anchor id `portafogli` kept so old links resolve. |
| `portfolio-dossier#scope-controls` | 3 | rework | «Organizzazione» and «Canale» selects removed (1.2b): the page scope bar writes `c_port_org`/`c_port_channel`. «Portafoglio» (`c_port_id`) and «Periodo» (`c_port_period`) stay as the section's local controls. |
| `portfolio-dossier#fetch-state` | 3 | keep | Loading, failure and «Riprova / Portafoglio iniziale» copy unchanged; fetch stays in the dossier (no provider in batch 1). |
| `portfolio-dossier#starting-point` | 3 | keep | Lead card unchanged; first sentence «{org} · {canale} · {periodo}.» is the pinned scope statement. |
| `portfolio-dossier#kpis` | 3 | keep | Four tiles unchanged; tile detail «proxy ATC, con rettifiche» becomes «raggruppamento ATC in bozza · rettifiche incluse» (1.2b); data attributes unchanged. |
| `portfolio-dossier#monthly-exact-table` | 3 | keep | Stays with the dossier in batch 1. Final state: section 4, table rendered below the chart (batch 2). |
| `portfolio-dossier#monthly-chart` | 3 | keep | Stays with the dossier in batch 1. Final state: section 4 line timeline with the «Componente» select (batch 2). |
| `portfolio-dossier#drivers-bars` | 3 | keep | Stays with the dossier in batch 1. Final state: section 4, one ranked diverging chart merged with the change-summary lists (batch 2). |
| `portfolio-dossier#products-table` | 3 | keep | Id `portfolio-product-detail` kept for drill-down links. Final state: section 4 (batch 2). |
| `portfolio-dossier#shared-exposure` | 3 | keep | Stays as the dossier's lead-in. Final state: merged with the attribution ranges on the shared RangeChart (batch 2). |
| `portfolio-dossier#planning-slider` | 3 | keep | Stays inside `CPortfolioDossierView` (owner decision O2/UI-16, markup and source pinned). Relocation to section 5 is a batch-2 item with the owner's sign-off; merging it into the Spazio scenari is proposed, not done. |
| `portfolio-dossier#footer-note` | 3 | rework | The «#costi» link is removed (1.2b). The method sentence stays here in batch 1; final state moves it to section 6 «Fonti e versione» (batch 2). |
| `portfolio-dossier#purpose-navigation` | — | remove | Removed for the reviewer in 1.2b and for the organisation-scoped page in 1.2c (D5, section 5.3; the export stays until 1.2c); the uniform sidebar labels carry the Pillar B / Pillar C distinction from 1.1. |
| `change-summary#panel` | 3 | keep | Rendered inside the dossier view in batch 1. Final state: section 4 product-level block (batch 2). |
| `change-summary#dominant-sentence` | 3 | keep | Unchanged. Final state: section 4 (batch 2). |
| `change-summary#kpis` | 3 | keep | Three tiles with the voce/voci rule unchanged. Final state: section 4 (batch 2). |
| `change-summary#bridge-details` | 3 | keep | Collapsed presence bridge unchanged in batch 1; focusable bars with aria-labels in batch 2. |
| `change-summary#top-products` | 3 | keep | Kept in batch 1. Final state: removed when the ranked drivers chart absorbs the ranking (batch 2); the remainder line and the drill-down link survive. |
| `change-summary#all-link` | 3 | keep | Unchanged. Final state: section 4 (batch 2). |
| `change-summary#unavailable` | 3 | keep | Verbatim, pinned. Final state: section 4 (batch 2). |
| `change-summary#boundary-note` | 3 | keep | Verbatim, pinned. Final state: section 4 (batch 2). |
| `portfolio-pvm#withheld-note` | 3 | keep | Scoped audiences keep the one-line note (`data-c-portfolio-pvm=withheld`, markup pinned). |
| `portfolio-pvm#details` | 3 | keep | Reviewer-only collapsed details unchanged except the «#costi» link, removed in 1.2b. Final state: end of section 4 with coverage meters and a three-step mini bridge (batch 2). |
| `portfolio-pvm#reading-unsupported` | 3 | keep | Verbatim; names the only supported scope. |
| `portfolio-pvm#reading-unavailable` | 3 | keep | Verbatim. |
| `portfolio-pvm#coverage` | 3 | keep | Exact percentages unchanged; meters are a batch-2 presentation item. |
| `portfolio-pvm#insufficient` | 3 | keep | Verbatim. |
| `portfolio-pvm#admitted-change` | 3 | keep | Unchanged. |
| `portfolio-pvm#effects` | 3 | keep | Three icon cards unchanged; the mini bridge is a batch-2 presentation item. |
| `portfolio-pvm#rounding-note` | 3 | keep | Verbatim. |
| `portfolio-pvm#notes` | 3 | rework | Copy drops «convenzione Q dai campi del ledger» and «registro AIFA» (1.2b); the two pinned sentences («non scompongono l’intera variazione…», «non è convalidata dall’Azienda») stay verbatim. |
| `change-bridge#view-toggle` | 4 | keep | Local «Ponte a cascata ❘ Contributi con segno» toggle unchanged. |
| `change-bridge#waterfall` | 4 | keep | Six focusable steps and aria-live readout unchanged. |
| `change-bridge#detail-line` | 4 | keep | Unchanged. |
| `change-bridge#legend-note` | 4 | rework | Colour-name sentence («Blu: totale; verde: …») replaced by a legend keyed to the `--viz` tokens (1.3); «contabili, non causali» kept. |
| `change-bridge#contributions-dot` | 4 | keep | Unchanged (uses the entry-chunk insight-chart primitive). |
| `change-bridge#unavailable` | 4 | keep | Verbatim. |
| `review-plan#details` | 3 | keep | Mounted by `PillarCPortfolioDossier` beside the dossier view and fed by its result, so it stays with the dossier in batch 1; section 6 links to it. Final state: section 6 action block (batch 2, with the provider). |
| `review-plan#actions` | 3 | keep | Unchanged. |
| `review-plan#exports` | 3 | keep | File-name template, JSON/CSV export and confidentiality label unchanged. |
| `review-plan#confidentiality` | 3 | keep | Verbatim. |
| `review-plan#feedback` | 3 | keep | Verbatim. |
| `review-plan#task-editor` | 3 | keep | Unchanged in batch 1; the in-page confirmation replacing `window.confirm` is deferred to batch 2 (critique simplification). |
| `lib/portfolio#contract` | — | keep | Read-only shared contract (Codex); consumed as is. |
| `lib/portfolio-insights#drivers-and-planning` | — | keep | Read-only lib (Codex); consumed as is. |
| `lib/change-explanation#explanation` | — | keep | Read-only lib (Codex); consumed as is. |
| `lib/portfolio-pvm#adapter` | — | keep | Read-only lib (Codex); the workbook-free adapter is contract request 5. |
| `lib/review-plan#engine` | — | keep | Read-only lib (Codex); consumed as is. |

### 2.2 Attribution, planning and evidence (`attribution-analysis`, `planning-workspace`, `evidence-workflow` and their libs)

| Element | Section | Action | Batch-1 note and final state |
|---|---|---|---|
| `attribution-analysis#section` | 3 | keep | Mounted whole in section 3 under the dossier; number badge removed (1.2b); inner anchor id `attribuzione` kept. 1.2b does this for the reviewer through the `pageScope` prop (D1, section 5.3); the scoped page follows in 1.2c. |
| `attribution-analysis#scope-controls` | 3 | remove | The three selects go (1.2b). The attribution scope follows `c_port_*` only; `c_attr_*` is not read; the scope bar deletes `c_attr_org` and `c_attr_channel` (an old `c_attr_period` stays in the address, unread), and «Azzera» deletes all three. |
| `attribution-analysis#states` | 3 | keep | Loading and unavailable copy unchanged; fetch stays in the component (no provider in batch 1). Under `pageScope` (1.2b) the unavailable sentence stays verbatim: no key and no period prefix; the section-3 scope line names the period. |
| `attribution-analysis#kpis` | 3 | keep | Four tiles with data-period/org/channel attributes unchanged. |
| `attribution-analysis#composition` | 3 | keep | Kept with its local «Composizione ❘ Confronto» toggle in batch 1. Final state: one stacked-bar coverage block merged with #change (batch 2); single-period composition when the comparison is null. |
| `attribution-analysis#priority` | 3 | keep | Pareto stays in section 3 in batch 1; section 6 opens with the cross-link «Quali prodotti approfondire per primi? →». Final state: section 6 (batch 2, with the provider). |
| `attribution-analysis#ranges` | 3 | rework | Fixed-width SVG (horizontal scroll on phones) rebuilt on the extracted RangeChart (1.3): bracket bars on one euro scale, focusable rows with aria-labels; the two pinned sentences stay verbatim. |
| `attribution-analysis#change` | 3 | keep | Kept in batch 1. Final state: folded into the composition block as the three share tiles (batch 2). |
| `attribution-analysis#register` | 3 | keep | Kept with the Pareto in batch 1. Final state: section 6 «Grafico ❘ Tabella» pair (batch 2). |
| `attribution-analysis#footer-note` | 3 | keep | Kept in batch 1. Final state: method line stays here, «Versione della mappatura» moves to section 6 «Fonti e versione» (batch 2). |
| `attribution.ts#engine` | — | keep | Read-only lib (Codex). |
| `attribution-format.ts#helpers` | — | keep | Read-only lib (Codex). |
| `planning-workspace#section` | 5 | keep | Spazio scenari mounted whole in section 5 after the budget panel; id `scenari`, registered copy, copy lint and `c_plan_*` contract unchanged. |
| `planning-workspace#scope-line` | 5 | keep | «Ambito del dossier» line, partial-period banner and observed chip unchanged (pinned). |
| `planning-workspace#group-picker` | 5 | keep | Unchanged. |
| `planning-workspace#variant-controls` | 5 | keep | Unchanged. |
| `planning-workspace#rule-controls` | 5 | keep | Unchanged. |
| `planning-workspace#actions` | 5 | keep | Export and confidentiality label unchanged. |
| `planning-workspace#sr-announcement` | 5 | keep | Unchanged. |
| `planning-workspace#states` | 5 | keep | Unchanged. |
| `planning-workspace#observed-lane` | 5 | keep | Unchanged. |
| `planning-workspace#assumption-lane` | 5 | keep | Unchanged. |
| `planning-workspace#ranking` | 5 | keep | Stays collapsed with its basis stated («solo voci condivise con portafogli fuori dal gruppo»); reviewer link to `#evidence-workflow` kept. |
| `planning-workspace#outside-strip` | 5 | keep | Sentences verbatim; restyled as the section's cross-links in 1.4 (its targets `#pianificazione` and `#previsione` now sit in the same section). |
| `planning-workspace#not-computed` | 5 | keep | Unchanged. |
| `planning-workspace#range-chart` | 5 | rework | Extracted to `range-chart.tsx` (1.3) with byte-identical rendered classes; if a planning-ui pin still breaks, the local copy stays and the extracted chart serves attribution only. |
| `planning.ts#labels` | — | keep | Read-only registered copy (Codex); the link rewording is contract request 6. |
| `planning.ts#engine` | — | keep | Read-only lib (Codex). |
| `evidence-workflow#section` | 6 | keep | Reviewer-only queue mounted whole in section 6; gate `audience.capabilities.evidence === true` unchanged; id `evidence-workflow` kept. |
| `evidence-workflow#open-button` | 6 | keep | Unchanged. |
| `evidence-workflow#kpis` | 6 | keep | Unchanged. |
| `evidence-workflow#filters` | 6 | keep | Unchanged. |
| `evidence-workflow#queue-table` | 6 | keep | Unchanged. |
| `evidence-workflow#archived` | 6 | keep | Unchanged. |
| `evidence-workflow#case-editor` | 6 | keep | Unchanged. |
| `evidence-workflow#notices` | 6 | keep | Unchanged. |
| `evidence-priority.ts#contract` | — | keep | Read-only lib (Codex). |
| `attribution-analysis#link-to-queue` | 3 | rework | Reviewer-only link wording aligned to «aggregato delle quattro Aziende» with the fixed-perimeter note when the scope differs (1.2b); target `#evidence-workflow` in section 6. |
| `planning-workspace#cross-links` | 5 | rework | Only hrefs change: the dossier-scope link keeps its registered text and points to `#portafogli-attribuzione`; «Vai agli atti approvati» and the forecast link point inside section 5; «Apri le verifiche» unchanged. |
| `evidence-workflow#incoming-nav` | 6 | rework | The strip entries «Attribuzione» and «Verifiche» disappear with the strip; `#evidence-workflow` stays an inner anchor reached from the section-6 bar entry and the section-3 queue link. |

### 2.3 Audiences, navigation, shell and home (page, scoped workspace, section navigation, layout, sidebar, logo, homepage, login destinations)

| Element | Section | Action | Batch-1 note and final state |
|---|---|---|---|
| `page#metadata` | — | keep | `page.tsx` is read-only in batch 1, so the metadata title stays «Pillar C · Aree cliniche e budget ❘ VIS» for now; aligning it to the page title is recorded as a one-line follow-up for whoever next edits the presentation line of `page.tsx`. |
| `page#auth-and-loaders` | — | keep | Read-only (gate order, loaders, Suspense); page-matrix hash unchanged. |
| `page#scoped-branch` | — | keep | Read-only. |
| `page#scoped-unavailable` | — | keep | Read-only. |
| `page#forecast-only` | — | keep | The `role=note` line in `page.tsx` stays the only organisation statement for forecast_only members. |
| `page#ForecastUnavailable` | 5 | keep | Unchanged. |
| `page#in-preparazione` | — | keep | Read-only. |
| `page#reviewer-branch` | — | keep | Read-only; dynamic boundary unchanged. |
| `page#reviewer-not-ready` | — | keep | Read-only. |
| `scoped#root` | — | rework | `scoped-workspace.tsx` composes the six frames (1.2c); `data-pillar-c-review` / `data-release-state`, `coherent()`, the audience gate and the review-blocks-only import stay. |
| `scoped#header` | 1 | keep | Title «Spesa, budget e aree cliniche» and the `audience.scopeLine` pill unchanged. |
| `scoped#section-strip` | — | remove | Nine-card strip and «Vai alla sezione» select replaced by the six-entry bar (1.2c). |
| `scoped#purpose-nav` | — | remove | Same component as portfolio-dossier#purpose-navigation; the reviewer mount goes in 1.2b, this scoped mount in 1.2c (D5, section 5.3). |
| `scoped#decision` | 1 | keep | Three cards from `cScopedDecision` unchanged; the chosen comparison is shown as text, the toggle lives in section 4. |
| `scoped#ambito` | 1 | rework | Becomes `PillarCScopeBar` (shared with the reviewer): «Ambito», «Canale», «Copia vista», «Azzera», tampered note and sr-only status; writes `c_org`/`c_channel` and `c_port_org`/`c_port_channel` together. |
| `scoped#spesa` | 4 | keep | Regrouped in 1.2c; chart rework in 1.3. |
| `scoped#cambiamento` | 4 | keep | Regrouped in 1.2c with the single «Confronto» toggle. |
| `scoped#pianificazione` | 5 | keep | Regrouped; `C_AUDIENCE_COPY` empty states, the static «Budget pubblicato» line and the O4 note exactly as pinned. |
| `scoped#numerosita` | 5 | keep | Regrouped; the denominator basis sentence (2023 discharge rate × residents at 31 December 2024) stays as the panel lead. |
| `scoped#previsione` | 5 | keep | Last block of section 5. |
| `scoped#evidenza` | 6 | merge | The scoped and reviewer reading cards become one audience-free `evidence-sources.tsx` with the compact «Fonti e versione» list (1.2b/1.2c). |
| `dossier#section` | 3 | keep | As portfolio-dossier#section. |
| `dossier#starting-point` | 3 | keep | As portfolio-dossier#starting-point. |
| `dossier#change-summary` | 3 | keep | As change-summary#panel (final: section 4, batch 2). |
| `dossier#pvm` | 3 | keep | As portfolio-pvm#details / #withheld-note. |
| `dossier#monthly` | 3 | keep | As portfolio-dossier#monthly-chart (final: section 4, batch 2). |
| `dossier#drivers` | 3 | keep | As portfolio-dossier#drivers-bars (final: section 4, batch 2). |
| `dossier#all-products` | 3 | keep | As portfolio-dossier#products-table (final: section 4, batch 2). |
| `dossier#shared-exposure` | 3 | keep | As portfolio-dossier#shared-exposure. |
| `dossier#planning-slider` | 3 | keep | As portfolio-dossier#planning-slider. |
| `dossier#footer` | 3 | rework | As portfolio-dossier#footer-note («#costi» link removed). |
| `dossier#review-plan` | 3 | keep | As review-plan#details (section 6 links to it; final: section 6, batch 2). |
| `planning#section` | 5 | keep | As planning-workspace#section. |
| `planning#observed-lane` | 5 | keep | Unchanged. |
| `planning#assumption-lane` | 5 | keep | Unchanged. |
| `planning#ranking` | 5 | keep | Unchanged. |
| `planning#outside` | 5 | keep | Unchanged (restyle in 1.4). |
| `planning#not-computed` | 5 | keep | Unchanged. |
| `attribution#section` | 3 | keep | As attribution-analysis#section (selects and badge removed). |
| `attribution#tiles` | 3 | keep | As attribution-analysis#kpis. |
| `attribution#composition` | 3 | keep | As attribution-analysis#composition. |
| `attribution#priority` | 3 | keep | As attribution-analysis#priority (final: section 6, batch 2). |
| `attribution#ranges` | 3 | rework | As attribution-analysis#ranges (RangeChart, 1.3). |
| `attribution#change` | 3 | keep | As attribution-analysis#change. |
| `attribution#register` | 3 | keep | As attribution-analysis#register. |
| `forecast#panel` | 5 | keep | `PillarCForecastPanel` unchanged, id `previsione`. |
| `forecast#decision-cards` | 5 | merge | Unchanged in section 5; section 1 adds a link card to the annual estimate built from `cForecastDecision` (see section 1). |
| `forecast#exact-table` | 5 | keep | Unchanged. |
| `forecast#data-scope` | 5 | keep | Unchanged, including the CC BY attribution. |
| `regional-forecast-workspace#root` | 5 | rework | forecast_only composition (1.2c): the six-entry bar, section 5 with the forecast, and one sentence naming the five sections not available for the organisation; the file still never names an audience; `router.replace` series contract unchanged. |
| `section-navigation#component` | — | rework | Compact six-entry sticky bar with scroll-spy; strip and select removed (1.2a additive, old rendering dropped in 1.2c). |
| `section-navigation#lists` | — | rework | One six-entry `PILLAR_C_SECTIONS`; `PILLAR_C_ALL_SECTIONS` and `PILLAR_C_SCOPED_SECTIONS` deleted in 1.2c; `pillarCSectionAtViewport` keeps its signature with fallback `quadro`. |
| `audience-context#provider` | — | keep | Read-only. |
| `analytical#root-and-nav` | — | rework | `analytical-workspace.tsx` composes the six frames (1.2b); data attributes, the dynamic-boundary import rule and the `publishedActs` `useMemo` line stay verbatim. |
| `analytical#budget-reviewer-extras` | 5 | rework | The two preset buttons and the empty-state hint are removed (1.2b) and replaced by one availability line built from the published-act keys through `C_ORG_LABELS`; the published/modelled source switch stays for the reviewer. |
| `analytical#numerosita-reviewer-wording` | 5 | rework | Per-person wording removed (1.2b); the scoped ratio wording (euro per unit of estimated count) becomes the default for every audience; the basis sentence stays as the lead. |
| `analytical#insight-panels` | — | remove | Removed in 1.2d (own revertible commit); see «Removed pending Codex admission». |
| `analytical#evidence-workflow` | 6 | keep | As evidence-workflow#section. |
| `analytical#evidenza-lineage` | 6 | keep | «Tracciabilità» (OutputLineage, workbook version · sha256, receipt hashes) stays inside `analytical-workspace.tsx` as a collapsed reviewer-only block; never in a shared file. |
| `legacy#workbook-explorer` | — | remove | Dead code deleted in 1.2d. |
| `legacy#preview-workspace-and-charts` | — | remove | Dead synthetic prototype deleted in 1.2d; `lib/preview.ts` untouched. |
| `layout#dashboard-review` | — | keep | Auth lines and `isReviewer` forwarding byte-identical; only the bare-logo fallback becomes `VisLogoLink` (1.1). |
| `nav#logo-link` | — | rework | 1.1: `VisLogoLink` → `/` with aria-label «VIS Pharma Compass · torna alla home» and a 44 px target (before 1.1 the sidebar logo opened the spend overview). |
| `nav#identity-block` | — | keep | Unchanged. |
| `nav#groups` | — | rework | 1.1: uniform pillar labels; every href and the group structure unchanged. |
| `nav#admin-and-logout` | — | rework | 1.1: «Esci» rendered at every width; the admin Control Center gate unchanged. |
| `nav#layout-container` | — | keep | `contentOverflow` special case kept. |
| `vis-logo#component` | — | rework | 1.1: `VisLogoLink` added; `VisLogo` stays presentational. |
| `logo#homepage-nav-and-footer` | — | rework | 1.1: both placements become `VisLogoLink`. |
| `logo#pillar-a-header` | — | rework | 1.1: logo through `VisLogoLink` and a «Pillar B · Biosimilari ed esclusività» link in a nav labelled «Navigazione pubblica»; the reserved target and every data section untouched. |
| `logo#pillar-b-header` | — | rework | 1.1: logo through `VisLogoLink` (replacing the page's own link labelled «VIS Pharma Compass, home»), the «Pillar A · Fonti pubbliche» link and 44 px targets; the reserved target and every data section untouched. |
| `logo#access-portal` | — | rework | 1.1: logo → `VisLogoLink`; the two public pillar links relabelled; no Pillar C link. |
| `logo#control-center` | — | rework | 1.1: the `VisLogo` placements become `VisLogoLink`; auth gates untouched. |
| `logo#auth-layout` | — | rework | 1.1: the duplicated `AuthMark` SVG replaced by `VisLogoLink`; nothing else in `app/auth/**`. |
| `logo#protected-layout-legacy` | — | keep | Legacy starter layout, out of scope; recorded. |
| `home#nav-pillar-links` | — | rework | 1.1: three equal pill links A/B/C in one pattern (subtitle shown from `xl`, sr-only below; 44 px target); Pillar C adds the lock icon and sr-only «accesso riservato»; literal hrefs `/pillar-a` and `/pillar-b` and the Pillar B subtitle text stay as pinned. |
| `home#hero-and-ctas` | — | keep | Untouched. |
| `home#dashboard-preview-mock` | — | keep | Untouched; its hard-coded figures are flagged for the owner, not edited. |
| `home#modules-and-footer` | — | rework | 1.1: footer logo → `VisLogoLink` only; modules untouched. |
| `auth#proxy-session-redirect` | — | keep | Read-only (Codex); see contract request 7. |
| `auth#login-destination` | — | keep | Read-only (Codex). |
| `auth#callback-and-confirm` | — | keep | Read-only (Codex). |
| `auth#other-destinations` | — | keep | Read-only (Codex). |
| `shell#error-and-loading` | — | keep | Unchanged. |
| `review-blocks#shared` | — | rework | `CReviewHeading` keeps a `number` prop for the numerals 1–6 and, from 1.2b, takes `inner` (an `h3` without number badge for a block inside a section frame, D6); `ExactTable` header «Celle prodotto» → «Voci prodotto» (1.2b); `CountRows` default labels = ratio wording (1.2b); no org key, label, audience or province key may enter the file. |
| `local-toggle#shared` | — | keep | Reused for «Vista», «Confronto», «Anno CO». |

### 2.4 Workbook sections (`analytical-workspace`, `review-blocks`, `insight-panels`, `forecast-section`, `regional-forecast-workspace`, legacy files and their libs)

| Element | Section | Action | Batch-1 note and final state |
|---|---|---|---|
| `analytical-workspace#page-header` | 1 | keep | Title «Spesa, budget e aree cliniche» unchanged; scope pill «Aggregato delle quattro Aziende e ASL 1–4 · revisione di progetto» built inside the reviewer chunk. |
| `analytical-workspace#section-nav-strip` | — | remove | Sixteen-card strip and «Vai alla sezione» select replaced by the six-entry bar (1.2b). |
| `analytical-workspace#dossier-and-planning-mounts` | 3 / 5 | rework | Dossier → section 3; Spazio scenari → section 5 after the budget panel; purpose navigation removed; still exactly one dossier, one planning, one attribution and one evidence mount. |
| `analytical-workspace#decision` | 1 | keep | Three cards from `cDecisionAnswer`; «Vai a» links to `#portafogli-attribuzione`, `#fattori`, `#budget-scenari`; the «#costi» link goes. |
| `analytical-workspace#scope-bar` | 1 | rework | Becomes `PillarCScopeBar`; the explanatory paragraph («Periodi e misure sono accanto ai grafici…») is dropped; the sr-only «Selezione aggiornata» status stays. |
| `analytical-workspace#spesa` | 4 | keep | Regrouped in 1.2b; chart rework in 1.3. |
| `review-blocks#SpendKpis` | 4 | merge | 1.3: the «Mesi rappresentati» KPI folds into the coverage note «{n} di 12 mesi rappresentati · non certifica la completezza degli invii» under the timeline; the three KPI cards stay. |
| `review-blocks#SpendViewButtons+SpendChart` | 4 | rework | 1.3: replaced by `SpendTimeline` chosen by the «Vista» Mensile ❘ Cumulata toggle; the Area/Linea/Colonne chooser is removed. |
| `review-blocks#ExactTable` | 4 | keep | «Valori e dettaglio» pattern unchanged; header «Celle prodotto» → «Voci prodotto» (1.2b). |
| `analytical-workspace#insights-spesa` | — | remove | Removed in 1.2d pending Codex admission (O-09-04…08, O-10-02). |
| `analytical-workspace#composizione` | — | remove | Removed in 1.2d pending Codex admission (O-11-01/02/03/05). |
| `analytical-workspace#attribuzione-mount` | 3 | keep | Attribution mounted whole in section 3 after the dossier. |
| `analytical-workspace#cambiamento` | 4 | keep | Regrouped in 1.2b with the single «Confronto» toggle. |
| `analytical-workspace#insights-cambiamento` | — | remove | Removed in 1.2d pending Codex admission (O-12-01…06). |
| `analytical-workspace#costi` | — | remove | Removed in 1.2d (O-13-*, ML-4-*); the per-portfolio PVM reading stays in section 3. |
| `analytical-workspace#confronti` | — | remove | Removed in 1.2d pending Codex admission (O-14-01/02/03/06). |
| `analytical-workspace#attivita` | — | remove | Removed in 1.2d pending Codex admission (O-04-01, O-15-03/04/07, PUB-01…05, PUB-07-*). |
| `analytical-workspace#pianificazione` | 5 | rework | Preset buttons → availability line (1.2b); «Azienda / Canale / Periodo del budget», «Livello organizzativo», «Area» and the reviewer-only «Fonte del budget» select stay; comparison dots reworked in 1.3. |
| `analytical-workspace#insights-pianificazione` | — | remove | Removed in 1.2d pending Codex admission (O-16-01…04, PUB-09-v2, PUB-10, ML-1-*, ML-A03, ML-2-*). |
| `analytical-workspace#numerosita` | 5 | rework | Ratio wording for every audience; basis sentence kept as the lead; portfolio labels in the select are contract request 3. |
| `analytical-workspace#insights-numerosita+tendenze` | — | remove | Removed in 1.2d pending Codex admission (ML-3-*, O-17-01/05). |
| `analytical-workspace#previsione` | 5 | keep | Forecast panel kept; the insights block (O-18-04) is removed in 1.2d pending admission. |
| `analytical-workspace#sensibilita+priorita+queue` | 6 | rework | Insight sections 12–13 removed in 1.2d pending admission (PC-19/SG, PC-20, O-10-06); the evidence queue stays, mounted in section 6. |
| `analytical-workspace#evidenza` | 6 | merge | Reading cards merge with the scoped ones into `evidence-sources.tsx`; «Tracciabilità» stays in `analytical-workspace.tsx`; insights evidenza (O-03-01/03, SRC-DEF-01, PC-03-C3) removed in 1.2d. |
| `analytical-workspace#data-attributes-and-state` | — | keep | Data attributes unchanged. 1.2b replaces the workbook-only root override `xl:[&_section[id]]:scroll-mt-56` with the unconditional `xl:[&_[id]]:scroll-mt-36` (144 px against a sticky section bar of at most about 94 px; D3 and R10, section 5.3); 1.4 measures the offset in a browser. |
| `review-blocks#BridgeValues` | 4 | keep | Tiles and bridge unchanged. |
| `review-blocks#BudgetRows` | 5 | rework | 1.3: comparison dots (● chiave principale ◇ alternativa │ budget) on one common scale, first 12 rows drawn, signed differences in the exact table. |
| `review-blocks#CountRows` | 5 | rework | 1.2b: default labels become the ratio wording; the dot-with-±25 % range on a common scale and the exact table stay. |
| `reviewer-workspace#dynamic-wrapper` | — | keep | Read-only (UI-4 dynamic boundary). |
| `insight-panels#PillarCInsightsPanel` | — | remove | Removed in 1.2d. |
| `insight-panels#InsightView-controls` | — | remove | Removed in 1.2d. |
| `insight-panels#PillarCInsightsSection` | — | remove | Removed in 1.2d. |
| `insight-chart#PillarCInsightChart` | — | keep | Read-only entry-chunk primitive used by change-bridge. |
| `forecast-section#banner` | 5 | keep | Unchanged (`C_FORECAST_LABEL`). |
| `forecast-section#chart` | 5 | keep | Unchanged. |
| `forecast-section#planning-cards` | 5 | merge | Unchanged in section 5; the annual estimate is also surfaced by the section-1 link card. |
| `forecast-section#exact-table+scope-details` | 5 | keep | Unchanged. |
| `regional-forecast-workspace#page` | 5 | rework | As regional-forecast-workspace#root. |
| `workspace#PillarCWorkspace-preview` | — | remove | Dead synthetic prototype deleted in 1.2d. |
| `charts#preview-charts` | — | remove | Only imported by the deleted prototype; deleted in 1.2d. |
| `workbook-explorer#PillarCWorkbookExplorer` | — | remove | Dead raw workbook browser deleted in 1.2d. |
| `workbook.ts#contract` | — | keep | Read-only; the navigation lib's dependency on `C_WORKBOOK_SECTIONS` goes, the lib itself is untouched. |
| `insights.ts#vocabulary` | — | keep | Read-only; exports used only by the removed browser are listed for a later handoff, not pruned. |
| `insight-charts.ts#options` | — | keep | Read-only; same later handoff. |
| `chart-kinds.ts#vocabulary` | — | keep | Read-only (entry chunk). |
| `review.ts#contract-and-labels` | — | keep | Read-only; `C_COMPONENT_LABELS` rewording is contract request 1. |
| `reviewer-labels.ts#C_ORG_LABELS` | — | keep | Read-only, reviewer-only chunk; the positive control of the client-graph test may point here. |
| `section-navigation.ts#lists` | — | rework | As section-navigation#lists. |

Totals: 222 inventory elements; keep 154, merge 5, rework 41, remove 22. «merge» is used where batch 1 itself folds elements together (the section-1 link card, the two audiences' reading cards, the coverage note). The further merges the design makes (comparison tiles into the coverage block, top-3 lists into the drivers chart, shared exposure with the ranges) are batch-2 items noted on the rows that batch 1 keeps.

Silent merges are not allowed; the ones the design makes are stated here so that nothing disappears unannounced: the attribution comparison tiles fold into the coverage block (batch 2); the change-summary top-3 lists fold into the ranked drivers chart with the remainder line kept (batch 2); the dossier footer method sentences and the attribution mapping version move to sections 3 and 6 (batch 2); the planning outside-strip's regional-context lines are kept verbatim and restyled (1.4); the spend chart-type chooser is replaced by a chart chosen by the question (1.3). The dossier note «I controlli aggiornano solo questo dossier e il suo piano di revisione» disappears with the dossier's organisation and channel selects; the section-3 scope line states instead that the page scope drives dossier, attribution, scenari and review plan. In 1.2b the reviewer's dossier carries a new note that says where organisation and channel are chosen (D1, section 5.3); the scoped page keeps the old note until 1.2c.

## 3. Removed

### 3.1 Removed from the interface, with reasons

| Element | Commit | Why |
|---|---|---|
| Long selector strip: `analytical-workspace#section-nav-strip`, `scoped#section-strip`, `section-navigation#lists` (`PILLAR_C_ALL_SECTIONS` 16 entries, `PILLAR_C_SCOPED_SECTIONS` 9 entries, «Vai alla sezione» select) | 1.2b / 1.2c | Replaced by one six-entry compact bar shared by every audience; the workbook numbering 01–14 and the scoped numbering 01–07 disappear. |
| Generic insight browser: `insight-panels#PillarCInsightsPanel`, `#InsightView-controls`, `#PillarCInsightsSection` | 1.2d | The «one browser per workbook section» with facet selects, eight chart kinds, «Dettaglio metodologico» cells and unmapped codes (SG-1…6, T01–T11, Theil-Sen, Shapley, LMDI, winsorizzata, «in formula») is the internal-formula presentation the brief excludes. Its 84 workbook outputs are not accepted (CLAUDE.md), so no accepted analysis disappears; the reviewer views it carried are listed in 3.2. |
| Per-section reviewer insight mounts: `analytical-workspace#insights-spesa`, `#composizione`, `#insights-cambiamento`, `#costi`, `#confronti`, `#attivita`, `#insights-pianificazione`, `#insights-numerosita+tendenze`, the previsione insights block, `#sensibilita+priorita` (insight part), `#insights-evidenza` | 1.2d | Reviewer-only workbook snapshots with numerical acceptance pending; synthetic-tier outputs (ML-1/2/3/4-SYN) must not be presented as organisational results; audit and readiness tables are internal. Candidates for purpose-built reviewer blocks in batch 2 once Codex names the admitted outputs with explicit column maps (contract request 4). |
| `workbook-explorer#PillarCWorkbookExplorer` | 1.2d | Dead code (mounted nowhere; tests forbid it) showing raw ids «O-xx · R5», «col. X», «Riga workbook N» and the tier «Ledger privato — V2 in attesa». |
| `workspace#PillarCWorkspace-preview`, `charts#preview-charts` | 1.2d | Dead synthetic prototype («Dati illustrativi · nessun risultato aziendale», ui-preview-20261013) withdrawn from the routes; it would break the no-synthesis rule if ever mounted. `lib/preview.ts` keeps `canSeePillarCPreview` (imported by `page.tsx`) untouched. |
| `analytical#budget-reviewer-extras`: preset buttons «Budget pubblicati · ASL 4 · CO 2024» and «Piano modellato 2025 · {ASL}», empty-state hint «Prova ASL 4, CO o DD…» | 1.2b | A hard-coded shortcut to one Azienda is internal knowledge. Replaced by one availability line derived from the published-act keys, labelled through the audience and never carrying an amount. The published/modelled source switch itself stays for the reviewer. |
| `review-blocks#SpendViewButtons` (Area / Linea / Colonne) | 1.3 | The chart type is chosen by the question (monthly columns, cumulative line); the meaningful local control is the «Vista» toggle between «Mensile» and «Cumulata». |
| `portfolio-dossier#purpose-navigation`, `scoped#purpose-nav` (`PillarPurposeNavigation`) | 1.2b (reviewer) / 1.2c (scoped) | Duplicates the sidebar's Pillar B link; from 1.1 the uniform A/B/C labels carry the distinction. |
| `portfolio-dossier#scope-controls` («Organizzazione», «Canale» selects); `attribution-analysis#scope-controls` («Periodo», «Organizzazione», «Canale» selects) | 1.2b | Three identical trios collapse into the page scope bar (organisation · channel) plus one local «Periodo» in section 3. URL keys are kept; old links still resolve, and the attribution follows `c_port_*` only. |
| `change-summary#top-products` (two top-3 lists) | batch 2 | Same ranking as the dossier's top-10 bars; one ranked drivers chart keeps the remainder line and the drill-down link. Deferred: the drivers chart merge needs the provider split. |
| `attribution-analysis#composition` «Confronto» view as a duplicate of `attribution-analysis#change` | batch 2 | The same two shares shown twice; merged into one period-comparison block. Deferred with the attribution rework. |
| Links to «#costi»: `portfolio-dossier#footer-note` («Quantità, mix e costo nei sottoinsiemi ammessi»), `analytical-workspace#decision` («Quantità, mix e costo»), `portfolio-pvm#details` («Apri supporto, confronti e dettaglio dei costi») | 1.2b | They point at the removed workbook costi section; the price-quantity-mix reading lives with the dossier. Interim: the costi workbook section stays mounted in section 4 until 1.2d, so between 1.2b and 1.2d it is reached only through «Fattori di spesa». |
| `analytical-workspace#scope-bar` explanatory paragraph «Periodi e misure sono accanto ai grafici; la numerosità resta una vista CO distinta…» | 1.2b | Replaced by per-section scope lines; the sr-only «Selezione aggiornata» status stays. |
| `analytical#numerosita-reviewer-wording` («Spesa per paziente nello scenario…», «Euro / persona nello scenario») | 1.2b | Per-person wording is misleading for a modelled denominator; the scoped ratio wording becomes the default for every audience, with the basis sentence as the lead. |
| `review-blocks#SpendKpis` «Mesi rappresentati» KPI card | 1.3 | A coverage fact, not a KPI; becomes a one-line note under the timeline (nothing lost). |
| `change-bridge#legend-note` colour-name sentence («Blu: totale; verde: …») | 1.3 | Names can diverge from the theme tokens; replaced by a legend keyed to the `--viz` tokens. |
| Section number badges 01–14 (reviewer) and 01–07 (scoped) in `CReviewHeading`, attribution and insight sections | 1.2b / 1.2c | Six named sections replace the numbering; `CReviewHeading` keeps a `number` prop for the numerals 1–6. The reviewer's insight-section badges (02, 05, 06, 07, 10, 12, 13 with a workbook) stay until 1.2d removes those sections (D2). |
| Internal-model wording: `portfolio-dossier#kpis` detail «proxy ATC, con rettifiche»; `portfolio-pvm#notes` «convenzione Q dai campi del ledger», «registro AIFA»; attribution S2 label «Portafoglio singolo · proxy»; `ExactTable` header «Celle prodotto» | 1.2b | Replaced by plain labels; the meaning and the pinned sentences are kept. |

### 3.2 Removed pending Codex admission

These reviewer workbook views leave the interface with commit 1.2d and have no interim replacement. They are recorded here, with the section they would return to, so that each can be readmitted through a contract (request 4) as a purpose-built block with an explicit column map and tier. None is accepted for scoped or forecast_only audiences; none is lost for them.

| Output | What it showed | Candidate section |
|---|---|---|
| PUB-09-v2 | Published 2024 departmental budget of one Azienda (public tier; the inventory marked it the real approved-budget view) | 5 |
| PUB-04 | AIFA regional versus national timeline 2018–2025 (public tier) | 2 (public context) |
| O-15-03 | Residents context (public tier) | 2 (public context) |
| O-16-01 | Budget register | 5 |
| PUB-10 | Other-Azienda context (public tier) | 5 |
| O-11-02 / O-11-03 | Composition by ATC class and by portfolio | 3 |
| O-12-04 / O-12-05 | Product and class drivers (Regione only) | 4 |
| O-14-03 | Standardised comparison with the D min/max bounds | 3 |
| O-17-01 | Sixteen monthly series | 4 |
| O-18-04 | Descriptive 2026 scenarios SC-0/1/L/H | 5 |
| PC-20 | Priority register (top-25 evidence targets) | 6 |
| O-10-06 | Top evidence targets, paired with PC-20 | 6 |
| PC-19/SG | Sensitivity to assumptions (as a note) | 5 |
| ML-4-REAL (with ML-4-COV) | Three-effect reading beyond the single selected portfolio; the per-portfolio price-quantity-mix reading stays in section 3 | 4 |

Synthetic-tier outputs (ML-1/2/3/4-SYN) are not requested back. If the owner wants no interim loss, the alternative recorded by the critique is to mount the existing reviewer-only panel unchanged inside one collapsed section-6 block until batch 2; the default is removal in 1.2d, which can be reverted alone.

## 4. Navigation standard

### 4.1 Compact section bar

- `lib/dashboard-review/pillar-c/section-navigation.ts` exports one list `PILLAR_C_SECTIONS` of six entries `{ id, label, question, number }` with numbers 1–6 and the ids of the table in section 1. In 1.2a the list is added as `PILLAR_C_SIX_SECTIONS` beside the old lists (nothing reads it yet) and takes the name `PILLAR_C_SECTIONS` in 1.2c, when the old lists go. `PILLAR_C_ALL_SECTIONS` and `PILLAR_C_SCOPED_SECTIONS` are deleted (1.2c), the dependency on `workbook.ts` `C_WORKBOOK_SECTIONS` goes (the workbook lib is untouched), and `pillarCSectionAtViewport` keeps its signature with the default list and the fallback id `quadro`.
- `components/dashboard-review/pillar-c/section-navigation.tsx` renders `<nav aria-label="Sezioni dell’analisi Pillar C">` as one row of six pill links (icon + label; the numeral is `aria-hidden`), `aria-current="location"` from the rAF scroll-spy, synced on `hashchange` and `popstate`. Below `md` it is a horizontally scrollable row with scroll-snap, 44 px targets and no description text; from `md` a grid with wrapping labels, three columns up to `lg` and six from `xl` (1.2a measurement: under the 256 px sidebar a six-column cell leaves no room for a label before `xl`); sticky at `xl` (from 1.2b alone: the scope bar is not sticky, D3 in section 5.3). The component is `PillarCSectionBar`, added in 1.2a beside the old `PillarCSectionNavigation`, which goes in 1.2c. No «Vai alla sezione» select. Motion-safe transitions only. Activating a link scrolls to the section and moves focus to its `h2` (`tabIndex -1`), as the scenari link does today.
- Section frames: `PillarCSectionFrame` renders `<section id aria-labelledby>` with the numeral, the `h2`, the question as lead and an optional scope line (source · organisation · channel · period as keyed live text); `PillarCSectionEmpty` renders one exact sentence as `role=status`. The reviewer, scoped and regional-forecast workspaces compose the same frames in the same order; the regional-forecast workspace stays audience-free (its source may not contain the word audience).
- The page scope bar (`PillarCScopeBar`, entry chunk, labels passed as props and never imported) sits in section 1 under the header and the section bar: «Ambito» (`audience.orgs`), «Canale», «Copia vista» (keyed span), «Azzera» (`cInsightResetSearch` unchanged), the tampered note for scoped links and the sr-only «{scope}. Selezione aggiornata.» The design made it sticky with the bar at `xl`; 1.2b keeps it in the flow (deviation D3, section 5.3), because a stacked sticky header would cover about 200 px at `xl`. It writes `c_org`, `c_channel`, `c_port_org` and `c_port_channel` in one `pushState` and deletes `c_attr_org` and `c_attr_channel` (an old `c_attr_period` stays in the address, unread; «Azzera» deletes all three `c_attr_*` keys); the attribution reads `c_port_*` only. No scope bar for forecast_only (no organisation data). An old link with divergent keys (for example `c_org` and `c_port_org` naming different organisations) shows `c_org` in the bar and `c_port_*` in section 3 (dossier, attribution and the section scope line); they converge when the reader picks another organisation or channel in the bar, or uses «Azzera» (choosing the organisation the bar already shows fires no change). Each reader keeps its own key and the section-3 scope line stays visible.
- Text that changes with a filter is a single text child or a keyed element, so Chrome page translation replaces it instead of keeping a stale translation. Every control is keyboard reachable; no positive `tabindex`.

### 4.2 Sidebar standard (every `/dashboard-review/*` page)

`components/dashboard-review/nav.tsx`: `VisLogoLink` (href `/`, aria-label «VIS Pharma Compass · torna alla home», 44 px minimum height; the sidebar logo no longer opens the spend overview) and the theme switcher; identity block unchanged («Revisore» pill or name + organisation + «Dati limitati al perimetro autorizzato»); groups unchanged except the pillar labels; `aria-current="page"` on the exact pathname; «Esci» rendered at every width (the hidden `md:block` wrapper goes); the admin Control Center gate and the `contentOverflow` special case unchanged. `app/dashboard-review/layout.tsx`: auth logic untouched; only the bare-logo fallback (no overview) becomes `VisLogoLink`.

### 4.3 Uniform pillar labels

The same three labels everywhere a pillar is named, in the same order and pattern:

| Label | Sidebar href | Homepage href | Note |
|---|---|---|---|
| «Pillar A · Fonti pubbliche» | `/pillar-a` | `/pillar-a` | Replaces the earlier spellings «Pillar A · fonti pubbliche» (sidebar) and «Pillar A · dati pubblici» (access portal). Sidebar target consistency with the private «Antibiotici AWaRe» module is an open owner question (not blocking). |
| «Pillar B · Biosimilari ed esclusività» | `/dashboard-review/revisione-pillar-b` | `/pillar-b` | Replaces «Pillar B · dati pubblici» in the access portal. The homepage literal hrefs and the subtitle text are pinned by `pillar-b-public-surface` and stay. |
| «Pillar C · Aree cliniche e budget» | `/dashboard-review/pillar-c` | `/dashboard-review/pillar-c` | The existing sidebar and metadata wording, unchanged. On the homepage the link adds a lock icon and the sr-only «accesso riservato». |

On the homepage the three links share one pattern: the pillar name, the subtitle shown from `xl` and read out below it (`sr-only`), so the accessible name is always the full label; a 32 px pill with a 44 px touch target. The Pillar C page header keeps its own title «Spesa, budget e aree cliniche» (the string the reviewer and scoped workspaces already render) and `page.tsx` keeps its metadata title «Pillar C · Aree cliniche e budget | VIS» because it is read-only in batch 1. Whether the header title and the pillar label are later aligned, and to which wording, is the owner confirmation in section 9.

Public headers: `/pillar-a` links home through `VisLogoLink` and, in a nav labelled «Navigazione pubblica», shows Home · «Pillar B · Biosimilari ed esclusività» · «Area riservata →», keeping its existing reserved target (`/dashboard-review/antibiotici`); `/pillar-b` already linked home with the accessible name and shows Home · Pillar A · «Area riservata →». Access portal (pending accounts): logo → `VisLogoLink`; links relabelled «Pillar A · Fonti pubbliche» and «Pillar B · Biosimilari ed esclusività», each a 44 px target; no Pillar C link, because pending accounts must not see private analyses. Control Center (restricted, setup-required and the access-control-centre header) and the auth layout: `VisLogoLink` replaces the unlinked `VisLogo` and the duplicated `AuthMark` SVG; the auth pages no longer carry their own copy of the mark.

### 4.4 Every logo links home

`components/vis-logo.tsx` gains `VisLogoLink` (next/link to `/` with the aria-label «VIS Pharma Compass · torna alla home», a 44 px minimum height and a visible focus ring, wrapping `VisLogo`) so every placement links home from one definition and the destination and accessible name cannot drift; `VisLogo` stays presentational; its only change is `whitespace-nowrap` on the wordmark, so «VIS PHARMA» cannot break into a third line when the sticky bar squeezes it at 375 px. Placements through `VisLogoLink`: sidebar (1), homepage sticky nav and footer (2), dashboard-review layout fallback (1), access portal (1), Control Center restricted and setup-required states (2), access-control-centre header (1), `/pillar-a` header (1), auth layout (1); `/pillar-b` keeps its existing home link with the same accessible name. `tests/shell-navigation.test.mjs` pins the placement count per file, forbids a bare `VisLogo` or a locally wrapped logo in those files, and renders the sidebar, the access portal, the homepage and the auth layout to count the home links.

### 4.5 Access restrictions preserved

`app/dashboard-review/pillar-c/page.tsx` is read-only in batch 1: gate order, `resolvePillarCMemberAudience`, loaders, Suspense wrappers, the `role=note` line and the static sections are untouched, so the page-matrix hash stays. The audience provider, the guard shapes (exported mount = guard returning null; inner component takes the audience; no exported component fetches), the capability gates (`evidence`, `pvm`, `syntheticBudgets`, `lineage`) and the `REVIEWER_ONLY` leak list are kept and re-asserted. Reviewer-only modules stay outside the route entry chunk.

### 4.6 Login return destinations preserved

`lib/supabase/proxy.ts` (unauthenticated → `/auth/login`, path dropped), `components/login-form.tsx` (→ `/dashboard-review/spend`), the `/auth/callback` and `/auth/confirm` routes (`safeNext`), logout → `/auth/login` and the legacy redirects (`/dashboard-review/pillar-a` → antibiotici, `biosimilar-to-euros` → `revisione-pillar-b`) are read-only. The homepage Pillar C link therefore lands a signed-out visitor on `/auth/login` and, after login, on `/dashboard-review/spend`. This is recorded, the link is labelled «area riservata» so the behaviour is expected, and a `next` carry is requested from Codex as a contract change (request 7).

## 5. Batch plan

### 5.1 Simplifications adopted from the critique

- Batch 1 = regroup only. `CPortfolioDossierView` stays whole (slider card, change summary, drivers, monthly chart, products table, price-quantity-mix reading) and the review plan stays beside it in section 3; `PillarCAttributionAnalysis` stays whole in section 3. No `portfolio-view-context.tsx`, `portfolio-drivers.tsx` or `attribution-view-context.tsx` in batch 1: no guard-shape re-pins, no double-fetch risk, and the O2/UI-16 and portfolio-render pins keep passing.
- The attribution scope follows `c_port_*` only; the `c_attr_*` fallback logic is dropped (none of those keys is read; the scope bar deletes `c_attr_org` and `c_attr_channel`, «Azzera» all three).
- One «Confronto» toggle, in section 4; section 1 shows the chosen comparison as text, and the composition block renders single-period when the comparison is null.
- forecast_only = the section bar + section 5 + one sentence naming the unavailable sections, not five empty frames. The six-frame variant is offered to the owner as an option.
- `cPlanningCopyLint` stays scoped to `#scenari`; the rest of section 5 and the new frames use the narrower existing lints only.
- «Tracciabilità» and `OutputLineage` stay inside `analytical-workspace.tsx`; `evidence-sources.tsx` is audience-free (reading cards + «Fonti e versione»).
- The review-plan in-page confirmation is deferred to batch 2.
- The count-scenario denominator sentence stays as the panel lead; the «Budget pubblicato» static line and the O4 note stay exactly as pinned.
- The insight-panels removal is its own commit (1.2d), independently revertible, reviewed by the owner before the push; commits 1.3 and 1.4 do not depend on it.

### 5.2 Commits

Every commit: tsc clean, eslint clean, the full test suite passing, `npx next build --webpack` passing, rationale and re-pin reasons in the message, no new dependency, committed by the agent on the UI branch with the owner's identity and never pushed by the agent (the owner reviews and pushes after Codex's gate and Guido's sign-off). Gates and sequence:

| Commit | Content | Tests |
|---|---|---|
| 1.1 Shell and home | `vis-logo.tsx` (`VisLogoLink`); `nav.tsx` (logo home, uniform labels, «Esci» at every width); `app/page.tsx` (A/B/C links, two logo placements); `app/auth/layout.tsx`; `components/access/access-portal.tsx`; `app/admin/control-center/page.tsx`; `components/admin/access-control-center.tsx`; `app/pillar-a/page.tsx` header; `app/pillar-b/page.tsx` header; `app/dashboard-review/layout.tsx` fallback logo; this document. Logo and label edits only in the six named extra files. | New `tests/shell-navigation.test.mjs` (server-side render with the data layer stubbed: one way home, every placement through `VisLogoLink`, the three labels in sidebar, homepage, public header and access portal, «Esci» at every width as a 44 px target, sidebar hrefs, admin gate and layout auth lines byte-identical); `pillar-b-public-surface` and `pillar-b-scope` unchanged and passing. |
| 1.2a Nav lib and frames (additive) | `section-navigation.ts` gains the six-entry list beside the old lists; `section-navigation.tsx` gains the compact rendering; new `section-frame.tsx`, `scope-bar.tsx`, `decision-overview.tsx`. Nothing mounted yet; old lists kept one commit longer. | New `tests/pillar-c-six-sections-nav.test.mjs`, `-frames.test.mjs` and `-overview.test.mjs` (21 tests: pure-function pins of the six entries and of the untouched old lists, SSR markup of the bar, the frames, the scope bar and the overview, source pins); existing tests untouched. |
| 1.2b Reviewer regroup | `analytical-workspace.tsx` composes the six frames with the scope bar (not sticky, D3); dossier and attribution whole in section 3 through the `pageScope` prop (their org/channel and three selects removed, attribution on `c_port_*`; the scoped page passes nothing, D1); spend and bridge in section 4 with the single toggle; budget panel (presets → availability line), scenari, counts (ratio wording, basis lead) and forecast in section 5; queue, `evidence-sources.tsx`, Tracciabilità and cross-links in section 6; the insight mounts placed by topic until 1.2d (D2); reviewer purpose navigation, «#costi» links, number badges and internal wording removed. Record: section 5.3. | Reviewer markup hash re-recorded once (`eac1cc54…` → `c476b18e…`, cases 51 → 59, data hash `bebe2d2b…` unchanged; reason: six-section regroup, the 1.2b copy rows and the reviewer queue link at 44 px); re-pins in scoped-ui (guards, count wording, hash, `REVIEWER_ONLY` extended), attribution (mount count), portfolio-render, planning-ui mount order, evidence-ui mount and queue wording, review.test keyed-text and forbidden-wording lists, six-sections-overview mount pin; client-graph positive control re-pointed as described in section 7; matrix helper extended by eight leaves; new `tests/pillar-c-six-sections-reviewer.test.mjs` (16 tests). The section-navigation, workbook and nav-list re-pins move to 1.2c (D4). |
| 1.2c Scoped and forecast_only regroup | `scoped-workspace.tsx` composes the same frames; `regional-forecast-workspace.tsx` = bar + section 5 + the one sentence; `PILLAR_C_ALL_SECTIONS` and `PILLAR_C_SCOPED_SECTIONS` deleted; old strip rendering removed. | scoped-ui option, badge and select pins; the new `tests/pillar-c-six-sections.test.mjs` per audience; scoped-page hash unchanged (the regional workspace is stubbed in the page matrix); `pillar-c-regional-forecast` checked and, if it pins the old markup, re-pinned with the reason stated. |
| 1.2d Insight browser removal | `insight-panels.tsx` deleted with its reviewer-only mounts; dead files `workspace.tsx`, `charts.tsx`, `workbook-explorer.tsx` deleted; `lib/preview.ts` untouched. | insights test lines 50–56; `REVIEWER_ONLY` list extended with `insight-panels` and «Approfondimento del workbook»; hash re-recorded (reason: removal only); `pillar-c-preview.test.mjs` checked before deleting `workspace.tsx`. |
| 1.3 Chart presentation | `spend-timeline.tsx` (monthly columns with negatives in `--viz-4`, cumulative line broken at missing months, exact tooltip strings, coverage note, exact table beneath; replaces the chooser); `range-chart.tsx` extracted from `planning-workspace.tsx` with identical rendered classes and used for the attribution ranges; `BudgetRows` comparison dots on one common scale (first 12 drawn, signed differences in the exact table); bridge legend keyed to tokens. | chart-render additions (null month breaks the line, observed zero renders as zero, negative colour); exact-value pairing (one «Valori e dettaglio» or `<dl>` per `aria-hidden` chart); planning-ui class pins unchanged; hash re-recorded (reason: chart markup). |
| 1.4 Responsive, accessibility and performance | Scroll-snap row and 44 px targets at 375; sticky offsets re-measured; focus-to-`h2`; charts `aria-hidden` with focusable exact alternatives; motion-safe transitions; no fixed width over 343 px outside an `overflow-x-auto` container; outside-strip restyle; entry-chunk module count bounded; route size before and after; HTML-stream timing on the dev server; screenshots at 375/768/1280, light and dark, for the reviewer (SSR harness) and forecast_only (next dev with the placeholder env), recorded only if taken. | six-sections keyboard, responsive and copy-lint assertions; client-graph bound. |

Measured for 1.1 on the webpack dev server after the breakpoint change: the homepage sticky bar has no horizontal overflow at 375, 768, 1024 and 1280 px and «Registrati» is fully visible at each (before the change it overflowed by 42 px at 375 and by 238 px at 768); at 320 px it still overflows by 22 px, outside the 375 px target. The pill names and arrows show from `lg`, the section anchors from `xl`, the theme switcher and «Accedi» from `sm`. The auth layout was verified by server-side render (the dev server has no Supabase variables, so its fail-closed proxy answers 503 on `/auth/*`): one home link, 42 px mark, centred, 44 px target.

Measured for 1.2a: 975 tests, 967 pass, 8 skipped (the same 8), tsc and eslint clean, `next build --webpack` passes; the Pillar C route keeps 20 client chunks, 1,144 KB → 1,146 KB (+1,426 bytes: the six-entry list and the six icon entries kept alive by the module-level id list, plus the layout-dashboard icon; the bar body and the three new files are not bundled because nothing mounts them).

Measured for 1.2b: 991 tests, 983 pass, 8 skipped (the same 8; the 16 new tests are `tests/pillar-c-six-sections-reviewer.test.mjs`); tsc clean; eslint clean on the 16 changed and new files, while `npm run lint` reports 6 errors and 3 warnings, all in six files untouched since `ac5e058` and the same 9 problems that `npx eslint .` reports on an extract of `ac5e058`; `next build --webpack` passes; the Pillar C route keeps 20 client chunks, 1,173,599 → 1,176,901 bytes (+3,302 bytes, all in the route's page chunk: the compact section bar body, now bundled because the reviewer mounts it, and the `pageScope` branches and copy rows of the dossier, attribution and review blocks, which are entry-chunk modules). None of the reviewer-only 1.2b strings (the availability line, «Fonti e versione», «Versione e tracciabilità») is in the 20 route chunks. Reviewer matrix before the helper was extended: data hash unchanged, 30 of the 51 old cases changed (22 workspace, 4 attribution, 4 dossier) and 21 byte-identical (2 change summaries, 16 planning, 3 review plans). Scoped check: 195 of 195 scoped cases equal to `ac5e058` after the three every-audience substitutions (tile detail, S2 label, «Voci prodotto»), 108 of them byte-identical; `scoped-workspace.tsx`, `regional-forecast-workspace.tsx` and `app/` unchanged.

Handback after 1.4: this document updated with commit ids, the tests run with counts, the measurements, unresolved issues and the contract requests; release candidate handed to the owner for the push (agent push to main is blocked; the owner runs the command and the live check follows).

### 5.3 Commit 1.2b record

1.2b regroups the reviewer page only: `analytical-workspace.tsx` composes the six frames, and the organisation-scoped and forecast_only pages follow in 1.2c. This section records the lead's decisions (D1–D8), the planner's resolutions (R1–R10) and the amendments the lead made to the plan after its critique. The rows of sections 2, 3, 4 and 6 that they change point back here.

Decisions:

- **D1 `pageScope`.** `PillarCPortfolioDossier` and `PillarCAttributionAnalysis` take `pageScope?: boolean` (default `false`). The reviewer mounts `<PillarCPortfolioDossier workbook={workbook} pageScope/>` and `<PillarCAttributionAnalysis pageScope />`; the scoped page passes nothing in 1.2b and renders as at `ac5e058` except the every-audience copy rows (tile detail, S2 label, «Voci prodotto»).
  - Dossier under `pageScope`: no «Organizzazione» and «Canale» selects (only «Portafoglio» and «Periodo»), an `h3` title, the review plan inside a `#piano-revisione` wrapper, and the note «Organizzazione e canale si scelgono nell’ambito della pagina, nella sezione Quadro decisionale; il periodo scelto qui vale anche per l’attribuzione, lo spazio scenari e il piano di revisione. I raggruppamenti ATC non sono reparti o titolari di budget.»
  - Attribution under `pageScope`: reads `c_port_*` only and never `c_attr_*`; no selects, no badge, an `h3`, and `data-c-attribution-scope="{period}|{org}|{channel}"`. The unavailable sentence stays verbatim in both branches (no key, no period prefix), so row `attribution-analysis#states` holds; the section-3 scope line names the period.
  - The guard shapes stay: the exported mount is a guard returning null, the inner component takes the audience, and no exported component fetches. The claim rows of `portfolio-dossier.tsx` and `attribution-analysis.tsx` in section 6 describe the design's final state; in batch 1 the two files change only as stated here and in the copy rows of 3.1 (no provider, no split).
- **D2 insight mounts.** The reviewer insight mounts stay until 1.2d, placed in the frames by topic. `composizione` is mounted in section 3 after the attribution (row `analytical-workspace#attribuzione-mount` places the attribution directly after the dossier); the spesa panel is in section 4; the other mounts keep their relative order (cambiamento panel, costi, confronti and attivita in section 4; the pianificazione panel, the numerosita panel, tendenze and the previsione panel in section 5; sensibilita, priorita and the evidenza panel in section 6). They keep their own `h2` and the badges 02, 05, 06, 07, 10, 12 and 13 until 1.2d (rows `analytical#insight-panels`, `analytical-workspace#insights-*` and the badge row of 3.1).
  - The three «#costi» links go in 1.2b (row of 3.1), while the costi workbook section stays until 1.2d: in between, it is reached only through «Fattori di spesa».
  - Until 1.2d the insight-panel footnote (`insight-panels.tsx:155`, Codex-owned) still names the «sezione Evidenza»; on the reviewer page that is the block «Fonti e criteri di lettura» in section 6 «Priorità ed evidenza».
- **D3 sticky.** Only `PillarCSectionBar` is sticky (`xl:sticky xl:top-3`). The scope bar is not sticky in 1.2b, a deviation from section 4.1 («sticky with the bar at `xl`»), because a stacked sticky header would cover about 200 px at `xl`. The root override `xl:[&_section[id]]:scroll-mt-56` (workbook only) is replaced by the unconditional `xl:[&_[id]]:scroll-mt-36` (R10). 1.4 measures the offset in a browser at 1280 px.
- **D4.** `PillarCSectionNavigation`, `PILLAR_C_SECTIONS` and the 16- and 9-entry lists are untouched in 1.2b. The re-pins of `pillar-c-section-navigation`, `pillar-c-workbook` and the nav parts of `pillar-c-evidence-ui` and `pillar-c-planning-ui` move to 1.2c (rows in section 6).
- **D5.** The reviewer no longer mounts `PillarPurposeNavigation`; the export and the scoped mount stay until 1.2c.
- **D6 headings.** `CReviewHeading` gains `inner`: a block inside a frame renders an `h3` with no number badge. Every old inner anchor id still exists (`portafogli`, `attribuzione`, `spesa`, `cambiamento`, `pianificazione`, `scenari`, `numerosita`, `previsione`, `evidenza`, `evidence-workflow`, `portfolio-product-detail`). The old decision heading becomes `h3 id="c-decision-title"`.
  - Accepted `h2` exceptions inside the frames: `scenari-title` (planning-workspace.tsx, until 1.3), `c-evidence-title` (evidence-workflow.tsx, read-only in batch 1) and the insight sections (until 1.2d).
  - Outline consequence: `numerosita-title` and `previsione-title` sit under `scenari-title` until 1.3; with a workbook, `previsione-title` sits under `tendenze-title` until 1.2d, and `evidenza-title` under `c-evidence-title` until the queue heading becomes an `h3` (batch 2).
  - Heading flattening: the inner blocks' `h3` stand next to the `h3` of their Panels. Under `pageScope` the dossier and attribution inner `h3` headings (monthly, drivers, composition and priority titles among them) are peers of their `h3` titles until batch 2 splits those views.
  - `evidence-sources.tsx` renders each criterion title as an `h5` under the `h4` «Come leggere le analisi»; «Fonti e versione» is an `h4`.
- **D7 evidence sources.** `evidence-sources.tsx` is audience-free and holds no reviewer-only content (claim row corrected in section 6).
  - «Tracciabilità» means the two existing collapsed details, «Fonti e significato delle analisi» (`OutputLineage`) and «Versione e tracciabilità». Both stay verbatim inside `analytical-workspace.tsx` and are passed as children, because `REVIEWER_ONLY` matches their summaries.
  - «Fonti e versione» in 1.2b repeats sentences already on the page (R5): «Spesa», «Raggruppamenti terapeutici», «Scenario CO» («Scenario CO con tasso regionale di dimissione 2023 e residenti al 31 dicembre 2024. Dati sintetici: numerosità stimata dai dimessi. Non rappresenta pazienti distinti osservati.») and «Previsione regionale» (`C_FORECAST_LABEL`). The forecast row renders only when the packet holds a forecast.
  - The version itself stays in «Tracciabilità»; the mapping version moves in batch 2.
- **D8 hash.** The reviewer regression hash in `tests/pillar-c-scoped-ui.test.mjs` is re-recorded once: `eac1cc54cfb1f90b7e9222ea46d065a11ba9e769352ed8876922995fd17827fd` (51 cases) → `c476b18e51c01864596c43a683580630fee96cb7048431f09f715006b8643d58` (59 cases), data hash `bebe2d2b…` unchanged. Reason: the six-section regroup, the 1.2b copy rows and the reviewer queue link at 44 px.
  - Before the helper was extended, 30 of the 51 old cases changed and 21 were byte-identical (measurements above). Each changed attribution and dossier leaf is explained by the 1.2b copy rows, the removed «#costi» links and, for one attribution case, the queue link class.
  - The 8 new leaves render on literal synthetic props: the frame (with scope line, with empty state), the scope bar (plain, tampered), the decision overview (with and without the regional card) and the evidence sources (with children, without sources).
  - The positive control of `pillar-c-scoped-client-graph` is re-pointed: the reviewer workspace's findings are exactly `['C_ORG_LABELS']` (the preset buttons held its only literal pairing), and the TE pairing is found in `insights.ts`. No pairing was added and no leak check was loosened.

Resolutions:

- **R1.** Workbook gating stays: the attribution mount and the evidence queue stay inside `workbook && …` (regroup only; open question 1, answered by the lead).
- **R2.** Section-1 regional card from `cForecastDecision(packet.forecast, "TOT")`, linking to `#previsione`; absent when the forecast is missing or not admitted, or when the decision throws. It ships in 1.2b following section 1; the owner item in section 9 is provisionally answered this way.
- **R3.** Page-header scope pill «Aggregato delle quattro Aziende e ASL 1–4 · revisione di progetto», built inside the reviewer chunk (row `analytical-workspace#page-header`).
- **R4.** Section-6 cross-links: «Quali prodotti approfondire per primi? →» goes to `#attribuzione` and renders only with a workbook, like its target; «Piano di revisione del portafoglio →» goes to `#piano-revisione`, which the dossier renders after it loads (the one link target the new test allows to be absent from the server render).
- **R5.** «Fonti e versione» rows: see D7.
- **R6.** The old decision heading group stays inside section 1: eyebrow «La domanda di gestione», `h3` «Più persone trattate o prodotti più costosi?» and the lead unchanged.
- **R7.** The reviewer workspace's own selects are 44 px (`h-11`, derived from `C_REVIEW_UI.selectClass`); the shared `C_REVIEW_UI`, `LocalToggle` and the dossier and attribution controls wait for 1.4, so the scoped markup is unchanged.
- **R8.** The «Copia vista» state lives in `PillarCScopeBar`: «Link copiato» resets on the bar's own changes and on «Azzera», not on changes made in other sections (the link was still copied).
- **R9.** New wording: listed below, subject to sign-off.
- **R10.** Scroll offset `xl:[&_[id]]:scroll-mt-36`, unconditional. The project's Tailwind 3.4 compiles it to `scroll-margin-top: 9rem` on every `[id]` at `xl`; its specificity (0,2,0) is above the components' own `xl:scroll-mt-56` (0,1,0). 144 px against a bar bottom edge of at most about 94 px: `top-3` 12 px, `p-2` 16 px, a 2 px border and links of at most 64 px with three-line labels.

Amendments by the lead to the plan:

- The attribution's unavailable sentence is unchanged (D1); the plan's period-prefixed variant and its source pin were dropped.
- The dossier `pageScope` note has the wording in D1. Divergent old links: when `c_org` and `c_port_org` differ, the bar shows `c_org` and section 3 shows `c_port_*`; they converge when the reader picks another organisation or channel, or uses «Azzera» (section 4.1). The new reviewer test pins `?c_org=AQ` with no `c_port_org`: the bar shows AQ selected, while the section-3 scope line and `data-c-attribution-scope` show the default organisation.
- The new test finds heading ids whatever the attribute order: React keeps prop order, so the dossier heading renders `class` before `id`.
- The availability line (row `analytical#budget-reviewer-extras`) reads «Atti di budget dipartimentali pubblicati nel pacchetto: {Azienda} · {periodo} · {canali}.» or «Nessun atto di budget dipartimentale pubblicato nel pacchetto di revisione.» It is built from `publishedActs`, which keeps only departmental published acts; its `useMemo` line and keys-only comment stay verbatim. It never shows an amount.
- The S2 label is «Portafoglio singolo · da mappatura» (S2 = exactly one candidate portfolio in the mapping).
- The PVM loading text is «Caricamento della scomposizione…» (the old text described the decomposition as verified, which no Pillar C review state may claim). `portfolio-pvm.tsx`, `portfolio-dossier.tsx` and `attribution-analysis.tsx` join the forbidden-wording file list of `pillar-c-review`.
- `REVIEWER_ONLY` gains three patterns: «Atti di budget dipartimentali pubblicati nel pacchetto», «Nessun atto di budget dipartimentale pubblicato nel pacchetto» and «Aggregato delle quattro Aziende e ASL 1–4». Each has a live positive match in the reviewer render. This is a tightening. The shorter «Atti di budget pubblicati» is not used, because the scoped reading card contains it.
- Both `<summary>` elements of the workspace get `py-3` (44 px), with their text unchanged; the new test requires `py-3` or `min-h-11` on every `<summary` in the workspace source. The reviewer-only queue link of the attribution is `min-h-11`.

Recorded for 1.4 (44 px targets and motion-safe transitions on the reviewer page):

- the `ExactTable` summary (`review-blocks.tsx`);
- the attribution `button` class (`min-h-10`, bare `transition`);
- `LocalToggle`'s `transition-colors`;
- the forecast `<summary>` «Dati e ambito della previsione» (`forecast-section.tsx:144`, no `py-3` or `min-h-11`; Codex-owned);
- the change-bridge toggle buttons (`min-h-10`);
- the review-plan inputs and buttons (`min-h-10`, bare `transition-colors`);
- the change-summary link (`min-h-10`);
- the planning workspace's «Apri la previsione regionale» link (`min-h-10`);
- the attribution's inline «Apri la coda condivisa →» link, inside a sentence (WCAG 2.5.8 inline exception, to review);
- the reviewer's «{n} portafogli senza rapporto disponibile restano nel registro di copertura…», which reads «1 portafogli» when the count is 1. The fix renders the singular, keeps one text child, re-pins `review.test` and re-records the hash; the scoped copy (`scoped-workspace.tsx`) goes to Codex.

Notes for Codex (`lib/**` is read-only for the UI):

- The `audience-view.ts:29–30` comment «The reviewer view keeps its own wording» is stale after 1.2b: the reviewer now reads the same ratio wording.
- `planning.ts:59` and `:79`: see request 6 in section 8.

New wording in 1.2b, accepted by the lead and subject to Guido Putignano's sign-off before release (section 9, item 3):

- the dossier `pageScope` note;
- the two variants of the availability line;
- the S2 label «Portafoglio singolo · da mappatura»;
- the PVM sentence «Stima da dati reali, con quantità ricondotte a unità confrontabili.» and the loading text «Caricamento della scomposizione…»;
- the budget empty state «Nessuna coppia disponibile per questo ambito nel pacchetto di revisione. Nessun valore viene sostituito con zero.» (equal to the scoped copy);
- the cross-link labels «Piano di revisione del portafoglio →» and «Quali prodotti approfondire per primi? →»;
- the comparison line «Confronto: …» of section 1;
- the «Fonti e versione» terms and rows.

Tests: the re-pins and their reasons are listed in the 1.2b commit message and summarised in the rows of section 6. `tests/pillar-c-six-sections-reviewer.test.mjs` (new, 16 tests) renders the reviewer workspace with and without a workbook on the synthetic fixture. It covers frames, blocks per frame, badges, headings, anchors, removed strings, the sticky rule, the scope-bar address, the availability line, the attribution and dossier under `pageScope`, the unchanged scoped mounts, the regional card and the «Fonti e versione» rows, the copy rows, the `evidence-sources.tsx` source pins, and keyboard, 44 px and motion.

### 5.4 Commit 1.2c record

1.2c gives the Azienda and Regione pages the reviewer's six-section composition (same frames and components; values, card wording and security lines unchanged; the scope bar writes `c_org`, `c_channel`, `c_port_org` and `c_port_channel` in one `pushState` through `cScopedPageScopeSearch`, built on `cScopedReviewSearch`, and deletes `c_attr_org` and `c_attr_channel`). The forecast_only page keeps its header and shows the section bar with only «Budget e scenari» as a link (the other entries are plain text with the sr-only «, sezione non disponibile in questa pagina»), the sentence «Quadro decisionale, Destinatari e utilizzo, Portafogli e attribuzione, Fattori di spesa e Priorità ed evidenza non sono disponibili in questa pagina; in Budget e scenari è disponibile solo la previsione regionale. Nessun valore viene sostituito.» and section 5 with the forecast. The sentence speaks about the page, never about the organisation, because the same workspace is mounted for outage branches; the `role=note` line of `page.tsx` stays the only organisation statement (a deviation from the section-1 pattern, on the sign-off list). Deleted: `PillarCSectionNavigation`, `PILLAR_C_ALL_SECTIONS`, `PILLAR_C_SCOPED_SECTIONS`, the old six-entry list, `PillarPurposeNavigation`, the `pageScope` prop with the branches it selected, and the numbered `CReviewHeading`; `PILLAR_C_SIX_SECTIONS` is now `PILLAR_C_SECTIONS` with the fallback `quadro`. The reviewer markup hash is unchanged (`c476b18e…`) and `page.tsx` is byte-identical. The scoped «Scenario CO» source row repeats the count lead verbatim (no estimate wording under the count empty state). Codex note: from 1.2c no reader's dossier has organisation or channel selects, while `planning.ts:59` and `:79` still name them (request 6). Section 7's «six section ids for every audience» does not hold for forecast_only (only `budget-scenari` and `previsione`); recorded here for the owner with the six-frame option. Checks: 1,002 tests, 994 pass, 8 skipped; tsc and eslint clean on the changed files; `next build --webpack` passes.

Recorded for 1.4 (both pages, WCAG 2.5.3 Label in Name):

- the budget selects «Livello organizzativo» and «Area da esplorare» carry `aria-label="Livello del budget"` and `aria-label="Area del budget"`. The `aria-label` replaces the visible label in the accessible name, so a voice-control user who says the visible label cannot reach the control. 1.4 changes them to `aria-label="Livello organizzativo del budget"` and `aria-label="Area da esplorare del budget"`, so that each name starts with the visible label: `scoped-workspace.tsx:203–204` and `analytical-workspace.tsx:176–177`. The pair is present at `b2579dc`; 1.2c moves the block bodies verbatim and the reviewer hash does not move in 1.2c, so the fix waits for 1.4. The 1.4 re-pins: `tests/pillar-c-six-sections.test.mjs:482`, `tests/pillar-c-six-sections-reviewer.test.mjs:619`, the aria-label lists of that batch's text-node regression check, and the reviewer hash, re-recorded with that reason.

### 5.5 Later batches

- Batch 2, after Codex names admitted workbook outputs and delivers adapters: the dossier and attribution splits with view providers (drivers block in section 4, Pareto and register in section 6, slider card and review plan relocated with the owner's sign-off), the composition/comparison merge, the price-quantity-mix meters and mini bridge, purpose-built reviewer blocks per section with explicit column maps, human area labels and portfolio labels from the packets, `C_COMPONENT_LABELS` and planning link copy, the `next` login carry for the homepage link, the review-plan in-page confirmation, point-18 persistence through approved endpoints, pruning of dead insight exports by named handoff.
- Batch 3: section 2 «Destinatari e utilizzo» populated only when an accepted audience-specific recipients/utilization packet exists (January points 2–4/5, later File F), with exact tables, never earlier.

## 6. Per-file claim

The claim is reproduced exactly as the design lists it, with the batch-1 commit that touches the file. Files marked «batch 2» are claimed by the design but deferred by the regroup-only decision and are not created in batch 1. The six files named outside the Pillar C tree (`app/auth/layout.tsx`, `components/access/access-portal.tsx`, `app/admin/control-center/page.tsx`, `components/admin/access-control-center.tsx`, `app/pillar-a/page.tsx`, `app/pillar-b/page.tsx`) receive logo and label edits only, in commit 1.1.

| Path | Change | Batch | Design note |
|---|---|---|---|
| `components/dashboard-review/pillar-c/analytical-workspace.tsx` | edit | 1.2b, 1.2c | reviewer composition of the six frames; keeps data-pillar-c-review/data-release-state, the dynamic-boundary import rule, publishedActs useMemo line verbatim, exactly one dossier/planning/evidence/attribution mount; removes insights/explorer/purpose-navigation/presets. 1.2c (E4, E6): only lines 24, 36 and 37 rename `PILLAR_C_SIX_SECTIONS`/`PillarCSixSection` to `PILLAR_C_SECTIONS`/`PillarCSection`, and lines 147–148 mount `<PillarCPortfolioDossier workbook={workbook} />` and `<PillarCAttributionAnalysis />` without `pageScope`; the reviewer markup hash c476b18e… stays |
| `components/dashboard-review/pillar-c/scoped-workspace.tsx` | edit | 1.2c | scoped composition of the same frames; coherent(), audience gate, explicit-row reading, C_AUDIENCE_COPY use, `const label = (key: string) => cAudienceLabel(audience, key) ?? "";` line and review-blocks-only import kept; source must stay free of paziente❘persona\b. 1.2c (E1, E2, P4–P7, P11–P13, K7): the nine-card strip and its select, the purpose navigation, the «Ambito» section, the copy and reset buttons, the decision wrapper and the numbered headings give way to `<PillarCSectionBar />`, `PillarCScopeBar` (written through `cScopedPageScopeSearch`, exported here) and the six `PillarCSectionFrame`s holding the existing blocks (`Heading inner`), the decision overview, the prop-less dossier and attribution, the cross-links and section 6 with the scoped criteria and «Fonti e versione» (the «Scenario CO» row repeats the numerosità lead verbatim); root `xl:[&_[id]]:scroll-mt-36`, own selects `h-11` |
| `components/dashboard-review/pillar-c/regional-forecast-workspace.tsx` | edit | 1.2c | forecast_only: same six frames with empty sentences and the forecast in section 5; router.replace series contract kept; file must not contain the word audience. As built in 1.2c (E3, K1, K2), in place of the six frames: the unchanged `PageHeader`, then `<PillarCSectionBar available={[BUDGET.id]} />` (the other five entries as plain text with the sr-only «, sezione non disponibile in questa pagina», `#budget-scenari` the only link), then the sentence «Quadro decisionale, Destinatari e utilizzo, Portafogli e attribuzione, Fattori di spesa e Priorità ed evidenza non sono disponibili in questa pagina; in Budget e scenari è disponibile solo la previsione regionale. Nessun valore viene sostituito.» as `PillarCSectionEmpty`, then the section-5 `PillarCSectionFrame` holding today's `<section id="previsione">` forecast panel; `update` with `router.replace` kept verbatim, root `xl:[&_[id]]:scroll-mt-36` |
| `components/dashboard-review/pillar-c/section-navigation.tsx` | edit | 1.2a, 1.2c | 1.2a adds `PillarCSectionBar` (compact six-entry bar) beside the old component; 1.2c removes the strip, the select and the old component. As built in 1.2c (E4, P1, P10): `PillarCSectionNavigation`, `SIX_IDS`, the old icon keys and 13 lucide imports are deleted; `PillarCSectionBar` gains `available` (default all six, markup byte-identical): an entry outside it renders in place as a `<span>` with the sr-only «, sezione non disponibile in questa pagina», and the current entry is clamped to an available one |
| `lib/dashboard-review/pillar-c/section-navigation.ts` | edit | 1.2a, 1.2c | presentation-only lib (its header says so): 1.2a adds `PILLAR_C_SIX_SECTIONS` and widens the id union; 1.2c renames it to `PILLAR_C_SECTIONS`, deletes the ALL/SCOPED lists and moves the fallback to `quadro`; pillarCSectionAtViewport signature kept. As built in 1.2c (E4, P8): `PILLAR_C_SECTIONS` is the only list, `PillarCSectionId` the six-id union and `PillarCSection` the entry type; `PillarCNavSection`, `PillarCSixSectionId`, `PillarCSixSection` and the `C_WORKBOOK_SECTIONS` import are deleted, so the file has no import |
| `components/dashboard-review/pillar-c/review-blocks.tsx` | edit | 1.2b, 1.2c, 1.3 | SpendViewButtons/SpendChart replaced by SpendTimeline import, «Mesi rappresentati» → coverage note, ExactTable header «Voci prodotto», CountRows default labels = ratio wording, Heading numeral 1–6; must keep no org key/label/audience and no province key. 1.2c (E7, P9): the numbered `CReviewHeading` variant is deleted and `HeadingProps` requires `inner: true`, so every block heading is an `h3` without a number badge |
| `components/dashboard-review/pillar-c/portfolio-dossier.tsx` | edit | 1.2b, 1.2c | fetch moved to the provider; org/channel selects removed; purpose navigation removed; slider card, review plan and change summary re-exported for their new sections; guard shape pattern kept; #costi link removed. As built in 1.2b: a `pageScope` prop (default false) removes the org/channel selects for the reviewer, swaps the note and wraps the review plan in `#piano-revisione`; fetch, re-exports and the purpose navigation export stay (D1, section 5.3). 1.2c (E5, E6): the `pageScope` prop with its default branch (organisation and channel selects, old note, `h2`) and the `PillarPurposeNavigation` export are deleted, so every reader gets the D1 note, the `h3` title and `#piano-revisione`; the unused imports (`next/link`, four icons, `C_ATTR_CHANNELS`) go |
| `components/dashboard-review/pillar-c/change-summary.tsx` | edit | batch 2 (deferred: regroup only) | top-3 lists removed in favour of the ranked drivers; presence bridge bars focusable; pinned sentences and data-c-change-* kept; no fetch, no reviewer vocabulary |
| `components/dashboard-review/pillar-c/portfolio-pvm.tsx` | edit | 1.2b | #costi link removed, copy without internal source wording, coverage meters and three-step mini bridge; guard regex shape and withheld-note markup kept |
| `components/dashboard-review/pillar-c/attribution-analysis.tsx` | edit | 1.2b, 1.2c | split into section-3 analysis and section-6 priority consumers of the provider; selects removed (c_attr_* with c_port_* fallback); «proxy» label and queue wording aligned; pinned sentences kept. As built in 1.2b: no split; a `pageScope` prop (default false) makes the reviewer's attribution read `c_port_*` only, with no selects, no badge, an `h3` and `data-c-attribution-scope`; without it (scoped page until 1.2c) the selects and `c_attr_*` stay (D1, section 5.3). 1.2c (E6): the `number` and `pageScope` props with the default branch (the «Ambito di questa analisi» card, its three selects, the badge, the `c_attr_*` reading, the `h2`) are deleted, so every reader's attribution reads `c_port_*` only, with an `h3` and `data-c-attribution-scope` |
| `components/dashboard-review/pillar-c/planning-workspace.tsx` | edit | 1.3 | only: RangeChart import from range-chart.tsx and the scope link href → #portafogli-attribuzione; every registered label, source-pinned line and class stays |
| `components/dashboard-review/pillar-c/change-bridge.tsx` | edit | 1.3 | legend keyed to --viz tokens; waterfall/dot logic, tabIndex steps and aria-live unchanged; stays in the entry chunk with no province key |
| `components/dashboard-review/pillar-c/review-plan.tsx` | edit | batch 2 (deferred: regroup only) | in-page confirmation replaces window.confirm (batch 1.4, optional); pinned source lines untouched |
| `components/dashboard-review/pillar-c/section-frame.tsx` | new | 1.2a | PillarCSectionFrame, PillarCSectionEmpty, PillarCScopeLine (audience-free) |
| `components/dashboard-review/pillar-c/scope-bar.tsx` | new | 1.2a | PillarCScopeBar (entry chunk, props-fed labels) |
| `components/dashboard-review/pillar-c/decision-overview.tsx` | new | 1.2a | section 1 cards, the chosen comparison as text (no toggle: the page's one «Confronto» toggle is in section 4), regional reference card |
| `components/dashboard-review/pillar-c/spend-timeline.tsx` | new | 1.3 | monthly columns / cumulative line + exact table |
| `components/dashboard-review/pillar-c/range-chart.tsx` | new | 1.3 | RangeChart extracted from planning-workspace.tsx, identical rendered classes |
| `components/dashboard-review/pillar-c/portfolio-view-context.tsx` | new | batch 2 (deferred: regroup only) | portfolio view provider/hook (guarded, single fetch per scope) |
| `components/dashboard-review/pillar-c/portfolio-drivers.tsx` | new | batch 2 (deferred: regroup only) | section 4 product-level drivers block |
| `components/dashboard-review/pillar-c/attribution-view-context.tsx` | new | batch 2 (deferred: regroup only) | attribution view provider/hook shared by sections 3 and 6 |
| `components/dashboard-review/pillar-c/evidence-sources.tsx` | new | 1.2b | section 6 reading criteria and «Fonti e versione»; audience-free, with no reviewer-only content: the reviewer's «Tracciabilità» stays in analytical-workspace.tsx and is passed as children (D7, section 5.3) |
| `components/dashboard-review/pillar-c/workspace.tsx` | delete | 1.2d | dead synthetic preview (ui-preview-20261013); never re-mounted |
| `components/dashboard-review/pillar-c/charts.tsx` | delete | 1.2d | only imported by workspace.tsx |
| `components/dashboard-review/pillar-c/workbook-explorer.tsx` | delete | 1.2d | dead raw workbook browser |
| `components/dashboard-review/pillar-c/insight-panels.tsx` | delete | 1.2d | generic workbook insight browser; its lazy fetch + request cache + retry pattern is documented for batch 2 purpose-built blocks |
| `components/dashboard-review/nav.tsx` | edit | 1.1 | VisLogoLink, uniform pillar labels, «Esci» at every width; NAV_GROUPS hrefs and admin gate unchanged |
| `components/vis-logo.tsx` | edit | 1.1 | add VisLogoLink; VisLogo unchanged |
| `app/page.tsx` | edit | 1.1 | only the sticky-nav pillar links (A/B/C uniform, C with lock), the bar's breakpoints (pill names and arrows from `lg`, section anchors from `xl`, theme switcher and «Accedi» from `sm`, tighter gaps below `sm`; the bar overflowed at 375 and 768 before) and the two logo placements; pinned href="/pillar-a", href="/pillar-b" and «Biosimilari ed esclusività» kept; hero/modules/preview untouched |
| `app/auth/layout.tsx` | edit | 1.1 | AuthMark SVG replaced by VisLogoLink; import order tidied; nothing else |
| `components/access/access-portal.tsx` | edit | 1.1 | header logo → VisLogoLink and the two public pillar link labels only; overview/request logic untouched; no Pillar C link |
| `app/admin/control-center/page.tsx` | edit | 1.1 | two VisLogo placements → VisLogoLink; auth gates untouched |
| `components/admin/access-control-center.tsx` | edit | 1.1 | header VisLogo → VisLogoLink only |
| `app/pillar-a/page.tsx` | edit | 1.1 | header: logo through `VisLogoLink`, a «Pillar B · Biosimilari ed esclusività» link, 44 px targets; the page title aligned to «Pillar A · Fonti pubbliche»; data/sections untouched |
| `app/pillar-b/page.tsx` | edit | 1.1 | header: logo through `VisLogoLink`, the «Pillar A · Fonti pubbliche» link, 44 px targets; data/sections untouched |
| `app/dashboard-review/layout.tsx` | edit | 1.1 | only the bare-logo fallback becomes VisLogoLink; every auth line and the isReviewer forwarding byte-identical |
| `tests/pillar-c-section-navigation.test.mjs` | edit | 1.2c (moved from 1.2b, D4) | re-pin to the six ids/numerals and fallback quadro. 1.2c: the whole file moves to `PILLAR_C_SECTIONS` (the six ids, numerals 1–6, `question`) and the viewport cases to the six ids, plus one case for the `quadro` clamp |
| `tests/pillar-c-workbook.test.mjs` | edit | 1.2c (moved from 1.2b, D4) | drop the PILLAR_C_ALL_SECTIONS import and nav assertions (lines 7, 13–17); workbook lib assertions unchanged. 1.2c: lines 7, 15 and 16 deleted, line 13 retitled, and one line pins that `section-navigation.ts` names neither `workbook` nor `C_WORKBOOK_SECTIONS` |
| `tests/pillar-c-evidence-ui.test.mjs` | edit | 1.2b, 1.2c | re-pin nav/mount lines 137–145 (queue mounted inside section 6 after the priority block, before the sources block; icon map) and the queue link wording (line 152). 1.2b: the mount pin :144 (`<PillarCEvidenceSources`, adjacency to the queue kept) and the queue wording :152 and :155 («aggregato delle quattro Aziende», plus an absence check of «aggregato regionale»); the nav part moves to 1.2c (D4). 1.2c: :7 imports `PILLAR_C_SECTIONS`; :137–142 pin `priorita-evidenza` as the last entry, no `evidenza` entry and the queue inside the section-6 frame; :146 pins the `"priorita-evidenza": ListChecks` icon |
| `tests/pillar-c-planning-ui.test.mjs` | edit | 1.2b, 1.2c | re-pin lines 315–318 (dossier/planning mount regex: planning now follows the budget panel in section 5) and 532–540 (nav list); O2/UI-16 and focus pins unchanged. 1.2b: :316 becomes order assertions (budget panel, the keys-only planning mount, the numerosità block; dossier before spesa), each anchor found exactly once; :317–318 unchanged; lines 532–540 move to 1.2c (D4). 1.2c: :9 drops `PILLAR_C_ALL_SECTIONS`, :321 pins `<PillarCPortfolioDossier workbook={workbook} />`, and :536–547 pin the planning mount between the section-5 and section-6 frames on both the reviewer and the scoped workspace, the `"budget-scenari": Landmark` icon and one viewport case |
| `tests/pillar-c-insights.test.mjs` | edit | 1.2d | lines 50–56: no PillarCInsightsProvider, no insight-panels import; keep «Più persone trattate…» and the no-explorer rule; lib assertions unchanged |
| `tests/pillar-c-portfolio-render.test.mjs` | edit | 1.2b, 1.2c | lines 73–77: purpose navigation removed → assert sidebar labels; dossier mount regex; reset-key assertions unchanged. 1.2b: the reviewer mounts no purpose navigation, the scoped mount and the export stay until 1.2c (D5); the PVM render has no «registro AIFA», «convenzione Q» or «ledger». 1.2c: :74–76 and :83 pin `PillarPurposeNavigation` absent from the dossier module, its source and the scoped workspace, and :78 the reviewer's dossier mount without `pageScope` |
| `tests/pillar-c-attribution.test.mjs` | edit | 1.2b (mount count, D1), 1.2c; provider part batch 2 (deferred: regroup only) | lines 74–76: provider mounted once, section-3 and section-6 consumers once each, no section="attribuzione". 1.2b: :75 counts exactly one `<PillarCAttributionAnalysis pageScope />` and exactly one mount of any form; :76 unchanged. 1.2c: :75 counts exactly one `<PillarCAttributionAnalysis />` without props and adds an absence check of `pageScope` |
| `tests/pillar-c-scoped-ui.test.mjs` | edit | 1.2b, 1.2c | re-pin guard-shape regexes (124–127), option/scope pins (172, 216–218, 303–305, 330–331), count wording (286–292: reviewer no longer per-person), keyed-text and hash (416–424: new markup hash recorded with the stated reason, data hash bebe2d2b… kept); REVIEWER_ONLY leak list kept and extended with /insight-panels❘Approfondimento del workbook/. Moved to 1.2b (D1, D8): the attribution and dossier guard regexes (:123–124, the same shape with `pageScope`), the count wording (:250, :286, :289, now absence checks of per-person wording), the hash (eac1cc54… → c476b18e…, 51 → 59 cases) and `REVIEWER_ONLY` extended with three 1.2b patterns, each with a live match in the reviewer render (a tightening); the option and scope pins stay 1.2c. 1.2c: the attribution and dossier guard regexes (:129–130) follow the prop-less guards with the same shape, the no-`fetch(` and no-reviewer-constant lists (:140, :143) gain `regional-forecast-workspace.tsx` (the first also `section-frame.tsx`), and the option and scope pins (:46, :176–178, :221–224, :310–316, :455) move to `PILLAR_C_SECTIONS`, the six-section bar, the «Vai a» links, the `c_port_*` attribution scope and `PillarCScopeBar`; hash c476b18e… and data bebe2d2b… unchanged |
| `tests/pillar-c-review.test.mjs` | edit | 1.2b, 1.2c | keyed-text expression list (518–535) and the forbidden-wording file list (537–541) extended to the new components; forecast copy tests unchanged. 1.2b: the keyed-text list reads six files and drops the two entries for removed text (:520, :522); the forbidden-wording list adds scope-bar, section-frame, decision-overview, evidence-sources, review-blocks, portfolio-pvm, portfolio-dossier and attribution-analysis; :491 adds evidence-sources. 1.2c (P16): the keyed-text source list (:517) also reads `scoped-workspace.tsx`, `regional-forecast-workspace.tsx` and `section-navigation.tsx`, and the forbidden-wording list (:544) gains the two workspaces |
| `tests/pillar-c-chart-render.test.mjs` | edit | 1.3 | add SpendTimeline, RangeChart and drivers-chart render tests; waterfall/dot tests unchanged |
| `tests/helpers/pillar-c-ui-matrix.mjs` | edit | 1.2b, 1.3 | leaf list extended on the same synthetic data so the data hash stays. 1.2b: eight leaves (two frames, two scope bars, two decision overviews, two evidence-sources renders); the spend timeline (1.3), drivers and priority (batch 2) are not 1.2b components and are added with them |
| `tests/pillar-c-six-sections.test.mjs` | new | 1.2c | SSR per audience: ids/order/titles, exact empty sentences, no private data for forecast_only, no province token, no internal-code tokens in text nodes, exact-value alternative per chart, keyboard/focus, responsive class budget, copy lint. As built in 1.2c: the SSR tests of plan §4.3 over the reviewer, Azienda and Regione (three searches each, with and without the forecast) and forecast_only renders, plus the lead's pins: the exact K1 forecast_only sentence and its forbidden words, no «organizzazion» in any forecast_only render, `href="#portafogli"` with «Cambia periodo, organizzazione o canale nel dossier» on every scoped render (K3), unresolved in-page targets exactly `['piano-revisione']` on every scoped render (K4), and a count-empty scoped render whose evidence block has neither «dimessi» nor «dati sintetici» (K7) |
| `tests/shell-navigation.test.mjs` | new | 1.1 | logo-home placements, uniform pillar labels in sidebar/home/public headers/access portal, «Esci» visible, no Pillar C link in the access portal |
| `tests/pillar-c-six-sections-nav.test.mjs` | new | 1.2a, 1.2c | the six entries, the untouched old lists, pillarCSectionAtViewport over the six, the bar markup and the wiring of its handler and scroll-spy. 1.2c: re-pinned to the single list `PILLAR_C_SECTIONS` and the single export `PillarCSectionBar` (the old lists stay only as absence references), with the default render byte-equal to `available` of all six and the `available: ['budget-scenari']` render as four spans, one current link and one span, each span carrying the sr-only statement |
| `tests/pillar-c-six-sections-frames.test.mjs` | new | 1.2a, 1.2c | frame, empty state, scope line and scope bar markup with 44 px classes; no audience, loader or search-helper import. 1.2c: :51 pins the numeral span in `section-frame.tsx` and the absence of `{number}` from `review-blocks.tsx` (E7) |
| `tests/pillar-c-six-sections-overview.test.mjs` | new | 1.2a, 1.2c | decision overview markup with invented props; the regional card absent when null; no province, place or NSIS token. 1.2b re-pins :147–148: the reviewer workspace imports the overview, the scoped and regional workspaces do not yet (1.2c). 1.2c: :147–148 pin that the scoped workspace imports the overview and the regional workspace does not |
| `tests/pillar-c-six-sections-reviewer.test.mjs` | new | 1.2b, 1.2c | 16 tests on the reviewer workspace with and without a workbook (synthetic fixture, invented values only): the six frames and the blocks in each, no number badge, heading ids whatever the attribute order, old anchors, removed strings, the sticky rule, the scope-bar address (including the divergent `?c_org=AQ` link), the availability line, the attribution and dossier under `pageScope`, the unchanged scoped mounts, the regional card and the «Fonti e versione» rows, the copy rows, the `evidence-sources.tsx` source pins (`h5` criteria), keyboard, 44 px (every `<summary` with `py-3` or `min-h-11`) and motion. 1.2c: `PILLAR_C_SIX_SECTIONS` renamed (9 occurrences), :294 pins `<div id="piano-revisione">{plan}</div>` in the dossier source, and tests 10–12 pin the prop-less attribution and dossier (no `pageScope` in five files) and the scoped page's mounts in the reviewer's shape |
| `tests/fixtures/pillar-c-six-sections.mjs` | new | 1.2c | isolated fictional fixtures (invented months with null/zero/negative, invented areas, invented decision values); never real figures. As built in 1.2c: `sixSectionsReviews()` clones the scoped fixture's reviews, gives `asl-4` CO an absent, a zero and a negative month (`EDGE_UNIT`, `EDGE_MONTHS`) and re-derives that unit's baseline and bridges and the aggregate's exact four-unit sum; invented values only |
| `docs/PILLAR_C_SIX_SECTIONS_20261022.md` | new | 1.1 | non-private UI documentation: the old-output → section map, removed items, re-pin reasons, owner confirmations |
| `app/dashboard-review/pillar-c/page.tsx` | read-only | read-only | batch 1 leaves it untouched (gate order, loaders, Suspense, role=note, static sections); page-matrix hash 28295723… unchanged |
| `components/dashboard-review/pillar-c/reviewer-workspace.tsx` | read-only | read-only | dynamic boundary (UI-4) unchanged |
| `components/dashboard-review/pillar-c/audience-context.tsx` | read-only | read-only | mandatory audience context unchanged |
| `components/dashboard-review/pillar-c/evidence-workflow.tsx` | read-only | read-only | mounted whole in section 6; no edit in batch 1 |
| `components/dashboard-review/pillar-c/forecast-section.tsx` | read-only | read-only | heavily pinned; mounted unchanged |
| `components/dashboard-review/pillar-c/insight-chart.tsx` | read-only | read-only | entry-chunk dot/paired/interval primitive used by change-bridge |
| `lib/dashboard-review/pillar-c/{review.ts, audience-rules.ts, audience-view.ts, audience.ts, payload-guard.ts, scoped-loader.ts, scoped-review.ts, scoped-route.ts, scoped-storage.ts, scoped-transport.ts, scoped-units.ts, planning.ts, attribution.ts, attribution-format.ts, attribution-loader.ts, attribution-storage.ts, portfolio.ts, portfolio-insights.ts, portfolio-loader.ts, portfolio-storage.ts, portfolio-pvm.ts, change-explanation.ts, review-plan.ts, evidence-priority.ts, evidence-server.ts, workbook.ts, workbook-loader.ts, workbook-storage.ts, insights.ts, insight-charts.ts, chart-kinds.ts, reset-search.ts, reviewer-labels.ts, preview.ts, forecast-decision.ts, regional-forecast-loader.ts, review-loader.ts, review-storage.ts}` | read-only | read-only | statistical meanings, URL/packet contracts, loaders, labels: consumed as is; dead exports left after the insight-panel removal (insights.ts, insight-charts.ts) are listed for a later handoff, not pruned |
| `app/api/pillar-c/**; lib/auth/**; lib/supabase/**; proxy.ts; app/auth/** (except app/auth/layout.tsx logo); components/login-form.tsx; components/logout-button.tsx; supabase/**` | read-only | read-only | auth, security, login return destinations and migrations: Codex-owned |
| `package.json; package-lock.json` | read-only | read-only | no new dependency (recharts ^2.15, lucide-react present) |
| `tests/pillar-c-scoped-client-graph.test.mjs; tests/pillar-c-scoped-source-pins.test.mjs; tests/pillar-c-scoped-page.test.mjs; tests/pillar-c-scoped-routes.test.mjs; tests/pillar-c-audience.test.mjs; tests/pillar-c-payload-guard.test.mjs; tests/pillar-c-regional-forecast.test.mjs; tests/pillar-b-public-surface.test.mjs; tests/pillar-b-scope.test.mjs` | read-only | read-only | security-relevant pins that must keep passing unchanged. One exception, under D8 (section 5.3): `tests/pillar-c-scoped-client-graph.test.mjs` lines 14 and 135–136 are re-pointed in 1.2b (the reviewer workspace's findings are exactly `['C_ORG_LABELS']`, and the TE pairing is found in insights.ts); the entry-chunk guard and the probes are unchanged |

Batch-1 adjustments to the design notes, applied by the regroup-only decision: `portfolio-dossier.tsx` loses only its organisation and channel selects, the purpose navigation and the «#costi» link (its fetch, the slider card, the change summary and the re-exports stay as they are); `attribution-analysis.tsx` loses its three selects and reads `c_port_*` only (no split, no provider; for the reviewer through `pageScope` in 1.2b, for the scoped page in 1.2c); `review-blocks.tsx` takes the copy changes in 1.2b and the `SpendTimeline` and comparison-dot work in 1.3; `change-summary.tsx` and `review-plan.tsx` are not edited in batch 1; `tests/pillar-c-attribution.test.mjs` keeps its provider assertions for batch 2 because no provider is mounted; in 1.2b only its mount count (:75) is re-pinned for the `pageScope` mount (D1). `app/dashboard-review/pillar-c/page.tsx` stays read-only, so its metadata title is unchanged in batch 1.

## 7. Test re-pin policy

- The reviewer regression in `tests/pillar-c-scoped-ui.test.mjs` pins a sha256 over the markup of 51 synthetic cases built by `tests/helpers/pillar-c-ui-matrix.mjs`. Any markup move changes it by construction. It is re-recorded on identical synthetic data, once per commit, with the data hash unchanged (that equality proves only markup moved), and the commit message states the one reason for that commit's change (regroup only; removal only; chart markup).
- A leak check is never loosened. The `REVIEWER_ONLY` regexes, the no-fetch-in-exported-guard rule, the no-`C_ORG_LABELS`/`C_ATTR_ORGS`/`C_ORGS`-in-shared-files rule, the empty-render-without-audience rule and the province-key scan over scoped renders are kept and extended (`insight-panels`, «Approfondimento del workbook», the six section ids present for every audience). The positive control of `tests/pillar-c-scoped-client-graph.test.mjs` (which proves the detector finds reviewer vocabulary in reviewer-only files) is re-pointed to the vocabulary that remains after the preset buttons go, for example the reviewer availability line's `C_ORG_LABELS` use and the pseudonym map in `reviewer-labels.ts`; a fake pairing is never added, and the entry-chunk guard itself is untouched. Done in 1.2b (D8, section 5.3).
- Each re-pin is stated in the commit message with its file, lines (at `cb3e98e`) and reason. Pins that must change in batch 1: `pillar-c-scoped-ui` (badge and link order, select options, count wording, keyed-text list and hash); `pillar-c-section-navigation` (six ids, numerals 1–6, fallback `quadro`); `pillar-c-workbook` (the `PILLAR_C_ALL_SECTIONS` import and nav assertions only; the 14 workbook-lib assertions stay); `pillar-c-evidence-ui` (module import, mount order, queue link text and the fixed-perimeter note); `pillar-c-planning-ui` (module import, dossier/planning mount regex, nav list; the O2/UI-16 slider pins and the focus pins stay unchanged); `pillar-c-insights` (no provider, no `insight-panels` import; «Più persone trattate…» and the no-explorer rule stay); `pillar-c-portfolio-render` (module import of `PillarPurposeNavigation`, sidebar labels instead of the purpose navigation; the dossier assertions stay because the view stays whole); `pillar-c-review` (keyed-text expression list and the forbidden-wording file list extended); `pillar-c-chart-render` (additions only); `tests/helpers/pillar-c-ui-matrix.mjs` (leaf list extended on the same synthetic data).
- Pins that must keep passing unchanged: `pillar-c-scoped-client-graph` (entry-chunk guard), `pillar-c-scoped-source-pins`, `pillar-c-scoped-page` (hash unchanged because `page.tsx` is untouched), `pillar-c-scoped-routes`, `pillar-c-audience`, `pillar-c-payload-guard`, `pillar-c-regional-forecast` (checked at 1.2c), `pillar-b-public-surface`, `pillar-b-scope`, and every lib test (review, planning, attribution, portfolio, change-explanation, review-plan, evidence-server, workbook, the lib parts of insights).
- New tests: `tests/pillar-c-six-sections.test.mjs` (SSR per audience: ids and order, titles, exact empty sentences, no private data for forecast_only, no province token in scoped keys and attributes, no internal-code token in text nodes, one exact-value alternative per chart, keyboard and focus, responsive class budget, copy lint), `tests/shell-navigation.test.mjs` (logo-home placements, uniform labels in sidebar, homepage, public headers and access portal, «Esci» visible, no Pillar C link in the access portal) and `tests/fixtures/pillar-c-six-sections.mjs` (invented months with a null, a zero and a negative; invented areas; invented decision values; never real figures). No test verifies TypeScript logic by running it as JavaScript: `npx tsc --noEmit` runs against the real source.

## 8. Contract requests for Codex

Verbatim from the design. The presentation keeps the current behaviour until the contract changes; a status line follows each request.

1. review.ts C_COMPONENT_LABELS: plain-language labels for the scope bridge components («Prodotti entrati nel perimetro locale» / «usciti dal perimetro locale» → e.g. «Prodotti presenti solo nel secondo periodo» / «solo nel primo periodo»; «Identificativi non AIC o senza ATC» → «Voci senza codice AIC o senza classe ATC»). The UI keeps the current strings until the shared contract (read by the scoped bundle and the payload guard) changes.

   Status: requested; the UI keeps `C_COMPONENT_LABELS` as is.

2. Budget rows: human area labels. packet.budgets.area carries numeric codes (/^\d{2,4}$/) rendered as «Dipartimento 4000»; request an area label field (or label map) in the review packet and the scoped client packet so the comparison-dot rows and exact table can name areas. Until then the UI shows the code.

   Status: requested; the UI shows the code until a label field or map exists.

3. Scoped review packet counts: portfolio labels. packet.counts carries portfolio ids only (ONC…); the UI will reuse the dossier's portfolio labels when loaded and fall back to the id. Request labels (or a label map) in pillar-c-review-client-v1 / the reviewer packet so the «Portafoglio dello scenario» select never shows an id.

   Status: requested; batch 1 shows the id in the select, batch 2 reuses the dossier labels when a provider exists.

4. Workbook outputs admitted for reviewer display. The generic insight browser is removed in batch 1; batch 2 can build purpose-built reviewer blocks only for outputs Codex names as admitted, each with an explicit column map and tier. Candidates in priority order: O-11-02/O-11-03 (composition by ATC portfolio, section 3), O-14-03 (standardised comparison, section 3), PUB-09-v2 (published Teramo 2024 departmental budget, section 5), O-18-04 (descriptive 2026 scenarios, section 5), PC-20 / O-10-06 (priority register, section 6), O-12-04/O-12-05 (product/class drivers, section 4), O-17-01 (monthly series, section 4), PUB-04 and O-15-03 (public context, section 2). Synthetic-tier outputs (ML-1/2/3/4-SYN) are not requested.

   Status: requested; see section 3.2 for the list recorded as removed pending admission.

5. portfolio-pvm.ts: a thin accepted adapter that does not require the workbook index prop to render the PVM states (today the component imports workbook.ts types and the section JSON contract). Requested so the section-4 reading can be mounted without the workbook coupling; until then the UI passes the index through the portfolio provider unchanged.

   Status: requested; batch 1 keeps the price-quantity-mix reading inside the dossier with the workbook index passed as today.

6. planning.ts C_PLANNING_LABELS.section.dossierScope: reword the registered link text «Cambia periodo, organizzazione o canale nel dossier» to «Cambia periodo nella sezione Portafogli e attribuzione; organizzazione e canale dall’ambito della pagina» (registered copy under PC-08-A12 item 5 and the copy lint; the UI keeps the text and changes only the href in batch 1).

   Status: requested; batch 1 keeps the registered text and changes only the href to `#portafogli-attribuzione`.

   Interim from 1.2b until Codex rewords it: the registered link text «Cambia periodo, organizzazione o canale nel dossier» (`planning.ts:79`) names organisation and channel controls that the reviewer's dossier no longer has; the page scope bar sets them. The section lead at `planning.ts:59` («Parti dalla spesa osservata dell’ambito scelto nel dossier, …») has the same issue: from 1.2b the reviewer's dossier sets only the period. Codex is asked to reword the lead and `dossierScope` together, before release. `planning.ts` and `planning-workspace.tsx` are not edited in 1.2b.

7. Login return destination for the homepage «Pillar C» link: lib/supabase/proxy.ts drops the requested path on the /auth/login redirect and components/login-form.tsx pushes /dashboard-review/spend; a `next` carry through the proxy redirect, read by LoginForm via lib/auth/safe-next.ts, is needed for a signed-out visitor to land on Pillar C. Also: two safeNext implementations exist (lib/auth/safe-next.ts with the /\\ guard, and a weaker local copy in app/auth/login/page.tsx) — flagged, not touched.

   Status: requested; the homepage link is labelled «area riservata» until the carry exists. Login return destinations are untouched by batch 1.

8. Section 2 «Destinatari e utilizzo»: an accepted audience-specific aggregate packet for recipients/utilization (January points 2–4/5 protected views, later File F) with source version/hash, period basis, organisation/channel scope, denominator, disclosure disposition and receipt, as per the handoff contract. None exists; the section stays an honest empty state until delivered.

   Status: requested; section 2 stays an honest empty state until an accepted packet is delivered (batch 3).

9. Optional: readable c_comparison values (K1/K2 → e.g. anni/gen-mag) in review.ts cReviewFilters/cReviewSearch; labels are already human, so this is low priority and the UI keeps K1/K2 as URL values.

   Status: optional; the UI keeps K1/K2 as URL values.

10. Owner decisions (not Codex): (a) merge the dossier slider card «Pianificazione sotto ipotesi» into the Spazio scenari (owner decision O2/UI-16 kept it; tests pin its markup) — batch 1 keeps it intact in section 5; (b) confirm the Pillar C title «Spesa, portafogli e budget» replacing «Aree cliniche e budget»; (c) confirm that forecast_only members (every production non-reviewer today) see the six section headers with the organisation empty sentence in five of them; (d) the sidebar «Pillar A» target (/pillar-a public page vs the private «Antibiotici AWaRe» module).

   Status: owner items. (a) kept intact in batch 1; (b) superseded by this document, which keeps «Spesa, budget e aree cliniche» unless the owner chooses otherwise; (c) superseded by the adopted one-sentence variant for forecast_only, with the six-frame variant offered as an option; (d) open, not blocking.

11. Later handoff (no action now): after batch 1, insights.ts and insight-charts.ts keep exports used only by the removed browser (cInsightText, cInsightVisibleColumns, cInsightPreferredMetric, cInsightChartOptions…); cDecisionAnswer, cBudgetFilters, cBudgetSearch and the reset re-export remain in use. Pruning is proposed as a named handoff once batch 2 decides which outputs return.

   Status: later handoff, no action in batch 1.


## 9. Owner confirmations needed

1. **Page title and pillar label.** Batch 1 keeps both existing strings: the page header title «Spesa, budget e aree cliniche» (kept unless the owner chooses otherwise) and the uniform label «Pillar C · Aree cliniche e budget» in the sidebar, on the homepage and in the metadata. The owner confirms the header title and says whether the label should be aligned to it, left as it is, or both replaced by the design's alternative «Spesa, portafogli e budget». Any change is one constant per surface plus the `LABELS` of the shell test, stated in the commit.
2. **Insight-browser removal.** Commit 1.2d removes the reviewer's generic workbook browser and the per-section insight mounts (section 3.2 lists what leaves). It is its own commit, reverted alone if the owner prefers the interim option of mounting the existing panel collapsed in section 6 until batch 2.
3. **Sign-off before release.** CLAUDE.md records that prototype and UI direction changes require sign-off from the Foundation President (Guido Putignano) and, where relevant, the external reviewer. Batch 1 is a release candidate until that sign-off; nothing is pushed or deployed before it. The sign-off covers the new wording of 1.2b listed in section 5.3.

Recorded for the owner, not blocking batch 1: whether the slider card «Pianificazione sotto ipotesi» is later merged into the Spazio scenari (owner decision O2/UI-16 kept it; batch 1 keeps it intact); the sidebar «Pillar A» target (`/pillar-a` public page versus the private «Antibiotici AWaRe» module); the six-frame variant for forecast_only as an alternative to the one-sentence default; whether section 1 shows the annual forecast estimate as a link card with its band or omits the figure and keeps the exact cards in section 5 only (provisionally answered in 1.2b by following section 1: the reviewer's card ships and links to `#previsione`, R2 in section 5.3); the hard-coded figures of the homepage preview mock, flagged and untouched.
