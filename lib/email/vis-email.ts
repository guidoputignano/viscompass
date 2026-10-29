const DEFAULT_SITE_URL = "https://www.eurekene.com";

function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (configured?.startsWith("https://") || configured?.startsWith("http://")) return configured;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return DEFAULT_SITE_URL;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character]!);
}

async function sendVisEmail(input: {
  to: string;
  subject: string;
  heading: string;
  message: string;
  actionLabel: string;
  actionPath: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.VIS_EMAIL_FROM;
  if (!apiKey || !from) return { sent: false, reason: "VIS email is not configured" };

  const url = `${siteUrl()}${input.actionPath}`;
  const safeHeading = escapeHtml(input.heading);
  const safeMessage = escapeHtml(input.message);
  const safeAction = escapeHtml(input.actionLabel);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      reply_to: process.env.VIS_EMAIL_REPLY_TO || undefined,
      subject: input.subject,
      text: `${input.heading}\n\n${input.message}\n\n${input.actionLabel}: ${url}`,
      html: `
        <div style="background:#f5f8f8;padding:32px 16px;font-family:Arial,sans-serif;color:#102f3b">
          <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #dce7e6;border-radius:18px;overflow:hidden">
            <div style="padding:22px 28px;border-bottom:1px solid #edf2f2;font-weight:700">VIS <span style="color:#0f9f91">PHARMA COMPASS</span></div>
            <div style="padding:30px 28px">
              <h1 style="font-size:24px;line-height:1.25;margin:0 0 14px">${safeHeading}</h1>
              <p style="font-size:15px;line-height:1.7;color:#52646b;margin:0 0 24px">${safeMessage}</p>
              <a href="${url}" style="display:inline-block;background:#0f9f91;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">${safeAction}</a>
            </div>
          </div>
        </div>`,
    }),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    return { sent: false, reason: `Resend ${response.status}: ${detail}` };
  }
  return { sent: true };
}

export async function sendRegistrationReceivedEmail(email: string, fullName: string) {
  return sendVisEmail({
    to: email,
    subject: "Registrazione ricevuta · VIS Pharma Compass",
    heading: `Ciao ${fullName || ""}`.trim() + ", la registrazione è arrivata.",
    message: "Conferma il tuo indirizzo email. Poi potrai richiedere l’accesso per la tua organizzazione; la richiesta resterà in verifica fino all’approvazione di un amministratore.",
    actionLabel: "Conferma e accedi",
    actionPath: "/auth/login",
  });
}

export async function sendAccessRequestReceivedEmail(email: string, organizationName: string) {
  return sendVisEmail({
    to: email,
    subject: "Richiesta di accesso in verifica · VIS Pharma Compass",
    heading: "La tua richiesta di accesso è in verifica.",
    message: `Abbiamo ricevuto la richiesta di accesso per ${organizationName}. Un amministratore la esaminerà dal Control Center; troverai lo stato aggiornato nella tua area di accesso.`,
    actionLabel: "Controlla lo stato",
    actionPath: "/access",
  });
}

export async function sendAccessDecisionEmail(
  email: string,
  organizationName: string,
  outcome: "approved" | "rejected",
) {
  return sendVisEmail({
    to: email,
    subject: outcome === "approved" ? "Accesso approvato · VIS Pharma Compass" : "Aggiornamento della richiesta di accesso · VIS Pharma Compass",
    heading: outcome === "approved" ? "Il tuo accesso è stato approvato." : "La richiesta di accesso è stata aggiornata.",
    message: outcome === "approved"
      ? `Puoi ora entrare nel perimetro ${organizationName}. I dati reali restano visibili soltanto agli utenti autorizzati.`
      : `La richiesta per ${organizationName} non è stata approvata. Accedi alla tua area per consultare la nota dell’amministratore o inviare una nuova richiesta.`,
    actionLabel: outcome === "approved" ? "Apri la dashboard" : "Apri la tua area",
    actionPath: outcome === "approved" ? "/dashboard-review/spend" : "/access",
  });
}

// Finding cases: the title and the due date only. The figures stay behind the
// sign-in, so a forwarded or intercepted email carries none.
const italianDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

export async function sendFindingAssignedEmail(email: string, title: string, dueDate: string, caseId: string) {
  return sendVisEmail({
    to: email,
    subject: "Nuovo caso assegnato · VIS Pharma Compass",
    heading: "Ti è stato assegnato un caso.",
    message: `${title}. Scadenza: ${italianDate(dueDate)}. Apri il caso per leggere il risultato, registrare la decisione e, a conclusione, l’esito.`,
    actionLabel: "Apri il caso",
    actionPath: `/dashboard-review/azioni?caso=${encodeURIComponent(caseId)}`,
  });
}

export async function sendFindingOverdueEmail(email: string, title: string, dueDate: string, caseId: string) {
  return sendVisEmail({
    to: email,
    subject: "Caso in scadenza superata · VIS Pharma Compass",
    heading: "Un caso che ti è assegnato ha superato la scadenza.",
    message: `${title}. Scadenza: ${italianDate(dueDate)}. Registra la decisione o l’esito, oppure chiedi a chi lo ha assegnato di aggiornare la scadenza.`,
    actionLabel: "Apri il caso",
    actionPath: `/dashboard-review/azioni?caso=${encodeURIComponent(caseId)}`,
  });
}
