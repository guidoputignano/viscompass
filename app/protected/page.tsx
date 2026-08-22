import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

// This route only ever decides where to redirect based on the caller's
// live session cookie — there's no content to prerender or stream, so it
// must always render dynamically per request.
export const instant = false;

export default async function ProtectedPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/auth/login");
  }

  redirect("/dashboard.html");
}
