# Access Control Center

VIS PHARMA COMPASS separates authentication from authorization:

- Supabase Auth proves who the person is.
- `user_organizations` defines the single regional or ASL data perimeter the person can access.
- The Control Center lets an allow-listed administrator approve applications, send invitations,
  revoke access, and inspect recent decisions.

The browser never receives the Supabase service-role key. Applicant writes use narrow database
functions and all administrative writes re-check the authenticated administrator email on the
server before using the service-role client.

## 1. Apply the database migration

Run the following file in the Supabase SQL editor, or apply it through the Supabase CLI:

```text
supabase/migrations/20260831224500_access_control_center.sql
```

The migration adds:

- application metadata and decision audit fields to `user_organizations`;
- one-active-organization enforcement;
- `organization_invitations`, including expiry, delivery and response state;
- authenticated functions for applying and accepting/declining invitations;
- service-role-only transactional functions for approvals and revocations;
- recipient-only Row Level Security for invitation inboxes.

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

Set these for Preview and, after validation, Production:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
ADMIN_EMAILS
NEXT_PUBLIC_SITE_URL
```

`ADMIN_EMAILS` is a comma-separated allow-list, for example:

```text
owner@example.com,regional.admin@example.it
```

The first administrator does not need an approved organization membership to open
`/admin/control-center`; they do need a confirmed Supabase account whose email appears in
`ADMIN_EMAILS`.

Never prefix the service-role key with `NEXT_PUBLIC_`, commit it, or place it in client-side code.

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

For reliable external delivery, configure custom SMTP in Supabase and validate the sending domain.
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

Vercel Deployment Protection is separate from this workflow. It controls who can open a preview
URL; the Control Center controls what an authenticated person can see inside VIS PHARMA COMPASS.
