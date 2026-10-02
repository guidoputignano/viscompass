import { redirect } from "next/navigation";

// Preserve existing bookmarks while keeping a single Pillar B destination.
export default function FormerBiosimilarPage() {
  redirect("/dashboard-review/revisione-pillar-b");
}
