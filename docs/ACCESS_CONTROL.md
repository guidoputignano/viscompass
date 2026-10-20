# Access Control Center

VIS PHARMA COMPASS separates authentication from authorization:

- Supabase Auth proves who the person is.
- `user_organizations` defines the single regional or ASL data perimeter the person can access.
- The Control Center lets an allow-listed administrator approve applications, send invitations,
  revoke access, and inspect recent decisions.

The browser never receives the Supabase service-role key. Applicant writes use narrow database
functions and all administrative writes re-check the authenticated administrator email on the
server before using the service-role client.

## 1. Apply the database migrations

There are two separate files in `supabase/migrations`. Run them in this order in the Supabase SQL
editor, or apply them through the Supabase CLI:

```text
1. 20260831224500_access_control_center.sql — original Control Center and organization access
2. 20260902120000_antibiotic_analytics_and_consents.sql — antibiotic analytics and consent audit
```

If the Control Center already works at `/admin/control-center`, migration 1 has already been applied
and does not need to be rerun. The September 2 migration is the new file added with the antibiotic
and registration-consent update.

After running both, this verification query should return non-null table names and the three new
antibiotic columns:

```sql
select
  to_regclass('public.user_organizations') as user_organizations,
  to_regclass('public.organization_invitations') as organization_invitations,
  to_regclass('public.communication_consents') as communication_consents;

select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'antibiotic_consumption_fact'
  and column_name in ('population', 'unit_name', 'period_status')
order by column_name;
```

The migration adds:

- application metadata and decision audit fields to `user_organizations`;
- one-active-organization enforcement;
- `organization_invitations`, including expiry, delivery and response state;
- authenticated functions for applying and accepting/declining invitations;
- service-role-only transactional functions for approvals and revocations;
- recipient-only Row Level Security for invitation inboxes.
- separate VIS and partner communication-consent audit fields;
- population, unit labels and period status for AWaRe analytics.

Before applying it, resolve any user who already has more than one `approved` membership. The new
partial unique index deliberately rejects that ambiguous state.

## 2. Confirm the organization directory

`organizations` must contain the regions and ASLs that applicants can select. Do not invent codes:
use the exact codes present in the loaded facts and NSIS/AIFA source conventions.

Example only:

```sql
select org_code, org_name, org_type, region_code
from public.organizations
order by org_type desc, org_name;
```

If this query returns no rows, seed the directory before opening applications.

## 3. Configure Vercel environment variables

