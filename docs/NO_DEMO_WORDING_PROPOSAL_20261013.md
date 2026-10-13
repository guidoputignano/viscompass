# Removing "demo" from VIS: wording proposal (13 October 2026)

**Status: CONFIRMED by the owner on 13 Oct 2026 and implemented on
branch `copy/no-demo-wording`.** The owner's answers:

1. Wording: sections A–C confirmed as written, including the H rows.
2. Synthetic fallbacks: both replaced by an empty state. This supersedes
   B3–B6 and the spend-overview and antibiotic rows of section E: the
   synthetic data was deleted, not relabelled. B1–B2 still apply,
   because the antibiotic type keeps `mode: "synthetic"` and the page
   still labels it.
3. `public/dashboard.html`: deleted. `/protected` now redirects to
   `/dashboard-review/spend`.
4. Supabase «Confirm sign up»: edited by the agent with the owner's
   authorization (A14, H1), saved and re-read. It is live now,
   independently of the code deploy.

Correction to question 2 below: the «€29,7 mld», «21», «73,8%» and
«91,4%» figures are not only in the modal. They are also hard-coded in
the homepage hero and preview (`app/page.tsx`, lines 29–32, 184–186
and 217), with no source in `data/` or `docs/`. They are still open.

**Owner rule (13 Oct 2026):** no part of VIS may be called a demo,
demonstration or "dimostrativo". Synthesized data is allowed only when
real data is unavailable AND the metric is highly important. Wherever it
is used, it carries a brief note («dati sintetici: …»), not a "demo"
label.

