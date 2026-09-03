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

## 7. Antibiotic demo and real-data loading

When no RLS-visible antibiotic rows exist, the dashboard shows a prominently labelled synthetic
scenario. Synthetic rows live in application code only and are never merged into the production
fact table. Once authorized rows exist, the page switches automatically to real mode.

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
