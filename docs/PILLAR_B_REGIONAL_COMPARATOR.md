# Pillar B — the regional comparator for an ordinary Azienda (PB-V5-01)

Status: **implemented and reviewed locally, not applied to production.** The
migration `supabase/migrations/20261009120000_pillar_b_regional_comparator.sql`
is a security change and is applied only with the owner's explicit approval.
Until then the page says "Il confronto con la Regione non è ancora
disponibile." and shows nothing regional to an Azienda account.

This document holds no figure from the private workbook. The reconciled values
are in the private evidence logs (`outputs/pillar-b/logs/b49`, `b50`).

## 1. The decision (owner, 9 October 2026)

| Account | Sees | How |
| --- | --- | --- |
| Ordinary Azienda | Its own analysis, plus a **pooled aggregate of its own Region** | Its own rows under RLS; the Region through one aggregate-only database function |
| Regione | Its Region's Aziende | RLS over the Region (unchanged) |
| Platform reviewer | Every authorised Azienda and Region | The server's reviewer path (unchanged) |
| Anonymous | Nothing | Refused |

An Azienda never receives another Azienda's rows, codes, names or individual
figures, nor anything of another Region. `canonical_fact`'s RLS policy is
unchanged: an Azienda reading the table directly, or through any existing
function, still sees its own rows only.

## 2. The function

`public.pillar_b_regional_comparator(p_years int[]) returns jsonb`

* `SECURITY DEFINER`, `STABLE`, `set search_path = pg_catalog, pg_temp`. Built-in
  names resolve first and the session's temporary schema last. Left out of the
  path, PostgreSQL would search the temporary schema *first* for table and type
  names. Every relation is schema-qualified.
* The active release is read here, directly from
  `public.pillar_b_active_release`, and must be exactly one. The function does
  not call `pillar_b_release()`: that function carries its own
  `search_path = public`, and a session temporary table of the same name
  redirects it. The harness demonstrates this.
* No temporary table; one statement after the checks.
* `EXECUTE` granted to `authenticated` only. `PUBLIC`, `anon` and
  `service_role` are revoked. The reviewer's service-role client therefore
  cannot call it; an Azienda page calls it with the Azienda's own session.
* **No organisation, Region or user argument.** The caller is `auth.uid()`.
  Its Azienda and Region come from its single approved membership in
  `user_organizations` / `organizations`, read inside the database. A forged
  argument (peer, Region, user, channel, molecule) does not match the
  signature, and PostgreSQL refuses the call.
* **Every row is attributed to one registered Azienda of the Region.** A row's
  `asl_code` may be either form the RLS policy accepts: `region || org` or the
  bare `org`. Both forms of one Azienda count as that Azienda, once. If any row
  of the Region in the release has no code, a code no organisation owns, or a
  code two organisations could claim, the answer is `unresolved_rows` and
  nothing is computed. Otherwise such a row would enter the totals unchecked,
  or count as an extra "other Azienda" and unlock a figure the rule withholds.
* **Every row of the Region carries channel CO, DD or DPC**, or the answer is
  `unexpected_channel`. The quotas count every channel and the mix these three,
  as the Azienda's own figures do. A fourth channel would split the two, and
  "mix spend minus quota-1 denominator" would become a quantity the rule does
  not check. The real release has only these three channels.
* The only choice is the set of years, from 2024 and 2025. 2026 is partial and
  refused.
* It returns percentages only:

```json
{ "status": "ok", "years": [2024, 2025],
  "uptake": { "quota1": { "available": true, "reason": null, "share": 0.0 },
              "quota2": { "available": false, "reason": "cell_rule", "share": null } },
  "channel_mix": [ { "year": 2024, "available": true, "reason": null,
                     "shares": { "CO": 0.0, "DD": 0.0, "DPC": 0.0 } } ] }
```

There is no amount, no row, no per-Azienda group, no code or name, and no count
of contributing Aziende. Reasons are `cell_rule` (the disclosure rule) and
`not_computable` (a denominator that is zero or negative, or a share outside
0–100% because of credit notes). Other statuses:

* `no_session`
* `no_membership`
* `ambiguous_membership` (two approved memberships; the schema already forbids it)
* `not_an_azienda` (a Regione)
* `no_region`
* `invalid_filter`
* `no_release` (the release gate is off; nothing is computed)
* `unresolved_rows`
* `unexpected_channel`

## 3. The measures

Defined exactly as the page defines the Azienda's own figures when no channel or
molecule filter is set.

| Measure | Definition |
| --- | --- |
| Quota 1 | Biosimilar spend in date-valid months ÷ biosimilar + reference spend in the same months, summed over every Azienda of the Region and the three channels. |
| Quota 2 | The same, over the months from the first local biosimilar dispensing. "First" is **each Azienda's own** first use of the substance: the clock its own quota 2 uses, read over its full history and every channel. The results are then summed. |
| Channel mix | The share of CO, DD and DPC in the Region's reported spend in the year. |

