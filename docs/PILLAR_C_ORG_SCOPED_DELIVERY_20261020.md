# Pillar C organisation-scoped delivery (recommendation 5)

Date: 2026-10-20. Owner decisions: 2026-10-19.

This document covers Pillar C recommendation 5: who sees what of Pillar C beyond the project reviewers, how the database enforces it, how it is switched on and off, and what must be approved before anything reaches production. It contains no workbook figures, row or object counts, email addresses or user identifiers. Those stay in the private Pillar C evidence repository.

**Status on 2026-10-20: designed, not live.**
- Migration `supabase/migrations/20261020120000_pillar_c_scoped_storage.sql` is not applied.
- Nothing is uploaded to the bucket `pillar-c-scoped`.
- No code for this delivery is deployed.

Production Pillar C still serves the reviewer view (service role, `pillar-c-review`) to reviewers and administrators, and only the public regional forecast to every other approved member.

## 1. Owner decisions (2026-10-19)

| ID | Decision, in summary |
|---|---|
| O1 | An Azienda user sees its own Azienda and the aggregate of the four Aziende («Aggregato delle quattro Aziende») as reviewers see it. It never sees another individual Azienda. The owner was told what subtraction discloses (§7) and accepted it, for Pillar C only. |
| O2 | Enforcement by database rules from the start: per-unit copies in a private Storage bucket, one SELECT policy on `storage.objects`, reads with the user's own session. The reviewer path keeps its existing application-level exception (service role, `REVIEWER_EMAILS`/`ADMIN_EMAILS`, bucket `pillar-c-review`), unchanged. |
| O3 | Regione delivery now. A Regione user (org 130, region 130) sees the aggregate («Aggregato regionale») and the four Aziende as ASL 1–4, under opaque keys. No province key and no real Azienda name appears in payloads, the DOM, URLs or export names. |
| O4 | Azienda users see their own published budget rows and the CO count scenario, each with a short visible note (modelled allocations; estimates). Modelled budgets are withheld from Azienda and Regione users. The Regione sees published rows only. |
| O5 | The aggregate's product rows are shown as reviewers see them, including the Pillar B biosimilar molecules. |
| O6 | No small-cell suppression in the aggregate. |

The full record is private. It holds the questions as they were put, the options and recommendations, what was explained and what remains open.

## 2. Roles

| Role | How it is identified | What it gets |
|---|---|---|
| Reviewer or administrator | An approved membership, and the session email on `REVIEWER_EMAILS` or `ADMIN_EMAILS` | Unchanged: the full reviewer view, read with the service role from `pillar-c-review`. This is the documented application-level exception. |
| Enabled Azienda user | Exactly one approved membership in an `asl` organisation 201–204 of region 130. Its organisation is switched on, and the user is on the allow-list (or the organisation is in `all` mode). | Its own Azienda under its real name, plus the four-Azienda aggregate (§3) |
| Enabled Regione user | Exactly one approved membership in organisation 130 (`regione`, region 130), switched on as above | The aggregate plus ASL 1–4 (§3) |
| Approved member without scoped delivery | Approved, but not switched on or not on the allow-list; or any other organisation or region; or any deployment other than production | Today's public regional forecast, with one line that depends on the reason (below) |
| Pending, rejected or revoked user; no membership; signed out | No approved membership | The access portal or the static «in preparazione» section. Every Pillar C API returns 403. |

The forecast-only line is chosen by reason (`C_FORECAST_ONLY_NOTES` and `cForecastOnlyNote` in `lib/dashboard-review/pillar-c/audience-rules.ts`):

| Reason | When | Line shown |
|---|---|---|
| `not_enabled`, `units_mismatch` | A member of one of the five organisations. The units function returns no unit (organisation not switched on, user not on the allow-list, or not exactly one approved membership), or units that are not exactly the organisation's entitlement. | «Le analisi di dettaglio di Pillar C per la tua organizzazione non sono ancora attive.» |
| `units_unavailable` | A member of one of the five organisations, when the units function cannot be called or answers malformed data (for example before the migration is applied) | «Le analisi di dettaglio non sono disponibili in questo momento.» |
| `unmapped`, `not_production` | Any other organisation, region or organisation type; and every non-reviewer on a preview, development or local deployment | «Le analisi di dettaglio di Pillar C non sono attive per la tua organizzazione.» |

An outage is never shown as «not active», and no line promises an activation that no decision covers.

Two further rules:
- **Production only.** Scoped delivery runs only on production deployments (`VERCEL_ENV === 'production'`). Preview, development and local runs treat every non-reviewer as forecast-only (the `not_production` line above), and tests use synthetic fixtures only.
- **The client cannot assert a role.** Nothing in the URL, the body or a header sets the organisation or the role.