Set these on the Vercel project for **Production**. Add them to Preview only when a separate preview
deployment is deliberately being tested:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
ADMIN_EMAILS
NEXT_PUBLIC_SITE_URL
RESEND_API_KEY
VIS_EMAIL_FROM
VIS_EMAIL_REPLY_TO
```

`ADMIN_EMAILS` is a comma-separated allow-list, for example:

```text
owner@example.com,regional.admin@example.it
```

The first administrator does not need an approved organization membership to open
`/admin/control-center`; they do need a confirmed Supabase account whose email appears in
`ADMIN_EMAILS`.

Never prefix the service-role key with `NEXT_PUBLIC_`, commit it, or place it in client-side code.

### Add the VIS Resend variables

1. In Resend, open **Domains → Add Domain**, add `eurekene.com`, copy the generated SPF and DKIM
   records into the domain's DNS provider, then wait until Resend shows **Verified**.
2. Open **API Keys → Create API Key**. Name it `VIS Pharma Compass Production`, choose
   **Sending access**, and restrict it to `eurekene.com`. Copy the `re_...` value immediately;
   Resend displays it only once.
3. In Vercel, open the VIS project and go to **Settings → Environment Variables**. Add each variable
   separately and select **Production**:

```text
RESEND_API_KEY = re_...                       # the secret copied from Resend
VIS_EMAIL_FROM = VIS Pharma Compass <access@eurekene.com>
VIS_EMAIL_REPLY_TO = an inbox that your team actually monitors
NEXT_PUBLIC_SITE_URL = https://www.eurekene.com
```

4. Save the variables, then open **Deployments**, select the latest production deployment and choose
   **Redeploy**. Vercel environment changes apply only to a new deployment.

Never paste the API key into chat, source code, `.env.example`, or GitHub. Registration and
access-control writes remain successful if email delivery is temporarily unavailable.

## 4. Configure Supabase authentication URLs

In **Authentication → URL Configuration**, set the canonical Site URL and allow the callback URLs
used by local development and Vercel. For preview deployments, Supabase supports a Vercel wildcard
pattern such as:

```text
http://localhost:3000/**
https://*-guidoputignanos-projects.vercel.app/**
```

Also add the final production domain explicitly before production launch.

## 5. Configure invitation email delivery

New users receive Supabase's invitation email. Existing users receive a passwordless sign-in email
and then see the invitation in their in-app inbox. Customize the **Invite user** and **Magic Link**
templates in Supabase so both clearly identify VIS PHARMA COMPASS and the expected action.

For reliable external delivery, configure **Authentication → Email → SMTP Settings** in Supabase
with the dedicated VIS Resend SMTP credentials and the verified VIS sender domain. This makes the
actual account-confirmation, passwordless-login and invitation messages use the VIS sender; the
application's status notifications use the Resend API variables above.
The Control Center records `email_sent` or `failed`; failed invitations can be retried without
creating a second active invitation.

## 6. Operational workflow

1. A person registers and confirms their email.
2. They select an organization and submit their professional role and reason for access.
3. An administrator reviews the application in `/admin/control-center`.
4. Approval creates the only active organizational scope; rejection preserves the decision note.
5. Alternatively, an administrator sends an invitation. The recipient accepts or declines it in
   their invitation inbox.
6. Revocation immediately removes the `approved` status used by every data RLS policy.

The two registration communication choices are independent, optional and unchecked by default.
The current value is stored in `communication_consents`, while the initial registration metadata
provides a recovery trail if the database migration has not yet been applied.

## 7. Antibiotic data loading

When no RLS-visible antibiotic rows exist, the dashboard shows an empty state with a link to the
data page. Until 13 October 2026 it showed a synthetic organization instead; that fallback was
removed under the owner's rule that synthesized data never stands in for an organization's own
figures. Once authorized rows exist, the page shows them.

After applying the 2026-09-02 migration, load the provided workbook with the server-only service
role key:

```text
node load_antibiotic_consumption.mjs "path/to/Dati_Analisi_v02.xlsm"
```

The loader imports 2023–2025 ASL and confirmed ASL 203 unit-level AWaRe rows, population and hospital
day denominators, and marks the annual periods complete. Run with `--dry-run` first when validating
a revised workbook.

Vercel Deployment Protection is separate from this workflow. It controls who can open a preview
URL; the Control Center controls what an authenticated person can see inside VIS PHARMA COMPASS.

## 8. Pillar C organisation-scoped delivery

Status on 2026-10-20: designed, not live. The migration
`20261020120000_pillar_c_scoped_storage.sql` is not applied, the bucket `pillar-c-scoped` holds
nothing and no code for it is deployed. The design, roles, entitlement matrix and residual risks
are in `docs/PILLAR_C_ORG_SCOPED_DELIVERY_20261020.md`, following the owner decisions of
2026-10-19.

### How it is enforced

- **Policy and function.** Database rules decide what an Azienda or Regione user may read in
  Pillar C:
  - one SELECT policy on `storage.objects` for the private bucket `pillar-c-scoped`;
  - the function `public.pillar_c_scoped_units()`, which takes no argument and derives the caller's
    units from `auth.uid()` and its single approved membership;
  - the two rollout tables below. No user session can read or write them.
- **Who reads which units.** An Azienda 20n reads its own unit `asl-n` and the aggregate unit
  `aggregato`. The Regione 130 reads all five units.
- **Read, never sign, copy or move.** The policy allows download, HEAD, info and list. It refuses
  the bucket's objects to the signing, copy and move operations, which Storage reports through
  `storage.operation()`. The live check must still prove this in production.
- **Session reads.** The server reads with the user's own session, never with the service role,
  and caches nothing.
- **Reviewer path.** Reviewers and administrators keep the existing application-level path: the
  service role, the bucket `pillar-c-review`, and `REVIEWER_EMAILS`/`ADMIN_EMAILS`. It is
  unchanged.
- **No environment variable.** Nothing needs to be set in Vercel to enable this delivery. The code
  runs it only on Production deployments (`VERCEL_ENV`); Preview and Development treat every
  non-reviewer as forecast-only.

### Enabling and disabling (SQL editor, owner approval only)

Both rollout tables start empty, which means off for everyone. Write them only in the Supabase SQL
editor, one transaction at a time, and only after the owner has approved the specific change.
Never put user identifiers or email addresses in a repository file.

Enable one user of one organisation (allow-list mode):

```sql
begin;
insert into public.pillar_c_scoped_org_switch (org_code, mode, note)
values ('<ORG_CODE>', 'allowlist', '<reason>')
on conflict (org_code) do nothing;
insert into public.pillar_c_scoped_user_allow (org_code, user_id, note)
values ('<ORG_CODE>', '<USER_UUID>', '<reason>');
commit;
```

Before enabling, confirm that the user holds exactly one approved membership, and that it is in
`<ORG_CODE>`.

Disable one user, in allow-list mode only. This takes effect at the next request, with no
redeploy. In `all` mode the function ignores allow rows, so deleting one does nothing and the user
keeps reading; the statement below refuses that case. To stop one user of an `all`-mode
organisation, revoke the membership (§6). Deleting the organisation's switch row stops everyone in
it.

```sql
begin;
do $off$
begin
  if exists (select 1 from public.pillar_c_scoped_org_switch
             where org_code = '<ORG_CODE>' and mode = 'all') then
    raise exception 'mode all: an allow row does not turn a user off; revoke the membership';
  end if;
  delete from public.pillar_c_scoped_user_allow
  where org_code = '<ORG_CODE>' and user_id = '<USER_UUID>';
  if not found then
    raise exception 'no allow row for this user: nothing was deleted';
  end if;
