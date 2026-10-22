# Pillar C interface: release-candidate handback to Codex

Date: 22 October 2026. From: Claude Code (presentation owner, points 15–17, frontend part of 19, UI evidence for 20). To: Codex (release coordination, contracts, production).

## Release candidate

- Checkout: `viscompass-ui` worktree, branch `ui/pillar-c-six-sections`, head `cb4a1d0`.
- Base: `cb3e98e` on `pillar-c/rec5-scoped`. That base is **not in `origin/main`**: the scoped Pillar C delivery (recommendation 5) must land first, or this branch must be rebased with it.
- Nothing is pushed, deployed, migrated or activated. No production data, schema, upload, rollout or access change.
- Separate small branch for `main`: `docs/remove-ui-signoff` (`dd588f9`, on top of `origin/main` `99a53fb`) removes the UI-direction sign-off rule from `CLAUDE.md` and `AGENTS.md`, as the owner asked. The same change is in this branch as `f78cd08`.

| Commit | Point | Content |
|---|---|---|
| `c168a38` | 17 | Every logo links home (one `VisLogoLink`), uniform A/B/C labels in the sidebar, homepage, public headers and access portal, «Esci» at every width, homepage bar without overflow at 375–1280 px |
| `ac5e058` | 15 | Six-section building blocks (section list, compact section bar, frames, scope bar, decision overview), not mounted |
| `b2579dc` | 15 | Reviewer page in six sections |
| `c3b040e` | 15, 17 | Azienda, Regione and forecast_only pages in six sections; old 16- and 9-entry navigation, purpose navigation and the dossier/attribution `pageScope` switch deleted |
| `d7c2a53` | 15 | Reviewer workbook insight browser and dead prototype files removed (revertible on its own) |
| `f78cd08` | — | Sign-off rule removed from the agent instructions (owner request) |
| `3193a9f` | 16 | Charts chosen by the question: spend columns or cumulative line, coverage note, responsive attribution ranges, bridge legend |
| `cb4a1d0` | 19 | 44 px controls, motion-safe transitions, label-in-name for the budget selects, singular count sentence, route profile |

55 files changed against `cb3e98e` (12 added, 4 deleted, 39 modified). The design record with every decision and re-pin is `docs/PILLAR_C_SIX_SECTIONS_20261022.md`.

## Behaviour changes Codex must know