## 3. Entitlement matrix

| Product | Reviewer | Regione | Azienda |
|---|---|---|---|
| Regional forecast (public AIFA data) | As today | Yes, as regional public context | Yes, as regional public context. It is never subtracted from, or scaled to, the Azienda. |
| Spend trend and baseline | All scopes | «Aggregato regionale» and ASL 1–4 | Own Azienda (real name) and «Aggregato delle quattro Aziende». The aggregate monthly series comes from explicit rows, never from summing in the browser. |
| Change bridge and decision panel | As today | Aggregate and ASL 1–4 | Own and aggregate |
| Budget against allocated spend | Published and modelled rows | Published rows only, with the modelled-allocation note. An Azienda without a published act shows an empty state. | Own published rows only, with the note. With no published act, an empty state. Never a modelled budget, and never the aggregate. |
| CO count scenario | As today | Aggregate and ASL 1–4, with the estimate note | Own and aggregate, with the estimate note |
| Portfolio dossier, change explanation, review-plan export | All scopes | Aggregate and ASL 1–4. Export labelled «Riservato alla Regione · dati delle quattro Aziende (ASL 1–4) e aggregato regionale». | Own and aggregate. Export labelled «Riservato a <nome dell'Azienda> · dati della propria Azienda e aggregato delle quattro Aziende». |
| Attribution uncertainty | As today | Aggregate and ASL 1–4; no evidence-queue link | Own and aggregate; no evidence-queue link |
| «Spazio scenari» (planning workspace) | Any scope | Its five scopes | Own and aggregate scopes; published acts from its own rows only |
| Price, quantity and mix decomposition | As today | Reviewer-only for now: a note, with no request and no link | Same as Regione |
| Evidence queue | Reviewers and administrators | Not rendered; API 403 | Not rendered; API 403 |
| Workbook index, sections, insight panels, explorer | As today | Not loaded; API 403 | Not loaded; API 403 |
| Lineage, receipts, workbook hash and ranges | As today | Never sent | Never sent |
| Raw objects through the Storage API with the user's own session | None. Reviewer reads use the service role. | Its five units only, while switched on | Its own unit and the aggregate unit only, while switched on |

Nowhere does the interface compute the aggregate minus an Azienda's own figures, show an «altre Aziende» series or rank Aziende.

## 4. Units and storage layout

- **Bucket.** `pillar-c-scoped`: private, 5 MiB per object, `application/json` only. It is created by the migration. The migration refuses to run if the bucket already holds any object.
- **Units.** Five folders under a build root: `asl-1`, `asl-2`, `asl-3`, `asl-4` (one per Azienda) and `aggregato` (the four-Azienda aggregate). The current root is `v1`. The policy accepts the root family `^v[1-9][0-9]{0,2}/`, so a re-key needs no new migration (§8).
- **Pseudonyms.**
  - Each Azienda's files are pseudonymised once, in the private builder. Organisation 201 is `asl-1`, … 204 is `asl-4`: the reviewed order of `REVIEWED_PSEUDONYMS` in `lib/analytics/org-pseudonym.ts`.
  - The aggregate's key is `aggregato`, the name of its unit, for every scoped audience. The private builder re-keys the reviewer's aggregate rows (`Regione`) to `aggregato`; apart from that key, the aggregate's attribution and portfolio files are byte-identical to the reviewer's. `Regione` stays the reviewer key only: every scoped route refuses it with 403 `forbidden_scope`, and the payload guard refuses it in any identifier.
  - The province keys are replaced by unit keys in the private builder. No scoped payload, unit name or object name carries a province key.
  - **Where the province map lives.** The map from province keys to ASL 1–4 exists only in the private builder and in reviewer-only application code (`lib/dashboard-review/pillar-c/reviewer-labels.ts` and the reviewer workspace). The page loads that code as a separate chunk, for reviewers only. The page's entry chunk, which every audience loads, carries no such map.
  - **Residual: the pseudonyms protect labels, not a secret** (review finding F-UI4-RES).
    - The reviewer chunk is a static file of the application. Scoped audiences never load it, but it is publicly fetchable: anyone who reads the client runtime's chunk list can download it by URL, signed in or not, and it contains the province-to-ASL map. The shared URL parsers in the entry chunk also list the province keys in ASL order.
    - ASL 1–4 follows the Region's official numbering of its four ASLs. Anyone who knows the Region can therefore reverse `asl-n` and «ASL n», with or without that chunk.
    - The pseudonym keeps province keys and place names out of identifiers, exports and screens. It does not hide which Azienda is which, and no part of this delivery relies on that being secret.
