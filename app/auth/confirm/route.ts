import { createClient } from "@/lib/supabase/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

// `next` arrives from the email link, so it is attacker-influenced: only ever
// redirect within this site. Same guard as app/auth/callback/route.ts.
function safeNext(value: string | null): string {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

// Accepts both confirmation dialects, so the route works whichever one the
// Supabase email template emits:
//   token_hash + type -> verifyOtp               (a custom template linking here)
//   code              -> exchangeCodeForSession  (Supabase's default
//                                                 {{ .ConfirmationURL }}, which
//                                                 verifies server-side and then
//                                                 redirects with a PKCE code)
// Neither is required, so editing the template can no longer produce a hard
// failure by disagreeing with the emailRedirectTo the app sends.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (error) {
      redirect(`/auth/error?error=${encodeURIComponent(error.message)}`);
    }
    redirect(next);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      redirect(`/auth/error?error=${encodeURIComponent(error.message)}`);
    }
    redirect(next);
  }

  redirect(`/auth/error?error=${encodeURIComponent("No token hash or code")}`);
}
