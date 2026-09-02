"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendAccessRequestReceivedEmail } from "@/lib/email/vis-email";

export interface AccessActionResult {
  ok: boolean;
  message: string;
}

function clean(value: string, maxLength: number): string {
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function errorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : "";
  if (message.toLowerCase().includes("already approved")) {
    return "Hai già un accesso approvato per questa organizzazione.";
  }
  if (message.toLowerCase().includes("expired")) {
    return "L'invito è scaduto. Chiedi all'amministratore di inviarne uno nuovo.";
  }
  if (message.toLowerCase().includes("another organization")) {
    return "Il tuo account è già associato a un'altra organizzazione.";
  }
  return fallback;
}

async function requireSession() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub || !data.claims.email) throw new Error("Sessione non valida.");
  return { supabase, email: String(data.claims.email) };
}

export async function requestOrganizationAccess(input: {
  orgCode: string;
  requestedRole: string;
  message: string;
}): Promise<AccessActionResult> {
  const orgCode = clean(input.orgCode, 80);
  const requestedRole = clean(input.requestedRole, 120);
  const message = input.message.trim().slice(0, 1200);

  if (!orgCode || !requestedRole) {
    return { ok: false, message: "Seleziona l'organizzazione e indica il tuo ruolo." };
  }

  try {
    const { supabase, email } = await requireSession();
    const { data: organization } = await supabase
      .from("organizations")
      .select("org_name")
      .eq("org_code", orgCode)
      .maybeSingle();
    const { error } = await supabase.rpc("request_organization_membership", {
      p_org_code: orgCode,
      p_requested_role: requestedRole,
      p_request_message: message || null,
    });
    if (error) throw error;

    try {
      const delivery = await sendAccessRequestReceivedEmail(email, organization?.org_name ?? orgCode);
      if (!delivery.sent && delivery.reason !== "VIS email is not configured") {
        console.error("access request email failed", delivery.reason);
      }
    } catch (deliveryError) {
      console.error("access request email failed", deliveryError);
    }

    revalidatePath("/access");
    revalidatePath("/dashboard-review", "layout");
    return {
      ok: true,
      message: "Richiesta inviata. Riceverai accesso dopo la verifica dell'organizzazione.",
    };
  } catch (error) {
    return {
      ok: false,
      message: errorMessage(
        error,
        "Non è stato possibile inviare la richiesta. Verifica che il Control Center sia stato attivato.",
      ),
    };
  }
}

export async function respondToOrganizationInvitation(input: {
  invitationId: string;
  outcome: "accept" | "decline";
}): Promise<AccessActionResult> {
  if (!/^[0-9a-f-]{36}$/i.test(input.invitationId)) {
    return { ok: false, message: "Invito non valido." };
  }

  try {
    const { supabase } = await requireSession();
    const rpc =
      input.outcome === "accept"
        ? "accept_organization_invitation"
        : "decline_organization_invitation";
    const { data, error } = await supabase.rpc(rpc, { p_invitation_id: input.invitationId });
    if (error) throw error;
    if (input.outcome === "accept" && data === "__expired__") {
      return {
        ok: false,
        message: "L'invito è scaduto. Chiedi all'amministratore di inviarne uno nuovo.",
      };
    }

    revalidatePath("/access");
    revalidatePath("/dashboard-review", "layout");
    return {
      ok: true,
      message:
        input.outcome === "accept"
          ? "Invito accettato. Il perimetro autorizzato è ora disponibile."
          : "Invito rifiutato.",
    };
  } catch (error) {
    return {
      ok: false,
      message: errorMessage(error, "Non è stato possibile aggiornare l'invito."),
    };
  }
}