- **Who reads which units.**

  | Account | Units it reads |
  |---|---|
  | Azienda 20n | `asl-n` and `aggregato` |
  | Regione 130 | All five |

- **Object names.** Neutral: `<kind>[-<period>][-<channel>]-<sha256>.json`. The folder identifies the unit, so no object name carries an organisation key or a province token. The policy ignores any other name in the bucket.
- **Immutability.** Every object is addressed by its SHA-256. The application pins the hashes and checks every read against its pin. A new release means new objects and new pins.
- **Province tokens.** The rule «no province token in any identifier, key or object name» is checked over everything each audience can read: own unit plus aggregate for an Azienda, all five units for the Regione.

## 5. Enforcement

1. **Storage RLS.** One SELECT policy on `storage.objects`, for `authenticated`, for this bucket only.
   - A user may read an object only if its name matches the unit pattern, and its unit is one of the caller's units.
   - The caller's units are computed by `public.pillar_c_scoped_units()`. The function takes no argument, has a pinned `search_path` and can be executed by `authenticated` only.
   - It filters every read by `auth.uid()`, requires exactly one approved membership, then ANDs the result with the rollout tables (§6). It returns unit names only.
   - There is no INSERT, UPDATE or DELETE policy, so users cannot write to the bucket.
   - The same policy refuses the bucket's objects to the signing, copy and move operations, which Storage reports through `storage.operation()`. Download, HEAD, info and list stay allowed (§8).
   - The pre-existing `uploads` policies are fingerprinted before the migration runs. The migration refuses to run in any of these cases:
     - a storage policy differs from the reviewed fingerprint;
     - row level security is off on a storage table;
     - a storage listing function runs as its owner;
     - the bucket already holds objects.

     The private pre-check also fingerprints the storage function definitions.
2. **Session reads.**
   - The server reads with the request's own session client: `createClient().storage.from('pillar-c-scoped').download(path)`.
   - There is no service role and no process cache, so Storage RLS decides every read.
   - Paths are built only from pinned constants and validated keys.
   - **No other service-role path into the bucket.** Outside the reviewer path (the reviewer packets and the evidence queue), the one service-role Storage read in the application is the hospital-file upload processor, which reads from the `uploads` bucket at the path stored in the upload record. The adversarial review found that a client-chosen path with a dot segment (`../pillar-c-scoped/…`) left `uploads`: the read then reached other private buckets, and the processor's message told whether an object existed there. That path is now confined on the server, before the read. The fix shipped to production separately on 20 October 2026, in two parts: the application check in `lib/uploads/storage-path.ts` (with the upload shell writing only names that pass it) and the `public.uploads` INSERT policy of migration `20261020150000`. This delivery carries those files unchanged. The rule: it must name one file directly inside the caller's own organisation folder of `uploads`, so a dot segment, an encoded separator or a path into another bucket is refused.
3. **Routes.**
   - The organisation must be one of the audience's keys; otherwise 403 `forbidden_scope`. Malformed or repeated parameters give 400 `invalid_scope`.
   - An entitled unit whose object is missing or refused gives 503 `unavailable`, with the stable log code `PCS-ABSENT`, and the honest note «Le analisi di Pillar C per la tua organizzazione non sono disponibili in questo momento. Nessun valore viene sostituito.» It is never shown as «not entitled».
   - Responses are `private, no-store, max-age=0`, with `Vary: Cookie` and `nosniff`.
4. **Payload guard.** Every scoped response and page property is rebuilt from a closed allow-list of keys, then scanned field by field for foreign keys, province tokens and place names. Reviewer-only keys are refused.
5. **Interface.**
   - The audience is mandatory, and the reviewer branch passes an explicit reviewer audience. A component without one renders nothing and fetches nothing; it never falls back to the reviewer's options.
   - A tampered link falls back to the user's own default, with a visible note. That fallback is for usability only; the server enforces.

## 6. Rollout tables and kill switch

There is no environment switch. Two database tables decide who is enabled. Both start **empty**, so nothing is readable, even by an entitled member, until rows are added.

| Table | Row | Effect |
|---|---|---|
| `public.pillar_c_scoped_org_switch` | One per organisation (`201`–`204`, `130`), with mode `allowlist` or `all` | The organisation is switched on. In `allowlist` mode only its allow-listed users are enabled. In `all` mode every approved member is. |
| `public.pillar_c_scoped_user_allow` | One per (organisation, user) | That user is enabled while the organisation is in `allowlist` mode. In `all` mode the function ignores this table. |

