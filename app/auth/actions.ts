"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

// Every auth step that reads or writes the session runs here, on the server
// (XC-X3.3). The session cookies are HttpOnly (lib/supabase/cookie-options.ts),
// so the browser can neither read them nor sign in, sign out or change a
// password with them; the forms call these actions instead.
//
// They return what the forms already showed: the Supabase message for sign-in
// (components/login-form.tsx maps it to Italian), and a plain outcome for the
// others. No action redirects; the form navigates, so it keeps the section
// anchor only the browser knows.

export interface AuthActionResult {
  ok: boolean;
  /** The Supabase error message, or null on success. */
  error: string | null;
}

const text = (value: unknown, max: number): string =>
  typeof value === "string" ? value.slice(0, max) : "";

export async function signInWithPassword(input: { email: unknown; password: unknown }): Promise<AuthActionResult> {
  const email = text(input?.email, 320).trim();
  const password = text(input?.password, 128);
  if (!email || !password) return { ok: false, error: "Missing email or password" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? { ok: false, error: error.message } : { ok: true, error: null };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}

/**
 * A recovery session (from the email link, verified by /auth/confirm) may set a
 * new password without the current one; any other session must give it. Supabase
 * applies its own reauthentication rule on top, exactly as it did when the form
 * called it from the browser.
 */
export async function updatePassword(input: {
  password: unknown;
  currentPassword?: unknown;
  recovery: boolean;
}): Promise<AuthActionResult> {
  const password = text(input?.password, 128);
  if (!password) return { ok: false, error: "Missing password" };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser(
    input?.recovery === true
      ? { password }
      : { password, current_password: text(input?.currentPassword, 128) },
  );
  return error ? { ok: false, error: error.message } : { ok: true, error: null };
}

export async function requestPasswordReset(input: { email: unknown }): Promise<AuthActionResult> {
  const email = text(input?.email, 320).trim();
  if (!email) return { ok: false, error: "Missing email" };

  // Server actions only run for a same-origin request (Next compares Origin with
  // Host), so the Origin header is this site. The reset-password email template
  // links to {{ .SiteURL }}/auth/confirm with a token hash, which /auth/confirm
  // verifies on the server; this redirect is the fallback for the default template.
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin") ?? `https://${requestHeaders.get("host")}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/update-password?mode=recovery`,
  });
  return error ? { ok: false, error: error.message } : { ok: true, error: null };
}