* **Pooled:** summed numerators over summed denominators, never the mean of
  Azienda percentages.
* **Inclusive:** the Region includes the caller's own Azienda.
* **Like-for-like:** the four Aziende's own figures, each read as itself under
  RLS and summed, equal the regional quotas exactly (b49, third oracle).
* **Not the Regione's quota 2:** the regional quota 2 shown to an Azienda is not
  the quota 2 a Regione account sees for its Region, which counts from the first
  use by any Azienda. The page labels it "Regione, ciascuna Azienda dal proprio
  primo uso" and says so. An Azienda that never dispensed a biosimilar of a
  substance does not enter the regional quota 2 for that substance, exactly as
  in its own quota 2.
* **Separate from composition:** the channel mix (a composition of reported
  spend) stays separate from the two uptake measures.

## 4. Why the scope is fixed

The caller knows its own amounts exactly, so every answered ratio is a linear
equation in the other Aziende's sums. While every part has two or more
contributors, ratios alone fix no amount, because they do not change when the
whole Region is scaled. Two things can fix the scale:
* one outside figure, such as a published regional total;
* a part that is zero for every other Azienda (the zero exceptions of §5). The
  caller's own amount then pins it.

An earlier draft let the caller pick any subset of channels. With every
denominator known, its answers determined each channel's part of every measure,
and their differences. Quota 1 minus quota 2 per channel, for instance, gives
the reference spend before first use, which can belong to a single Azienda. No
rule had checked those differences.

The function therefore has a **fixed, coarse scope**: CO, DD and DPC together,
the whole biosimilar perimeter, no molecule, years only. With every denominator
known, its answers determine only per-year parts and per-(year, channel) spend,
and the rule below checks every one of them. The harness proves both statements
by rank (b49 §D).

On the page, a channel or molecule filter hides the regional comparator, with
the sentence "Il confronto con la Regione è mostrato solo senza filtri di
canale o di molecola…".

## 5. The disclosure rule

A part **passes** when, over the Aziende **other than the caller**:

1. at least **two** have a positive amount;
2. **none** has a negative amount;
3. the largest is **at most 75%** of their total. This is a p%-rule with
   p = 1/3: the others hide the largest by at least a third of it.

The parts, per selected year (the uptake shares span the three channels):

| Part | What it is | Checked for |
| --- | --- | --- |
| W_bio, W_ref | biosimilar / reference spend in each Azienda's quota-2 window | quota 2 |
| Q1_bio, Q1_ref | the same over all date-valid months | quota 1 |
| P_bio, P_ref | Q1 − W: date-valid spend before the Azienda's own first use | quota 2 (blocks quota 1 − quota 2) |
| Rest | reported spend outside Q1 | quota 1 and quota 2 (blocks spend − quota) |

The channel mix adds one part: the reported spend per selected (year, channel)
of CO, DD and DPC, since each share is one channel's spend.

* **Quotas.** Each quota is answered only when all its parts pass in every
  selected year. Otherwise it is **"non disponibile"**: `null` with a reason,
  never zero. A measure part that is zero for every other Azienda (say, no
  biosimilar at all among them) does not pass.
* **The zero exception.** P_bio, P_ref and Rest are differences, not measures.
  They also pass when they are exactly zero for every other Azienda, since then
  there is nothing to expose. So does a mix channel that no other Azienda uses,
  provided at least one channel of the year passes on (1)–(3).
* **The channel mix of a year** is answered only when all three channels pass.
  One failing channel withholds the whole year, because the other shares would
  imply it.
* **Closure.** A two-year answer is a sum of passing parts, and passes too. The
  largest of a sum is at most the sum of the largest, so (3) is closed under
  addition, and so are (1) and (2).
* **Pairing on the page.** The database answers each quota on its own parts.
  The page shows the two regional quotas **together or not at all**, as it does
  the Azienda's own ("Le due quote si leggono solo insieme"). When one is
  withheld, both cards say why.

## 6. On the page

* **Quota cards (Azienda account only).**
  * The Azienda's own figure is labelled "La tua Azienda".
  * Below it: "Regione: x%" on the quota 1 card, and "Regione, ciascuna Azienda
    dal proprio primo uso: y%" on the quota 2 card. Otherwise, the reason it is
    withheld.
  * One sentence below the pair states the method:
    * the reader's Azienda is included;
    * pooled sums, not a mean;
    * same years, all channels, whole perimeter;
    * quota 2 on each Azienda's own first use, not the Regione's quota 2;
    * a gap from the Region can come from the molecule mix and is not a better
      or worse result;
    * of the Region, shares only.
  * With no regional value drawn (not yet deployed, a filter, a failed read),
    no sentence on the page speaks of one.
  * The quota 2 card's "Mesi contati" and the gap sentence speak of "la tua
    Azienda".