- **Who can write them.** Both tables have RLS enabled and forced, and grant nothing to signed-in or anonymous users, who can neither read nor write them. Rows are written in the SQL editor, after the owner's approval. `docs/ACCESS_CONTROL.md` §8 has the statements.
- **Kill switch.** A deletion takes effect at the next statement, with no redeploy. What it turns off depends on the organisation's mode:
  - **Organisation switch row, either mode.** Deleting it turns the whole organisation off and removes its allow rows. This is the kill switch for an organisation in `all` mode.
  - **User allow row, `allowlist` mode.** Deleting it turns that user off.
  - **User allow row, `all` mode.** Deleting it does nothing: the user keeps reading. To stop one user of an `all`-mode organisation, revoke the membership. The only other stop is the organisation's switch row, which turns off everyone in it.
  - **Membership.** Revoking it in the Control Center turns the user off everywhere, in either mode.
- **Check after every deletion.** A rolled-back impersonation of the user (§8 of `docs/ACCESS_CONTROL.md`) must show that `public.pillar_c_scoped_units()` returns no unit.
- **Switching an organisation to `all`.** That is a separate release decision. It comes after the Pillar C figures pass Gate W acceptance, since they are still review-only and the portfolio mapping is a draft. It also needs the governance basis in §7.

## 7. What the aggregate discloses, and other residuals

The owner accepted these points (O1, O5, O6).

1. **Subtraction.** The aggregate minus an Azienda's own figures gives the other three Aziende combined. Where only one other Azienda dispenses a product, it gives that Azienda's exact figure. For rarely dispensed products this can approach patient-level information.
2. **Biosimilar molecules.** The aggregate includes the biosimilar molecules that Pillar B's regional comparator (PB-V5-01) deliberately withholds from Aziende. Pillar B is unchanged.
3. **Collusion and public data.** Any three Aziende pooling their own figures learn the fourth. The public AIFA regional series also approximates the regional total.
4. **The Region is named.** The regional forecast names the Region. It has done so for every approved member since 16 October 2026.

The Region's legal and governance basis for showing an Azienda these figures is recorded as an open point, to be settled before any real member is enabled.

Also recorded, though not an owner decision: anyone who knows the Region can reverse the ASL 1–4 pseudonyms (§4). They protect labels, not a secret.

## 8. Signed links, copies and offboarding

A user who is switched on can download its entitled objects directly through the Storage API with its own session, outside the application's labels and logs. Two other Storage operations could leave behind something a revoke does not reach:
- **Signed links.** Storage can create a signed link to an object the caller may read, with an expiry the caller chooses. It serves the link by its token, without RLS, until the link expires or the object is deleted, so the link would outlive a revoke.
- **Copies and moves.** A server-side copy places an entitled object elsewhere in Storage. A copy into the organisation's own `uploads` folder, for example, would be admitted by that bucket's upload policy, readable there by the organisation's other members, and untouched by a revoke.

**The policy refuses both.** Storage tells the database which operation each request performs (`storage.operation()`, for example `storage.object.sign`). The policy refuses this bucket's objects to the signing, copy and move operations, the S3 forms of copy included, and still allows download, HEAD, info and list. A switched-on user therefore cannot create a signed link or a Storage copy with its session, and a revoke ends every Storage read at the next statement.
- **Pending the live proof.** Production must show the refusal in the live checks before any real member is enabled. An entitled test account asks to sign one of its own objects (60 seconds at most) and tries to copy and move one inside the bucket. The private receipt records each outcome. If production allows any of them, the live phase stops and the re-key in step 2 applies. A copy into another bucket is not attempted live. For that case the evidence is the database harness (§10), the post-apply verification of the policy text, and the rolled-back impersonations, which read each member's objects under the copy and move operations and must find none.
- **The remaining residual is files already downloaded.** A file downloaded while the user was switched on cannot be recalled.

Offboarding procedure, for a test account or, once an organisation is in `all` mode, for any member who leaves:

1. **Stop session reads first.**
   - Revoke the membership in the Control Center. That works in either mode.
   - In `allowlist` mode, deleting the user's allow row also works. In `all` mode it does nothing (§6): revoke the membership, or delete the organisation's switch row if the whole organisation is to stop.
   - Confirm with a rolled-back impersonation that the user has no unit.
   - Storage checks the session token, not bans: a ban alone does not stop reads until the token expires.
