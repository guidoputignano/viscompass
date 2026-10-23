import { LoginForm } from "@/components/login-form";
import { createClient } from "@/lib/supabase/server";
import { loginNext } from "@/lib/auth/safe-next";
import { redirect } from "next/navigation";

export const instant = false;

export default async function Page({
  searchParams,
}: {
  // A repeated parameter arrives as an array: loginNext treats it as absent, and only a single code is exchanged.
  searchParams: Promise<{ code?: string | string[]; next?: string | string[] }>;
}) {
  const { code, next } = await searchParams;
  // R20-05: the page the user asked for before signing in, validated once here (lib/auth/safe-next.ts).
  const destination = loginNext(next);

  // Some Supabase projects still use /auth/login as their Site URL. If a
  // confirmation returns here with a PKCE code, complete the exchange rather
  // than rendering the login form again and leaving the user in a loop.
  if (typeof code === "string" && code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) redirect(destination);
    redirect(`/auth/error?error=${encodeURIComponent(error.message)}`);
  }

  return <LoginForm next={destination} />;
}
