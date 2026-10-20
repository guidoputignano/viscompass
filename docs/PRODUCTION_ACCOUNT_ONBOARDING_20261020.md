# Production account onboarding

## Product direction

The owner requested regional and organizational account choices, national
public data for everyone, cross-region aggregate comparisons for regional
users, and own-organization analyses with regional comparisons for
organizational users. A comparison requires compatible sources and measures;
permission to view a source is not evidence of comparability.

## This change

- Registration explicitly asks for Regione or Azienda sanitaria. Neither is
  preselected. The saved requested_account_type is an untrusted UI preference.
- After email confirmation, the access portal offers type, region and the
  configured organization. It never silently selects the first organization.
- Changing type or region clears the organization. The server rechecks the
  directory row against the supplied type and region before requesting access.
- Requests still use the existing pending-membership RPC. Administrator
  approval, invitations, reviewer/admin allowlists, organizational RLS and the
  single-approved-membership rule are unchanged.
- Existing public Pillar A/B pages remain linked while approval is pending.
- Legacy clients that omit a preference remain compatible. Unknown requested
  types and directory mismatches are refused rather than coerced.

There is no migration, directory seed, account activation or permission grant.
Only configured organizations are offered. The existing schema supports ASL
and Regione, not arbitrary hospital/province account subtypes.

## Separate delivery work

Claude is editing organization-scoped Pillar C in a separate checkout. Those
changes were neither overwritten nor included in this registration delivery.
That work must integrate this commit before its combined build and release.

The detailed owner-direction handover is outside this public repository at
outputs/pillar-c/PRODUCTION_ACCOUNT_DELIVERY_20261020.md in the shared workspace.
It distinguishes public national/interregional data from private institutional
access, and records current data coverage and source compatibility requirements.

The account-type controls do not by themselves release national Pillar C views,
expand cross-region private access or activate organizational Pillar C data.
Those capabilities require their own tested data products and release gates.

## Verification

Sixteen focused checks exercise the real access-request action with isolated
database/session/mail doubles, rendered forms and pure directory helpers.
They cover missing/forged account types, organization/region mismatches,
zero-prefixed codes, no default organization, preserved approval lifecycle,
empty directories and backward compatibility. No real account is registered
or changed by these checks.

Full suite: 821 passed, eight existing skips, zero failures. The actual project
type-check, scoped ESLint and production webpack build passed. Live UI checks
are recorded separately when completed.