**Inventory method:** grep for `demo|Demo|DEMO|dimostrativ` in `app/`,
`components/`, `lib/`, `public/`, `supabase/`, `tests/` and the repo
root. Supabase auth email templates were read in the dashboard: the
repo grep cannot see them (AGENTS.md, "User-facing copy is not only in
the repo"). False positives are excluded: «demografico», "demonstrated",
`demo.istat.it` URLs, and the starter kit's `deploy-button.tsx` URL
parameters. No test asserts on any of these strings.

Kind: **T** visible text · **A** screen-reader label · **P** form
placeholder · **E** email · **H** optional harmonization: the word is
«candidatura», not «demo», but it belongs to the same flow.

## A. Access and sign-up flow (product decision)

The flow's single term becomes **«richiesta di accesso»**.

| # | Where | Kind | Current | Proposed |
|---|---|---|---|---|
| A1 | `app/page.tsx:301` (hero) | T | Registrati per la demo | Richiedi l'accesso |
| A2 | `app/page.tsx:464` (closing CTA) | T | Registrati per la demo | Richiedi l'accesso |
| A3 | `components/demo-prompt.tsx:75` (homepage modal) | T | Esplora la demo VIS Pharma Compass con un esempio già pronto. | Registrati e richiedi l'accesso per la tua organizzazione. |
| A4 | `components/home/decision-demo.tsx:75` (badge) | T | Demo interattiva | Interattivo |
| A5 | `components/home/decision-demo.tsx:157` (link) | T | Esplora la demo completa | Richiedi l'accesso |
| A6 | `app/auth/sign-up-success/page.tsx:26-27` | T | … Dopo l'accesso potrai inviare la candidatura alla demo oppure accettare un invito ricevuto. | … Dopo la conferma potrai inviare la richiesta di accesso per la tua organizzazione oppure accettare un invito ricevuto. |
| A7 | `components/sign-up-form.tsx:164` | T | Dopo la conferma dell'email potrai candidarti alla demo selezionando la tua organizzazione … | Dopo la conferma dell'email potrai richiedere l'accesso selezionando la tua organizzazione … |
| A8 | `lib/email/vis-email.ts:74` (registration email) | E | … Dopo l'accesso potrai inviare la candidatura alla demo; la richiesta resterà in verifica fino all'approvazione dell'organizzazione. | … Poi potrai richiedere l'accesso per la tua organizzazione; la richiesta resterà in verifica fino all'approvazione di un amministratore. |
| A9 | `components/access/access-portal.tsx:202` (h1 of `/access`) | T | Richiedi accesso alla demo. | Richiedi l'accesso ai dati della tua organizzazione. |
| A10 | `components/access/access-portal.tsx:258` | T | Candidatura demo | Richiesta di accesso |
| A11 | `components/access/access-portal.tsx:304` | P | Quali analisi o decisioni desideri supportare con la demo? | Quali analisi o decisioni desideri supportare con VIS? |
| A12 | `components/admin/access-control-center.tsx:419` | P | Perché stai concedendo l'accesso e cosa può essere valutato nella demo? | Perché stai concedendo l'accesso e per quali analisi? |
| A13 | `components/admin/access-control-center.tsx:527` | T | Candidature alla demo | Richieste di accesso |
| A14 | Supabase → Auth → Emails → **Confirm sign up** (body) | E | … completare la registrazione e richiedere l'accesso alla demo. | … completare la registrazione e richiedere l'accesso per la tua organizzazione. |
| H1 | Supabase → **Confirm sign up**, step 2 | E/H | Scegli l'organizzazione e invia la candidatura. | Scegli l'organizzazione e invia la richiesta di accesso. |
| H2 | `components/access/access-portal.tsx:330` | H | Invia candidatura | Invia richiesta |
| H3 | `components/access/access-portal.tsx:349` | H | Nessuna candidatura inviata | Nessuna richiesta inviata |
| H4 | `components/admin/access-control-center.tsx:488` | H | Candidature | Richieste |
| H5 | `components/admin/access-control-center.tsx:534` | H | Nessuna candidatura richiede una decisione. | Nessuna richiesta attende una decisione. |
| H6 | `app/admin/control-center/actions.ts:157` | H | Candidatura rifiutata. | Richiesta rifiutata. |
| H7 | `lib/email/vis-email.ts:83-84` | E/H | Candidatura in verifica · … / La tua candidatura è in verifica. | Richiesta di accesso in verifica · … / La tua richiesta di accesso è in verifica. |
| H8 | `lib/email/vis-email.ts:98-99` | E/H | Aggiornamento candidatura · … / La candidatura è stata aggiornata. | Aggiornamento della richiesta di accesso · … / La richiesta di accesso è stata aggiornata. |

A14 and H1 live in the Supabase dashboard, not in git. They need either
the owner's edit or explicit permission for the agent to make it.

## B. Notes on synthetic data

| # | Where | Kind | Current | Proposed |
|---|---|---|---|---|
| B1 | `app/dashboard-review/antibiotici/page.tsx:47` (header scope) | T | Demo sintetica | Dati sintetici |
| B2 | `app/dashboard-review/antibiotici/page.tsx:178` | T | … Eventuali dati sintetici sono indicati come demo. | … Eventuali dati sintetici sono segnalati da una breve nota. |
| B3 | `lib/dashboard-review/antibiotic-demo.ts:68` (note text) | T | Scenario dimostrativo · valori sintetici ispirati alla struttura AWaRe 2023–2025 | Valori costruiti sulla struttura AWaRe 2023–2025 · nessun dato dell'organizzazione caricato |
| B4 | `components/dashboard-review/spend-overview.tsx:95` | A | Scenario demo · spesa nel tempo | Dati sintetici · spesa nel tempo |
| B5 | `components/dashboard-review/spend-overview.tsx:110` | T | Regione dimostrativa · dati sintetici 2025 | Regione sintetica · 2025 |
| B6 | `components/dashboard-review/spend-overview.tsx:311` (note badge + text) | T | Demo regionale · Regione dimostrativa · valori interamente sintetici | Dati sintetici · Regione sintetica · nessun dato dell'organizzazione caricato |

B3 and B6 are shown next to a «Dati sintetici» badge, so they do not
repeat it. Sections B and E apply only if the owner keeps the fallbacks
(question 2 below).

## C. Pillar C reviewer preview (`/dashboard-review/pillar-c`, reviewers and admins only)

The page itself already says «Dati illustrativi».

| # | Where | Kind | Current | Proposed |
|---|---|---|---|---|
| C1 | `components/dashboard-review/pillar-c/workspace.tsx:70` | T | · ambito dimostrativo | · dati sintetici |
| C2 | `components/dashboard-review/pillar-c/workspace.tsx:82` | T | Categorie dimostrative selezionate | Categorie selezionate |
| C3 | `components/dashboard-review/pillar-c/workspace.tsx:142` | T | Coda di revisione dimostrativa | Coda di revisione su dati sintetici |
| C4 | `components/dashboard-review/pillar-c/charts.tsx:95` (table caption) | T | Confronto di budget dimostrativo | Confronto di budget |

C4's caption already has «· dati illustrativi» appended.

## D. Outside the React app

| # | Where | Current | Proposed |
|---|---|---|---|
| D1 | `public/dashboard.html` (old static prototype). It is served at `/dashboard.html` to any signed-in user, and `app/protected/page.tsx` redirects there. | DATI DIMOSTRATIVI badge; «Azione dimostrativa» alert; «prototipo di interfaccia» | **Recommended:** delete the file and point `/protected` to `/dashboard-review/spend`, the real post-login page. The alternative is to reword it. |
| D2 | `README.md:5` (public GitHub) | Control Center for demo applications, … | Control Center for access requests, … |
| D3 | `AGENTS.md` / `CLAUDE.md` § "Never fabricate a number" | Synthetic/demo data must be flagged … See `antibiotic-demo.ts`. | State the 13 Oct rule. Point to the renamed file. |

The rest of `README.md` is the Supabase starter kit's boilerplate,
which advertises Vercel's own "demo". It is out of scope here.

## E. Internal identifiers (renamed where cheap and safe; nothing persistent depends on them)

| Current | Proposed |
|---|---|
| `components/demo-prompt.tsx`, `DemoPrompt`, `demo-prompt-title`, sessionStorage key `vis-pharma-demo-prompt-seen` | `components/access-prompt.tsx`, `AccessPrompt`, `access-prompt-title`, `vis-pharma-access-prompt-seen`. The key is per session only: at most, the modal reappears once. |
| `components/home/decision-demo.tsx`, `DecisionDemo` | `components/home/signal-explorer.tsx`, `SignalExplorer` |
| `lib/dashboard-review/antibiotic-demo.ts`, `orgCode: "DEMO"` (used only as a React key) | `lib/dashboard-review/antibiotic-synthetic.ts`, `orgCode: "SYNTHETIC"` |
| `spend-overview.tsx`: `demo` prop/variable, `DEMO_ATC`, `DEMO_MOLECULES`, `DEMO_REVIEWS`, keys `demo-2023…`, ids `demo-bio…` | `synthetic`, `SYNTHETIC_ATC`, `SYNTHETIC_MOLECULES`, `SYNTHETIC_REVIEWS`, `synthetic-2023…`, `synthetic-bio…` |
| Comments in `lib/dashboard-review/queries.ts:1093,1102` | Reword: "synthetic fallback" |

## Questions for the owner

1. **Wording.** Confirm sections A–C as written, or amend. Should the
   optional H rows also change «candidatura» to «richiesta (di
   accesso)»?
2. **Synthetic fallbacks: keep with a note, or replace with an empty
   state?** (See below.)
3. **`public/dashboard.html`:** delete it, as recommended in D1, or
   reword it?
4. **Supabase «Confirm sign up» template (A14, H1):** will you edit it,
   or do you authorize the agent to edit it in the dashboard?

### Question 2 in detail: does the rule allow these synthetic fallbacks?

| Surface | When it shows | Assessment against the rule |
|---|---|---|
| Spend overview, `/dashboard-review/spend` | The approved organization has 0 records. This is the **post-login landing page**. | The whole dashboard is replaced by an invented region: €1.24 bn, «Molecola Alfa/Beta/Gamma», 1,876 unresolved rows, and invented review items. This is not one important metric filling a gap, and toy molecule names fail the realism test. **Recommend:** an empty state («Nessun dato caricato per la tua organizzazione» + «Carica i tuoi dati»). |
| Antibiotics, `/dashboard-review/antibiotici` | The organization has no rows in `antibiotic_consumption_fact`, or the table is missing. | AWaRe stewardship is highly important, but the fallback is a fictitious organization's full dataset (AWaRe split, 5 indicators, 7 units). It describes nobody, so no decision can rest on it. **Recommend:** an empty state. A possible later step is public regional OsMed context from Pillar A data, labelled as public data, not as the organization's own data. |
| Homepage widget («Un segnale, prima della dashboard») | Always, on the public homepage | It uses the same synthetic numbers as the antibiotics fallback. Real public data exists (Pillar A: AIFA, ISTAT), so the "real data unavailable" condition fails. **Recommend:** relabel now (A4, A5). Replace it with a real public series in a follow-up, or remove it. |
| Homepage modal mock-up (`demo-prompt.tsx`) | First visit, after 1.4 s | It shows «€29,7 mld», «21 regioni e province», «+5,9%», «91,4%», «73,8%». Provenance unknown: they were added on 1 Sep 2026, before the public data release. **Recommend:** source them or remove them. |
| Pillar C preview | Reviewers and admins only | The page is entirely invented («esempi inventati»), labelled «Dati illustrativi». It is not customer-facing. **Recommend:** keep it as is for now, with C1–C4, until Gate W. |
