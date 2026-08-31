"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  Check,
  Clock3,
  Inbox,
  KeyRound,
  MailCheck,
  ShieldCheck,
  UserRoundCheck,
  X,
} from "lucide-react";
import { VisLogo } from "@/components/vis-logo";
import { LogoutButton } from "@/components/logout-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  requestOrganizationAccess,
  respondToOrganizationInvitation,
} from "@/app/access/actions";
import type { AccessOverview, OrganizationInvitation } from "@/lib/access/types";

const STATUS_LABEL = {
  pending: "In verifica",
  rejected: "Non approvata",
  revoked: "Revocata",
  approved: "Approvata",
} as const;

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function InvitationCard({ invitation }: { invitation: OrganizationInvitation }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "accepting" | "declining" | "done" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");
  const expired = new Date(invitation.expires_at).getTime() <= Date.now();

  async function respond(outcome: "accept" | "decline") {
    setState(outcome === "accept" ? "accepting" : "declining");
    const result = await respondToOrganizationInvitation({
      invitationId: invitation.id,
      outcome,
    });
    setMessage(result.message);
    if (!result.ok) {
      setState("error");
      return;
    }
    setState("done");
    if (outcome === "accept") {
      router.push("/dashboard-review/spend");
    }
    router.refresh();
  }

  return (
    <Card className="border-primary/30 bg-primary/[0.035] shadow-sm">
      <CardContent className="grid gap-5 p-5 md:grid-cols-[1fr_auto] md:items-center">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge className="border-0 bg-[hsl(174_46%_24%)] text-white hover:bg-[hsl(174_46%_24%)]">
              Invito ricevuto
            </Badge>
            <span className="text-xs text-muted-foreground">
              Scade il {formatDate(invitation.expires_at)}
            </span>
          </div>
          <h3 className="font-display text-xl">
            {invitation.organizations?.org_name ?? invitation.org_code}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {invitation.invited_role ?? "Accesso al perimetro organizzativo"}
          </p>
          {invitation.invitation_note && (
            <p className="mt-3 max-w-2xl text-sm leading-6 text-foreground/80">
              {invitation.invitation_note}
            </p>
          )}
          {message && (
            <p className={`mt-3 text-sm ${state === "error" ? "text-destructive" : "text-foreground"}`}>
              {message}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 md:justify-end">
          <Button
            onClick={() => respond("accept")}
            disabled={expired || state === "accepting" || state === "declining" || state === "done"}
          >
            <Check className="mr-2" size={15} />
            {state === "accepting" ? "Accettazione..." : "Accetta"}
          </Button>
          <Button
            variant="outline"
            onClick={() => respond("decline")}
            disabled={state === "accepting" || state === "declining" || state === "done"}
          >
            <X className="mr-2" size={15} />
            {state === "declining" ? "Aggiornamento..." : "Rifiuta"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
export function AccessPortal({
  overview,
  isAdmin = false,
}: {
  overview: AccessOverview;
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const [orgCode, setOrgCode] = useState(overview.organizations[0]?.org_code ?? "");
  const [role, setRole] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [submission, setSubmission] = useState<{
    state: "idle" | "submitting" | "success" | "error";
    message: string;
  }>({ state: "idle", message: "" });

  const pendingInvitations = useMemo(
    () => overview.invitations.filter((invitation) => invitation.status === "pending"),
    [overview.invitations],
  );
  const applications = overview.memberships.filter((membership) => membership.status !== "approved");

  async function submitApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmission({ state: "submitting", message: "" });
    const result = await requestOrganizationAccess({
      orgCode,
      requestedRole: role,
      message: requestMessage,
    });
    setSubmission({ state: result.ok ? "success" : "error", message: result.message });
    if (result.ok) {
      setRequestMessage("");
      router.refresh();
    }
  }

  return (
    <div className="min-h-svh bg-background">
      <header className="border-b border-border bg-card/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 md:px-8">
          <VisLogo size="sm" />
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/control-center">
                  <KeyRound className="mr-2" size={14} />
                  Control Center
                </Link>
              </Button>
            )}
            <LogoutButton label="Esci" className="text-muted-foreground" />
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-8 md:px-8 md:py-12">
        <section className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr] lg:items-end">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[hsl(174_46%_24%)]">
              <ShieldCheck size={14} />
              Accesso organizzativo
            </div>
            <h1 className="font-display max-w-3xl text-3xl leading-tight md:text-5xl">
              Richiedi l&apos;accesso al perimetro dati della tua organizzazione.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
              Ogni richiesta viene verificata prima di rendere visibili dati, confronti e moduli di
              governance. L&apos;accesso resta separato dall&apos;autenticazione e viene tracciato.
            </p>
          </div>

          <Card className="bg-[hsl(204_63%_12%)] text-white shadow-none">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-white/10 p-2.5 text-[hsl(78_75%_60%)]">
                  <UserRoundCheck size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.14em] text-white/55">Account verificato</p>
                  <p className="mt-1 truncate text-sm font-medium">{overview.email}</p>
                  <p className="mt-2 text-xs leading-5 text-white/60">
                    L&apos;identità è confermata. Manca solo il perimetro organizzativo.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {overview.setupRequired && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Il Control Center è presente nell&apos;applicazione, ma la migrazione Supabase deve ancora
            essere applicata prima di poter inviare richieste o gestire inviti.
          </div>
        )}

        {pendingInvitations.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <Inbox className="text-primary" size={20} />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Posta in arrivo
                </p>
                <h2 className="font-display text-2xl">Inviti ricevuti</h2>
              </div>
            </div>
            <div className="grid gap-3">
              {pendingInvitations.map((invitation) => (
                <InvitationCard key={invitation.id} invitation={invitation} />
              ))}
            </div>
          </section>
        )}

        <section className="grid gap-6 lg:grid-cols-[1fr_0.75fr]">
          <Card className="shadow-sm">
            <CardHeader className="border-b border-border">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-primary/10 p-2.5 text-[hsl(174_46%_24%)]">
                  <Building2 size={18} />
                </div>
                <div>
                  <CardTitle className="font-display text-2xl">Candidatura demo</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Seleziona il perimetro e spiega brevemente il tuo ruolo.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5 md:p-6">
              <form onSubmit={submitApplication} className="grid gap-5">
                <div className="grid gap-2">
                  <Label htmlFor="access-organization">Organizzazione</Label>
                  <select
                    id="access-organization"
                    required
                    value={orgCode}
                    onChange={(event) => setOrgCode(event.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {overview.organizations.length === 0 && (
                      <option value="">Nessuna organizzazione configurata</option>
                    )}
                    {overview.organizations.map((organization) => (
                      <option key={organization.org_code} value={organization.org_code}>
                        {organization.org_name} · {organization.org_type === "regione" ? "Regione" : "ASL"}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="access-role">Ruolo professionale</Label>
                  <Input
                    id="access-role"
                    required
                    maxLength={120}
                    value={role}
                    onChange={(event) => setRole(event.target.value)}
                    placeholder="Es. Direttore del servizio farmaceutico"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="access-message">Motivazione</Label>
                  <Textarea
                    id="access-message"
                    maxLength={1200}
                    rows={4}
                    value={requestMessage}
                    onChange={(event) => setRequestMessage(event.target.value)}
                    placeholder="Quali analisi o decisioni desideri supportare con la demo?"
                  />
                  <span className="text-right text-[11px] text-muted-foreground">
                    {requestMessage.length}/1200
                  </span>
                </div>

                {submission.message && (
                  <p
                    className={`text-sm ${
                      submission.state === "error" ? "text-destructive" : "text-[hsl(174_46%_24%)]"
                    }`}
                  >
                    {submission.message}
                  </p>
                )}

                <Button
                  type="submit"
                  className="w-full md:w-fit"
                  disabled={
                    overview.setupRequired ||
                    overview.organizations.length === 0 ||
                    submission.state === "submitting"
                  }
                >
                  {submission.state === "submitting" ? "Invio in corso..." : "Invia candidatura"}
                  <ArrowRight className="ml-2" size={15} />
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Stato delle richieste
              </p>
              <h2 className="font-display mt-1 text-2xl">Cronologia accessi</h2>
            </div>

            {applications.length === 0 ? (
              <Card className="border-dashed shadow-none">
                <CardContent className="flex min-h-40 flex-col items-center justify-center p-6 text-center">
                  <Clock3 className="mb-3 text-muted-foreground" size={22} />
                  <p className="text-sm font-medium">Nessuna candidatura inviata</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    La richiesta comparirà qui con il relativo stato.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {applications.map((membership) => (
                  <Card key={membership.id} className="shadow-none">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {membership.organizations?.org_name ?? membership.org_code}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Inviata il {formatDate(membership.requested_at)}
                          </p>
                        </div>
                        <Badge variant="secondary">{STATUS_LABEL[membership.status]}</Badge>
                      </div>
                      {membership.decision_note && (
                        <p className="mt-3 border-t border-border pt-3 text-xs leading-5 text-muted-foreground">
                          {membership.decision_note}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <Card className="border-0 bg-secondary/70 shadow-none">
              <CardContent className="flex gap-3 p-4">
                <MailCheck className="mt-0.5 shrink-0 text-primary" size={18} />
                <p className="text-xs leading-5 text-muted-foreground">
                  Se ricevi un invito, accedi con lo stesso indirizzo email: comparirà in questa
                  pagina e potrai accettarlo o rifiutarlo.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
}
