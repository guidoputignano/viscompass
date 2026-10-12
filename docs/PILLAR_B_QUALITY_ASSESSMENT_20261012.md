# Pillar B quality assessment — live site, 12 October 2026

Two independent assessments of Pillar B on https://www.eurekene.com (deployment 09ab8b8), merged here and carried into the project register [`PENDING_UPGRADE_FIXES.md`](PENDING_UPGRADE_FIXES.md). Nothing in this document is fixed yet; the fixes are scheduled for the general review of Pillars A–C.

- **Quality of what is delivered** (Claude Code): five independent lens graders (data and method; meaning and language; visual design and data visualisation; accessibility and responsive behaviour; engineering), one synthesis, and three adversarial verifiers who re-checked every grade and every improvement against the code and the live evidence. Refuted improvements were removed (1 of 113); a grade moved by a verifier moves at most one notch.
- **Completeness against the plan** (Codex): what the pillar was meant to contain and does not yet deliver (exclusivity, the statistical analyses, the nine workbook sheets still awaiting a data contract or migration).

This repository is public: the document names components, files and rules, never release figures.

Scale: **A** excellent · **A−** minor polish · **B+/B/B−** noticeable issues · **C** range significant · **D/F** broken or misleading. Priorities: **P1** fix first · **P2** next · **P3** polish.

## Live evidence behind the grades

