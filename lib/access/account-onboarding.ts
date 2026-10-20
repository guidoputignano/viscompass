import type { Organization } from "@/lib/dashboard-review/types";

/** An onboarding preference only. Approved database membership grants access. */
export type RequestedAccountType = "regione" | "organization";

export const ACCOUNT_TYPE_OPTIONS = [
  {
    value: "regione",
    label: "Regione",
    description: "Per il governo e il confronto dei risultati regionali.",
  },
  {
    value: "organization",
    label: "Azienda sanitaria",
    description: "Per analizzare i dati della propria organizzazione.",
  },
] as const satisfies ReadonlyArray<{
  value: RequestedAccountType;
  label: string;
  description: string;
}>;

export function parseRequestedAccountType(value: unknown): RequestedAccountType | null {
  return value === "regione" || value === "organization" ? value : null;
}

/** Only configured regions are offered; a missing regional name stays a code. */
export function accountRegions(
  organizations: readonly Organization[],
): Array<{ code: string; label: string }> {
  const regionCodes = new Set(
    organizations.flatMap((organization) =>
      organization.region_code !== null && organization.region_code !== ""
        ? [organization.region_code]
        : [],
    ),
  );
  return [...regionCodes].map((code) => {
    const namedRegions = organizations
      .filter((organization) => organization.org_type === "regione" && organization.region_code === code)
      .map((organization) => organization.org_name)
      .filter((name) => name.trim() !== "")
      .sort((a, b) => a.localeCompare(b, "it"));
    return { code, label: namedRegions[0] ?? code };
  }).sort((a, b) => a.label.localeCompare(b.label, "it") || a.code.localeCompare(b.code));
}

export function accountOrganizations(
  organizations: readonly Organization[],
  requestedAccountType: unknown,
  regionCode: string,
): Organization[] {
  const accountType = parseRequestedAccountType(requestedAccountType);
  if (!accountType || (accountType === "organization" && (typeof regionCode !== "string" || regionCode === ""))) return [];
  return organizations.filter((organization) =>
    accountType === "regione"
      ? organization.org_type === "regione"
      : organization.org_type === "asl" && organization.region_code === regionCode,
  ).sort((a, b) => a.org_name.localeCompare(b.org_name, "it") || a.org_code.localeCompare(b.org_code));
}
