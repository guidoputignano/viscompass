# Pillar C planning workspace («Scenari»)

Date: 2026-10-19. This is the reference for the «Scenari» section of the Pillar C reviewer page, built for Pillar C recommendation 4. That recommendation asks for a planning workspace with explicit assumptions. Users examine scenarios for selected portfolios and see how results change under alternative allocation assumptions. Approved budgets, observed expenditure and modelled values stay separate, and the regional forecast stays regional context.

This page explains what the workspace answers, what each assumption does and what the workspace never claims. It contains no workbook figures, no amounts and no ratios from private data. The example further down uses invented numbers. The rules are registered in two dated amendments to the private statistical analysis plan, PC-08-A12 and PC-08-A13 (see "Registered rules").

## What the workspace answers

You choose one or more therapeutic portfolios, for example oncology and haematology together. The workspace then answers these questions:

1. **How much did this portfolio, or this group of portfolios, spend in the chosen period?** It also shows how much of that spending does not depend on how shared products are divided between portfolios. This is under the draft mapping.
2. **At least and at most, how much shared spending could belong to the group?** This is the group's range. Shared spending is counted once, however many of the group's portfolios share a product.
3. **If I assume a change of a given percentage, what value and range do I get?** The answer is for a period of the same length as the base period.
4. **How do one or two of my assumptions compare with what was actually recorded?**
5. **If shared spending were divided by a rule I declare, where would the group land inside its range?** The rule can be equal shares, shares in proportion to each portfolio's own spending, or my own shares.
6. **Which shared products would narrow the group's range most, if their indications were reviewed?**

## What it does not calculate

Each item names the data that would be needed.

| Not calculated | What would be needed |
|---|---|
| A budget per portfolio, or a difference from a budget | An approved budget at portfolio level, on the same basis as the recorded spending |
| Spending of a ward, unit or clinical area | A local allocation by structure, unit or cost centre, and a reviewed link from units to portfolios |
| People treated, or spending per person | Counts of distinct treated people for the same perimeter |
| A forecast for an Azienda or a portfolio | Enough compatible local history for the registered forecasting rule |
| Savings, or net cost | Net prices after discounts and payback, and an agreed comparison |

## Words used on the page

- **Portafoglio** (portfolio): a therapeutic grouping by main use, assigned from the ATC code. The mapping is a draft (v0.1). It is not a clinical attribution, and it has not had its domain review.
- **Parte a portafoglio singolo** (single-portfolio part): spending on products whose ATC rule names one portfolio only.
- **Spesa condivisa** (shared spending): spending on products whose ATC rule names two or more candidate portfolios. The candidates form an **insieme di candidati** (candidate set).
- **Resta nel gruppo in ogni ripartizione**: shared spending whose candidates are all inside your group. It belongs to the group however it is divided.
- **Condivisa con portafogli fuori dal gruppo**: shared spending with at least one candidate inside the group and at least one outside it. Only this part makes the group's range wide.
- **Non attribuita**: spending with insufficient evidence or an identifier still to resolve. It has no candidate portfolio.
- **Intervallo condizionale**: the lowest and highest values that are possible if the candidate sets are right. It is not a confidence interval and carries no probability.

## What you choose

- **Scope.** The period, organisation and channel are those of the portfolio dossier above the workspace.
  - The period can be a full year (2024 or 2025) or a January–May period (2025 or 2026).
  - The organisation «Regione» means the aggregate of the four Aziende in the register («Aggregato delle quattro Aziende»), not the AIFA Region.
- **Group.** One to six portfolios, from the full vocabulary, product categories included.
- **January–May base.** A January–May base gives five-month values. They are never annualised and never compared with a full year. The page says so in a banner.

## Four layers, kept apart

| Layer | Label on the page | What it shows | What it never shows |
|---|---|---|---|
| Approved budget | «Budget approvato» (one line in the strip «Fuori da questa sezione») | Whether a published budget act exists for this organisation, period and channel. If one exists, a link to the Budget section. | An amount, a difference from a budget, or the modelled budgets of the Budget section |
| Observed spending | «Spesa rendicontata osservata» | The scope's recorded spending in six parts. The parts add up exactly to the scope total. | Any value under an assumption |
| Values under assumption | «Valori sotto ipotesi» | Your declared variants and, if you choose a rule, the declared split | A forecast, a budget or a saving. Nothing observed, except the observed group range that contains a split at the observed base (see below) |
| Regional context | «Contesto regionale» (one line in the strip «Fuori da questa sezione») | A link to the regional forecast built on public AIFA data, marked «previsione regionale, non aziendale» | Any forecast figure. The regional forecast is not split by Azienda, channel or portfolio and does not enter any calculation here. |