- **Page structure (all audiences).** Quadro decisionale, Destinatari e utilizzo, Portafogli e attribuzione, Fattori di spesa, Budget e scenari, Priorità ed evidenza. Every old in-page anchor still resolves (`portafogli`, `scenari`, `spesa`, `cambiamento`, `attribuzione`, `pianificazione`, `numerosita`, `previsione`, `evidence-workflow`, `evidenza`, `portfolio-product-detail`).
- **URL keys.** The page scope bar writes `c_org`, `c_channel`, `c_port_org` and `c_port_channel` in one `pushState` (reviewer through `cReviewerScopeSearch`, scoped through `cScopedPageScopeSearch` on `cScopedReviewSearch`, so only the audience's own keys) and deletes `c_attr_org` and `c_attr_channel`. The attribution reads `c_port_*` only; `c_attr_*` is no longer read. «Azzera» still uses `cInsightResetSearch`. With an old link where `c_org` and `c_port_org` differ, the bar shows `c_org` and section 3 shows `c_port_*` until the reader changes organisation or channel, or uses «Azzera».
- **Section 2** is an honest empty state («Le fonti attualmente disponibili in questa vista non contano le persone trattate e non misurano l’utilizzo. Nessun valore viene mostrato né sostituito.») until an accepted recipients packet exists.
- **forecast_only** keeps its header and shows the section bar with only «Budget e scenari» as a link, the sentence «Quadro decisionale, Destinatari e utilizzo, Portafogli e attribuzione, Fattori di spesa e Priorità ed evidenza non sono disponibili in questa pagina; in Budget e scenari è disponibile solo la previsione regionale. Nessun valore viene sostituito.» and the forecast. It never speaks about the organisation, because outage branches mount the same workspace; the `role=note` line of `page.tsx` stays the only organisation statement.
- **Removed from the reviewer page:** the generic workbook insight browser (views listed in the design record §3.2 as removed pending admission), the budget shortcut buttons for one Azienda, per-person count wording, links to the workbook costi section.
- **Shared component outside Pillar C:** `pillar-b-local-toggle.tsx` buttons are now 44 px tall below `md` with motion-safe transitions; Pillar B pages show the same toggles slightly taller on phones.
- **Not touched:** `app/dashboard-review/pillar-c/page.tsx` (byte-identical), loaders, auth, access, `lib/**` except the presentation-only `section-navigation.ts`, migrations, packets.

## Evidence actually produced

- Full suite at `cb4a1d0`: 1,002 tests, 994 pass, 8 skipped (the same 8 private-file skips as at `cb3e98e`), 0 fail.
- `npx tsc --noEmit` clean; `eslint --max-warnings 0` clean on every changed file. The repository-wide `npm run lint` still reports the same 9 problems as before this work, all in files it does not touch.
- `npx next build --webpack` passes at every commit.
- Leak and security pins unchanged and passing: scoped client graph and entry-chunk guard, scoped source pins, scoped page hash, scoped routes, audience, payload guard, regional forecast. `REVIEWER_ONLY` was extended (availability line, header pill), never loosened.
- Reviewer regression hash re-recorded at each markup change on the same synthetic data, data hash `bebe2d2b…` unchanged throughout; current markup hash `021f0914…`.
- At the 1.2b step the 195 scoped renders were compared case by case with the previous commit: equal after three recorded copy substitutions.
- Visual check: server-rendered reviewer workspace on synthetic data, viewed in the browser at 1280 and 375 px (no horizontal page overflow at 375). Homepage bar measured: no overflow at 375, 768, 1024 and 1280 px; at 320 px it still overflows by 22 px.
- Route profile (`/dashboard-review/pillar-c`): 20 client chunks, 1,166,951 bytes raw, 337,328 gzip; the chart library is 375,524 raw / 102,779 gzip for every audience; the reviewer workspace is a separate 56,342-byte dynamic chunk.

**Not performed:** no signed-in browser session (reviewer, Azienda, Regione or forecast_only) on the dev server or production; no account test; no live screenshot; no server or HTML-stream timing; no Excel or workbook check (point 14 not started). These need the release environment and Codex's gate.

## Requests for Codex (contracts and copy in Codex-owned files)

1. `planning.ts:59` and `:79`: the Spazio scenari lead («dell’ambito scelto nel dossier») and the registered link «Cambia periodo, organizzazione o canale nel dossier» name dossier controls that no reader's dossier has any more; please reword both before release (design §8 request 6). The new six-sections test pins the current text so the rewording is a deliberate re-pin.
2. `audience-view.ts:29–30`: the comment «The reviewer view keeps its own wording» is stale; the reviewer now reads the same ratio wording.
3. Login return destination: a signed-out visitor who clicks the homepage Pillar C link lands on `/dashboard-review/spend`; a `next` carry through the proxy redirect is needed (design §8 request 7).
4. Budget rows show numeric area codes («Dipartimento 4000»): a label field or map in the packets (request 2).
5. Count scenario select shows portfolio ids: labels in the packets (request 3).
6. Workbook outputs admitted for reviewer display, with column maps and tier, to rebuild purpose-built reviewer blocks (request 4, list in §3.2).
7. Section 2 needs an accepted audience-specific recipients/utilisation packet (request 8).
8. `C_COMPONENT_LABELS` plain-language bridge labels (request 1).

## Next safe tasks on the interface side

- Lazy-load the chart library (all recharts components through dynamic imports), about 103 KB gzip off the initial load; no contract change needed.
- Charts that need recipient data (profiles, distributions and concentration, spend versus reach) as soon as an accepted packet exists.
- Point 14 workbook assembly once accepted inputs are named; point 18 presentation once the review endpoints exist.
