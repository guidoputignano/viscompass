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
  Landmark,
  MailCheck,
  ShieldCheck,
  UserRoundCheck,
  X,
} from "lucide-react";
import { VisLogo } from "@/components/vis-logo";
import { LogoutButton } from "@/components/logout-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
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
import { ACCOUNT_TYPE_OPTIONS, accountOrganizations, accountRegions, parseRequestedAccountType, type RequestedAccountType } from "@/lib/access/account-onboarding";

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
  // The clock is read once, at mount, not on every render (react-hooks/purity).
  const [now] = useState(() => Date.now());
  const expired = new Date(invitation.expires_at).getTime() <= now;

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
            <Badge className="border-0 bg-primary text-primary-foreground hover:bg-primary">
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
  isReviewer = false,
}: {
  overview: AccessOverview;
  isAdmin?: boolean;
  /** The session's email is on the platform-reviewer allow-list. */
  isReviewer?: boolean;
}) {
  const router = useRouter();
  const [accountType, setAccountType] = useState<RequestedAccountType | "">(() => parseRequestedAccountType(overview.requestedAccountType) ?? "");
  const [regionCode, setRegionCode] = useState("");
  const [orgCode, setOrgCode] = useState("");
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
  const regions = accountRegions(overview.organizations);
  const organizations = accountOrganizations(overview.organizations, accountType, regionCode);
  const selectedOrganization = organizations.find((organization) => organization.org_code === orgCode);

  async function submitApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accountType || !selectedOrganization) {
      setSubmission({ state: "error", message: "Scegli il tipo di account e seleziona la tua organizzazione." });
      return;
    }
    setSubmission({ state: "submitting", message: "" });
    const result = await requestOrganizationAccess({
      orgCode,
      requestedRole: role,
      message: requestMessage,
      requestedAccountType: accountType,
      ...(accountType === "organization" ? { requestedRegionCode: regionCode } : {}),
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
            <ThemeSwitcher />
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
        {isReviewer && (
          <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100">
            Accesso revisore riconosciuto. La lettura estesa a tutte le Aziende si applica a un account con
            un&apos;iscrizione approvata a un&apos;organizzazione: questo account non ne ha ancora una. Richiedi
            l&apos;accesso qui sotto, o chiedi a un amministratore di approvarlo.
          </p>
        )}
        <section className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr] lg:items-end">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[hsl(174_46%_24%)]">
              <ShieldCheck size={14} />
              Accesso organizzativo
            </div>
            <h1 className="font-display max-w-3xl text-3xl leading-tight md:text-5xl">
              Richiedi l&apos;accesso ai dati della tua organizzazione.
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground md:text-base">
              Scegli il tipo di account, la tua organizzazione e il ruolo. Un amministratore verifica la richiesta prima di abilitare i dati riservati.
            </p>
          </div>

          <Card className="border-primary/20 bg-[hsl(174_46%_96%)] shadow-none dark:bg-primary/10">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-white p-2.5 text-primary shadow-sm dark:bg-card">
                  <UserRoundCheck size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Account verificato</p>
                  <p className="mt-1 truncate text-sm font-medium">{overview.email}</p>
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
                  <CardTitle className="font-display text-2xl">Richiesta di accesso</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5 md:p-6">
              <form onSubmit={submitApplication} className="grid gap-5">
                <fieldset className="grid gap-3">
                  <legend className="mb-2 text-sm font-medium">Tipo di account richiesto</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {ACCOUNT_TYPE_OPTIONS.map((option) => {
                      const Icon = option.value === "regione" ? Landmark : Building2;
                      return <label key={option.value} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors focus-within:ring-2 focus-within:ring-ring ${accountType === option.value ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/40"}`}>
                        <input type="radio" name="requested-account-type" value={option.value} checked={accountType === option.value} required className="mt-1 accent-primary" onChange={() => { setAccountType(option.value); setRegionCode(""); setOrgCode(""); setSubmission({ state: "idle", message: "" }); }} />
                        <span><span className="flex items-center gap-2 text-sm font-semibold"><Icon size={16} aria-hidden="true" />{option.label}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{option.description}</span></span>
                      </label>;
                    })}
                  </div>
                </fieldset>
                {accountType === "organization" && <div className="grid gap-2">
                  <Label htmlFor="access-region">Regione dell’organizzazione</Label>
                  <select id="access-region" value={regionCode} required onChange={(event) => { setRegionCode(event.target.value); setOrgCode(""); setSubmission({ state: "idle", message: "" }); }} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                    <option value="">Seleziona la regione</option>
                    {regions.map((region) => <option key={region.code} value={region.code}>{region.label}</option>)}
                  </select>
                </div>}
                <div className="grid gap-2">
                  <Label htmlFor="access-organization">{accountType === "regione" ? "Amministrazione regionale" : "Organizzazione"}</Label>
                  <select
                    id="access-organization"
                    required
                    value={orgCode}
                    disabled={!accountType || (accountType === "organization" && !regionCode)}
                    onChange={(event) => { setOrgCode(event.target.value); setSubmission({ state: "idle", message: "" }); }}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">{!accountType ? "Scegli prima il tipo di account" : accountType === "organization" && !regionCode ? "Scegli prima la regione" : organizations.length === 0 ? "Nessuna organizzazione configurata in questo ambito" : "Seleziona la tua organizzazione"}</option>
                    {organizations.map((organization) => (
                      <option key={organization.org_code} value={organization.org_code}>
                        {organization.org_name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs leading-5 text-muted-foreground">Sono elencate le organizzazioni configurate. Se la tua non compare, chiedi all’amministratore di aggiungerla al registro.</p>
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
                    rows={3}
                    value={requestMessage}
                    onChange={(event) => setRequestMessage(event.target.value)}
                    placeholder="Quali analisi o decisioni desideri supportare con VIS?"
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
                    !selectedOrganization ||
                    submission.state === "submitting"
                  }
                >
                  {submission.state === "submitting" ? "Invio in corso..." : "Invia richiesta"}
                  <ArrowRight className="ml-2" size={15} />
                </Button>
              </form>
              <div className="mt-6 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
                <p>Puoi consultare le analisi pubbliche senza attendere l’accesso ai dati riservati.</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2"><Link href="/pillar-a" className="font-medium text-primary hover:underline">Pillar A · dati pubblici</Link><Link href="/pillar-b" className="font-medium text-primary hover:underline">Pillar B · dati pubblici</Link></div>
              </div>
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
                  <p className="text-sm font-medium">Nessuna richiesta inviata</p>
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