No number moves between layers, and no sum, difference or ratio is taken across them. Each layer has its own charts and its own scale. There is one exception, required by the split rules: a split result at the observed base is drawn inside the observed group range, in its own chart in the «Valori sotto ipotesi» layer, and that range is labelled «Intervallo congiunto del gruppo · spesa osservata».

The six observed parts are:

- «Portafogli del gruppo · parte a portafoglio singolo», one line per portfolio;
- «Resta nel gruppo in ogni ripartizione»;
- «Condivisa con portafogli fuori dal gruppo»;
- «Altri portafogli · parte a portafoglio singolo»;
- «Condivisa solo fra altri portafogli»;
- «Non attribuita».

The page checks that these six parts add up exactly to the scope total. If the check fails, the page shows no figures.

## The group's range is not a sum of ranges

Adding the ranges of individual portfolios counts shared products twice. The group's range counts each one once. The page says: «Sommare gli intervalli dei singoli portafogli conta più volte le voci condivise fra portafogli del gruppo; l'intervallo del gruppo le conta una volta.»

**Example.** The numbers are invented and in units, not euros. There are three portfolios, A, B and C:

- A's single-portfolio part is 50, B's is 30 and C's is 10.
- Product P1 is shared by A and B. It cost 20.
- Product P2 is shared by B and C. It cost 10.
- Nothing is unattributed.

Taken one at a time:

- A ranges from 50 to 70, because P1 could all be A's.
- B ranges from 30 to 60, because P1 and P2 could both be B's.

Adding these two ranges gives 80 to 130. That is wrong for the group {A, B}:

- P1 belongs to the group whatever happens.
- Only P2 is uncertain.

The group's range is therefore 80 + 20 = 100 to 110. In the observed layer the same scope reads:

| Part | Value |
|---|---|
| Portafogli del gruppo · parte a portafoglio singolo | 80 (A 50, B 30) |
| Resta nel gruppo in ogni ripartizione | 20 (P1) |
| Condivisa con portafogli fuori dal gruppo | 10 (P2) |
| Altri portafogli · parte a portafoglio singolo | 10 (C) |
| Condivisa solo fra altri portafogli | 0 |
| Non attribuita | 0 |
| Total | 120 |

Credit notes are kept as their own records. Suppose P2's 10 were made of 12 in charges and a credit note of 2. The group's range would then be 98 to 112. The credit could lower the group's total, and the charges could raise it.

Two more things to know:

- **Unattributed items.** The page always adds one separate line, «Se anche le voci non attribuite potessero ricadere nel gruppo: …», unless the group covers every portfolio. When there are no unattributed items, that line repeats the group's range.
- **Extremes.** Each end of the group's range is possible on its own. But the extremes of different portfolios cannot all happen at once: a shared product given to the group is missing from the others.

## Assumptions and their effect

| Assumption | Where | Allowed values | Effect |
|---|---|---|---|
| Change for the group | One per variant | −50.00 % to +100.00 %, at most two decimals; default 0 | Applies to the group's single-portfolio part and to all shared spending that touches the group, both «resta nel gruppo» and «condivisa con portafogli fuori dal gruppo». The range moves and widens or narrows with it. |
| Separate change for shared spending | «Ipotesi avanzate» | Same | Replaces the group change for the shared spending that touches the group. The shared change in force is always printed with the result. |
| Separate change for one portfolio | «Ipotesi avanzate» | Same | Replaces the group change for that portfolio's single-portfolio part. |
| Number of variants | Beside the observed base | Up to two | Each variant is compared with the observed base («Base osservata (nessuna ipotesi)»), never with the other variant. |

**What is never varied:**

- the single-portfolio part of the other portfolios;
- shared spending only among other portfolios;
- unattributed items.

The page says this beside every variant.

**What a value under assumption means in time.** It covers a period of the same length as the base period («per un periodo della stessa durata del periodo di base»):

- It has no year label. It is not "2026" or "2027".
- It is not a forecast of the next period.
- It is not annualised.

**Effect line.** «Effetto dell'ipotesi rispetto alla spesa osservata del periodo di base, non risparmio». It is the change in the part of the group that does not depend on how shared spending is divided. In the example, +10 % for the group gives:

- single-portfolio part 88 and P1 22, so 110 for the part that does not depend on the split;
- P2 becomes 11, so the range is 110 to 121;
- the effect is +10 units.