2. **Re-key the bucket, only if a signed link or a Storage copy may exist**: the live proof failed, the policy has changed since, or there is any doubt. Build the same release under the next root (`v2`, …), upload it, verify it, and deploy the new pins. Then **delete every object under the old root**. Deleting an object invalidates every signed link to it, as long as object versioning is not enabled on the bucket. Never re-upload under an old root. A re-key does not reach a copy in another bucket, such as an organisation's `uploads` folder. Find such a copy there by the manifest's SHA-256 values and delete it.
3. **Accept that downloaded files stay.** Objects are uploaded with `cache-control: private, no-store, max-age=0`, so shared caches should hold no copy. A file already downloaded cannot be recalled.
4. **Record** the times privately.

A browser tab that is already open keeps what it has rendered until it is reloaded. Its later requests are refused.

## 9. Approval points

None of these is taken by an agent alone.

| Point | What the owner approves |
|---|---|
| AP0 | Read-only production checks: the pre-check fingerprints, the member inventory and the rolled-back impersonations. Also the wording of the CLAUDE.md and AGENTS.md §3/§4 changes and of the private contract amendments, before they are committed. |
| AP1 | Applying the migration in the SQL editor, as one transaction. Before it: the PGlite Storage RLS harness, an adversarial review, and a saved pre-check whose storage-function fingerprints show that every storage listing and search function runs as the caller. After it: the fingerprint verification, which must find the storage policies of the reviewed set and the storage functions identical to the pre-check. |
| AP2 | The upload, against the manifest hash. The owner runs the upload script, which asks for the service-role key with hidden input and verifies every object by SHA-256. Then come the default-off proof and the impersonation of every approved member of the five organisations, which must find no unit. |
| AP3 | The code deploy. The owner pushes; the reviewer regression follows. |
| AP4 | The live phase. Approve the test accounts, then insert rollout rows for the two enabled test accounts only. Every other approved member of those organisations must still find no unit. |
| AP5 | Cleanup: rollout rows deleted, test memberships revoked, pending requests rejected, test users deleted. |

There are three test accounts:
- Azienda 204, enabled;
- Regione 130, enabled;
- Azienda 202, approved and never enabled, as the negative test.

All three stay pending until just before the live phase. None of the addresses is ever on `REVIEWER_EMAILS` or `ADMIN_EMAILS`, and each holds one membership.

## 10. Verification

- **Database.** A PGlite harness reproduces the Supabase Storage tables and roles. It applies the migration verbatim and exercises every Storage operation as the storage server issues it, with the operation name Storage reports: download, HEAD, info, sign, list, upload, upsert, move, delete and copy, including a copy of an entitled object into the caller's own `uploads` folder, which only the policy's operation term refuses. It runs them for every identity type, for adversarial object names and for rollout changes, and a set of SQL mutants must each fail at least one assertion. The harness lives outside CI. Its local run is recorded, and production relies on the rolled-back impersonations and the live checks.
  - **What the harness does not prove.** Its storage list and search functions (`storage.search` and `storage.list_objects_with_delimiter`) were **reconstructed** from the open-source Storage server (storage-api), as SECURITY INVOKER functions over `storage.objects`. They were not captured from production, which this step was not permitted to read. Newer functions such as `storage.search_v2`, and the `storage.prefixes` triggers, are not emulated.
  - **What production checks instead.** The private pre-check fingerprints every live storage function: whether it runs as its owner, and the md5 of its definition. The migration refuses to run if a storage listing or search function runs as its owner. After the apply, the verification must find the same fingerprints. Those checks show that the live listing and search functions run under the caller's RLS, and that the migration changed no storage function. They do not show that the live bodies equal the reconstruction. Listing and search are therefore exercised directly in the live phase, as each test account.
- **Application.** Tests on synthetic fixtures cover:
  - the audience decision;
  - session-only reads with no cache;
  - the distinction between `unavailable` and `denied`;
  - the payload guard (including product labels that contain a two-letter token);
  - the route matrix;
  - page properties per audience, with the reviewer properties pinned unchanged;
  - the interface (mandatory audience, notes, export labels, tampered links);
  - source pins that forbid cache primitives and the service role on the scoped path.
- **Live.** A private checklist covers each test account. It sets out the expected units, the status of every route, the fields that must be absent, direct Storage attempts (own, peer, list, search, signing a peer object, signing an own object for 60 seconds at most, copying and moving an own object, public URL, write attempts), the rollback and kill-switch test, and cleanup. Receipts record statuses, booleans and hashes only.

## 11. Not part of this delivery

- The workbook sections, the evidence queue and the price, quantity and mix decomposition for non-reviewers.
- Modelled budgets for non-reviewers.
- Any Azienda-facing comparator product. Its disclosure rules (at least three contributors, no differencing) stay binding.
- Any other Region. The policy pins region 130 and its five organisations; another Region needs its own reviewed migration and owner decision.
- Any change to Pillar A or Pillar B.
