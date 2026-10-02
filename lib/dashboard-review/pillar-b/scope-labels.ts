// Labels for the Aziende in a Pillar B scope, as a pure function.
//
// Split from scope.ts (which reads the session and the database) so the step
// that turns a scope decision into the names a viewer sees can be tested end
// to end: a reviewer whose widening succeeded sees real names, everyone else
// sees their own Azienda by name and the rest as ASL 1-4.
import { orgDisplayMap } from "@/lib/analytics/org-pseudonym";
import type { ScopeDecision } from "@/lib/analytics/private-scope-rules";

export interface LabelledOrg { orgCode: string; aslCode: string; regionCode: string; label: string }

export function labelScopedOrgs<T extends LabelledOrg>(
  decision: Pick<ScopeDecision, "viewerCode" | "showRealNames" | "allOrganizations">, scopedOrgs: ReadonlyArray<T>,
): T[] {
  const labels = orgDisplayMap(
    scopedOrgs.map((o) => ({ org_code: o.orgCode, org_name: o.label })),
    decision.viewerCode,
    { unrestricted: decision.showRealNames && decision.allOrganizations },
  );
  return scopedOrgs.map((o) => ({ ...o, label: labels[o.orgCode] ?? o.orgCode }));
}