**What a variant can be.** Every variant is typed by you. There is no preset that repeats the change observed between two periods. There is no option to use regional AIFA growth, the regional forecast, the growth used for the modelled budgets, or any budget. The scope total under an assumption is not displayed.

**Captions.**

- The «Valori sotto ipotesi» layer opens with the full caption «Scenario (ipotesi dichiarata) — non è una previsione né un dato osservato; nessuna probabilità associata. Non è un budget, un tetto o un risparmio.» and the time reading «Per un periodo della stessa durata del periodo di base.»
- Under each variant's values, and under the chart that compares the variants, one line repeats them: «Scenario (ipotesi dichiarata), per un periodo della stessa durata del periodo di base: non è una previsione né un dato osservato.»
- Each variant card leads with «Parte del gruppo che non dipende dalla ripartizione · sotto ipotesi», the same quantity as the observed «Parte del gruppo che non dipende dalla ripartizione», under the assumption.

## Splitting shared spending under a declared rule

By default nothing is split: «Nessuna ripartizione (solo intervallo)». You can choose a rule for the shared spending that crosses the group's boundary. Spending that stays in the group needs no rule, and unattributed items are never split.

| Rule (label) | What the group receives from each crossing product | When a product «resta non ripartita» |
|---|---|---|
| «Quote uguali fra i candidati» | The group's number of candidates divided by the product's number of candidates | Never |
| «In proporzione alla parte a portafoglio singolo osservata nello stesso ambito» | In proportion to the observed single-portfolio part of each candidate in the same period, organisation and channel. Negative parts count as zero. | When all its candidates have a zero or negative single-portfolio part |
| «Quota del gruppo scelta dall'utente per insieme di candidati» | The share you type for that candidate set, from 0 to 100 % | When you have typed no share for that set |

In the example, the rules split P2 (candidates B and C) as follows:

- equal shares give the group half of P2, so 105;
- the proportional rule gives 30 / (30 + 10) = 75 % of P2, so 107.5;
- a share of 40 % typed by you gives 104.

With no share typed, the group stays at 100 to 110.

**How a split result is shown:**

- It is always shown inside the group's range, labelled «Ripartizione dichiarata (ipotesi)». It is never the headline or the result.
- A split result is the part of the group that does not depend on the split, plus the share you declared of the spending shared with portfolios outside the group. The intro of the section says so.
- Products a rule does not cover keep their own range («Voci che restano non ripartite: mantengono il loro intervallo»). So a split result is itself a range. It becomes a single value only when every crossing product is covered.
- The split result is for the group as a whole. For a group of two or more portfolios, no split value is shown per portfolio.
- Under every split result, and once at the head of the layer, the page says «Ripartizione dichiarata (ipotesi): non è un dato osservato né un'attribuzione clinica e non esprime una probabilità.» The notes on what a split is and what it never changes sit next to the split at the observed base.
- If the group shares nothing with outside portfolios, or the rule covers no product (for example your own shares before you type one), the page shows no split figure, marker or caption, only a line saying so.

**What the rules can and cannot claim:**

- **Equal shares and the proportional rule** are arithmetic references, not evidence of where the medicines were used. The proportional rule also favours portfolios that already have a large single-portfolio part.
- **Additivity across slices.**
  - Equal shares add up across Aziende and channels.
  - The proportional rule does not, because each scope has its own weights. The page says «non additiva tra Aziende e canali».
  - Your own shares add up only if you use the same shares everywhere. The page does not claim that they do.
- **Your own shares** are your planning choice. The page says «Quote scelte dall'utente: nessuna evidenza le sostiene». They are never read as evidence. They never change the mapping, and they never enter the shared review queue.
- **Effect on the rest of the dashboard.** A split never changes the mapping, the attribution analysis, the portfolio dossier, the review queue or any other section's totals or exports. The attribution section's statement that no equal or proportional split is assumed stays true.

**Exact arithmetic.** Splits are computed as exact fractions and rounded only once, for display. Displayed amounts may not add up to the cent, and the page says «Gli arrotondamenti possono non sommare».

## Which products would narrow the range

The list «Revisione delle indicazioni del prodotto: riduzione massima dell'intervallo del gruppo» ranks the shared products that cross the group's boundary. It uses the same ranking as the attribution analysis, by absolute exposure.

