# Action loop for findings

Pack priority 2: "Extend the action loop beyond attribution". It covers who owns each finding, what they decided and the outcome, for biosimilar and benchmark findings, with notifications.

## Owner decisions, 29 Oct 2026

| Question | Answer |
|---|---|
| Which findings first | Biosimilar and benchmark |
| Who acts | The reviewer or admin assigns the case; an approved member of the Azienda owns it |
| Notifications | An email when a case is assigned, and a reminder when its due date passes |

## What a case is

A case starts from one finding about **one Azienda** in the active release.

| Kind | Finding | Offered when |
|---|---|---|
| Biosimilar | Reference spend in the months after the first local biosimilar of a substance, 2024–2025, all channels (the Pillar B review queue; not a saving) | The page itself would show that Azienda's queue: the bridge reconciles with the perimeter facet and no row is a net credit. At most five substances per Azienda, by euros. |
| Benchmark | The Azienda's unit-cost index: its spend against what the cohort pays for its own product mix (100 = the cohort's price) | Index above 100, resting on at least half the Azienda's spend |

The case freezes the finding as it was when it was opened: release, Azienda, subject and figure. Its identity is the SHA-256 of kind, release, Azienda and subject. The database checks it, so opening the same finding again returns the same case, and a new release makes a new finding.

## Lifecycle and who acts

| State | Reviewer or admin | Owner (an approved member of the Azienda) |
|---|---|---|
| Da assegnare | Assign the case: owner and due date | — |
| Assegnato | Reassign, or take the case on | Take the case on |
| In esame | Reassign, or record the decision | Record the decision |
| Decisione registrata | Revise the decision, or close with the outcome | Revise the decision, or close with the outcome |
| Chiuso | Reopen, with a reason | — |

- **Decisions:** action decided; no action, with a reason; data to verify; already addressed.
- **Closing:** needs an outcome and a decision recorded in the current cycle.
- **Reopening:** keeps the earlier decision and outcome in the history, and needs a new decision and outcome.

## Who sees what

- **Reviewer and admin:** every case, plus the findings of the active release.
- **A member:** the cases about their own Azienda, but only once someone in that Azienda owns them.
- **Internal triage:** a reviewer or admin may hold a case themselves, for example before the Azienda has an account. The Azienda does not see such a case.
- **Acting on a case:** only its owner, among the members, acts on it; colleagues in the same Azienda can read it.

## Privacy

- **No session reads a table:** row-level security is forced, there are no policies and no grants to signed-in users. The server checks the live session and the rules above (`lib/dashboard-review/actions/model.ts`), then writes through audited functions with the service role. This is the same model as the Pillar C evidence queue.
- **Benchmark findings carry only the unit-cost index and its coverage.** The spend index is left out on purpose: with the Azienda's own spend, it would reveal the peers' median spend.
- **Emails carry the title and the due date only**, never a figure. The figures stay behind the sign-in.
- **History is append only:** every change is one revision with its audit event, and the reminders are recorded apart from the case.

## Setup

1. **Migration:** `supabase/migrations/20261029200000_finding_action_loop.sql`, applied in the SQL editor on the owner's explicit approval. Until it is applied, the page says the register is not active yet.
2. **Email:** `RESEND_API_KEY` and `VIS_EMAIL_FROM`, already used for the access emails. Without them a case is still assigned, and the workspace says that no email went out.
3. **Reminders:**
   - Set `CRON_SECRET` in Vercel (16 characters or more).
   - `vercel.json` runs `/api/findings/reminders` daily at 06:00 UTC.
   - Each run sends at most one reminder per case, due date and owner.
   - Without the secret, the route does nothing.

## Limits

- No Azienda account exists yet, so for now cases can only be held in internal triage. Assigning to an Azienda needs its first approved member.
- Biosimilar findings are read on all channels for 2024–2025. A case does not follow the filters a reviewer has on the Pillar B page.
- **Benchmark coverage:** this release yields benchmark findings only for Aziende whose index is above 100 on at least half their spend.

## Tests

- `tests/finding-action-loop-sql.test.mjs` runs on real PostgreSQL (PGlite) and covers:
  - grants and RLS;
  - source validation and identity;
  - the full lifecycle with reopening;
  - append-only history and audited revisions;
  - reminder claims.
- `tests/finding-action-loop.test.mjs` covers:
  - visibility and the steps allowed to each viewer;
  - which candidates are offered;
  - figure-free titles and emails;
  - due dates;
  - the order of the route gates;
  - the reminder secret;
  - the page and its navigation entry.
