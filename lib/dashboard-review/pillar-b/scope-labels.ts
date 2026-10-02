// Labels for the Aziende in a Pillar B scope, as a pure function.
//
// Split from scope.ts (which reads the session and the database) so the step
// that turns a scope decision into the names a viewer sees can be tested end
// to end: a reviewer whose widening succeeded sees real names, everyone else
// sees their own Azienda by name and the rest as ASL 1-4.
import { orgDisplayName } from "@/lib/analytics/org-pseudonym";
import type { ScopeDecision } from "@/lib/analytics/private-scope-rules";

export interface LabelledOrg { orgCode: string; aslCode: string; regionCode: string; label: string }

export function labelScopedOrgs<T extends LabelledOrg>(
  decision: Pick<ScopeDecision, "viewerCode" | "showRealNames" | "allOrganizations">, scopedOrgs: ReadonlyArray<T>,
): T[] {
  const unrestricted = decision.showRealNames && decision.allOrganizations;
  return scopedOrgs.map((o) => ({
    ...o,
    // The reviewed ASL 1–4 aliases belong to Abruzzo only. Other regions
    // cannot inherit them merely because their short org_code also says 201.
    // Resolve per row: an org_code-keyed map would collide in a multi-region
    // reviewer release and assign one Azienda another's real name.
    label: !unrestricted && o.regionCode !== "130" && o.orgCode !== decision.viewerCode
      ? o.aslCode
      : orgDisplayName(o.orgCode, decision.viewerCode, o.label, { unrestricted }),
  }));
}