- **How much a review can narrow the range.** Reviewing a product's indications can narrow the range by **up to** that product's exposure («fino a»). That happens only if the review places the product wholly inside or wholly outside the group, as the page says. A review that still leaves it shared across the boundary narrows nothing.
- **Observed base.** The list is computed on the observed spending. A variant changes the amounts, not the order.
- **Cost-centre allocation.** Local allocation by cost centre is a separate, organisational request. It does not narrow a portfolio or group range, so the list promises nothing for it.
- **Order is not an outcome.** The order is a review order. It is not a clinical or performance ranking.
- **Links.** The link to the shared review queue appears only where that section is present on the page.

## Guard rails

- **No people.**
  - The workspace never shows counts of people treated, spending per person or patient-level data.
  - Euro assumptions never feed a per-person figure.
- **No clinical attribution.**
  - Portfolios are a draft ATC grouping: «Mappatura terapeutica in bozza (v0.1): la parte a portafoglio singolo è un raggruppamento per ATC, non un'attribuzione clinica; la sensibilità alla mappatura non è valutata.»
  - The single-portfolio part is never presented as spending of a ward or clinical area.
- **No savings.**
  - An effect is never called a saving.
  - Nothing is presented as net cost or as a price effect.
- **No budget comparison.**
  - No portfolio-level budget exists, so no difference from a budget is calculated.
  - Modelled budgets from the Budget section never appear.
- **No Azienda forecast.**
  - The regional forecast is a link only, and it is never an input or a preset.
  - The page never multiplies it by any Azienda, channel or portfolio share.
  - The page uses «Aggregato delle quattro Aziende» for the register and «Regione Abruzzo (AIFA)» only for the forecast, so the two cannot be confused.
- **Time.** There are no year labels on values under assumption, no annualisation and no full-year versus January–May comparison.
- **Exactness.**
  - All amounts are computed exactly and rounded once, for display.
  - If any identity fails, the page shows no figure: «L'analisi non è disponibile per questa selezione. Nessun valore viene sostituito con zero.»
  - When a portfolio's single-portfolio part is exactly zero, the page cannot tell missing records from records that cancel out. It shows «Nessun importo netto a portafoglio singolo (righe assenti o compensate)» rather than a zero. For a one-portfolio group this includes the headline value, observed and on every variant card.