end
$off$;
commit;
```

Disable a whole organisation, in either mode. This also removes its allow-list rows, and it is the
kill switch for an organisation in `all` mode:

```sql
delete from public.pillar_c_scoped_org_switch where org_code = '<ORG_CODE>';
```

Check the state without listing anyone:

```sql
select s.org_code, s.mode, count(a.user_id) as allow_listed
from public.pillar_c_scoped_org_switch s
left join public.pillar_c_scoped_user_allow a on a.org_code = s.org_code
group by s.org_code, s.mode order by s.org_code;
```

After every deletion or revoke, confirm that the user has no unit, with a rolled-back
impersonation. The expected answer is `{}`:

```sql
begin;
select set_config('request.jwt.claims', '{"sub":"<USER_UUID>","role":"authenticated"}', true);
set local role authenticated;
select public.pillar_c_scoped_units() as units;
rollback;
```

Mode `all` enables every approved member of an organisation. It is a separate release decision,
not a routine step. It comes after the Pillar C figures are accepted, and after the governance
basis recorded with the owner decisions is settled.

### Offboarding

1. **Stop session reads first.** Revoke the membership in the Control Center (§6), which works in
   either mode. In allow-list mode, deleting the user's allow row also works. In `all` mode it does
   nothing: revoke the membership, or delete the organisation's switch row to stop the whole
   organisation. Each takes effect at the next statement, including Storage reads. Confirm with the
   impersonation above that the user has no unit. Storage checks the session token, not bans: a ban
   without a revoke leaves reads working until the token expires.
2. **Signed links and Storage copies.** Storage serves a signed link by its token, without RLS,
   until it expires or the object is deleted, and a Storage copy lives on outside this bucket.
   Neither would stop at a revoke. The policy refuses signing, copy and move on these objects, so a
   switched-on user cannot create either with its session. The live check must show these refusals
   in production before any real member is enabled; a copy into another bucket is covered by the
   database harness and the rolled-back impersonations instead. The result is recorded privately
   (`docs/PILLAR_C_ORG_SCOPED_DELIVERY_20261020.md` §8).
3. **Re-key only if a signed link or a copy may exist**: the live check failed, the policy has
   changed since, or there is any doubt. Build the same release under the next build root
   (`v2`, …), upload and verify it, deploy the new pins, then delete every object under the old
   root. Deleting an object invalidates its signed links while object versioning is not enabled on
   the bucket. The policy accepts the root family, so no migration is needed. A copy in another
   bucket is not reached by a re-key; delete it where it is.
4. **Downloaded files stay.** A file downloaded while the user was switched on cannot be recalled.
   That is the remaining residual.
5. **Open tabs keep their data.** A tab that is already open keeps what it rendered until it is
   reloaded.

### Test accounts

- Test accounts are created through the normal sign-up and access request, and approved in the
  Control Center.
- Each holds one membership, and its address is never on `REVIEWER_EMAILS` or `ADMIN_EMAILS`.
- They stay pending until just before the live phase.
- Cleanup is, in order: delete their rollout rows, revoke them, reject any pending request, and
  delete the auth users (the owner's action, in Supabase → Authentication → Users).