- **Figures.** In 8 filter states the v5 figures matched, string for string, a recomputation on the frozen release with the page's own SQL functions and modules (b48: composition, channel cells for Azienda and Region, review headlines, reconciliation summary, every dumbbell gap). That is a parity check that the deployment matches the code; the definitions themselves are checked against direct SQL by b46 and b47. In 7 states 145 of 147 older strings matched b45, whose expectations compare the page's path with direct SQL sums (headline tiles, totals, both quotas, withheld amounts, all monthly bar labels, the trend list, the empty-state hint); the 2 misses are stale expectations explained by later intentional changes. No NaN, no -0, missing never drawn as zero.
- **Access.** Anonymous requests to the private page and its RSC request answer 307 to the login page, with no figures. The full security-header set is present except an enforced CSP (report-only).
- **Speed.** Public page: prerendered, first byte 44 ms, 136 KB. Private page: the first chunk carries only the shell and a generic skeleton; the heading and everything else arrive together after about 3 s warm and about 12 s cold, in 2.2 MB of HTML with about 13,000 elements.
- **Accessibility probe.** Private page: 40 text elements below 4.5:1 in light mode and 10 in dark mode (nearly all brand teal, plus the shell's 9 px 'Revisore' badge); 113 text elements under 11 px; 35 targets under 24 px; 5 tables without captions. Public page: 3 charts without a text label (each has a table), 2 contrast failures, minimum text 12 px.
- **Layout.** No page-level horizontal scroll at 1280 or 375 px on either page. On a phone the private page's first screen is the dashboard navigation; the public page keeps three inner scroll boxes.
- **Machine translation.** Verified the same day: panel switches, filters, Azzera and copy-link survive simulated Chrome translation on the private page (d47351a).
- **Limits.** The browser pane was hidden: most screenshots of the private page failed, so its visuals were judged from the code and the measured geometry; the public page was captured at 1280 and 375 px. No live Azienda or Regione session exists. The live-evidence summary (`LIVE_EVIDENCE`), the b45 state data and every screenshot named in this document are private evidence in `outputs/pillar-b/qa-20261012/` (summary also at `outputs/pillar-b/PB_QA_20261012_LIVE_EVIDENCE.md`); they contain release figures and must never be committed to this repository.

## Overall

**Pillar B: B** (Codex's overall grade). The panel graded the two pages separately: private page **B**, public page **C+** until the composition chart is fixed (Q2), about **B+/A−** after it.

The figures hold up well. On the private page, b48 matched the live page string for string in eight filter states with zero mismatches, empty and zero states are never drawn as zero, and access is fail-closed. Presentation and accessibility hold it back. Small teal text and pressed toggles fail contrast across the whole page. Every filter change destroys the control just used, so keyboard focus is lost. Per-Azienda values are hidden from screen readers. Several labels mean different things in different places: the euro unit, the two quotas, 'perimetro', and the funnel's 'Perimetro biosimilare' stage. The page is also slow to appear: nothing readable shows for 3 s warm and about 12 s cold. The public page is fast and well documented, but its main chart, 'Composizione per territorio', is misleading. The SC segments are not drawn (0 <pattern> elements on the live page), so every bar stops short of the 100% its own note promises. That caps the public grade until the fix ships; with it fixed, the public page would be about B+/A-.

Codex's grades are higher for the delivered parts because they weigh presentation and method from a visual pass; the panel also weighs accessibility, engineering and the live DOM. The one direct conflict is the public observatory (Codex A−): its composition chart looks plausible in a screenshot, but the live page contains no `<pattern>` element, so the subcutaneous segments are not drawn and bars stop short of their stated 100% (Q2). Where the two differ, the register takes the lower grade as the baseline for the general review.

## Grades by component

| ID | Component | Panel grade | Lens grades |
| --- | --- | --- | --- |
| P1 | Private · header and context | B+ | data A-, meaning B, visual A-, a11y B+, eng N/A |
| P2 | Private · filter bar | B- | data A-, meaning B+, visual B+, a11y C+, eng B |
| P3 | Private · headline tiles | A- | data A-, meaning A-, visual A-, a11y A-, eng N/A |
| P4 | Private · trend ('La traiettoria nel tempo') | B | data A-, meaning B, visual B+, a11y B-, eng A- |
| P5 | Private · monthly profile | B+ | data A, meaning B+, visual A-, a11y B-, eng A- |
| P6 | Private · per-Azienda and channel mix | B- | data A, meaning B+, visual B+, a11y C+, eng A- |
| P7 | Private · value uptake ('In valore') | B+ | data A-, meaning B+, visual A-, a11y B, eng B+ |
| P8 | Private · review questions | B+ | data A-, meaning B+, visual A-, a11y A-, eng N/A |
| P9 | Private · perimeter reconciliation and composition | B (panel B+; verifier proposed B) | data A, meaning B, visual A-, a11y A-, eng N/A |
| P10 | Private · volume uptake ('In volume') | B- | data B, meaning B-, visual A-, a11y B+, eng A- |
| P11 | Private · concentration | B+ | data A-, meaning B, visual A-, a11y B, eng N/A |
| P12 | Private · coverage and classification | B | data B+, meaning B, visual A-, a11y B+, eng N/A |
| P13 | Private · reading guide and source | B | data B+, meaning B, visual A, a11y A-, eng N/A |
| P14 | Private · page states | B- | data A-, meaning B, visual N/A, a11y B-, eng B |
| Q1 | Public · header, selectors and tiles | B+ | data A, meaning B+, visual A-, a11y B+, eng A- |
| Q2 | Public · composition by territory | D | data D, meaning D, visual F, a11y C, eng N/A |
| Q3 | Public · three measures / three molecules | A- | data A, meaning A-, visual A-, a11y B+, eng N/A |
| Q4 | Public · deviation from Italy | B | data A, meaning B+, visual B, a11y B |
| Q5 | Public · territory ranking | B+ | data A, meaning A-, visual B+, a11y B+ |
| Q6 | Public · reading guide, source and footer | A- | data A-, meaning A-, visual A, a11y A- |
| X1 | Cross · data correctness and reconciliation | B+ | data A-, eng B+ |
| X2 | Cross · access control and privacy | B+ (panel A-; verifier proposed B, capped at one notch) | data A, eng A- |
| X3 | Cross · web security headers and CSP | B | eng B |
| X4 | Cross · performance | B- | eng B- |
| X5 | Cross · accessibility (WCAG 2.2 AA) | C+ | a11y C+, visual B+ |
| X6 | Cross · responsive and mobile | B- | a11y B-, visual B |
| X7 | Cross · robustness | B | data A-, a11y B, eng B+ |
| X8 | Cross · code quality, tests and maintainability | B | eng B |

### Codex assessment (12 October 2026)

Codex's overall verdict: **Pillar B grades B overall.** The biosimilar dashboard is substantially developed, but exclusivity and several planned analyses are not yet delivered, so the full pillar is not A-grade.

Codex checked the live public page at desktop and at a true 390 px viewport (loads, reads clearly, no horizontal overflow) and confirmed that anonymous visitors are redirected to sign-in. It could not open an authenticated session, so its private grades are provisional, based on the deployed code and checks. It reports 508 tests passing (8 skipped) and a clean build.

| Codex component | Codex grade | Panel components | What would raise it (Codex) |
| --- | --- | --- | --- |
| Public AIFA observatory | A− | Q1–Q6 | Strong presentation and honest source limits. Expand beyond three molecules and 2025 only when verified public data supports it; it currently contains no exclusivity analysis. |
| Private filters and navigation | B+ | P2, X6 | Some panels intentionally ignore a global year, channel or molecule filter. Put an unmistakable "filters applied here" scope label on every panel. |
| Spend and molecule trends | A− | P4 | Add the validated matched-product expenditure decomposition; a spending change alone does not identify price or volume drivers. |
| Monthly, Azienda and channel views | B+ | P5, P6 | Make local-year versus page-year controls clearer and retain exact-value tables alongside every chart. |
| Value uptake and regional comparison | A− (provisional) | P7 | The two denominators and pooled regional comparison are carefully distinguished. Complete real Azienda and Regione live-session checks, including narrow screens. |
| Volume uptake | B | P10 | Reconcile the eligible product/unit pairs individually and make excluded coverage prominent beside the plotted percentage. |
| Molecule concentration | B+ | P11 | Add a product-level drill-down only where the authorised product data and denominator support it. |
| Review questions and Bridge B | B+ | P8, P9 | Link each finding to a persistent review action with an assigned owner, due date and outcome; do not label an opportunity as a saving. |
| Comparability evidence/funnel | B | P12 | Add the nine named exclusion gates and their reconciled euros from workbook sheet 08; current stages do not provide that breakdown. |
| Exclusivity | C | — (not delivered) | Build an evidence-linked regulatory/exclusivity timeline. Local first biosimilar use is not a legal exclusivity date. |
| Advanced statistical analyses | C | — (not delivered) | Publish the validated, access-controlled results for expenditure drivers, heterogeneity and uncertainty before presenting statistical conclusions. |

The workbook map (`PILLAR_B_WORKBOOK_MAP_20261002.md`) classifies the 25 sheets as 10 implemented, 6 evidence/audit and 9 awaiting a data contract or migration (08, 13, 14, 15, 16, 17, 18, 20, 21). Not every audit sheet needs a chart, but the nine outstanding sheets are why Pillar B is not complete. Codex's priority order: clarify panel filter scope → complete comparability coverage → deliver validated expenditure/statistical views → build the exclusivity timeline → add action tracking → authenticated cross-role visual sign-off.

## Top priorities (panel)

- Q2: draw the SC segments of the public 'Composizione per territorio' chart. Move the hatch <defs> out of the custom <Hatches/>, which Recharts drops, and add a test that every url(#id) fill resolves and each bar reaches 100%. Open the table by default until the fix ships.
- X5/P2: add a --primary-text token (hsl 174 66% 28%) for all small teal text and a darker pressed-toggle fill (dark mode: #0b1f28 text on bg-primary). This clears the teal contrast failures on the core controls (nearly all of the measured failures).
- P2: stop losing focus on every filter change. Render the filter bar outside the randomly keyed review subtree, or restore focus by id after the remount. Announce 'Aggiornamento in corso' and its completion in one persistent live region.
- P6: make the per-Azienda bars readable to screen readers. Drop the role="img" that hides the names and amounts, add an exact-value table, and key the bar colours by year.
- P12/P10: fix two counts that disagree with their labels. Rename the funnel's 'Perimetro biosimilare' stage, which includes same-substance rows. Add a year column, or sum per year, to the excluded-groups list so its length matches the stated group count.
- P14/X4: replace the silent generic skeleton with a page-specific loading state (real h1, role="status" line), stream sections behind Suspense, and switch 'Riprova' from reset() to retry().
- P13/P7/P10: define the euro unit once ('spesa rendicontata', replacing lorda/netta/riportata) and the two quotas' names once. State the volume shares' time windows, and drop the timeline's 'Mai dispensato … autorizzato', which lacks the EU-only qualifier.
- X3: enforce a nonce-based CSP on /dashboard-review/* with a reporting endpoint. The current policy is Report-Only, allows 'unsafe-inline' scripts and reports nowhere.

## Verified by the lead before recording

- **Release figures in tracked files of this public repository: confirmed, and wider than the verifier reported.** At 09ab8b8, release euro amounts, shares, record counts and integrity totals appear in several tracked files, and at least one equals a figure the private page shows today. The earlier tracker note that they "were scrubbed" (`PILLAR_B_GUIDO_FEEDBACK_V5_20261008.md`, decisions item 8) is wrong for these files. The file list, with line counts, is kept in the private evidence repository (`outputs/pillar-b/PB_QA_20261012_PUBLIC_REPO_FIGURES.md`), so that this public document does not point to the figures.
- **Reviewer scope and membership (XC-X2.5): confirmed by code reading, not exercised live.** Details are in the private security note (`outputs/pillar-b/SECURITY_NOTES_20261012.md`).
- **Search-path hardening (XC-X2.6).** 20261009160000 is on main with no production record. 20261009170000 is committed only on the unmerged branch `security/search-path-temp-last` (d95d608, 0c62ce1) and is not applied. Both verification scripts are in the private evidence repository, with no recorded result.
- **Session cookie readable by page scripts (XC-X3.3): confirmed live**, as `@supabase/ssr` is designed; enforcing the CSP (XC-X3.1) is the compensating control.
- **Public composition chart: confirmed live.** 0 `<pattern>` elements on the page; the hatch definitions sit in a custom component inside the Recharts chart (`components/pillar-b-public.tsx:66-75`, rendered at `:256`), which Recharts drops.

## Component detail

IDs match the register (`PENDING_UPGRADE_FIXES.md`). Each improvement carries the verifier's verdict: *confirmed* (verified in the code or the evidence) or *partly* (real, but overstated or the fix needs adjusting).

### P1 · Private · header and context — B+

*Lens grades:* data A-, meaning B, visual A-, a11y B+, eng N/A

The data-source card and the national-context card are honest: they show observed months, say the spend is gross and VAT-inclusive, keep 2026 out of comparisons, and say AIFA is not like-for-like. Held back by four things. The eyebrow and nav label promise exclusivity content the page does not have. The lead names no decision question and no starting point. The document title is the same for every dashboard module. The h1 is squeezed into four lines at 1280.

- **PB-P1.1 · P2** (confirmed; data, meaning) The eyebrow and sidebar label say 'Biosimilari ed esclusività', but the private page shows no exclusivity measure. Unlike the public page, it never says that it holds none.
  - *Evidence:* components/dashboard-review/pillar-b-review.tsx:396; components/dashboard-review/nav.tsx:32. The public page disclaims it at components/pillar-b-public.tsx:206-209.
  - *Suggestion:* Drop 'ed esclusività' from the eyebrow and nav label (e.g. 'Biosimilari · spesa e adozione'), or add the public page's sentence that no exclusivity data is shown. Leave the 'Pillar B' prefix to owner decision 7.
  - *Verifier:* Verified at pillar-b-review.tsx:396 and nav.tsx:32. Worse than stated: the Limiti card (pillar-b-review.tsx:825) explains «anni senza concorrenza» as if the page showed that measure, but no such figure is rendered. It exists only in workbook-map.ts, which PB-V5-07 keeps off the page. The name 'Biosimilari ed esclusività' is also used by the home page (pinned by tests/pillar-b-public-surface.test.mjs:161) and by the public page title. Adding the public page's disclaimer and fixing the Limiti card is therefore less disruptive than renaming only the private label.
- **PB-P1.2 · P2** (confirmed; a11y) The private page has no title of its own. It inherits 'VIS Pharma Compass', the same as every dashboard module, so tabs, history and screen readers cannot tell Pillar B apart (WCAG 2.4.2). (Shared dashboard shell: also affects Pillar A routes.)
  - *Evidence:* app/layout.tsx:12. There is no metadata export under app/dashboard-review; the public page sets its own title at app/pillar-b/page.tsx:14.
  - *Suggestion:* Export a static title from app/dashboard-review/revisione-pillar-b/page.tsx, e.g. 'Pillar B · Revisione biosimilari | VIS Pharma Compass', with no figures and no Azienda names.
  - *Verifier:* app/layout.tsx:12 sets 'VIS Pharma Compass'. Neither app/dashboard-review nor revisione-pillar-b/page.tsx exports metadata. The public page sets its own at app/pillar-b/page.tsx:14.
- **PB-P1.3 · P2** (partly; meaning) The lead does not say what question the page answers or where a hospital reader should start. Its last sentence is about method ('Ogni misura conserva il proprio denominatore…').
  - *Evidence:* components/dashboard-review/pillar-b-review.tsx:400-403.
  - *Suggestion:* Replace the method sentence with 'Da dove iniziare:' and anchor links to #adozione and to the review questions. Move the denominator sentence into 'Fonte, periodo e metodo'.
  - *Verifier:* The quoted text is accurate (pillar-b-review.tsx:400-403). But the adoption card just below the tiles is already a link to #adozione (:447) and serves as the entry point. A 'Da dove iniziare' line would partly duplicate it. This is an editorial choice, not a defect.
- **PB-P1.4 · P3** (confirmed; visual) At 1280 the auto-width source card takes the full width of its one-line texts, so the 5xl h1 breaks into four short lines.
  - *Evidence:* Screenshot private-1280-crop-top-left-header-filters.jpg. The grid is md:grid-cols-[1fr_auto] at pillar-b-review.tsx:394-408.
  - *Suggestion:* Use md:grid-cols-[minmax(0,1fr)_18rem] (or max-w-xs on the card with wrapping text) so the h1 keeps two lines, as on the public page.
  - *Verifier:* The screenshot shows the h1 on four lines with the source card cut off at the crop edge. The auto column takes the max-content width of the long partialYearCopy header line (pillar-b-review.tsx:407; view-options.ts:363).
- **PB-P1.5 · P3** (partly; meaning) The national-context card is one paragraph of about 150 words. It sits between the value quotas and the review questions, interrupting the step from the measure to the action.
  - *Evidence:* pillar-b-review.tsx:353-374 (card) and :550 (placement).
  - *Suggestion:* Cut it to two sentences plus the link, and move it after the review questions or into 'Fonte, periodo e metodo'.
  - *Verifier:* The length is real (about 150+ words, :358-370). But docs/PILLAR_B_REGIONAL_COMPARATOR.md §6 and §9 fix it as 'a separate, dashed card after the value-uptake section' that 'names the source, says why it is not on the same scale, and links'. Moving it into 'Fonte, periodo e metodo' contradicts that contract. A two-sentence cut must keep the scale reasons. The suggestion mentions neither. Moving it after the review questions is compatible.
- **PB-P1.6 · P3** (confirmed; a11y) The inline link to the public AIFA page is underlined only on hover. Apart from weight, only its colour sets it apart, and that is about 1.5:1 against the surrounding muted text.
  - *Evidence:* pillar-b-review.tsx:369 (text-primary hover:underline); --primary and --muted-foreground in app/globals.css:13, :25.
  - *Suggestion:* Underline it permanently, using the public page's LINK class (components/pillar-b-public.tsx:57).
  - *Verifier:* Computed: --primary against --muted-foreground is 1.50:1, and the link is underlined only on hover (:369). The link text itself also fails AA: LIVE_EVIDENCE lists «I dati pubblici AIFA…» at 3.39–3.54:1. The public LINK class (pillar-b-public.tsx:57) uses the darker 28%-lightness teal plus a permanent underline, so it fixes both.
- **PB-P1.7 · P3, found by the verifier (low)** The eyebrow 'Pillar B / Biosimilari ed esclusività' is 12 px uppercase text in text-primary on the page background, below 4.5:1.
  - *Evidence:* pillar-b-review.tsx:396 (text-primary). LIVE_EVIDENCE lists the section eyebrow among the teal-text failures at 3.39–3.54:1. The public page's eyebrow already uses text-[hsl(174_66%_28%)] dark:text-primary (pillar-b-public.tsx:197).
  - *Suggestion:* Use the public page's darker light-mode teal on the private eyebrow (text-[hsl(174_66%_28%)] dark:text-primary). Skip this if the cross-cutting contrast item already covers it.

### P2 · Private · filter bar — B-

*Lens grades:* data A-, meaning B+, visual B+, a11y C+, eng B

The filters keep their state in the URL and are validated on the server against closed lists. The scope and record lines are precise, and the empty-selection hint is exemplary. But the bar is rendered inside the review subtree, which is re-keyed with a random UUID on every server answer. Each filter change therefore destroys the control just used, and keyboard and screen-reader focus falls to <body>. That high-severity accessibility finding caps the grade at B. Also: status messages are unreliable; clicks made during the 3–12 s navigation build on stale props; the global 'Periodo' applies to only part of the page; pressed segments fail contrast (see X5).

- **PB-P2.1 · P1** (confirmed; a11y, eng) Focus is lost after every filter change: segments, Azienda select, quick picks, Tutte, Azzera and molecule links. The keyed remount unmounts the activated control, so focus falls to <body> and any open <details> closes (WCAG 2.4.3, 3.2.2).
  - *Evidence:* app/dashboard-review/revisione-pillar-b/page.tsx:553 (filterKey includes crypto.randomUUID()) and :573 (key={filterKey}). The filter bar renders inside it at components/dashboard-review/pillar-b-review.tsx:419. Verified in code; not exercised with a screen reader.
  - *Suggestion:* Render PillarBFilterBar outside the keyed subtree, keyed only on its own filter href so its text is still replaced whole for translation. Alternatively, record a data-focus-id before navigating and refocus it on mount, falling back to #filtri (tabIndex=-1).
  - *Verifier:* The keyed remount unmounts the PillarBFilterBar instance. Grep finds no .focus(), activeElement or data-focus handling. nav.tsx has no skip link, so after focus drops to <body> the next Tab restarts at the sidebar (about 3 screens at 375). Mouse users see part of this too: the quick-pick <details> (filter-bar.tsx:226) is recreated closed, so the chips fold away after a click. The panels' useDetailsOpen state is also lost.
- **PB-P2.2 · P2** (confirmed; a11y) 'Aggiornamento in corso' is created already holding its text, inside an aria-busy region, and is destroyed by the remount. Completion, the empty hint and 'Link copiato' are never reliably announced (4.1.3).
  - *Evidence:* components/dashboard-review/pillar-b-filter-bar.tsx:148 (aria-busy), :255 (status only while pending), :256-260 (empty hint inside the keyed tree), :266-272 and :134-136 (copy label swap; the clipboard error is swallowed silently).
  - *Suggestion:* Add one persistent, visually hidden aria-live="polite" region outside the keyed subtree. Write 'Aggiornamento in corso…', then 'Vista aggiornata: {scopeLine}', the empty hint, or the copy result into it. Remove aria-busy from the container.
  - *Verifier:* Verified: the role=status span is rendered with its text only while pending (:255), inside a section with aria-busy={pending} (:148). The empty hint lives in the keyed tree (:256-260). 'Link copiato' is a label swap with no live region (:266-272), and clipboard errors are swallowed (:134-136).
- **PB-P2.3 · P2** (confirmed; eng) While a navigation is pending, every control builds its URL from the server's old filters. A second click before the answer commits therefore discards the first: CO then DD gives only DD.
  - *Evidence:* pillar-b-filter-bar.tsx:120-127 (go builds from filters) and :185 (toggleChannel(filters, c)). Controls stay enabled while pending. Navigation takes 2.5–3.8 s warm and about 12 s cold (LIVE_EVIDENCE). Found in code; not reproduced live.
  - *Suggestion:* Build hrefs from an optimistic filter state (useOptimistic or local state set in go), or disable the segments and select while pending. Wrap 'Azzera' (:274) in the same startTransition so it shows the pending status.
  - *Verifier:* go() builds from the server prop filters (:120-127), and the channel toggles use toggleChannel(filters, c) (:185). Nothing is disabled while pending, so the last replace wins. 'Azzera' calls router.replace outside startTransition (:274), so it never shows the pending status.
- **PB-P2.4 · P2** (partly; meaning) The global 'Periodo' filter does not narrow the headline tiles, the trend, the monthly calendar, the concentration panel or the funnel. Each says so only in its own lead, so a reader cannot predict what a year click changes.
  - *Evidence:* pillar-b-review.tsx:438 and :721; pillar-b-panels.tsx:263; pillar-b-monthly-bars.tsx:127; page.tsx:691.
  - *Suggestion:* Under the Periodo control, add one line naming the sections it narrows ('Vale per distribuzione, adozione, domande di revisione e volume; il confronto 2024→2025 e il calendario usano sempre tutti i mesi'), or tag each section heading 'Periodo: segue il filtro / fisso'. → PB-S1.
  - *Verifier:* The unpredictability is real, but two sections are misdescribed. The funnel and concentration panels DO follow Periodo for their default year: filters.years.includes(2025) ? 2025 : 2024 (page.tsx:223, :442, :691), so anno=2024 shows 2024 there. The concentration lead (pillar-b-review.tsx:721, 'indipendentemente dal periodo selezionato in alto') is itself wrong about this. The proposed sentence should say that concentration and the funnel default to the latest selected year.
- **PB-P2.5 · P3** (partly; data, meaning, visual, a11y) The quick picks are ranked on date-valid reference spend over 2024 and 2025 across all channels, whatever filters are set. That rule exists only in title tooltips. The six aria-pressed chips sit outside any labelled group and are 23 px tall at 11 px.
  - *Evidence:* page.tsx:422-429; pillar-b-filter-bar.tsx:227-246 (summary, title={q.hint}, px-2.5 py-0.5 text-[11px]). LIVE_EVIDENCE measured 6 aria-pressed buttons outside role=group and quick picks 23 px tall.
  - *Suggestion:* Print the rule as a visible caption ('maggiore spesa di riferimento nei mesi con biosimilare disponibile · 2024 e 2025 · tutti i canali'), wrap the chips in role="group" with an aria-label, and raise them to py-1 text-xs.
  - *Verifier:* 'Whatever filters are set' is wrong: the picks follow the Azienda selection (page.tsx:256 passes aslCode, and the hint names hintScope at :421). The rest is verified: the rule exists only in title tooltips (filter-bar.tsx:233), the chips are 23 px tall, and the six aria-pressed buttons sit outside any role=group (LIVE_EVIDENCE).
- **PB-P2.6 · P3** (confirmed; meaning) 'perimetro' carries four meanings: the viewer's scope, the biosimilar perimeter, the volume base, and a panel toggle. The filter says 'Molecola' while the picks say 'principi attivi'.
  - *Evidence:* lib/dashboard-review/pillar-b/filters.ts:146; scope.ts:209-213; pillar-b-review.tsx:638; pillar-b-panels.tsx:237.
  - *Suggestion:* Reserve 'perimetro' for the biosimilar perimeter. Use 'ambito' for scope, 'base della misura in volume' for the volume base, and 'Molecole: tutte / con biosimilare' for the toggle. Use 'molecola' throughout.
  - *Verifier:* filters.ts:146 ('intero perimetro visibile'), scope.ts:209-213 ('il perimetro autorizzato'), pillar-b-review.tsx:638 ('perimetro della misura'), panels.tsx:237 (toggle label 'Perimetro'). The filter label is 'Molecola' and the summary says 'principi attivi' (filter-bar.tsx:195, :227).
- **PB-P2.7 · P3** (confirmed; meaning, a11y) The channel buttons show only CO / DD / DPC. The full names are in title tooltips that touch and keyboard users never see.
  - *Evidence:* pillar-b-filter-bar.tsx:184-187 (title={CHANNEL_NAMES[c]}).
  - *Suggestion:* Print 'CO consumi ospedalieri · DD distribuzione diretta · DPC per conto' once under the group, or set aria-label to the full name.
  - *Verifier:* The full names exist only in title= (filter-bar.tsx:184). They are spelled out far below, in the channel-mix legend (pillar-b-adoption-visuals.tsx:558), but not where the reader first meets the abbreviations.
- **PB-P2.8 · P3** (partly; a11y, eng) The molecule combobox navigates as soon as the typed text exactly equals a substance name, so a name that is a prefix of another can trigger a navigation mid-word.
  - *Evidence:* pillar-b-filter-bar.tsx:203-209 (substances.includes(v) inside onChange). Not checked whether such prefix pairs exist.
  - *Suggestion:* Commit on a datalist pick (inputType 'insertReplacementText'), on Enter or on blur.
  - *Verifier:* The mechanism is verified: onChange navigates on an exact match at every keystroke (:203-209), and after the commit the input remounts via key={filters.substance}. Whether the perimeter list actually contains prefix pairs was not checked by the panel or by me, so the impact is unverified.
- **PB-P2.9 · P2, found by the verifier (medium)** The Azienda <select> navigates on every change. In Chrome and Edge on Windows, each arrow key on a closed select fires change, so every arrow press starts a server navigation, and the first commit then drops focus (WCAG 3.2.2).
  - *Evidence:* pillar-b-filter-bar.tsx:154-158 (onChange calls go() directly). Combined with the keyed remount at page.tsx:573. Inferred from code and platform behaviour; not exercised live.
  - *Suggestion:* Commit the Azienda choice on blur or Enter (or with an 'Applica' button). Alternatively, ignore change events that come from arrow-key navigation, and navigate only on a pointer pick or on Enter.

### P3 · Private · headline tiles — A-

*Lens grades:* data A-, meaning A-, visual A-, a11y A-, eng N/A

The tiles have a clear hierarchy. A missing year reads 'nessun record' and a zero base reads 'non calcolabile', never 0. The perimeter tile appears only when the bridge ties, and the two adoption shares appear together or not at all. Only polish remains: tiles with different period rules sit side by side, the spend term differs from the rest of the page, and the adoption card is one large link.

- **PB-P3.1 · P3** (partly; data, meaning) Tiles with different period rules sit in one row. The spend tiles always use the fixed 2024/2025 comparison, while the perimeter tile follows the year filter. Only the change tile says the year filter does not apply.
  - *Evidence:* components/dashboard-review/pillar-b-review.tsx:428-441; the change tile's detail is at :438.
  - *Suggestion:* Add 'il filtro anno non si applica' to both spend tiles, and split the change tile's four-clause detail into two sentences ('Movimento: … ' / 'Sempre 2024 contro 2025, qualunque periodo sia scelto.').
  - *Verifier:* The spend tiles carry their year in the label ('Spesa riportata · 2024/2025') and the accent highlights the selected year (:428, :432). A reader can therefore see that both years are always shown. The extra note is polish; the suggestion itself is fine.
- **PB-P3.2 · P3** (confirmed; a11y, meaning) The adoption card is a single <a> wrapping two figures and three sentences, so its accessible name is the whole card. Nothing in the row points to the review questions.
  - *Evidence:* pillar-b-review.tsx:447-460.
  - *Suggestion:* Make the card a <div> with two links: 'Formula ed esempio ↓' to #adozione, and 'Domande di revisione per molecola ↓' to an id on the review-questions Sub.
  - *Verifier:* A single <a href=#adozione> wraps the label, both figures and three sentences (:447-460). The review-questions Sub has no id to link to (:553).
- **PB-P3.3 · P3** (confirmed; data, meaning, visual) The tiles say 'Spesa riportata' where the rest of the page says 'rendicontata'. The change percentage has no '+' sign and its precision varies.
  - *Evidence:* pillar-b-review.tsx:429, :433, :441, :437; lib/dashboard-review/format.ts:26-31 (no signDisplay, maximumFractionDigits 1).
  - *Suggestion:* Use the single spend term chosen under P13. Format change percentages with a signed, fixed one-decimal formatter (signDisplay 'exceptZero'), shared with P4.
  - *Verifier:* 'Spesa riportata' at :429, :433, :441. The PB-V5-06 acceptance names «spesa rendicontata» as the term, and the rest of the page uses it. formatPercent has no signDisplay and minimumFractionDigits 0 (format.ts:26-31).

### P4 · Private · trend ('La traiettoria nel tempo') — B

*Lens grades:* data A-, meaning B, visual B+, a11y B-, eng A-

The channel slope chart suits a two-year change. Every sort and perimeter variant is shaped on the server and swapped whole, and the rate on a zero base is 'n/c'. The molecule view is weaker. The percentage sort has no minimum base, so near-zero 2024 molecules lead it (confirmed in private-800-trend-panel.jpg). The bars always show the euro change, whatever the sort order. The drill-down links sit inside role="img". The tables lack captions. Perimeter molecules appear under English names.

- **PB-P4.1 · P2** (confirmed; data, meaning) 'Ordina per variazione in percentuale' ranks by rate with no minimum 2024 base, so the top-N fills with molecules whose 2024 spend was near zero. Rates in the thousands of percent are printed with mixed precision and can be misread under translation.
  - *Evidence:* lib/dashboard-review/pillar-b/view-options.ts:163-168 (no base floor); lib/dashboard-review/format.ts:26-31; screenshot private-800-trend-panel.jpg.
  - *Suggestion:* Rank by percentage only above a stated 2024 base floor, and print the floor in the title and orderNote (pillar-b-panels.tsx:229-233, :277). Print rates above 1.000% as a multiplier ('oltre 10×').
  - *Verifier:* sortTrend ranks by |change| with no base floor (view-options.ts:163-168). The 800 screenshot shows the top rows driven by near-zero 2024 bases, printed with varying precision (no minimumFractionDigits). Molecules with no 2024 record are 'n/c' and sort last, so new entrants never appear in this view either; the title should say so too.
- **PB-P4.2 · P2 (verifier: P3)** (partly; visual) Under the percentage and 2025-spend orders the bars still encode the euro change. Their lengths jump from row to row against the ranking, and with one sign half of the zero-centred track stays empty.
  - *Evidence:* pillar-b-review-visuals.tsx:265-271 (bars = changeEur) and :273-276 (figure follows measure); screenshots private-800-trend-panel.jpg and private-1280-trend-panel-translated.jpg.
  - *Suggestion:* Draw the measure the list is sorted on: a zero-based bar for 2025 spend, and a capped diverging bar for percentages. Alternatively, show the euro bar only under 'variazione in euro'.
  - *Verifier:* The bar's meaning is disclosed twice: in the column header ('Barra: variazione € 2025 meno 2024 · zero al centro', review-visuals.tsx:255) and in the Note ('La barra è sempre la variazione in euro', panels.tsx:269). A disclosed design choice is not a defect by itself. This is P3 polish, not P2.
- **PB-P4.3 · P2** (confirmed; a11y, eng) The molecule drill-down links sit inside a container with role="img", so their link role and name are not exposed to assistive technology. The trend table below has no links.
  - *Evidence:* components/dashboard-review/pillar-b-review-visuals.tsx:258-264 (role="img" wrapping KeepLink rows).
  - *Suggestion:* Render the rows as a <ul aria-label={title}> with aria-hidden bars and text figures, or move the links into the TrendTable's first column.
  - *Verifier:* Verified: the KeepLink rows (:262-263) are children of a div with role="img" (:258). The TrendTable rows have no links (panels.tsx:344).
- **PB-P4.4 · P2** (partly; meaning) With 'molecole del perimetro biosimilare' selected, names appear as English INNs ('insulin human', 'epoetin alfa'), while the all-spend list uses Italian names. The same names feed the combobox, the review questions and the dumbbell.
  - *Evidence:* b45 state data (private, outputs/pillar-b/qa-20261012/b45_states.txt), S7 vs S1 trend keys; screenshot private-375-trend-panel-translated.jpg; page.tsx:416, :449.
  - *Suggestion:* Add an INN→DCI display map (insulina umana, epoetina alfa, enoxaparina sodica, …) applied where names are formatted. Keep the source key in the URL.
  - *Verifier:* The English INNs are real (b45 S7 trend keys; private-375-trend-panel-translated.jpg). But perimeterOnly filters the same molecule rows by exact key (view-options.ts:216-220), so these are the source's own names and appear in the all-spend list too. The default S1 top-10 in b45 already contains an English influenza-strain description. The problem is naming across the whole page, not the perimeter toggle. The display-map fix still applies.
- **PB-P4.5 · P2** (confirmed; a11y, data, visual) Neither trend table has a <caption> or header scope, and the row label is a <td>. The last column draws an unlabelled bar of |spesa 2025|, which is not the quantity the chart above shows, and a negative value is drawn as positive.
  - *Evidence:* LIVE_EVIDENCE: 2 uncaptioned tables in 'La traiettoria nel tempo'. pillar-b-panels.tsx:313-314, :317, :333-346 (&nbsp; header at :338).
  - *Suggestion:* Make the <p> the <caption>, add scope="col" and <th scope="row">, and head the bar column 'Spesa 2025 (scala relativa)' with negatives marked, or drop the bar.
  - *Verifier:* LIVE_EVIDENCE: 2 uncaptioned tables in this section. TrendTable's title is a <p> (panels.tsx:317), the row label is a <td> (:344), and the bar column is |spend2025| with a blank header (:313-314, :338). scope="col" is optional in a one-row thead, so that sub-point is minor.
- **PB-P4.6 · P3** (confirmed; meaning) A dense 'Che cosa è calcolato / disegnato' note full of symbols comes before the chart, about 13 lines at 375. Under a year filter it contradicts itself, because its scope line carries the selected year next to 'il filtro anno non si applica'.
  - *Evidence:* pillar-b-panels.tsx:259-273 and :261 (scopeLine); filters.ts:147; screenshot private-375-trend-panel-translated.jpg.
  - *Suggestion:* Put the chart first and the note under 'Come è calcolato'. State it in words, and pass the panel a scope line without the year.
  - *Verifier:* The Note precedes the chart (panels.tsx:259-273) and runs to about 16 lines in the 375 screenshot. With a year filter, scopeLine includes the year (filters.ts:147) next to 'il filtro anno non si applica' (:263).
- **PB-P4.7 · P3** (confirmed; visual, a11y) The visual language is inconsistent and small. A decrease is coral in the slope chart but orange-500 (2.80:1) in the molecule bars. Teal means both '2025' and 'increase'. The 2024 swatch does not match its dot. Headers are 10 px uppercase, and truncated linked names have no title.
  - *Evidence:* pillar-b-review-visuals.tsx:16, :201, :214-215, :253, :263, :267, :275.
  - *Suggestion:* Define --chart-up/--chart-down tokens (orange at 3:1 or more) for both charts and match the swatch to the dot. Raise headers to 11–12 px, and add title={r.label} or line-clamp-2 to the links.
  - *Verifier:* Computed against white: coral #e87955 is 2.88:1 and orange-500 is 2.80:1, so both chart colours are below 3:1 and the new down token must be darker than the slope chart's coral too. The 2024 swatch is bg-slate-500 while its dot is muted-foreground (:201 vs :215). Headers are 10 px (:253). The linked names truncate with no title (:263).
- **PB-P4.8 · P3** (confirmed; meaning) The title 'La traiettoria nel tempo' suggests a time series, but the section compares two points (2024→2025).
  - *Evidence:* pillar-b-review.tsx:492.
  - *Suggestion:* Rename it 'Spesa 2024 → 2025: dove cambia'.
  - *Verifier:* The section compares two annual points only (pillar-b-review.tsx:492-507). Low priority.
- **PB-P4.9 · P3, found by the verifier (low)** Under 'Ordina per spesa 2025', the chart prints a molecule with no 2025 record as '0 €', while the table beside it prints 'nessun record'. This breaks the page's own rule that an absent year is never a zero.
  - *Evidence:* view-options.ts:195 (primary = spend2025) and review-visuals.tsx:228 (formatEur), against panels.tsx:303 ('nessun record' when rows2025 === 0). Found in code; rarely visible, because such rows sort low.
  - *Suggestion:* In trendFigures/figureText, return a 'nessun record' figure when rows2025 === 0 under the 'spesa' order, as TREND_VALUES does.

### P5 · Private · monthly profile — B+

*Lens grades:* data A, meaning B+, visual A-, a11y B-, eng A-

Data handling is exemplary. Missing months have no bar, a zero-spend share is 'non calcolabile', and 2026 is a separate labelled view. The phone layout reflows well, and the coverage companion chart says it is not adoption. Held back by keyboard tab stops on every bar inside role="img", a second 'Periodo' toggle that behaves differently from the global one, and hard-coded year colours that disagree with the other charts and include a 2.57:1 colour for 2026.

- **PB-P5.1 · P2** (confirmed; a11y) Every month bar has tabIndex=0 inside svg role="img" and shows nothing on focus. The companion chart's disclosure opens by default, so up to about 48 silent tab stops sit before the table.
  - *Evidence:* components/dashboard-review/pillar-b-monthly-bars.tsx:80-81, :172-173 (rect tabIndex={0}) inside :68, :153 (svg role="img"); pillar-b-panels.tsx:135, :155-167.
  - *Suggestion:* Remove tabIndex from the rects and rely on the 'Valori esatti' table. If keyboard exploration is wanted, use one roving tab stop per chart with a visible value callout.
  - *Verifier:* Every rect has tabIndex={0} inside svg role="img" (:80-81, :172-173), with no focus style. The companion disclosure defaults open in the default view (useDetailsOpen(selected === 'confronto' && metric === 'spesa'), panels.tsx:135), so about 24 + 24 stops sit in the visible layout.
- **PB-P5.2 · P2** (confirmed; meaning) The panel has its own toggle labelled 'Periodo' just below the global 'Periodo', and the two act independently. The lead also says the global selector 'vale per le altre viste', which is not true for the trend, concentration or funnel.
  - *Evidence:* pillar-b-panels.tsx:143 (label="Periodo"); pillar-b-filter-bar.tsx:166; pillar-b-monthly-bars.tsx:127.
  - *Suggestion:* Rename the local toggle 'Mesi mostrati'. Write 'Il calendario mostra sempre tutti i mesi osservati; il filtro Periodo in alto non lo restringe.' → PB-S1.
  - *Verifier:* The local toggle is labelled 'Periodo' (panels.tsx:143), right under the global 'Periodo' (filter-bar.tsx:166). The lead's 'che vale per le altre viste' (monthly-bars.tsx:127) is false for the trend, and only partly true for concentration and the funnel.
- **PB-P5.3 · P3** (confirmed; visual, a11y) Year colours are hard-coded hex values that differ from the theme tokens the Azienda bars and slope chart use, and they do not adapt to dark mode. 2026 amber is 2.57:1 on the card, and 2024 and 2025 differ in luminance by only 1.30:1.
  - *Evidence:* pillar-b-monthly-bars.tsx:11 (COLORS); pillar-b-adoption-visuals.tsx:21-22; app/globals.css:47.
  - *Suggestion:* Add --chart-2024/2025/2026 tokens with light and dark values (2026 at 3:1 or more, e.g. #b45309) and use them in every chart. Hatch or outline one year in the wide chart.
  - *Verifier:* Hex values are hard-coded at :11. Computed: 2026 #d99335 is 2.57:1 on white, 2024 vs 2025 is a 1.30:1 luminance ratio, and 2024 #647c90 drops to 2.98:1 on the dark card. These differ from the slate and teal of AziendaBars (adoption-visuals.tsx:21-22) and from the slope chart's muted and primary.
- **PB-P5.4 · P3** (confirmed; visual) The spend axis tops out at the unrounded data maximum, with three ticks. At 375 the calendar labels render at about 10.3 px.
  - *Evidence:* pillar-b-monthly-bars.tsx:116-118 and :154-160; LIVE_EVIDENCE: 63 SVG text nodes under 10.5 px at 375.
  - *Suggestion:* Round the top to a nice step, as ChannelSlopeChart does (pillar-b-review-visuals.tsx:188-195), with 4–5 ticks. Narrow NARROW_W or raise the font size so labels render at 11 px or more.
  - *Verifier:* The top tick is the raw maximum, and the three ticks sit at 0/0.5/1 of the span (:116-118, :154-160). LIVE_EVIDENCE measures calendar labels at about 10.3 px at 375.
- **PB-P5.5 · P3** (partly; meaning) The counter reads 'N barre su M mesi-anno', and in 'Profilo mensile e distribuzione' the word 'distribuzione' can be confused with the DD/DPC channels.
  - *Evidence:* pillar-b-monthly-bars.tsx:143; pillar-b-review.tsx:510.
  - *Suggestion:* Write 'N mesi con dati su 24' and rename the section 'Mesi, Aziende e canali'.
  - *Verifier:* The awkward 'mesi-anno' plural is real (:143). But the suggested 'N mesi con dati su 24' hard-codes 24, which is wrong for the single-year views (12 slots) and the 2026 view (observed months only). slots = months × shown years (:124).

### P6 · Private · per-Azienda and channel mix — B-

*Lens grades:* data A, meaning B+, visual B+, a11y C+, eng A-

The channel stacks are exact: each year's bar reaches 100%, empty cells stay empty, and the Region comparator reconciles cell by cell (b47, b48). The per-Azienda chart, though, wraps its visible names, amounts and shares in role="img" with a generic label and offers no table, so screen-reader users cannot read any per-Azienda value. That high-severity finding, confirmed in code, caps the grade. Its year colours also follow position rather than year and reuse the channel hues of the stack below.

- **PB-P6.1 · P1** (confirmed; a11y) AziendaBars hides its content from assistive technology. Names, per-year amounts, totals and comparable shares sit inside role="img" with the label 'Spesa per Azienda e anno', and AziendaPanel renders no exact-value table (1.1.1, 1.3.1).
  - *Evidence:* components/dashboard-review/pillar-b-adoption-visuals.tsx:384 and :416 (role="img"); pillar-b-panels.tsx:177-204 (no table). Verified in code.
  - *Suggestion:* Remove role="img" and render one list item per Azienda, with aria-hidden bars and text values. Alternatively, add a 'Valori esatti per Azienda e anno' disclosure table like ChannelStack's (pillar-b-adoption-visuals.tsx:576-620).
  - *Verifier:* Verified: role="img" with labels 'Spesa per Azienda e anno' and 'Quota confrontabile per Azienda' / 'Record per Azienda'. AziendaPanel renders no table or list of values.
- **PB-P6.2 · P2** (confirmed; visual, a11y) Year colours are assigned by index, so a lone 2025 is drawn in slate. Slate and teal are 1.06:1 in luminance, the printed values carry no year, and the same teal and slate mean CO and DD in the channel stack directly below.
  - *Evidence:* pillar-b-adoption-visuals.tsx:369 (colors=[slate, teal]), :431 and :433 (value without year), :448 (CHANNEL_COLORS).
  - *Suggestion:* Key the bars by year with the shared --chart-2024/2025 tokens and prefix each value with '2024 ·' / '2025 ·'. Give the channels a separate, non-overlapping palette, and separate segments with a 1–2 px card-coloured gap.
  - *Verifier:* colors=[slate, teal] is indexed by position (:369, :431), so years=[2025] draws slate. Computed: slate hsl(204 15% 55%) against teal is 1.06:1. The value has no year (:433). The channel stack reuses teal and slate for CO and DD (:448).
- **PB-P6.3 · P3** (partly; meaning) The per-Azienda lead runs to about 90 words before the bars. It mixes units, layout words ('a destra'/'sotto le barre') and the English 'case-mix'. The 'record' metric is offered as a peer of spend, and its definition sits only in a tooltip.
  - *Evidence:* pillar-b-adoption-visuals.tsx:410; pillar-b-panels.tsx:185-193.
  - *Suggestion:* Keep two sentences (unit; 'descrive che cosa è stato acquistato, non quanto bene: per l'adozione selezionare l'Azienda'). Move the case-mix caveat to the reading guide, and rename the third metric 'righe di dati (controllo)' with its definition visible under the toggle.
  - *Verifier:* The length is real. But the layout words switch correctly with the container query: 'a destra' shows only at 40rem or more and 'sotto le barre' below (:410), which is the tracker's own phone fix. The record metric's definition is printed in the visible Frame lead once that metric is selected (:381), not only in a tooltip.

### P7 · Private · value uptake ('In valore') — B+

*Lens grades:* data A-, meaning B+, visual A-, a11y B, eng B+

This is the analytical core, and it is strong. The two quotas always appear together, with formulas and euros. Excluded spend is named. The dumbbell uses a ring and a dot so equal values stay visible, and b48 matched every gap label live. Held back by five things. The headline gap sentence does not use the rounding the dumbbell uses. The quotas go by several different names. Every mark is a silent tab stop. The timeline's 'Mai dispensato qui … biosimilare autorizzato' drops both the EU-only qualifier and the 'non osservato' caveat. The prose before the chart is long.

- **PB-P7.1 · P2** (confirmed; data, eng) 'Le due quote differiscono di X punti percentuali' is computed from the unrounded shares, so it can differ by 0.1 p.p. from the difference of the two printed cards. It also does not say which quota is higher.
  - *Evidence:* components/dashboard-review/pillar-b-value-uptake.tsx:176-178 and :253, against lib/dashboard-review/pillar-b/adoption.ts:99-108 (dumbbellGapPoints rounds first). Not checked against live values.
  - *Suggestion:* Factor dumbbellGapPoints into a shared helper, compute the sentence from the displayed shares, and phrase it with direction ('la quota 2 supera la quota 1 di X p.p.'). Add a test with shares that round apart.
  - *Verifier:* gap is computed from the raw shares and printed with Math.abs (value-uptake.tsx:176-178, :253). dumbbellGapPoints rounds the displayed shares first (adoption.ts:104-108), and the tracker's 'gap computed from the shares as displayed' fix covers only the dumbbell.
- **PB-P7.2 · P2** (confirmed; data, meaning) The timeline box 'Mai dispensato qui, pur avendo un biosimilare autorizzato nel periodo selezionato' and the 'mai' cells assert an absolute, and they omit that the authorisation is EU-only. PB-V5-03 requires the EU status to stay an evidence question, and the review list's own method says 'non osservato' is not 'mai acquistato'.
  - *Evidence:* pillar-b-adoption-visuals.tsx:76 and :347; pillar-b-value-uptake.tsx:135; pillar-b-panels.tsx:586, :625; against pillar-b-review.tsx:570-578 and lib/dashboard-review/pillar-b/bridge-b.ts:72-75.
  - *Suggestion:* Write 'Non osservato qui, pur avendo un biosimilare autorizzato in EU nel periodo selezionato (stato in Italia da verificare)', and use 'non osservato' in the dumbbell and the cells. Add 'mai dispensato' to the copy-scan test.
  - *Verifier:* The wording is at adoption-visuals.tsx:76 and :347, value-uptake.tsx:135, and panels.tsx:586, :625. tests/pillar-b-bridge-b.test.mjs:141 already forbids «mai dispensato» in the matching gate's meaning, and that gate is named «EU-autorizzato, non ancora osservato qui» (bridge-b.ts:72-75). Caveat on the test suggestion: a page-wide ban would also hit 'non ha mai dispensato' in REGIONAL_UPTAKE_METHOD (regional-comparator.ts:54), which tests/pillar-b-regional-comparator.test.mjs:133 pins. Scope the ban to the review and adoption components.
- **PB-P7.3 · P2** (confirmed; meaning) The two quotas and 'first use' appear under many labels: 'Quota 1 · su mesi a validità riconosciuta', 'Quota (validità)', 'Primo uso locale', 'Primo biosimilare qui', 'mesi dal primo uso qui'. The reference product is called both 'riferimento' and 'originatore'.
  - *Evidence:* pillar-b-value-uptake.tsx:212, :219, :383-385; pillar-b-adoption-visuals.tsx:152-153, :312, :326; pillar-b-review.tsx:452, :456, :567; adoption.ts:140.
  - *Suggestion:* Fix one pair and use it everywhere, table headers included, e.g. 'Quota 1 · da quando esiste un biosimilare' / 'Quota 2 · da quando il biosimilare è usato qui', plus 'Primo uso qui' and 'medicinale di riferimento'.
  - *Verifier:* Verified labels: value-uptake.tsx:212, :219, :383-385; adoption-visuals.tsx:152-153, :312, :326; pillar-b-review.tsx:567. 'originatore' appears in adoption.ts:140 beside 'riferimento' elsewhere.
- **PB-P7.4 · P2** (confirmed; a11y) Every dumbbell and timeline mark has tabIndex=0 inside svg role="img", with all molecules drawn by default. Keyboard users pass two or three silent stops per molecule before reaching the table.
  - *Evidence:* pillar-b-adoption-visuals.tsx:118-119, :179-180, :240, :299 inside role="img" at :102, :158, :221, :285; pillar-b-value-uptake.tsx:314.
  - *Suggestion:* Drop tabIndex on the marks and keep <title> for mouse users. Put the numeric table's disclosure directly after the dumbbell; it already satisfies PB-V5-02's keyboard-accessible table.
  - *Verifier:* tabIndex={0} on the marks inside role="img" (adoption-visuals.tsx:118-119, :179-180, :240, :299). All molecules are drawn (value-uptake.tsx:314, limit = dumbbell.length). The numeric table already satisfies PB-V5-02's 'table/tooltip' requirement.
- **PB-P7.5 · P3** (confirmed; data) The numeric table's 'Biosimilare' and 'Riferimento' columns and totals are quota-1 (date-valid) amounts only, but the headers read as total spend on the molecule.
  - *Evidence:* pillar-b-value-uptake.tsx:133-134, :381-382, :423-426, and the stacked list at :339-342.
  - *Suggestion:* Rename them 'Biosimilare · mesi validi' and 'Riferimento · mesi validi'.
  - *Verifier:* The 'Biosimilare' and 'Riferimento' cells and footers are dateValid amounts only (value-uptake.tsx:133-134, :381-382, :423-426, :339-342).
- **PB-P7.6 · P3** (partly; meaning) The dumbbell lead (about 110 words) repeats the drawn key. The heading 'due denominatori, mai uno solo' states a production principle rather than the reader's question.
  - *Evidence:* lib/dashboard-review/pillar-b/adoption.ts:144; pillar-b-adoption-visuals.tsx:151-156; pillar-b-review.tsx:541.
  - *Suggestion:* Cut the lead to the two PB-V5-02 points the key lacks (position = share; the line is a p.p. gap, not time). Retitle the heading 'Quanta spesa va ai biosimilari, in valore'.
  - *Verifier:* PB-V5-02 explicitly asks to explain 'their overlap'. The lead's 'quando le quote coincidono il cerchio circonda il punto' (adoption.ts:144) is not in the key (adoption-visuals.tsx:152-155), so cutting to the two named points would drop a requested item. The retitle is editorial.
- **PB-P7.7 · P3** (partly; visual, a11y) Drawing polish. Reason text could collide with the right-aligned reference amount (computed from geometry, not observed). The legend says 'Area' while the radius is not area-proportional. White strokes become halos in dark mode. 10 px labels and 0.85-opacity dots (2.88:1).
  - *Evidence:* pillar-b-adoption-visuals.tsx:169, :181-182, :261, :281, :240, :299.
  - *Suggestion:* Shorten or wrap the reasons and add a no-overlap test. Use r = 10·√(share) with a floor, or relabel 'dimensione'. Use stroke={card}, 11–12 px labels and full-opacity dots.
  - *Verifier:* The white strokes (:240, :299), the 0.85 fillOpacity (computed at about 2.88:1 on white) and the 10 px labels (:181, :291, :300) are verified. The collision between reason text and amount is only computed from geometry. The radius r = 3 + 7·√(ref/max) (:261) is square-root scaled with a floor, so the 'Area' legend is roughly correct except at small values.
- **PB-P7.8 · P3, found by the verifier (low)** The closing note explains 'Una quota pari a 0,00%', but the formatter never prints '0,00%': a zero share renders as '0%'. The same card also shows the same amounts at two precisions.
  - *Evidence:* value-uptake.tsx:454 against format.ts:26-31 (percent, maximumFractionDigits 1, no minimum). In MeasureCard the formula uses formatEurPrecise (:68) and the dl below uses formatEur (:74, :78) for the same numerator and reference.
  - *Suggestion:* Write 'Una quota pari a 0%' (or format zero shares with a fixed decimal), and use one euro precision within each MeasureCard.

### P8 · Private · review questions — B+

*Lens grades:* data A-, meaning B+, visual A-, a11y A-, eng N/A

These are the most decision-useful elements on the page. Each list is an exact partition of the bridge gates (b46) and is withheld whole when the bridge does not tie. Each states the question, the evidence, the team, the next step and 'non sono risparmi'. Held back by placement: the lists render after the entire value-uptake block and the national card, although the tracker records PB-V5-03 as 'Adozione now leads with the two review questions'. Smaller issues: a first-use clock that does not say whose first use, and residual jargon.

- **PB-P8.1 · P2 (verifier: P3)** (partly; meaning) The review questions are the third block of 'Classificazione e adozione'. They come after the whole value-uptake block (cards, worked example, an all-molecule dumbbell, the timeline, the table) and after the national card, which contradicts the tracker's PB-V5-03 record.
  - *Evidence:* components/dashboard-review/pillar-b-review.tsx:541-552 (In valore, then NationalContextCard, then Domande di revisione); docs/PILLAR_B_GUIDO_FEEDBACK_V5_20261008.md:75.
  - *Suggestion:* Render the review-questions Sub right after the two measure cards. Split PillarBValueUptake into a summary and a detail (dumbbell, timeline, table), or move the Sub above 'In valore' and link it from the headline card.
  - *Verifier:* The order is as described: the In valore Sub at pillar-b-review.tsx:541-548, then NationalContextCard at :550, then the questions at :552. Under them sit the dumbbell, the timeline and the table (pillar-b-value-uptake.tsx:314-439). The claim that this contradicts PB-V5-03 is overstated. That acceptance asks for the questions ahead of Bridge B's gates, and they are ahead (the collapsed bridge is at :586). In the commit that recorded PB-V5-03 (539afe4), the value-uptake block already came before the questions. The national card's place after the private measures is deliberate (comment at :349). Moving the questions up, right after the two measure cards, is a reasonable UX change at P3, and the tracker wording should be corrected too.
- **PB-P8.2 · P3** (confirmed; data) In a multi-Azienda view, 'Riferimento dopo il primo uso' counts from the first switch by any Azienda. The visible question and the 'Primo uso qui' column do not say so; only the collapsed method does.
  - *Evidence:* pillar-b-review.tsx:560-568; lib/dashboard-review/pillar-b/value-uptake.ts:44-48.
  - *Suggestion:* When the scope holds more than one Azienda, rename the column 'Primo uso (prima Azienda dell'ambito)' and add a short clause to the headline, keeping the method one click away (PB-V5-05).
  - *Verifier:* The `opened` clock is narrowed only by p_asl_code (20261003090000_pillar_b_scoped_views.sql:114-130). In a multi-Azienda scope, first use therefore means the earliest first use by any Azienda. The column 'Primo uso qui' and the question's 'qui' (pillar-b-review.tsx:562, :567) do not say so. The collapsed method (:568) does, and so does the quota 2 card ('l'Azienda selezionata, o la Regione', pillar-b-value-uptake.tsx:222). The suggestion is proportionate.
- **PB-P8.3 · P3** (confirmed; meaning, a11y, visual) Question 2 says 'in questo rilascio', and the share columns are bare 'Quota 1' / 'Quota 2'. The question titles are <p>, not headings. The table headers are 10 px, and the teal method summary is 11 px.
  - *Evidence:* pillar-b-review.tsx:572, :567, :577, :244, :288, :320.
  - *Suggestion:* Write 'nei dati 2024–2026 delle Aziende selezionate' ('rilascio' sits next to owner decision 7). Use the P7 quota names in the headers, render the titles as <h4>, and set text to 11–12 px.
  - *Verifier:* All verified: 'in questo rilascio' at :572; bare 'Quota 2'/'Quota 1' at :567/:577; question titles as <p> at :244 (an <h4> under the Sub's <h3> causes no heading skip); text-[10px] table headers at :288; the 11 px teal summary at :320, a pair LIVE_EVIDENCE lists among the contrast failures. The proposed '2024–2026' wording matches the 29-month window in the method (:578).
- **PB-P8.4 · P2, found by the verifier (medium)** When the bridge ties to the cent but one gate is negative because of credit notes, the notice in this component's place says that the reconciliation does not tie to the cent. That is false.
  - *Evidence:* page.tsx:665-666 shows 'non torna al centesimo' whenever bridgeOutcome !== null && !bridgeReady. bridgeReady (bridge-b.ts:181-184) is also false for a negative gate, total <= 0 or perimeter <= 0. Meanwhile the panel itself says 'La tabella resta esatta' (pillar-b-bridge-b.tsx:138-142). A negative B4 is anticipated in review-queue.ts:91-94. Not verified live; the state is reachable by construction under narrow filters.
  - *Suggestion:* Key the notice on the reason. When check.consistent && residual === 0 and a gate is negative, reuse the credit-note sentence from page.tsx:664. Keep 'non torna al centesimo' for a failed check or a non-zero residual. Same root cause as PB-P9.5 (bridgeReady treats a negative gate as a failed tie-out): fix together.

### P9 · Private · perimeter reconciliation and composition — B

*Lens grades:* data A, meaning B, visual A-, a11y A-, eng N/A

*Verifier adjustment:* panel B+, verifier B (The panel missed a visible false statement. When a gate nets negative, the reconciliation summary says 'non riconciliata', although the table ties to the cent and the panel says so. Add the confirmed vocabulary, nesting and stale-reference issues, and data A / overall B+ is too generous for this component.)

The arithmetic is exemplary. Every euro leaves through exactly one gate. The perimeter is cross-checked to the cent, and a failed check opens the panel with role="alert". The composition prints its 100% base, keeps context outside it, and b48 matched it live in eight states. The vocabulary is weak: the classes are called 'soglie' (thresholds), a cross-reference is stale, one reconciliation is nested inside another, and some terms are unexplained.

- **PB-P9.1 · P2 (verifier: P3)** (partly; meaning) The mutually exclusive spend classes are called 'soglie' throughout ('soglia per soglia', 'Spesa per soglia', 'esce da una sola soglia'). That misleads in Italian and translates as 'threshold'.
  - *Evidence:* components/dashboard-review/pillar-b-review.tsx:591, :594; pillar-b-bridge-b.tsx:124-127, :149, :155, :190, :204; lib/dashboard-review/pillar-b/review-queue.ts:87-112.
  - *Suggestion:* Use 'voce' ('Riconciliazione della spesa del perimetro, voce per voce'; 'ogni euro appartiene a una sola voce') in the panel title, chart and review-queue footnotes.
  - *Verifier:* The usage is verified at every cited line, plus the 'Soglia' column header (pillar-b-bridge-b.tsx:204). 'Uscire da una soglia' is an understandable gate metaphor in Italian, so 'misleads' is overstated. Under the Chrome translation the owner uses, though, it reads 'threshold'. P3 rather than P2. 'voce' works. The summary string is pinned by tests/pillar-b-v5.test.mjs:238, so update that test too.
- **PB-P9.2 · P3** (confirmed; meaning) Inside the collapsed reconciliation, a second collapsed 'Riconciliazione con la spesa rendicontata' is nested. A cross-reference points to a section 'Evidenza' that is now titled 'Copertura e classificazione dei dati'.
  - *Evidence:* pillar-b-review.tsx:589-605; pillar-b-bridge-b.tsx:235-278 and :275; pillar-b-review.tsx:730.
  - *Suggestion:* Remove the inner <details> and show the ledger bar and the cross-check directly. Make the reference a link to #evidenza with the visible section title.
  - *Verifier:* The outer <details> is at pillar-b-review.tsx:589 and the inner one at pillar-b-bridge-b.tsx:235. 'La composizione del perimetro per stato del prodotto è in Evidenza' (bridge-b.tsx:275) points to a section whose visible title is 'Copertura e classificazione dei dati' (id evidenza, pillar-b-review.tsx:730).
- **PB-P9.3 · P3** (confirmed; meaning) Jargon: 'Ponte non disegnato', an unexplained 'EPAR', and 'Chiave non-AIC, fuori dalla tassonomia'.
  - *Evidence:* pillar-b-bridge-b.tsx:133, :241; lib/dashboard-review/pillar-b/facets.ts:325.
  - *Suggestion:* Write 'Ripartizione non disegnata', 'scheda di autorizzazione europea (EPAR)' and 'Righe senza codice AIC (non classificabili)'.
  - *Verifier:* Verified: 'Ponte non disegnato' (bridge-b.tsx:133); 'EPAR' is never expanded (bridge-b.tsx:49, :241); and 'Chiave non-AIC, fuori dalla tassonomia' (facets.ts:325) is rendered in the composition context list (adoption-visuals.tsx:709).
- **PB-P9.4 · P3** (partly; visual, a11y) The six gate bars use six hues, including the warning amber, although every bar is labelled and the legend repeats the names. Gate names are 10 units against values at 11. The private page uses teal/coral for biosimilar and reference, the public page teal/amber. The two composition segments touch.
  - *Evidence:* pillar-b-bridge-b.tsx:32-40, :159-161, :167-169; pillar-b-adoption-visuals.tsx:640-653; components/pillar-b-public.tsx:32-39.
  - *Suggestion:* Draw the gates in one neutral hue, with teal and the originator colour only for the two gates the review questions use, and drop the duplicate legend. Set names at 12 and values at 11–12. Use the public amber for reference, with a 2 px separator between segments.
  - *Verifier:* Six hues, 10-unit names against 11-unit values, and a duplicate legend: all verified (bridge-b.tsx:32-40, :159-161, :167-169). But the gate colours also key the table swatches (:178, :214), so one neutral hue means dropping those as well. Teal/coral on the private page against teal/amber on the public page is a cross-page inconsistency of low value. The composition segments do touch (adoption-visuals.tsx:640-653). Polish, not a grade driver.
- **PB-P9.5 · P2, found by the verifier (medium)** The reconciliation summary prints 'non riconciliata in questa selezione', and the panel opens, whenever bridgeReady is false. That includes a bridge that ties to the cent but has a gate netted negative by credit notes. Inside, the same panel says the table is exact and the perimeter is verified to the cent.
  - *Evidence:* pillar-b-review.tsx:589-591 (open and summary keyed on !bridgeReady); bridge-b.ts:181-184 (publishable also requires every gate >= 0, total > 0, perimeter > 0); pillar-b-bridge-b.tsx:138-142 ('La tabella resta esatta: la somma delle soglie è il totale') and :272-273. Negative pre-switch reference is anticipated in review-queue.ts:91-94. Not verified live.
  - *Suggestion:* Use two states. 'Non riconciliata' only when check is missing or inconsistent, or the residual is non-zero. For a consistent bridge with a negative gate, show '· riconciliata; una voce negativa per rettifiche' and leave the panel closed or open with that wording. Same root cause as PB-P8.4: fix together.

### P10 · Private · volume uptake ('In volume') — B-

*Lens grades:* data B, meaning B-, visual A-, a11y B+, eng A-

The volume reading is honest. It adds quantities only within one substance, route and unit, the coverage is an exact complement, and narrowed coverage is withheld rather than mixed. But two things a reader can see do not say what is computed. The excluded-groups list repeats each group once per year with no year column, so its length disagrees with its own count (verified in code). The two volume shares use time windows different from the value quotas, and the page never says so. The copy is also technical.

- **PB-P10.1 · P1 (verifier: P2)** (confirmed; data) With both years selected (the default), 'Apri i N gruppi trattenuti e i motivi' lists each (Azienda, molecola, motivo) once per year with no year column. Readers see apparent duplicates with different record counts and euros, and the stated N (distinct groups) is smaller than the number of rows.
  - *Evidence:* app/dashboard-review/revisione-pillar-b/page.tsx:79-81 (withheld = flatMap of per-year parts) and :670 (distinctWithheldGroups); components/dashboard-review/pillar-b-review.tsx:656, :663, :695; lib/dashboard-review/pillar-b/adoption.ts:231-237 (rows are per year).
  - *Suggestion:* Carry the year on WithheldRow and add an 'Anno' column and cell. Alternatively, sum the rows per (Azienda, substance, reason) across the selected years before rendering, so the list length equals N.
  - *Verifier:* getUptake calls pillar_b_uptake_withheld once per year (rpc.ts:241-267). The SQL groups by Azienda, substance and reason for one p_year (20261001120000_pillar_b_dashboard_rpc.sql:288-338). mergeUptake concatenates the years (page.tsx:81), WithheldRow has no year (rpc.ts:82-88), N counts distinct groups (adoption.ts:244-249; page.tsx:670), and both layouts render one row per year with no year column (pillar-b-review.tsx:663, :695). P2 is more proportionate than P1, since the list is collapsed.
- **PB-P10.2 · P2** (confirmed; data, meaning) 'Quota (intero periodo)' has no validity rule, so it counts months before a biosimilar existed. 'Quota (dal primo uso)' pools Aziende from each one's own first use, while the 'Primo uso' column shows the earliest. The page states neither rule, and readers will take the two as analogues of quota 1 and quota 2.
  - *Evidence:* supabase/migrations/20261001120000_pillar_b_dashboard_rpc.sql:170-188, :228-242; adoption.ts:300-334; pillar-b-panels.tsx:532-533, :586, :600-601; pillar-b-value-uptake.tsx:282-286.
  - *Suggestion:* State both rules in the volume lead (pillar-b-review.tsx:610-615), name the shares in the P7 vocabulary or say how they differ from quota 1 and 2, and rename the column 'Primo uso (prima Azienda)' when there is more than one Azienda.
  - *Verifier:* The whole-period quantity sums every month of the year with no validity rule (SQL :264-265). The window starts at each (Azienda, substance, route)'s own first use (SQL :228-242, :276-278). volumeBreakdown pools those per-Azienda windows but shows the earliest firstKey (adoption.ts:316-323). A grep finds no copy explaining either rule (only the labels at pillar-b-panels.tsx:532-533, :574-601).
- **PB-P10.3 · P2** (confirmed; meaning) The heading, lead, stat cards and reasons use tuple notation and technical phrases: '(Azienda, principio attivo, via, unità)', 'complemento esatto a livello di record', 'strato confrontabile', 'le due letture indipendenti non concordano'. 'Trattenuta' reads as a deduction, and there is no next step.
  - *Evidence:* pillar-b-review.tsx:608, :611-614, :630-648, :184-189; pillar-b-review-visuals.tsx:107-121.
  - *Suggestion:* Retitle 'Quanta quantità va ai biosimilari (solo dove le unità sono confrontabili)'. Rewrite the reasons in plain words, use 'esclusa dalla misura', and add a 'Passo successivo' line (check the pack quantity of the listed presentations).
  - *Verifier:* Verified at pillar-b-review.tsx:608, :611-614, :632, :635, and in the reason map at :184-189. There is no next-step line anywhere in the volume Sub.
- **PB-P10.4 · P3** (partly; data, visual, a11y) A share that does not exist is drawn as an empty track that looks like 0%. The 'intero periodo' swatch (slate-500) does not match its bars (#647c90), and the withheld segment (amber-500) is under 3:1.
  - *Evidence:* pillar-b-panels.tsx:532, :548, :576, :582, :614, :620; pillar-b-review-visuals.tsx:111, :118.
  - *Suggestion:* Render no track (or a dashed track, as in AziendaBars at pillar-b-adoption-visuals.tsx:426) when the share is null, use one token for swatch and bar, and darken the withheld amber to about #c27a1a.
  - *Verifier:* In the table and list, a null share draws an empty track (Bar share ?? 0 at panels :576, :582, :614, :620), but '—' is printed right beside it, so it is unlikely to be read as 0%. The chart rows skip null bars (:550). The swatch mismatch (bg-slate-500 at :532 against #647c90 at :548) is real but slight. The amber-500 segment (review-visuals.tsx:111) probably falls under 3:1 for non-text contrast, but both values are printed. Polish.
- **PB-P10.5 · P3** (confirmed; a11y) The withheld table has no caption or header scope. The <dl> places a <p> after the <dd>, which is invalid. Chart rows wrap text in role="img", and their two bars differ only by colour.
  - *Evidence:* LIVE_EVIDENCE: 1 uncaptioned table in 'Classificazione e adozione'; pillar-b-review.tsx:628-648, :684-693; pillar-b-panels.tsx:540, :548-557.
  - *Suggestion:* Add an sr-only caption with scope attributes, move each note inside its <dd>, drop role="img" on the rows, and tag the two bars 'periodo' / 'dal primo uso'.
  - *Verifier:* The withheld table has no caption and no scope (pillar-b-review.tsx:684-693). A <p> follows the <dd> inside dl > div (:628-648), which is invalid. role="img" on the chart rows (panels :540) hides the names and figures from assistive technology. The impact is limited, because the full volume table below is visible and captioned (:593).
- **PB-P10.6 · P3, found by the verifier (low)** Four of the eight withheld reasons the SQL can return have no Italian mapping and would show in English. A null substance would print as the string 'null'.
  - *Evidence:* SQL reasons at 20261001120000_pillar_b_dashboard_rpc.sql:318-327 ('substance not named by the frozen taxonomy', 'no parsed presentation for this product', 'no comparable unit', 'route not determinable for this product') against WITHHELD_REASON_IT at pillar-b-review.tsx:184-189; String(r.active_substance) at rpc.ts:263. Whether these reasons occur on the release was not verified: the list is collapsed, and the live copy scan read visible text.
  - *Suggestion:* Add Italian strings for all eight reasons. Render a null substance as 'principio attivo non nominato'.

### P11 · Private · concentration — B+

*Lens grades:* data A-, meaning B, visual A-, a11y B, eng N/A

The denominator is the net total of the same filters. Molecules that net negative are surfaced, not clamped, and zero or single-molecule states get explanations. The curve on a disclosed log axis is a sound choice. Held back by curve points beyond the top-25 table that exist only visually, no word on why concentration matters, an audit count shown as a headline card, and 'spesa netta' against the header's 'spesa lorda'.

- **PB-P11.1 · P2 (verifier: P3)** (confirmed; a11y) The curve draws cumulative shares at ranks 50, 100, 250 and the full count, but the table holds only the first 25 rows and the aria-label gives no values. Those points exist only visually (1.1.1).
  - *Evidence:* lib/dashboard-review/pillar-b/view-options.ts:247-253; components/dashboard-review/pillar-b-review-visuals.tsx:330-353 (aria-label at :349).
  - *Suggestion:* Add the sampled points to the label, or add a short visible 'Punti della curva' list under the chart.
  - *Verifier:* Samples are taken at ranks 50, 100, 250 and the full count (view-options.ts:247-254), but the table keeps 25 rows (:253). Both aria-labels are generic (review-visuals.tsx:346, :349) and no point carries a value label. Proportionate, though P3 would also be defensible.
- **PB-P11.2 · P2** (partly; meaning) Nothing tells the reader why concentration matters or what to do with it. The third card, 'Molecole a saldo negativo', is a data-quality count shown as a peer of the concentration measure.
  - *Evidence:* pillar-b-review.tsx:720-721; pillar-b-panels.tsx:412-414.
  - *Suggestion:* Add one sentence to the lead ('Indica su quante molecole si concentra il lavoro di acquisto e di revisione: le prime cinque sono elencate sotto'), and move the negative-balance count into the ranking footnote.
  - *Verifier:* The lead (pillar-b-review.tsx:721) says what is measured but not why, and adding one sentence is reasonable. The negative-balance card (panels :414) does carry context that explains why the curve can exceed 100% (review-visuals.tsx:357), so demoting it is an editorial choice, not a defect.
- **PB-P11.3 · P3** (partly; meaning, data) The visible axis says 'logaritmico'; units switch between 'voci', 'molecole' and 'principi attivi'; the panel says 'spesa netta' where the header says 'spesa lorda'.
  - *Evidence:* pillar-b-review-visuals.tsx:317-318, :346-357; pillar-b-panels.tsx:396, :413, :417, :448.
  - *Suggestion:* Label the marked points in words, use 'molecole' with one footnote for the unresolved row, and use the single spend term from P13.
  - *Verifier:* 'asse orizzontale logaritmico' is a correct disclosure in plain Italian, and the panel's own rationale praises it, so it is not a defect. The unit words are mixed as stated (panels :413 'Voci', which is deliberate for the unresolved row; :417 'molecole'; :448 'Principio attivo'). 'spesa netta' against the header's 'Spesa lorda' is real, but the two are not contradictory in substance (gross of payback, net of in-flow credit notes). It belongs to the single spend term in P13.
- **PB-P11.4 · P3** (confirmed; visual, a11y) The y gridlines are fractions of the data maximum, so when credit notes push the curve above 100% the ticks become odd values and no line marks 100%. The ranking table has no caption, scope or bar-column header, and its toggle group's name duplicates the trend panel's.
  - *Evidence:* pillar-b-review-visuals.tsx:336, :350; pillar-b-panels.tsx:385 vs :237, :444-453, :463; LIVE_EVIDENCE: 1 uncaptioned table in 'Concentrazione'.
  - *Suggestion:* Draw gridlines at 0/25/50/75/100% plus a labelled maximum, caption the table, head the bar 'Quota cumulata', and rename the group 'Perimetro della concentrazione'.
  - *Verifier:* Gridlines are drawn at v*maxShare with maxShare = max(1, …) (review-visuals.tsx:314, :336, :350), so no line marks 100% once the curve exceeds it. The ranking table has no caption, its th cells have no scope, and the bar column's header is &nbsp; (panels :444-453). Both toggle groups are named 'Perimetro delle molecole' (panels :237, :385).

### P12 · Private · coverage and classification — B

*Lens grades:* data B+, meaning B, visual A-, a11y B+, eng N/A

The funnel counts rows, which only decrease from stage to stage, shows signed spend, makes each stage's loss explicit and says it ignores filters. But its stage 3, 'Perimetro biosimilare', includes same-substance rows (verified in the SQL), unlike every other 'perimetro biosimilare' on the page, including the composition directly below. Two counts with the same label therefore disagree. With both years selected it silently shows 2025 only.

- **PB-P12.1 · P1** (confirmed; data, meaning) Funnel stage 3, 'Perimetro biosimilare', includes 'non_biosimilar_same_substance' rows. The record line, headline tile, bridge and the adjacent composition (which lists those rows as context outside the 100%) use biosimilar plus reference only. Its note 'Lo stato irrisolto è conservato' suggests unresolved rows are included, but they are excluded.
  - *Evidence:* supabase/migrations/20261001120000_pillar_b_dashboard_rpc.sql:422-427 (not redefined in later migrations); pillar-b-adoption-visuals.tsx:636, :703-715; lib/dashboard-review/pillar-b/facets.ts:319; pillar-b-filter-bar.tsx:253.
  - *Suggestion:* Rename stage 3 'Perimetro esteso: biosimilari, riferimento e stessa sostanza', or restrict stages 3 and 4 to biosimilar plus reference so the funnel matches the bridge. Rewrite the note: 'Le righe a stato non stabilito restano fuori, non sono attribuite all'originatore'.
  - *Verifier:* Stage 3 counts biosimilar, reference_medicine and non_biosimilar_same_substance (20261001120000_pillar_b_dashboard_rpc.sql:422-427; 20261009160000 only resets search_path, at :78). It shares the label 'Perimetro biosimilare' with the record line (pillar-b-filter-bar.tsx:253), the headline tile (pillar-b-review.tsx:439) and the composition base (adoption-visuals.tsx:636), all of which use biosimilar plus reference. The reading of the note 'Lo stato irrisolto è conservato' is interpretive but ambiguous.
- **PB-P12.2 · P2 (verifier: P3)** (partly; data) With the default '2024 + 2025' the funnel shows 2025 only. The information notice appears only when an Azienda, channel or molecule filter is set, so nothing says 2024 is left out.
  - *Evidence:* app/dashboard-review/revisione-pillar-b/page.tsx:223, :691; components/dashboard-review/pillar-b-review.tsx:732-739.
  - *Suggestion:* Add 'Con entrambi gli anni selezionati l'imbuto mostra il 2025', and show the notice whenever the funnel's scope differs from the scope line. → PB-S1.
  - *Verifier:* The funnel does use 2025 when both years are selected (page.tsx:223, :691). It is not silent, though: the Sub heading reads 'L'imbuto dei record · {anno} · intero perimetro visibile' (pillar-b-review.tsx:732), and the chart lead says 'record osservati nel {anno}' (review-visuals.tsx:78). An explicit '2024 non incluso' sentence would help, at P3.
- **PB-P12.3 · P3** (confirmed; meaning) Stage 1 is labelled 'Spesa osservata' but the chart counts records. The spend each step leaves out is only in the collapsed detail.
  - *Evidence:* 20261001120000_pillar_b_dashboard_rpc.sql:412-413; pillar-b-review-visuals.tsx:76-78; pillar-b-review.tsx:741-801.
  - *Suggestion:* Rename stage 1 'Righe osservate' and print the spend share beside the record share on each bar, or in one sentence after the chart.
  - *Verifier:* The stage is named 'Spesa osservata' (SQL :412) under the title 'Quanti record restano a ogni passaggio' (review-visuals.tsx:76). Spend appears only in the collapsed detail (pillar-b-review.tsx:741-801).
- **PB-P12.4 · P3** (confirmed; a11y, visual) The funnel table has no caption or row headers, and the role="img" wrapper hides the visible counts. The 28 px bars are much heavier than the rest of the page, and the lead and footnote repeat each other.
  - *Evidence:* LIVE_EVIDENCE: 1 uncaptioned table in 'Copertura'; pillar-b-review.tsx:772-797; pillar-b-review-visuals.tsx:84, :89-90, :97.
  - *Suggestion:* Caption the table with scope attributes, render the funnel as an <ol> with aria-hidden bars, reduce the bars to h-4, and drop the duplicate footnote.
  - *Verifier:* The table has no caption, and the stage cell is a td with unscoped headers (pillar-b-review.tsx:772-797); this is the uncaptioned 'Copertura' table in LIVE_EVIDENCE. role=img wraps visible counts (review-visuals.tsx:84). h-7 bars (:89). The footnote (:97) repeats the lead (:77-79).
- **PB-P12.5 · P3, found by the verifier (low)** The SQL stage notes are rendered verbatim in the detail table, with internal phrasing and a third meaning of 'perimetro'.
  - *Evidence:* SQL :413 'Tutte le righe nel perimetro, incluse le rettifiche negative' for stage 1, which is the whole ledger, and :439 'strato confrontabile con unità comune'; rendered at pillar-b-review.tsx:764 and :793.
  - *Suggestion:* Map the stage notes to page copy in TypeScript, as WITHHELD_REASON_IT does: e.g. 'Tutte le righe registrate, resi e note di credito inclusi' and 'Righe del perimetro con una quantità in unità comune'.

### P13 · Private · reading guide and source — B

*Lens grades:* data B+, meaning B, visual A, a11y A-, eng N/A

The guide states what the page refuses to show and why: forecasts, causal effects, savings, raw rankings, quantity totals and 2026 as a year. But it defines the spend unit in a way that the page's own notices and panels appear to contradict. Readers meet 'lorda', 'netta', 'riportata' and 'rendicontata' for the same euros. The 'Uptake parziale' notice does not say it concerns the volume measure, and it misstates the year and the reasons. One entry defines a measure the page never shows.

- **PB-P13.1 · P2** (confirmed; data, meaning) 'Spesa lorda: IVA inclusa, al lordo di payback e note di credito di registro' sits beside a notice that credit notes and returns 'sono inclusi nei totali'. Other panels call the same totals 'spesa netta', and the tiles say 'riportata', so readers cannot tell what the euro figures are.
  - *Evidence:* components/dashboard-review/pillar-b-review.tsx:824, :407; lib/dashboard-review/pillar-b/review-data.ts:290-295; pillar-b-panels.tsx:396; pillar-b-review-visuals.tsx:346-357; pillar-b-review.tsx:467.
  - *Suggestion:* Define one term once, e.g. 'Spesa rendicontata: IVA inclusa; resi e note di credito registrati nel flusso inclusi con segno negativo; payback e rimborsi dei registri AIFA non sottratti'. Use it instead of 'lorda', 'netta' and 'riportata' everywhere. The price-basis wording is an open owner question in the tracker, so confirm it with the owner.
  - *Verifier:* The same euros carry four names: 'Spesa riportata' (pillar-b-review.tsx:429), 'Spesa lorda' (:407, :824), 'spesa netta' (:467; panels :396; review-visuals.tsx:346, :357) and 'spesa rendicontata' (bridge-b.tsx:113). The suggestion correctly defers the price-basis wording to the owner (tracker line 264).
- **PB-P13.2 · P2** (confirmed; data, meaning) The 'Uptake parziale' notice never says it qualifies the volume measure, so it can be read as qualifying the headline value quotas. It says 'dell'anno di riferimento' although both years are merged, and it attributes all withheld spend to an unresolved quantity basis, though several reasons apply.
  - *Evidence:* lib/dashboard-review/pillar-b/review-data.ts:272-283; page.tsx:79-99; pillar-b-review.tsx:184-189, :838.
  - *Suggestion:* Label it 'Quota in volume: copertura parziale' and write 'esclude X% della spesa della sua base, degli anni selezionati, per i motivi elencati nella sezione In volume; le due quote in valore non sono interessate'. Replacing the word 'uptake' is owner decision 7.
  - *Verifier:* review-data.ts:272-283 says 'dell'anno di riferimento', but mergeUptake sums both years (page.tsx:79-99). It attributes everything withheld to the quantity basis, though the SQL has several reasons (SQL :317-328). It also carries the English 'release'; that, and 'uptake', is owner decision 7, which the suggestion respects.
- **PB-P13.3 · P3** (confirmed; data, meaning) The guide defines «anni senza concorrenza», which the page never displays. 'Previsioni' cites 'undici orizzonti' and a 'livello costante'. The flow code DIR_OSP_TRA_003AS appears unexplained.
  - *Evidence:* pillar-b-review.tsx:818, :825, :832.
  - *Suggestion:* Replace the exclusivity entry with 'La pagina non mostra dati di esclusività o brevettuali', simplify 'Previsioni' to one plain sentence, and write 'codice dell'estrazione regionale: DIR_OSP_TRA_003AS'.
  - *Verifier:* A grep finds 'anni senza concorrenza' only in the guide (pillar-b-review.tsx:825). 'undici orizzonti' and 'livello costante' are at :818; DIR_OSP_TRA_003AS appears unexplained at :832.
- **PB-P13.4 · P3** (confirmed; a11y) 'Cambia selezione ↑' in every section header is 12 px teal, and screen readers read the arrow aloud.
  - *Evidence:* pillar-b-review.tsx:154; LIVE_EVIDENCE contrast failures.
  - *Suggestion:* Apply the X5 text token and wrap the arrow in aria-hidden="true".
  - *Verifier:* :154 is text-xs text-primary, and LIVE_EVIDENCE lists 'Cambia selezione ↑' among the teal contrast failures. Note that this is the shared Group header, not specific to the guide.

### P14 · Private · page states — B-

*Lens grades:* data A-, meaning B, visual N/A, a11y B-, eng B

The page fails closed. It shows stable PBR phase codes, never shows SQL, separates a DOM desync from a data failure with a guarded single reload, and isolates optional reads. The empty-selection hint names the nearest non-empty states. But for 3–12 s of loading (measured) the reader sees a generic skeleton with no text and nothing announced. 'Riprova' calls reset(), which does not re-fetch in Next 16.3.4. The data-failure card does not announce itself, offers no way back, and claims more than is known. Any facets error other than a missing function blanks the whole page.

- **PB-P14.1 · P1** (confirmed; a11y, meaning, eng) The loading skeleton has no text, no role="status" and no aria-busy, and its shape does not match this page. Readers see grey blocks, and screen readers hear nothing, for 3 s warm and about 12 s cold. (Shared dashboard shell: also affects Pillar A routes.)
  - *Evidence:* app/dashboard-review/loading.tsx:1-18; LIVE_EVIDENCE Performance (heading at 3.1–3.4 s; cold about 12 s) and Accessibility (no role=status).
  - *Suggestion:* Add app/dashboard-review/revisione-pillar-b/loading.tsx with the static h1 and lead, a filter-bar placeholder and a role="status" line ('Calcolo dell'analisi sui dati regionali: può richiedere fino a 15 secondi'). Use motion-safe:animate-pulse.
  - *Verifier:* app/dashboard-review/loading.tsx:1-18 has no text, no role=status and no aria-busy, and animate-pulse (:3) is not motion-safe. The route directory holds only page.tsx, so there is no route-specific loading.tsx. The timings are in LIVE_EVIDENCE.
- **PB-P14.2 · P2** (confirmed; eng) In Next 16.3.4, 'Riprova' on the data-failure card calls reset(), which re-renders without re-fetching. A server-side failure therefore repeats the same failed payload. (Shared dashboard shell: also affects Pillar A routes.)
  - *Evidence:* app/dashboard-review/error.tsx:8 and :57; node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md:121, :157, :331 (retry stable in v16.3.0); package.json next 16.3.4.
  - *Suggestion:* Accept the retry prop and call it from 'Riprova'. Keep reset only for the desync path, if at all.
  - *Verifier:* error.tsx:8 and :57 use reset. The Next 16.3.4 docs (node_modules/next/dist/docs/.../error.md, under the retry and reset props and the version history) say reset re-renders without re-fetching and recommend retry, which has been stable since 16.3.0. Scope: only errors thrown outside page.tsx's try reach this card (the scope and release reads at :128, :141, :214, and render errors). Data-phase errors render the inline EmptyState instead (:361-371), which has no retry at all.
- **PB-P14.3 · P2** (partly; a11y, data, meaning, eng) The data-failure card has no role="alert" and does not take focus, unlike the desync card. It offers no link back to the default view. Its copy ('I dati sono disponibili, ma una verifica è fallita'; 'controlla lo stato delle fonti') claims things not established for a timeout and asks a hospital user to do something they cannot. (Shared dashboard shell: also affects Pillar A routes.)
  - *Evidence:* app/dashboard-review/error.tsx:51-60 vs :25, :39-41; app/dashboard-review/revisione-pillar-b/page.tsx:368-371; components/dashboard-review/analytics-ui.tsx:220-227.
  - *Suggestion:* Reuse the desync pattern (role="alert", focus the h1), and add a 'Riprova' link to the same URL and a link to the default view. Write 'La lettura dei dati non è riuscita (PBR-…). Nessuna cifra viene mostrata. Se persiste, segnalalo al referente VIS con l'ora e il codice.'
  - *Verifier:* Verified: the generic card has no role=alert and no focus, unlike the desync card (error.tsx:53 against :39-41). The inline EmptyState (analytics-ui.tsx:220-227) has no heading, no role and no link. Its copy says 'I dati sono disponibili, ma una verifica è fallita' for any phase error, timeouts included (page.tsx:370). Overstated: 'controlla lo stato delle fonti e dei caricamenti' is shared shell copy, and the shell does offer a 'Fonti e qualità' page (nav.tsx:46).
- **PB-P14.4 · P2** (confirmed; eng) Only a missing facets function degrades gracefully. Any other facets error, such as a statement timeout under the 8 s limit, throws PBR-FACETS and replaces the whole page, although the parts that depend on facets are optional, just as the regional read is.
  - *Evidence:* page.tsx:305-306 vs :291-294; supabase/migrations/20261002160000_pillar_b_molecule_spend_single_call.sql:26 (statement_timeout).
  - *Suggestion:* Catch facets errors like the regional read: log them, push a degraded notice ('non disponibile in questo momento'), and render with facets null. The bridge already withholds itself when facets totals are null.
  - *Verifier:* Facets errors that are not a missing function throw PBR-FACETS (page.tsx:305-306), while the regional read degrades (:291-294). The bridge already withholds itself when facets totals are null (:555). The 8 s statement_timeout applies to authenticated sessions (comment in 20261002160000:26), which covers Regione and Azienda accounts.
- **PB-P14.5 · P3** (confirmed; meaning, eng) The degraded notice speaks developer language and uses stale section names ('Panorama …', 'Evidenza (perimetro)'). For an empty selection, six section shells still render under the hint.
  - *Evidence:* pillar-b-review.tsx:484; page.tsx:309, :651; LIVE_EVIDENCE ('Six section headings still render under it').
  - *Suggestion:* Write 'Alcune viste non sono disponibili in questa versione:' and use the visible section titles. For an empty selection, render only the hint, the filter bar and the source section.
  - *Verifier:* Verified: pillar-b-review.tsx:484 and the stale names at page.tsx:309 ('Panorama', 'Evidenza (perimetro)'), plus 'ponte' at :651. The impact is low, because the notice appears only on isMissingFunction, which is dormant in production. The six section shells under the empty hint are in LIVE_EVIDENCE.

### Q1 · Public · header, selectors and tiles — B+

*Lens grades:* data A, meaning B+, visual A-, a11y B+, eng A-

Fast (prerendered, TTFB 44 ms) and robust. The URL selection is validated against fixed lists, the asset is shape-checked at load, and every tile is a published cell with its 100% stated. Held back by four things. On the default Italia view, two of the four tiles show only 'riferimento' and '—'. The 'Area riservata →' link fails contrast. Selection changes are not announced. The eyebrow promises exclusivity, which the next paragraph disclaims.

- **PB-Q1.1 · P2** (partly; meaning, visual) With the default territory Italia, 'Differenza da Italia' shows 'riferimento' and 'Posizione' shows '—', so a first-time visitor's tile row carries only two figures.
  - *Evidence:* components/pillar-b-public.tsx:241-244; lib/pillar-b-public/ev-sc-view.ts:85; screenshot public-1280-01-header-selectors-kpis.jpg.
  - *Suggestion:* When Italia is selected, use the two tiles for national context from the same table, such as the range of territory shares and the number of territories above Italy, or collapse the row to two tiles.
  - *Verifier:* Verified (pillar-b-public.tsx:241-244; screenshot public-1280-01). Both tiles say honestly why, so this is a UX cost of the default, not a defect. The suggested 'number of territories above Italy' tile is a ranking statistic duplicating the ranking panel. Collapsing to two tiles, or showing the range of shares, is the safer choice.
- **PB-Q1.2 · P2** (partly; a11y, visual) The header link 'Area riservata →' and the 'COMPASS' wordmark are brand teal at 3.54:1, below AA (1.4.3).
  - *Evidence:* app/pillar-b/page.tsx:37 (text-primary); LIVE_EVIDENCE: 2 contrast fails on the public page; the darker LINK shade is already at components/pillar-b-public.tsx:57.
  - *Suggestion:* Use text-[hsl(174_66%_28%)] dark:text-primary (5.42:1), via the XC-X5.1 token. The 'COMPASS' text is a logotype, exempt from 1.4.3 (verifier).
  - *Verifier:* The 'Area riservata →' link (app/pillar-b/page.tsx:37, text-primary) is a genuine AA failure according to LIVE_EVIDENCE. The 'COMPASS' text, however, is part of the VisLogo wordmark (:33), and 1.4.3 exempts logotypes. Only the link needs the darker LINK shade that already exists (pillar-b-public.tsx:57).
- **PB-Q1.3 · P3** (confirmed; meaning) The eyebrow reads 'Pillar B · Biosimilari ed esclusività', and the hero then says the page contains no exclusivity data. 'con i due denominatori di adozione' is jargon for a public reader.
  - *Evidence:* pillar-b-public.tsx:197, :207-208, :222-223.
  - *Suggestion:* Drop 'ed esclusività' ('Pillar B' is owner decision 7) and write '…con due misure di adozione sui flussi locali'.
  - *Verifier:* The eyebrow at :197 is followed by the disclaimer at :207-208; 'con i due denominatori di adozione' is at :222-223. The same 'ed esclusività' is in the metadata title (app/pillar-b/page.tsx:14). Dropping it does not touch owner decision 7, which concerns 'Pillar B'.
- **PB-Q1.4 · P3** (confirmed; a11y, eng) Changing territory, molecule or measure updates tiles and charts with no announcement. The whole page, static text included, is one 441-line client component.
  - *Evidence:* pillar-b-public.tsx:1, :149-155, :234-245; LIVE_EVIDENCE public JS about 283 KB.
  - *Suggestion:* Add an sr-only aria-live="polite" line repeating the first two tiles after each change. Move the intro, reading guide and source panel into server components.
  - *Verifier:* The page is 'use client' (:1), and update (:149-155) changes the tiles and charts with no live region. The static intro, guide and source would render fine as server components.

### Q2 · Public · composition by territory — D

*Lens grades:* data D, meaning D, visual F, a11y C, eng N/A

The design and the table are correct, but the chart, which is the component's main and default-visible element, is misleading. The SC segments are not painted and their legend swatches are blank. The fills reference url(#pbp-hatch-…), but <Hatches/> is a custom component inside the Recharts 2.15.4 BarChart, which drops it, so 0 <pattern> elements reach the page (measured live; verified in code). Bars stop short of the 100% the note promises: Molise, 100% biosimilar, draws at about 43%. The visible lengths contradict the stated sort order, and the only correct view is a collapsed table that is a two-axis inner scroller on phones.

- **PB-Q2.1 · P1** (confirmed; data, meaning, visual, a11y) The subcutaneous segments (biosimilare · SC, originator · SC) and their legend swatches are not drawn, so every bar with an SC part misstates the composition and contradicts 'Ogni barra ripartisce il 100 %'.
  - *Evidence:* components/pillar-b-public.tsx:41-46 (url(#pbp-hatch-*) fills), :66-75 (Hatches), :256 (<Hatches /> inside <BarChart>), :252 (note); node_modules/recharts 2.15.4; LIVE_EVIDENCE '0 <pattern> elements'; screenshot public-1280-06-composition-zoom-SC-segments-missing.png.
  - *Suggestion:* Render the patterns in a zero-size <svg aria-hidden><defs>…</defs></svg> beside the ResponsiveContainer (url(#id) resolves document-wide), or inline literal <defs> as a direct child of <BarChart>. Add a render test that every url(#id) fill resolves and each row's four segments reach 100. Until it ships, open the table by default or draw SC as a solid lighter tint.
  - *Verifier:* In Recharts 2.15.4, renderByOrder renders string-typed SVG children (isSvgElement, node_modules/recharts/lib/util/ReactUtils.js:157-158) or mapped chart components. <Hatches/> is a function component, so it is dropped; LIVE_EVIDENCE measured 0 <pattern> elements. Screenshot public-1280-06 shows blank SC gaps, blank SC legend swatches, and Molise drawn shortest although it sorts first. Both proposed fixes work: url(#id) resolves document-wide, and a literal <defs> child is kept.
- **PB-Q2.2 · P2** (confirmed; visual, a11y) At 375 px the exact-value table is a nested scroller in both directions, with no focusable content inside.
  - *Evidence:* LIVE_EVIDENCE: +285 px sideways and +548 px vertical in a 382 px box; pillar-b-public.tsx:273-274 (max-h-96 overflow-auto, min-w-[36rem]).
  - *Suggestion:* Below sm, render one stacked list per territory, as the private page does, and drop the inner max-height.
  - *Verifier:* Verified: LIVE_EVIDENCE at 375 px shows the two-axis inner scroller; the box is max-h-96 overflow-auto with min-w-[36rem] (pillar-b-public.tsx:273-274). The table is collapsed by default, which limits the exposure.
- **PB-Q2.3 · P3** (partly; meaning, a11y) The note relies on colour names ('verde acqua', 'ambra') and symbols ('·', '▸'), which translate poorly and assume colour vision.
  - *Evidence:* pillar-b-public.tsx:252, :189.
  - *Suggestion:* Write 'l'Italia è indicata con un punto dopo il nome; il territorio scelto con una freccia', and let the legend and the hatching carry form and identity.
  - *Verifier:* The colour names in the note (:252) supplement a labelled legend, so colour is not the only means and 1.4.1 is not failed. '▸' and '·' are explained in the same note (:189, :252). Minor wording polish.

### Q3 · Public · three measures / three molecules — A-

*Lens grades:* data A, meaning A-, visual A-, a11y B+, eng N/A

Both charts use solid fills, so they render correctly. They are honest zero-based bars on a fixed 0–100% axis, each with a captioned two-decimal table, and the note explains why the measures diverge without inventing a cause. Polish only: Italia changes colour with its role, the territory and Italia hues have the same luminance, and the labels are small and use a different precision.

- **PB-Q3.1 · P3** (confirmed; visual, a11y) On the default view Italia is drawn in teal; once another territory is selected it switches to blue-grey. Teal (#13998f) and Italia blue (#6f8bb3) are 1.01:1 in luminance.
  - *Evidence:* components/pillar-b-public.tsx:38-40, :302-307, :327-332; screenshot public-1280-03.
  - *Suggestion:* Always draw Italia in ITALY_COLOR at a clearly different lightness (2:1 or more against teal), and hide the single-entry legend when Italia is the selection.
  - *Verifier:* Italia is drawn in TEAL as the selected territory (:302, :327), and in ITALY_COLOR otherwise (:305, :330). The relative luminance of #13998f and #6f8bb3, computed from the hex values, gives about 1.01:1, so the pair relies on hue alone.
- **PB-Q3.2 · P3** (confirmed; meaning, visual, a11y) Bar labels print one decimal at 10 px, while the tiles and tables print two. Three bars fill most of the plot width.
  - *Evidence:* pillar-b-public.tsx:192, :303, :306, :328, :331 (fontSize 10); no maxBarSize; screenshots public-1280-02/03.
  - *Suggestion:* Use two decimals at 11–12 px and set maxBarSize={48}.
  - *Verifier:* valueLabel prints pct(v, 1) (:192), the LabelList fontSize is 10 (:303, :306, :328, :331), the tables print two decimals, and no maxBarSize is set.

### Q4 · Public · deviation from Italy — B

*Lens grades:* data A, meaning B+, visual B, a11y B

The form is right: a signed percentage-point difference per cell, a neutral midline, a stated fixed scale, and a 'non si sommano, non indicano qualità o risparmio' caveat. But a ±100 p.p. scale in an 80 px track makes most bars a pixel or invisible; the whole infliximab column shows only the midline. The table also scrolls inside a fixed box, in both directions on a phone.

- **PB-Q4.1 · P2** (confirmed; visual, meaning) Each half of the 80 px track spans 100 p.p., so a 1 p.p. deviation is about 0.4 px. The bars add almost nothing to the numbers, and the default molecule's deviations are almost all near zero.
  - *Evidence:* components/pillar-b-public.tsx:114-125 (w-20, width = min(|v|,100)/2 %), :348; screenshots public-1280-03 and public-1280-04-deviation-ranking.jpg.
  - *Suggestion:* Keep one shared scale across the three molecules, but choose it from {10, 25, 50, 100} p.p. by the data, state it in the key, and widen the track to w-28. When the selected molecule's spread is small, say so in one sentence above the table.
  - *Verifier:* The track is w-20 (80 px) and width = min(|v|,100)/2 % (pillar-b-public.tsx:116-118), so 1 p.p. is about 0.4 px. In screenshots public-1280-03 and 04 the default molecule's column shows only midlines.
- **PB-Q4.2 · P2** (partly; visual, a11y) The table sits in a 34rem inner scroller. At 375 it also scrolls sideways (min-w 47rem, though the bars are hidden), and its sticky header can cover a focused button.
  - *Evidence:* LIVE_EVIDENCE: +461 px sideways and +359 px vertical in 542 px at 375; pillar-b-public.tsx:350-353.
  - *Suggestion:* Drop the max-height at lg and up so the 22 rows flow. Below sm, render a stacked list per territory (name, then three p.p. values).
  - *Verifier:* The inner scrollers are verified (:350-351; LIVE_EVIDENCE at 375 px: sideways although the bars are hidden below sm at :118). The claim that the sticky header covers a focused button was not verified.
- **PB-Q4.3 · P3** (confirmed; visual, a11y, meaning) The key explains − and + in words without swatches, the sort is shown only by a visual '↓', and a row click updates off-screen charts with no confirmation.
  - *Evidence:* pillar-b-public.tsx:345-349, :355, :359-364.
  - *Suggestion:* Add amber and teal swatches to the key, set aria-sort="descending" on the sorted <th>, and show 'Selezionato: … · grafici aggiornati ↑' after a selection.
  - *Verifier:* The key at :346-349 has no swatches. The sort is shown only by ' ↓' (:355), with no aria-sort. A row button (:359-364) updates the charts above with no confirmation.

### Q5 · Public · territory ranking — B+

*Lens grades:* data A, meaning A-, visual B+, a11y B+

Competition ranking on the published values. Ties are marked, Italia is excluded, the position is always counted from the top, and the page says what the ranking does not mean. Held back by a fixed 24rem scroll box that hides most of the 21 rows on desktop and traps scrolling on a phone.

- **PB-Q5.1 · P2** (confirmed; visual, a11y) The ranking sits in a max-h-96 scroller at every width. At 1280 only about 9 of 21 rows show without scrolling inside the box. At 375 it scrolls 519 px vertically inside a 382 px box, and it has no focusable content.
  - *Evidence:* components/pillar-b-public.tsx:380; LIVE_EVIDENCE responsive section; screenshot public-1280-04-deviation-ranking.jpg.
  - *Suggestion:* Drop the max-height and let the 21 rows flow (about 860 px), or show the top 10 with a 'Mostra tutti i 21 territori' toggle.
  - *Verifier:* max-h-96 at every width (:380). Screenshot public-1280-04 shows about 9 rows. The 375 px inner scroll is in LIVE_EVIDENCE.
- **PB-Q5.2 · P3** (partly; a11y, meaning) A tied position such as '3=' is read aloud as '3 uguale'. The note runs to about 70 words, and the public page says 'originator' where the private page says 'medicinale di riferimento'.
  - *Evidence:* pillar-b-public.tsx:374, :384, :390.
  - *Suggestion:* Add sr-only ' pari merito', split the note into 'Che cosa ordina' / 'Che cosa non dice', and define 'originator (medicinale di riferimento)' once in the reading guide.
  - *Verifier:* The '=' has no sr-only text (:390, also :243 and :378), and the note runs long (:374). But 'originator' is the AIFA source's own classification and is already defined in the reading guide (:414), so renaming or cross-defining it is optional.

### Q6 · Public · reading guide, source and footer — A-

*Lens grades:* data A-, meaning A-, visual A, a11y A-

A concise guide (the 100%, EV/SC, the three measures, what is absent) and a verifiable source block with document, edition, pages and PDF link, using the AA teal shade. Minor: one provenance date is hard-coded, the spend definition does not say the price basis is undeclared, and the PDF link opens a new tab without warning.

- **PB-Q6.1 · P3** (confirmed; data) The footer's 'elaborazione AIFA del 3 luglio 2026' is a literal, while the edition, URL and build date come from the asset. A regenerated asset would leave it stale. The date was not checked against the PDF.
  - *Evidence:* components/pillar-b-public.tsx:439 vs :424, :214; data/public-compiled/pillar-b-aifa-ev-sc-2025.json has no such field.
  - *Suggestion:* Add the processing date to scripts/build_pillar_b_public_aifa_ev_sc.py's output, render it from asset.source, and assert it in server-data.ts.
  - *Verifier:* asset.source holds publisher, title, edition, channel, period, url and unit, but no processing date. The footer at :439 is a literal, and so are 'Nove tabelle' and 'pagine stampate 2–4, 6–8 e 10–12' at :429. The date itself was not checked against the PDF.
- **PB-Q6.2 · P3** (confirmed; meaning, a11y) 'Spesa: valori di tracciabilità' does not say the source leaves the price basis undeclared, which the private national card does say. The PDF link opens a new tab silently.
  - *Evidence:* pillar-b-public.tsx:413, :425; pillar-b-review.tsx:363.
  - *Suggestion:* Write 'valori registrati nella tracciabilità; la fonte non dichiara la base di prezzo (IVA, sconti)', and add '(PDF, si apre in una nuova scheda)'.
  - *Verifier:* 'Spesa: valori di tracciabilità' is at :413. The private national card does state that the price basis is undeclared (pillar-b-review.tsx:363). The PDF link (:425) uses target=_blank with no warning.

### X1 · Cross · data correctness and reconciliation — B+

*Lens grades:* data A-, eng B+

Reconciliation is unusually strong. b48 matched the live page string for string in eight states with zero mismatches. b45 matched 145 of 147 strings, and both misses are explained. b46 and b47 tie the gates, composition and channel cells to direct SQL, with no NaN, -0 or Infinity anywhere. Held back because every oracle checks text, not drawn marks, so a public chart that misdraws its data shipped (Q2). The live pass is also a parity check run by hand outside CI.

- **XC-X1.1 · P2** (partly; data, eng) The live and unit oracles compare strings, not geometry or referenced ids, so the public chart's missing SC segments passed every check while the bars were wrong. The private SVG charts share the blind spot.
  - *Evidence:* LIVE_EVIDENCE (b45/b48 compare strings; defect found only visually, public-1280-06-…png); tests/pillar-b-public*.test.mjs have no pattern or geometry assertion.
  - *Suggestion:* Add a geometry check: for each chart, read drawn widths and positions (rect width, circle cx) and compare them, through the same scale, with the exact-value table. Assert that every url(#…) reference resolves.
  - *Verifier:* Real for the public page: tests/pillar-b-public*.test.mjs have no pattern, url(#) or geometry assertion. Overstated for the private SVGs. tests/pillar-b-narrow-g2-review-visuals-monthly-bars.test.mjs:155-179, :297-303 and :346-347 parse the rendered rects and circles: they count marks, keep them inside the viewBox, forbid zero-size bars and require no mark for a missing year. The private page also uses no url(#) fills (LIVE_EVIDENCE). The real gap is narrower: value-to-length scaling is never asserted. A unit-level geometry test of the public Recharts chart also needs a fixed-size chart, because ResponsiveContainer draws nothing without a measured size, so this check belongs in the live pass.
- **XC-X1.2 · P3** (partly; data, eng) b48 re-runs the page's own SQL functions and modules, which proves the deployment matches local code, not that the definitions are right. b45 carries 2 stale expectations, which keeps the oracle permanently amber.
  - *Evidence:* outputs/pillar-b/logs/b48_v5_live_expectations.mjs:1-5; LIVE_EVIDENCE b45 145/147.
  - *Suggestion:* Label b48 as a parity check and chain b46/b47's direct-SQL assertions into the same live run. Regenerate b45 expectations against the current commit and record that commit with the fixtures.
  - *Verifier:* Confirmed that b48 runs the page's own functions and modules (b48_v5_live_expectations.mjs:1-5, :19-25, :67-68 call pillar_b_value_uptake_scoped and pillar_b_facets). LIVE_EVIDENCE's word 'independent' is therefore wrong. Overstated otherwise: the definitions are checked against direct SQL on the same frozen release by b46 and b47, and b45 has its own direct-SQL oracle. The two b45 misses are documented intentional changes, so 'permanently amber' is a housekeeping point, not a correctness gap.

### X2 · Cross · access control and privacy — B+

*Lens grades:* data A, eng A-

*Verifier adjustment:* panel A-, verifier proposed B: it found a confidentiality defect (release figures in tracked files of this public repository, XC-X2.4) and a reviewer-scope gap (XC-X2.5; details in the private notes).

Scope is decided in one server-only module. Reads are SECURITY INVOKER under RLS with no organisation parameter, and search_path puts pg_temp last. The one SECURITY DEFINER comparator returns shares only, under a stated disclosure rule, and is production-verified. Anonymous requests get a 307 with no figures, and nothing confidential reaches an Azienda's browser. Remaining gaps are hardening, not defects: the reviewer widening rests on an email claim with no MFA, the DB proofs run outside CI, and an unvalidated parameter is echoed into the page.

- **XC-X2.1 · P2** (confirmed; eng) The reviewer's extended read does not require a second factor: the reviewer flag comes from the session's email claim alone.
  - *Evidence:* lib/auth/viewer.ts:20-42; lib/dashboard-review/pillar-b/scope.ts:146-163; no aal/mfa check in lib/ or app/ (grep).
  - *Suggestion:* Require aal2 in the shared scope rule (lib/analytics/private-scope-rules.ts, used by Pillar A and Pillar B) before the reviewer branch; otherwise fail closed to the user's own scope with the existing 'lettura estesa non disponibile' notice. See also XC-X2.5.
  - *Verifier:* lib/auth/viewer.ts and lib/auth/reviewer.ts decide the reviewer flag from the email claim alone; no aal or MFA check exists in lib, app or proxy (grep). See also XC-X2.5.
- **XC-X2.2 · P3** (confirmed; eng) 'molecola' is not validated against the substance list before it is shown in the scope line and the empty hint (React escapes it; no XSS).
  - *Evidence:* lib/dashboard-review/pillar-b/filters.ts:84, :149; page.tsx:481-482.
  - *Suggestion:* Accept molecola only if it is in substanceOptions; otherwise drop it and say 'molecola non trovata'.
  - *Verifier:* filters.ts passes the parameter through unvalidated; substanceOptions is already computed in page.tsx, so the check is cheap.
- **XC-X2.3 · P3** (confirmed; data, eng) The database access proofs (b47, b49, b50) run in the private PGlite harness outside CI. Azienda and Regione page sessions have never been checked live; no test accounts were created, because on production they would be real access grants.
  - *Evidence:* tests/pillar-b-search-path.test.mjs (text checks only); docs/PILLAR_B_GUIDO_FEEDBACK_V5_20261008.md:263-264.
  - *Suggestion:* Add a CI PGlite test with synthetic rows asserting per-role isolation and each comparator status. Without creating production access grants, run the b48/b50 comparison on a staging project or in one owner-run session.
  - *Verifier:* tests/pillar-b-search-path.test.mjs:6-14 only pins the migration text; the behaviour lives in b51, outside the repository. No PGlite test exists in tests/ (grep). The suggestion keeps the no-production-test-accounts position (tracker:263).
- **XC-X2.4 · P1, found by the verifier (high)** The public repository at the live commit still holds confidential release figures (amounts, shares and counts) in tracked files. This breaks the project rule that release and workbook figures never go into the public repository, and the tracker wrongly records them as scrubbed. Same issue for Pillar A: A-34.
  - *Evidence:* The file list, with line counts, is kept in the private evidence repository (`outputs/pillar-b/PB_QA_20261012_PUBLIC_REPO_FIGURES.md`), so that this public document does not point to the figures.
  - *Suggestion:* Replace each figure with a reference to the private evidence (e.g. the b46 log). Release-check scripts should read expected values from the private manifest rather than hold them. Correct tracker item 8. History rewriting stays the owner's decision (tracker:120); add a repo-wide guard against recurrence (XC-X8.5).
- **XC-X2.5 · P2, found by the verifier (medium)** The reviewer's extended read should require the same approved membership as every other account, as lib/auth/reviewer-list.ts documents.
  - *Evidence:* Confirmed by code reading; not exercised live. Details in the private security note (outputs/pillar-b/SECURITY_NOTES_20261012.md).
  - *Suggestion:* Enforce it in the shared scope rule (lib/analytics/private-scope-rules.ts, used by both pillars' resolvers) and add a unit case in tests/private-scope-rules.test.mjs. See also XC-X2.1, A-11 and A-38.
- **XC-X2.6 · P2, found by the verifier (medium)** Search-path hardening is not finished in production. Migration 20261009160000 (on main) has no production record. Migration 20261009170000, which also sets pg_temp last for my_objective_rank and the organisation-access functions, is committed only on the unmerged branch security/search-path-temp-last (d95d608, 0c62ce1) and is not applied.
  - *Evidence:* docs/PILLAR_B_GUIDO_FEEDBACK_V5_20261008.md:261 (b51 checks the later migration locally only); `git merge-base --is-ancestor d95d608 origin/main` fails; the verification scripts VERIFY_20261009160000_live.sql and VERIFY_20261009170000_live.sql are in the private evidence repository, with no recorded result. The exploit needs arbitrary SQL, which PostgREST clients lack.
  - *Suggestion:* Merge the branch, apply both migrations with the owner's approval through the SQL-editor procedure, run both verification scripts, and record the result in PILLAR_B_REGIONAL_COMPARATOR.md §11. A-04 reuses this fix.

### X3 · Cross · web security headers and CSP — B

*Lens grades:* eng B

The non-CSP headers are complete on both pages (HSTS for 2 years, XFO DENY, nosniff, a strict referrer policy, Permissions-Policy, COOP), and session cookies are hardened. The CSP gives no protection: it is Report-Only, allows 'unsafe-inline' scripts (new Function() runs live), and reports nowhere, so after 12 days it has collected nothing toward enforcement.

- **XC-X3.1 · P1** (confirmed; eng) The only Content-Security-Policy is Report-Only and allows 'unsafe-inline' scripts, so script injection is not blocked on a page carrying confidential release figures.
  - *Evidence:* next.config.ts:14-27, :41; LIVE_EVIDENCE ('CSP is Content-Security-Policy-Report-Only… new Function() executes').
  - *Suggestion:* Enforce a nonce-based policy on /dashboard-review/* first: those routes are already fully dynamic, so proxy.ts can issue a per-request nonce. Use hashes or 'strict-dynamic' for the prerendered public pages.
  - *Verifier:* next.config.ts:14-27 and :41 are as described. P1 is defensible because the session cookie is readable by JavaScript (XC-X3.3), so an injected script could take the session. One nuance: the policy omits 'unsafe-eval', so the live new Function() result shows only that Report-Only blocks nothing, not a weakness of the policy text.
- **XC-X3.2 · P2** (confirmed; eng) The Report-Only policy has no report-uri, report-to or Reporting-Endpoints header, so it cannot gather the violations its own comment says it is collecting.
  - *Evidence:* next.config.ts:7-11 vs :14-27; introduced in ac5fa21 (2026-09-30).
  - *Suggestion:* Add report-to with a Reporting-Endpoints header (plus report-uri) pointing at a small rate-limited route that logs violations. Review the reports for a week, then enforce.
  - *Verifier:* No report-uri, report-to or Reporting-Endpoints in next.config.ts, against the comment at :10 that the policy 'collects the violations'. Last change ac5fa21 (30 Sep, git log).
- **XC-X3.3 · P2, found by the verifier (medium)** The auth cookies are not HttpOnly, despite the code's intent. @supabase/ssr passes httpOnly:false explicitly, so the proxy's `options?.httpOnly ?? true` never takes effect, so the auth cookies are script-readable.
  - *Evidence:* lib/supabase/proxy.ts:57-63 (`httpOnly: options?.httpOnly ?? true`); node_modules/@supabase/ssr/dist/main/utils/constants.js:4-9 (DEFAULT_COOKIE_OPTIONS httpOnly: false), merged into every set at cookies.js:461-465. The browser client is used by components/login-form.tsx and logout-button.tsx, so this is by library design. The panel's 'session cookies are hardened' is overstated.
  - *Suggestion:* Either move sign-in and sign-out to server actions and force httpOnly: true in proxy.ts and lib/supabase/server.ts, or document the exposure next to the CSP and treat enforcement as the compensating control. In both cases, correct the comment at lib/supabase/proxy.ts:51-56.

### X4 · Cross · performance — B-

*Lens grades:* eng B-

The public page is excellent (prerendered, TTFB 44 ms, 136 KB). The private page's reads are well engineered: two waves, a release-keyed cache, single-call aggregates. But it streams nothing inside the page. The h1 arrives at 3.1–3.4 s warm and about 12 s cold, together with everything else, in 2.2 MB of HTML with about 13,260 elements. Most of that is collapsed content and alternate layouts nobody has opened, and the whole tree is remounted on every navigation.

- **XC-X4.1 · P2** (partly; eng) Every read is awaited before any markup returns, so the header and filter bar arrive with the slowest section, after a silent gap of about 2.5 s warm and about 12 s cold.
  - *Evidence:* app/dashboard-review/revisione-pillar-b/page.tsx:222-351 (no Suspense boundary); LIVE_EVIDENCE Performance.
  - *Suggestion:* Return the header and filter bar immediately and wrap each Group in its own Suspense boundary, fed by the promises already started. Add a Server-Timing header to split DB time from render time.
  - *Verifier:* The issue is real. But the filter bar cannot be returned 'immediately': its molecule list, quick picks, record count and empty hint come from the value-uptake reads (page.tsx:416-429, :571-584), and the period labels need the calendar facets (:390-405). Only the h1 and lead are read-independent. The bar needs its own small boundary fed by the cached substances call. Splitting would also have to keep the translation-safe keyed replacement (page.tsx:543-555).
- **XC-X4.2 · P2** (partly; eng) Everything a reader might open is shipped up front: the contents of 17 collapsed <details>, narrow and wide copies of about 22 charts and tables, 6 trend variants of up to 50 rows, and 4 concentration variants. The RSC payload then serialises it again.
  - *Evidence:* LIVE_EVIDENCE: 2,204 KB decoded, about 13,260 elements, 17 collapsed details; page.tsx:452-472; pillar-b-panels.tsx:321-351, :564-631; pillar-b-monthly-bars.tsx:148-207.
  - *Suggestion:* Mount collapsed content on first open (useDetailsOpen already tracks it). Generate narrow and wide tables from one column definition. Send trend rows once, with ordered key lists for each variant.
  - *Verifier:* The sizes are confirmed, but the mechanism is misdescribed. useDetailsOpen exists only in the client panels (pillar-b-panels.tsx:55, 4 details). Most of the 17 details are in server components (pillar-b-review.tsx 6, value-uptake 2, bridge-b 1, adoption-visuals 2), where mount-on-open needs a client wrapper and the data still travels in the RSC props. Lazy mounting also removes collapsed tables from find-in-page and from the DOM-string oracle b48 relies on. Single-column-definition tables and sending trend rows once are the sound parts.
- **XC-X4.3 · P2** (partly; eng) The cache that makes warm renders fast is per server instance (10-minute TTL, 64 entries), so any idle period, new instance or deploy pays the measured ~12 s cold path.
  - *Evidence:* lib/dashboard-review/pillar-b/server-cache.ts:3-8, :102-103; LIVE_EVIDENCE cold timing.
  - *Suggestion:* Materialise the filter-independent aggregates into release-keyed tables under the same RLS when a release is activated. As an interim step, raise the TTL: the key already carries the release stamp.
  - *Verifier:* Materialising the release-keyed aggregates is sound. The interim 'raise the TTL' conflicts with the bound documented at server-cache.ts:33-37: in-place corrections, RLS-policy changes and directory edits are stale for at most ten minutes because of that TTL. A longer TTL also does nothing for a new instance or a deploy, which is where the measured cold path comes from.
- **XC-X4.4 · P3** (confirmed; eng) In the default view, the scoped value-uptake call has the same arguments as the cached 'substances' call, yet it always hits the database.
  - *Evidence:* page.tsx:254 vs :256; filters.ts:173-180.
  - *Suggestion:* When both years, all channels and no substance are selected, reuse the substances result for rows.
  - *Verifier:* In the default view, yearsArg is [2024, 2025] (filters.ts:26, :173), channels are null and the substance and aslCode are null. page.tsx:254 and :256 therefore issue identical getValueUptakeScoped calls, and only the second is cached.
- **XC-X4.5 · P3, found by the verifier (low)** In every empty selection, the explanatory hint adds a third serial database round trip after both waves have finished.
  - *Evidence:* page.tsx:478-486 awaits getFacets after the try block, when perimeterRows is 0 and a filter is set; the b45 empty state exercises it.
  - *Suggestion:* Start the 'wider' facets read inside the second wave whenever a channel, molecule or Azienda filter is set, and use it only if the selection turns out empty.

### X5 · Cross · accessibility (WCAG 2.2 AA) — C+

*Lens grades:* a11y C+, visual B+

The foundations are strong: lang="it", landmarks, no heading skips, every control and group named, a text alternative or table for nearly every chart, and container-query reflow. But AA failures recur. Small teal text and every pressed toggle fail contrast (40 failures in light mode, 10 in dark, measured). role="img" wraps text, links and tab stops. Focus is lost on every global filter change and status changes are not announced (P2, P14). Five tables lack captions. 113 text elements are under 11 px.

- **XC-X5.1 · P1** (confirmed; a11y, visual) Brand teal fails 1.4.3. As small text it measures 3.39–3.54:1. Pressed toggles and the active nav item, white on teal, measure 3.54:1 in light mode and 2.57:1 in dark. Affected: eyebrow, links, every teal <summary>, 'Cambia selezione', 'Azzera', and every Segment and LocalToggle.
  - *Evidence:* LIVE_EVIDENCE contrast (40 of 3,130 fail light; 10 dark); pillar-b-filter-bar.tsx:96; pillar-b-local-toggle.tsx:62-63; pillar-b-review.tsx:154, :320, :396; nav.tsx:133; components/pillar-b-public.tsx:57 (the passing shade already exists).
  - *Suggestion:* Add a --primary-text token (174 66% 28%, 5.42:1) for all small teal text. For pressed and active states, use white on hsl(174 66% 28%) in light mode and keep bg-primary with #0b1f28 text in dark mode (6.59:1). Depends on the brand-colour decision recorded in d0f6ba0 (see A-23).
  - *Verifier:* Lines verified: filter-bar:96, local-toggle:62-63, review:154, :320, :396, nav:133. Recomputed: hsl(174 66% 28%) on white is 5.39:1 (5.42 claimed; it passes), and dark bg-primary with #0b1f28 text is 6.59:1. The new text token needs a dark-mode value too, since 174 66% 28% is 2.42:1 on the dark card; components/pillar-b-public.tsx:57 already pairs it with dark:text-primary.
- **XC-X5.2 · P2** (confirmed; a11y, eng) role="img" is used on containers holding text, links or tab stops. The results: values hidden with no alternative (P6), unreachable links (P4), dozens of unexposed tab stops (P5, P7), and hidden text (P10, P12).
  - *Evidence:* pillar-b-adoption-visuals.tsx:102, :158, :221, :285, :384, :416; pillar-b-review-visuals.tsx:84, :258; pillar-b-monthly-bars.tsx:68, :153; pillar-b-panels.tsx:540.
  - *Suggestion:* Use role="img" only on purely graphical SVGs whose label carries the content or points to a table. Add a unit test that fails on [role=img] with an <a> or tabIndex descendant. Instances: PB-P4.3, PB-P5.1, PB-P6.1, PB-P7.4.
  - *Verifier:* tabIndex circles and rects sit inside role=img SVGs (adoption-visuals:118-119, :179-180, :240, :299; monthly-bars:81, :173), and the molecule links (KeepLink) sit inside role=img at review-visuals:258/263. Children of role=img are presentational, so these tab stops and links have no exposed name.
- **XC-X5.3 · P3** (partly; a11y, visual) Small text is widespread: 10 px uppercase table headers, legends and notes at 10–11 px, and five tables with no caption or header scope.
  - *Evidence:* LIVE_EVIDENCE: 113 HTML elements under 11 px at 1280, 63 SVG nodes under 10.5 px at 375; 5 uncaptioned tables (pillar-b-panels.tsx:333, :444; pillar-b-review.tsx:684, :772).
  - *Suggestion:* Set an 11 px floor (12 px preferred) for headers, legends and notes, drop the letter-spaced uppercase, and add a test that every <table> in components/dashboard-review has a <caption>.
  - *Verifier:* Real for legibility: 10 px uppercase headers at panels:334 and :445 and review:685 and :773. But neither point is a WCAG 2.2 AA failure. AA sets no font-size floor, and header cells in a single-row <thead> need no explicit scope. The missing captions are best practice, so P3 is right, but the 'no header scope' part should be dropped.
- **XC-X5.4 · P3** (confirmed; a11y) Some data marks are under 3:1 against the card: 2026 bars 2.57, decrease bars 2.80, coral 2.88, withheld amber 2.15, funnel 2.54. The 2026 bars are the real 1.4.11 gap, because their values sit only in a collapsed table.
  - *Evidence:* pillar-b-monthly-bars.tsx:11; pillar-b-review-visuals.tsx:16, :90, :111, :267; pillar-b-adoption-visuals.tsx:23.
  - *Suggestion:* Darken the series tokens (e.g. amber #b45309, orange #ea580c) and use opaque teal for track bars.
  - *Verifier:* Recomputed on the white card: 2026 #d99335 2.57, orange-500 2.80, coral #e87955 2.88, amber-500 2.15 (monthly-bars:11, review-visuals:16, :111, :267). The panel rightly limits the real 1.4.11 gap to the series with no adjacent figure.
- **XC-X5.5 · P3** (confirmed; a11y) There is no skip link past the logo, theme switch and about 11 nav links. The pulse and spin animations ignore prefers-reduced-motion.
  - *Evidence:* components/dashboard-review/nav.tsx:66-172; app/globals.css:119-125; loading.tsx:3; pillar-b-filter-bar.tsx:255.
  - *Suggestion:* Add 'Vai al contenuto' targeting an id on <main>, and switch to motion-safe:animate-pulse and motion-safe:animate-spin.
  - *Verifier:* No skip link (nav.tsx:66-175). animate-pulse (loading.tsx:3) and animate-spin (filter-bar:255) have no motion-safe variant, and globals.css:119-125 covers only the vis-* classes. Proportionate as P3: nav and main landmarks already meet 2.4.1, and reduced motion is AAA or best practice.
- **XC-X5.6 · P2, found by the verifier (medium)** The loading state is silent for assistive technology. For 3–12 s a screen reader hears nothing: the skeleton has no text, no role=status and no aria-busy. The public page's Suspense fallback does say 'Caricamento…'. (Same item as PB-P14.1; fix it there.)
  - *Evidence:* app/dashboard-review/loading.tsx:1-18 (divs only); LIVE_EVIDENCE accessibility ('a screen reader hears nothing for 3–12 s'); compare app/pillar-b/page.tsx:41.
  - *Suggestion:* Add role="status" with a visually hidden 'Caricamento dell'analisi…' (and aria-busy on the container) to loading.tsx.
- **XC-X5.7 · P3, found by the verifier (low)** Target size (2.5.8, the AA criterion new in WCAG 2.2) is not addressed, although the component is graded against 2.2 AA.
  - *Evidence:* LIVE_EVIDENCE: 35 interactive elements under 24×24 px at 1280, including 'Copia il link a questa vista' (16 px tall), every <summary> (16 px) and the molecule quick picks (23 px). The spacing exception was not measured, so some of these may pass. Not verified.
  - *Suggestion:* Give summaries and the copy-link button py-1 (24 px minimum height), set the quick picks to min-h-6, and re-run the probe with the 24 px spacing-circle test.
- **XC-X5.8 · P3, found by the verifier (low)** In dark mode the 2024 monthly series falls just under 3:1 against the card.
  - *Evidence:* pillar-b-monthly-bars.tsx:11 '#647c90' measures 2.99:1 on the dark card hsl(203 60% 18%) (computed with the WCAG formula).
  - *Suggestion:* Use a slightly lighter dark-mode value for the 2024 series (for example a slate around #7890a4), or a CSS-variable token per theme.

### X6 · Cross · responsive and mobile — B-

*Lens grades:* a11y B-, visual B

At 375 the private page has no sideways scroll, every table becomes a stacked list, and nothing is clipped. The shared shell holds it back. On a phone, the whole first screen is navigation: the h1 sits at y=649 and the first section 3.3 screens down. There is no sign-out below md. The 32-screen page has no index. The public page keeps three nested inner scrollers (see Q2, Q4, Q5).

- **XC-X6.1 · P2** (confirmed; a11y, visual) On a phone, the whole first screen is the dashboard navigation: the h1 is at y=649, the filter bar at y=1151 and the first section heading at y=2690.
  - *Evidence:* LIVE_EVIDENCE responsive; screenshot private-375-01-first-screen-is-navigation.jpg; components/dashboard-review/nav.tsx:67-68, :115-121.
  - *Suggestion:* Below md, show a compact top bar (logo, current module, a 'Menu' button with aria-expanded) and put the link list behind it.
  - *Verifier:* nav.tsx:68 stacks the full aside above main below md, and :115-121 wraps every link. The screenshot shows the h1 only at the bottom of the first screen.
- **XC-X6.2 · P2** (confirmed; a11y) Below the md breakpoint there is no way to sign out, which matters on shared hospital devices.
  - *Evidence:* components/dashboard-review/nav.tsx:167-169 (LogoutButton inside 'mt-auto hidden md:block').
  - *Suggestion:* Put 'Esci' in the mobile menu, or show it at every width.
  - *Verifier:* nav.tsx:167-169 'mt-auto hidden md:block' is the only LogoutButton in the dashboard shell (grep: the others are in the access portal and control centre). Sessions last up to 7 days (lib/supabase/proxy.ts:8).
- **XC-X6.3 · P3** (confirmed; a11y) At 375 the page is 32 screens long, with 17 collapsed disclosures and no in-page index; at 320 the narrow charts render at about 9 px.
  - *Evidence:* LIVE_EVIDENCE: 26,067 px at 375; docs/PILLAR_B_GUIDO_FEEDBACK_V5_20261008.md:241.
  - *Suggestion:* Add a compact jump list under the filter bar linking the existing section ids, and raise SVG font sizes when the container is under about 18rem.
  - *Verifier:* The Group ids exist (pillar-b-review.tsx:492-829: spesa, distribuzione, adozione, concentrazione, evidenza, limiti, fonte), but nothing links to them except '#filtri' and '#adozione'. The 9 px at 320 is recorded at tracker:241.

### X7 · Cross · robustness — B

*Lens grades:* data A-, a11y B, eng B+

Private-page robustness is careful and verified live. 25 translated panel switches matched an untranslated tab, a desync triggers one guarded reload, optional reads are isolated, and the cache keys carry the release stamp. Held back by four things. The public page patches text in place, has no error boundary, and was never tested under translation. translate="no" covers whole tables, so the owner's translated reading loses the headers and prose in them. The random-UUID remount costs focus and state. Deep links are lost through login.

- **XC-X7.1 · P2** (confirmed; a11y) The public page patches tiles, titles, notes and conditional nodes in place when a selector changes. That is the pattern that crashed the private page under Chrome translation, and there is no Fresh or keyed wrapper and no error.tsx.
  - *Evidence:* components/pillar-b-public.tsx:149-155, :235-244, :251-252, :292-293, :377-379; no error.tsx in app/pillar-b/; translation checks covered only the private page (docs/PILLAR_B_GUIDO_FEEDBACK_V5_20261008.md:266-277).
  - *Suggestion:* Key the selection-dependent content on selectionHref(sel), keeping the selects outside it so focus stays. Add app/pillar-b/error.tsx using lib/dashboard-review/dom-desync.ts, and re-run the translated-switch check on /pillar-b. The same pattern is needed on Pillar A: A-05.
  - *Verifier:* components/pillar-b-public.tsx:143-155 is plain useState with history.replaceState and no keyed wrapper. Tile text and notes are patched in place (:235-244), and conditional nodes like `{!isItaly && position && <p>…}` (:377) sit outside translate="no". app/pillar-b has only page.tsx, and the app/ listing has no error.tsx or global-error.tsx. This is the failure class recorded at tracker:268.
- **XC-X7.2 · P3** (partly; a11y) translate="no" is set on every table and stacked list, so readers using browser translation, as the owner does, get untranslated headers, reasons and method sentences.
  - *Evidence:* e.g. pillar-b-bridge-b.tsx:175, :200; pillar-b-review.tsx:257, :286, :662, :684, :772; pillar-b-panels.tsx:321, :333, :444; pillar-b-public.tsx:274, :351, :381.
  - *Suggestion:* Limit translate="no" to numeric cells (the font-mono values) and re-run b53. The tables already sit inside replaced-whole subtrees.
  - *Verifier:* Real for the owner's translated reading, but the stated premise is false for the public page. Its tables are not in replaced-whole subtrees: the page patches in place, and the tables at pillar-b-public.tsx:311 and :336 contain conditional cells (`{!isItaly && <td>}`, :314, :339) that translate="no" currently shields from the insertBefore/removeChild desync. Narrowing translate="no" is safe on the private page, where PillarBReview is re-keyed and the panels use Fresh. On the public page it must wait until the Fresh/key fix of XC-X7.1 lands.
- **XC-X7.3 · P3** (confirmed; eng) The review is re-keyed with crypto.randomUUID() on every answer, so even an identical refresh replaces about 13k nodes and drops focus and open disclosures.
  - *Evidence:* page.tsx:543-553; tests/pillar-b-translation-safe.test.mjs:150-156.
  - *Suggestion:* Key on pillarBHref(filters), the request's local-option params and the release stamp, which covers every case the comment lists, and update the pin.
  - *Verifier:* page.tsx:553 `${pillarBHref(BASE, filters, {})}#${crypto.randomUUID()}`, pinned by tests/pillar-b-translation-safe.test.mjs:150-156. The proposed deterministic key (filters, local-option params from requestSearch at :504, release stamp at :210) covers the cases the comment at :543-552 lists. It would not fix focus loss on a real filter change.
- **XC-X7.4 · P3** (partly; eng, data) A shared 'Copia il link a questa vista' URL opened while signed out lands on /dashboard-review/spend after login. The headline reads (10-minute cache) and the fresh reads can disagree briefly after an in-place data correction, and the page gives no read time.
  - *Evidence:* lib/supabase/proxy.ts:79-89; components/login-form.tsx:61; LIVE_EVIDENCE '307 → /auth/login?ambito=<codice>'; server-cache.ts:33-37.
  - *Suggestion:* Redirect to /auth/login?next=<path+query> and push safeNext(next) after login. Make any in-place correction bump the activation stamp, as a release-runbook step.
  - *Verifier:* The deep-link loss is confirmed. lib/supabase/proxy.ts:86-88 rewrites only the pathname, and components/login-form.tsx:61 always pushes /dashboard-review/spend, although lib/auth/safe-next.ts exists. The cache part, though, is a documented design bound (server-cache.ts:33-37) on a frozen release, not a defect. The runbook step is fine as hygiene.

### X8 · Cross · code quality, tests and maintainability — B

*Lens grades:* eng B

Code quality is high where it counts: strict TypeScript with no `any`, pure view-model modules, and about 1,260 assertions across 21 Pillar B test files, including a deep-freeze test and a search_path test over all migrations. Held back by four things. There is no CI. The 706-line page orchestration has no behavioural test, only about 100 regex pins on source text. Files are very large and repeat primitives and colour constants, which causes the colour inconsistencies noted in P4–P9. One SQL constant is copied six times.

- **XC-X8.1 · P2** (confirmed; eng) There is no continuous integration. Tests, lint, typecheck, build and the harnesses all run by hand, and nothing blocks a commit to main that breaks them.
  - *Evidence:* No .github directory; package.json defines only test and lint; harnesses live outside git in outputs/pillar-b/logs.
  - *Suggestion:* Add a workflow running npm test, tsc --noEmit, eslint and next build on every push and PR. The repository is public, so use synthetic fixtures only. Depends on A-19 (lockfile drift: npm ci would refuse the current lock).
  - *Verifier:* No .github directory. package.json:3-12 defines only test and lint, with no typecheck script.
- **XC-X8.2 · P2** (confirmed; eng) The page orchestration (waves, caching, degraded and failure modes, the empty hint, bridge and queue gating, Azienda branching) is pinned by regex over source formatting, not tested by behaviour.
  - *Evidence:* app/dashboard-review/revisione-pillar-b/page.tsx:123-706; e.g. tests/pillar-b-regional-comparator.test.mjs:154-170, tests/pillar-b-translation-safe.test.mjs:150-170.
  - *Suggestion:* Extract loadPillarBReview(scope, filters, rpc) with injected readers and a pure buildReviewProps(). Test facets timeout, a missing function, regional failure, the empty set and an Azienda account, then retire those pins.
  - *Verifier:* tests/pillar-b-regional-comparator.test.mjs:152-170 and translation-safe:150-156 match page.tsx source text, including newlines and spacing. b50 renders the components offline but not the page's own branching.
- **XC-X8.3 · P3** (partly; eng, visual) Large files and duplicated pieces. Frame, Pair, Stat, Note and Bar each exist twice, the colour constants are redefined in four files, and narrow/wide tables are hand-written twice. Dormant 'function not deployed' fallbacks are still carried.
  - *Evidence:* pillar-b-review.tsx 845 lines, pillar-b-adoption-visuals.tsx 717, page.tsx 706; Frame at pillar-b-adoption-visuals.tsx:36 and pillar-b-review-visuals.tsx:67; colours at adoption-visuals.tsx:17-23, review-visuals.tsx:12-16, bridge-b.tsx:29-31, monthly-bars.tsx:11-13; fallbacks at page.tsx:246-281, :505-533.
  - *Suggestion:* Create one pillar-b-ui.tsx holding the shared primitives and chart tokens, plus a ResponsiveTable driven by column definitions (the TREND_VALUES pattern). Split pillar-b-review.tsx by section, and make a missing scoped function fail closed.
  - *Verifier:* Frame (adoption-visuals:36, review-visuals:67), Pair (adoption-visuals:51, panels:106) and Stat (panels:486, review:172) are duplicated, and the colour constants recur in four files (bridge-b:29-31 included). But Note (panels:81) and Bar (panels:87) exist once. The dormant fallbacks are as described (page.tsx:259-281, isMissingFunction).
- **XC-X8.4 · P3** (confirmed; eng) The perimeter tile re-implements the bridge's publishability rule inline and omits perimeter > 0. The ten predates_window AIC codes are copied six times across three migrations, one copy inside the SECURITY DEFINER function. The Supabase packages are declared as 'latest'.
  - *Evidence:* pillar-b-review.tsx:439 vs lib/dashboard-review/pillar-b/bridge-b.ts:181-184; migrations 20261002170000:135,174, 20261003090000:101,124, 20261009120000:239,263; package.json.
  - *Suggestion:* Gate the tile on adoption.bridgeReady. Move the AIC list into one reference table or immutable function (or test that the copies are identical). Pin semver ranges that match the lockfile.
  - *Verifier:* pillar-b-review.tsx:439 re-implements bridgeBPublishable (bridge-b.ts:181-184) without `perimeter > 0`, while bridgeReady is already computed at page.tsx:566. The AIC list appears at 20261002170000:135, :174; 20261003090000:101, :124; 20261009120000:239, :263. The Supabase packages are 'latest' at package.json:18-19.
- **XC-X8.5 · P2, found by the verifier (medium)** No automated guard keeps confidential release figures out of tracked files, and such figures are present at HEAD (see XC-X2.4).
  - *Evidence:* tests/pillar-b-public-surface.test.mjs:99-126 scans only data/public-compiled/pillar-b-aifa-ev-sc-2025.json. No test walks git ls-files. A masked regex scan of tracked non-data files found euro amounts and release constants in several files; the list is in the private note (outputs/pillar-b/PB_QA_20261012_PUBLIC_REPO_FIGURES.md).
  - *Suggestion:* Add a node:test that runs git ls-files (excluding data/public-compiled and the published AIFA assets) and fails on Italian-formatted euro amounts and on the release's row and total constants, read from a private, git-ignored list when present.
- **XC-X8.6 · P3, found by the verifier (low)** A security comment on the Pillar B page names the wrong control; correct it to name the proxy redirect and the scope resolver.
  - *Evidence:* Details in the private security note.
  - *Suggestion:* Correct the comment (see the private note).