* **Channel mix.**
  * Under each year's bar for the Azienda, a share-only bar for the Region, or a
    line saying why not.
  * The exact-value table adds a "Quota Regione" column, with no amount column.
  * An Azienda with no spend in the selection gets its own empty card, with no
    comparison described.
* **National context.** A separate, dashed card after the value-uptake section,
  the same for every role. It carries no figure and links to the public AIFA
  data on the public Pillar B page (§9).
* **Failure isolation.**
  * A function not yet deployed, a failed call, an unresolved Region or an
    unexpected answer shape removes only the regional lines, with a sentence.
    The rest of the page is unaffected.
  * The answer is parsed strictly. Any of these makes the whole answer "non
    disponibile":
    * an unexpected key at any level;
    * a numeric string;
    * a share outside 0–1;
    * channel shares not summing to 100%;
    * an answered share carrying a reason;
    * an unknown reason or status;
    * years other than those asked.
* **Regione and reviewer views are unchanged.** They keep their own
  amount-bearing regional comparator (`pillar_b_facets` under RLS or the
  reviewer path) and never call this function. Their quota cards show the
  Region's own quota 2, on the Region-wide clock, when no Azienda is selected.

## 7. Evidence (local, frozen release, not production)

| Run | What | Result |
| --- | --- | --- |
| `outputs/pillar-b/logs/b49_regional_comparator.mjs` | See the breakdown below | 117 / 117 |
| `outputs/pillar-b/logs/b50_regional_render.mjs` | See the breakdown below | 14 / 14 |
| `tests/pillar-b-regional-comparator.test.mjs` | See the breakdown below | 18 / 18 |

**b49 covers:**

* **Reconciliation.** Every answer as Aziende 201–204 for 2024, 2025 and
  2024+2025, against three oracles:
  * direct SQL;
  * the scoped function per Azienda and channel;
  * the page's own path, each Azienda read as itself under RLS and summed.
* **Access.**
  * Regione, reviewer (service_role), anonymous, no subject.
  * Pending, revoked and two memberships; another Region.
  * Seven forged parameters, invalid years, the release gate off.
  * A temporary-table release hijack.
  * RLS and table grants unchanged; privileges; the payload whitelist.
* **Synthetic Regions.** 21 of them, one per withholding, attribution or
  channel path. Every answer from two seats is checked against an independent
  model.
* **The rank test of §4.**

**b50 covers** the shipped components rendered for each Azienda and year set,
with its own RLS reads and the function's answer:

* the regional quota 1, quota 2 and channel shares equal the reconciled values;
* the comparator adds only the Region's shares;
* no peer code, name, percentage or amount appears, and no regional amount.

**A second, independent verification round** checked each review finding
against the fixed code, with three verifiers and a skeptic per new finding. It
found the latent fourth-channel gap (now closed by `unexpected_channel`) and
the copy points below, and caught all seven deliberate SQL mutants it ran
through b49.

**The unit tests cover:**

* when the page asks;
* strict parsing;
* pairing;
* statuses;
* the copy rules over every sentence the module can render: "tu", no internal
  words, no national figure, no ranking;
* source pins (session client, isolated failure, years-only call,
  `pg_catalog, pg_temp`, no `pillar_b_release()`, attribution);
* static renders of both components, including the empty, withheld and
  note-only cases and a year without the Azienda's own bar;
* the national-context card: no figure, the source by its title, the link.

## 8. Limits

* **Collusion.** The rule protects each Azienda against any one other Azienda.
  Two Aziende pooling their own figures can learn more about the remaining ones.
* **What the rule still allows.** With the scale fixed (§4), the caller can
  determine the parts the rule checks. It never determines a single other
  Azienda's amount, but it can bound one: the largest other Azienda holds at
  most 75% of a part it can compute. That is the p%-rule's design margin.
* **A withheld answer is itself visible.** "Non disponibile" for a year or a
  part tells the Azienda that, there, fewer than two other Aziende contribute,
  one prevails, or one has negative adjusted amounts. The page says exactly
  this.
* **Successive releases.** A new release changes the inputs. The difference
  between two releases' answers is not itself checked by the rule. Releases
  are frozen and infrequent; a corrected release should be reviewed with this in
  mind.
