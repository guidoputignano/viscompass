import { LoginForm } from "@/components/login-form";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const instant = false;

function safeNext(value: string | undefined): string {
  return value?.startsWith("/") && !value.startsWith("//")
    ? value
    : "/dashboard-review/spend";
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; next?: string }>;
}) {
  const { code, next } = await searchParams;

  // Some Supabase projects still use /auth/login as their Site URL. If a
  // confirmation returns here with a PKCE code, complete the exchange rather
  // than rendering the login form again and leaving the user in a loop.
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) redirect(safeNext(next));
    redirect(`/auth/error?error=${encodeURIComponent(error.message)}`);
  }

  return <LoginForm />;
}
