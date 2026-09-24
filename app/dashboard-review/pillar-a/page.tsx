import { redirect } from "next/navigation";

// Pillar A and Antibiotici AWaRe are the same J01 analysis for the same
// organization, so they are one module now. The old path is kept as a redirect
// rather than removed, because it was linked from the navigation.
export default function PrivatePillarARedirect() {
  redirect("/dashboard-review/antibiotici");
}