* **Mixed-sign combinations.** The rule covers the parts and their sums. A
  difference between parts of different kinds (say one channel's spend minus a
  year's Rest) is not a determined quantity from the answers alone. It could
  isolate a single Azienda only with outside knowledge that some cells are
  zero (for example, that the other Aziende have no perimeter spend in a
  channel), or when several Aziende's values cancel exactly. That case is not
  modelled.
* **Public side information.** AIFA publishes per-molecule regional shares on a
  different flow (§9). They were considered. An Azienda cannot combine them with
  the comparator into exact equations: the comparator has no molecule, and the
  flows differ. Nothing is published by the platform in euro.
* **Selections.** There is no regional figure under a channel or molecule
  filter, or for 2026.
* **Not in CI.** The database behaviour is exercised by b49/b50 on PGlite,
  outside `npm test`. The repository has no in-process Postgres, and the unit
  tests pin the source and the rendering.

## 9. National figures

The rule: a national figure may be shown only when an independently verified
public source matches the measure, unit and price basis, denominator, channel,
molecules, period and population. Otherwise it is public context, kept
separate.

Source register:

| Source | Year | Channel / flow | Molecules | Measure | Denominator |
| --- | --- | --- | --- | --- | --- |
| AIFA biosimilar monitoring, report 5 "FocusForme EV/SC" (compiled in this repo, shown on `/pillar-b`) | 2025 (Jan–Dec); 2024 edition exists, not compiled | Acquisti diretti, NSIS Tracciabilità: sell-in to public structures; CO, DD, DPC not separable | infliximab, rituximab, trastuzumab | % split of traceability value (and packs, DDD) into originator / biosimilar × EV / SC; price basis not stated | the molecule's whole traceability value in the territory |
| AIFA biosimilar monitoring, report 2 "Variabilità regionale" | 2024, 2025 | Acquisti diretti, Tracciabilità | 24 groups, several are classes; no aflibercept, denosumab, golimumab, omalizumab | biosimilar incidence in **packs**; average price per pack | all packs of the group, classes including other products |
| AIFA report 6 "Stima del risparmio" | 2025 | Tracciabilità | as report 2 | counterfactual savings in euro | none; not an uptake measure, excluded |
| AIFA report 4 "Trend del costo medio per DDD" | 2017–2025 | convenzionata vs ospedaliero; no CO/DD/DPC split | categories | % of DDD by channel; cost per DDD | the category's DDD |
| Rapporto OsMed 2025, biologici a brevetto scaduto | 2025 | Tracciabilità + convenzionata | groups, including "Altro" products | spend incidence per group, national | the group's spend, including "Altro" |
| AIFA open data (spesa e consumi per regione, mese, ATC) | 2016–2025 | Tracciabilità (DD and DPC included, not split) + convenzionata | ATC level; cannot separate biosimilar from originator | spend and packs | none |

**Verdict: no national figure is a like-for-like comparator for any Pillar B
measure.**

* **Pooled quota 1:** nothing matches. No source publishes a pooled value share
  over this perimeter.
* **Quota 1 for a single substance at Regione scope:** this is the nearest case,
  against report 5 for its three molecules. Five of seven conditions match, but
  two fail:
  * the flow differs: Tracciabilità sell-in, against CO/DD/DPC dispensing;
  * report 5 does not state its price basis.
* **Quota 2:** cannot match by construction. Its window starts at a local first
  use.
* **Channel mix:** no source splits CO/DD/DPC.

The page therefore shows a **separately labelled national-context card with no
figure**. It names the source, says why it is not on the same scale, and links
to the public AIFA data already compiled and shown on `/pillar-b`.

**Open questions for the owner:**

* the price-basis wording of the private euro;
* a reviewer-only reconciliation of the Regione-level per-substance quota 1
  against report 5 (it would only corroborate);
* compiling the 2024 edition of report 5;
* re-reading the replaced OsMed 2025 PDF;
* whether the context card should appear for Azienda accounts. It does now: it
  carries no figure.

## 10. Applying it to production (with approval only)

1. **Pre-check** in the SQL editor of the production project:
   * the function does not exist;
   * exactly one active release;
   * `user_organizations_one_approved_per_user` exists;
   * **every `asl_code` of the active release resolves to exactly one
     registered Azienda of its Region** (otherwise every Azienda would get
     `unresolved_rows`);
   * every row of the active release carries channel CO, DD or DPC (otherwise
     `unexpected_channel`);
   * fingerprints of the `canonical_fact` policies and grants.
2. **Apply** the migration file as one transaction.
3. **Verify:**
   * one function of that name with argument `p_years integer[]`;
   * `prosecdef`, `proconfig = {"search_path=pg_catalog, pg_temp"}`;
   * `has_function_privilege` true for `authenticated`, false for `anon` and
     `service_role`;
   * `canonical_fact` policy and grant fingerprints unchanged;
   * as one approved Azienda user, inside a rolled-back transaction, the
     answer's quota 1 equals direct SQL for its Region.
4. **Live checks** with real sessions:
   * an Azienda account: regional lines present, method sentence, no peer
     name;
   * a Regione account: unchanged, no call;
   * the reviewer: unchanged, no call.