- **Interval semantics.** «Intervallo condizionale: non è un intervallo di confidenza e non esprime una probabilità.» Intervals are drawn as brackets, never as probability bands.
- **How to read a range.** The statements about group ranges appear once, verbatim, in the block «Come leggere questi valori» beside the observed group range. Every other group range (each variant's, the one around the split at the observed base, the chart of the variants) has a visible link-style button «Come leggere questo intervallo» that opens that block and moves to it.
- **Copy rules.** Words such as budget, saving, ceiling, overrun, target, deviation, confidence interval, probability, verified, proof, net spend or net cost, ward or clinical area, patients and clinical attribution appear only inside fixed negative sentences, such as the scenario caption or the mapping banner. Tests check every label and every rendered state.
- **Translation and small screens.**
  - Every text or number that changes between views sits in its own keyed element. Chrome's page translation therefore cannot leave an outdated value on screen.
  - The layout works at 375 px wide without horizontal scrolling.

## Access

- **Who can use it.** The workspace is reviewer-only. It appears only for an approved membership with the reviewer or administrator role, like the attribution analysis.
- **Data source.** It reads the existing endpoint `GET /api/pillar-c/attribution`. The endpoint checks access before any cache or storage read, serves hash-pinned private data and sends private, no-store responses.
- **Nothing new.** There is no new route, data packet, storage object, policy or migration.
- **Ordinary members.** Ordinary approved members keep forecast-only access, and the workspace is not part of their page.

The data contain aggregates of several Aziende. For the regional aggregate, subtracting one Azienda would reveal the other three combined. An Azienda-facing version would therefore need server-side slicing by organisation and a decision on the aggregate. It is not part of this delivery.

## Saving and sharing a draft

A scenario is a **local draft**. It is not saved on a server, not shared and not approved.

- **Page address.** The address keeps the group and the declared percentages. A copied link therefore reproduces the view for another reviewer. It carries no amounts.
- **JSON export.** The export is built from the same data and the newest committed state as the page, so a value you have just typed is in the file. It holds:
  - the scope and the group;
  - every assumption, including a chosen rule and typed shares;
  - only the values the page shows, each under its page label: the observed parts, the group range, its width and the part that does not depend on the split, the line with unattributed items, the portfolios' own ranges; for each variant its headline value, range, line with unattributed items, effect and the portfolios' ranges; and, only when the page shows a split, each split result labelled «Ripartizione dichiarata (ipotesi)»;
  - where the page reads «Nessun importo netto a portafoglio singolo (righe assenti o compensate)», that note instead of an amount;
  - the fixed sentences the page shows;
  - the identity of the source: source and classification hashes, mapping version, and the immutable snapshot of the attribution data.
- **Never in the export.** The part of a split that goes to portfolios outside the group, the ranges of products a rule leaves unsplit, differences between range ends, product rows, or a scope total under an assumption. No such total is computed for display. As on the page, the shown values can still add up to one in particular cases. For example, a split that covers every crossing entry, plus the observed parts outside the group, gives the scope total under that variant. This is because the page must show the group's range and the observed parts.
- **Confidentiality label.** Every export carries «Riservato ai revisori del progetto · contiene aggregati di più Aziende».
- **Not in this delivery.** There is no spreadsheet export, no file import and no printable note.
- **Browser storage.** No amount is stored in browser storage.

## The dossier card stays

The portfolio dossier keeps its card «Pianificazione sotto ipotesi», with its maths and its copy unchanged. Only a link to the workspace was added, and the link's own text says what it opens:

- With the slider at 0%, or when the card has no single-portfolio amount: «Pianifica questo portafoglio nello spazio scenari». The workspace opens with this portfolio as the group and keeps its own variants.
- With the slider moved, for example to +10%: «Apri nello spazio scenari questo portafoglio con +10% (sostituisce le varianti già presenti)». The workspace opens with that one variant, applied to the single-portfolio part only and with the shared spending at its observed value, as on the card. It then shows the card's reference, change and range.

A variant typed in the workspace behaves differently: by default it also varies the shared spending that touches the group. So the same percentage typed there gives a different range from the card.

## Registered rules

Both amendments are appended to the private statistical analysis plan, `outputs/pillar-c/contracts/PC-08_STATISTICAL_ANALYSIS_PLAN.md`, in the section dated 2026-10-19. That section is outside this public checkout.

- **PC-08-A12 (reading, 2026-10-19).** It registers:
  - the group's range, which is the plan's existing per-record bound applied to a set of one to six portfolios, with the same proof;
  - the six-part observed partition and the meaning of «resta nel gruppo»;
  - how a declared percentage applies;
  - the statements for a group range, shown once in the block «Come leggere questi valori», with a pointer «Come leggere questo intervallo» beside every group range;
  - additivity across Aziende and channels;
  - the time reading (same length as the base period, no year label, no annualisation);
  - the review order of crossing products.

  It discloses what was computed during design. Only pass/fail checks and relative measures were computed, and no euro value was displayed. Its text was corrected before first use, on the same day, to state exactly which checks the tests make and where the statements are placed.
- **PC-08-A13 (owner decision, 2026-10-19).** It admits labelled split scenarios of shared spending in this workspace only, under the three rules above, and fixes their labels, exact arithmetic and limits. It overrides the plan's earlier exclusion of any split, "not even as a labelled scenario", for this workspace only. Everywhere else that exclusion stands. It also discloses what had been computed before the decision.

The plan's portfolio taxonomy already allowed a later labelled scenario with shares that sum to one. These rules satisfy that condition.

## Verification to record

The tests are in this repository: `tests/pillar-c-planning.test.mjs` (engine) and `tests/pillar-c-planning-ui.test.mjs` (render, interaction logic and export). A box is ticked when a verification receipt records the check.

- [ ] Engine tests on fictional data:
  - the partition adds up to the total, and its shared and unattributed parts carry exactly the counts and absolute amounts of the scope;
  - a fixed reference allocation of every shared product (the test device of the analysis plan) gives the group and the other portfolios exactly the total;
  - a one-portfolio group equals the existing portfolio range;
  - the full vocabulary collapses to a single value;
  - nesting inside the summed ranges;
  - a brute-force check that the group's range is the true minimum and maximum, including credit notes;
  - additivity across Aziende and channels;
  - split results always inside the range;
  - exact rational arithmetic.
- [ ] Render tests:
  - the layers and their labels;
  - no amount in the budget or regional lines;
  - the January–May banner;
  - translation-safe keyed values;
  - narrow-screen layout;
  - fail-closed states for refused or failed requests.
- [ ] Isolation tests:
  - no forecast or budget code is imported;
  - ordinary members' access is unchanged;
  - the copy rules hold.
- [ ] An independent exact-decimal check over every private scope, kept outside this repository.
- [ ] A live reviewer check.
