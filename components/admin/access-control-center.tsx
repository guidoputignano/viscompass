"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import {
  ArrowLeft,
  Building2,
  Check,
  Clock3,
  History,
  MailPlus,
  RefreshCw,
  Send,
  ShieldCheck,
  UserMinus,
  UserRoundCheck,
  UsersRound,
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
  createOrganizationInvitation,
  decideMembership,
  resendOrganizationInvitation,
  revokeMembership,
  revokeOrganizationInvitation,
} from "@/app/admin/control-center/actions";
import type {
  AdminControlCenterData,
  AdminInvitation,
  AdminMembership,
} from "@/lib/access/types";

type CenterView = "requests" | "invitations" | "members" | "history";

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function Feedback({ result }: { result: { ok: boolean; message: string } | null }) {
  if (!result) return null;
  return (
    <p className={`text-xs leading-5 ${result.ok ? "text-[hsl(174_46%_24%)]" : "text-destructive"}`}>
      {result.message}
    </p>
  );
}
function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  value: number;
  helper: string;
  icon: typeof Clock3;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="text-left">
      <Card
        className={`h-full transition-colors ${
          active ? "border-[hsl(174_46%_24%)] bg-primary/[0.035]" : "hover:border-primary/40"
        }`}
      >
        <CardContent className="p-4 md:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {label}
              </p>
              <p className="font-display mt-2 text-3xl">{value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
            </div>
            <div
              className={`rounded-lg p-2.5 ${
                active ? "bg-primary text-primary-foreground shadow-sm" : "bg-secondary text-muted-foreground"
              }`}
            >
              <Icon size={17} />
            </div>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

function MembershipDecisionCard({ membership }: { membership: AdminMembership }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"approved" | "rejected" | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function decide(outcome: "approved" | "rejected") {
    setBusy(outcome);
    setResult(null);
    const response = await decideMembership({ membershipId: membership.id, outcome, note });
    setResult(response);
    setBusy(null);
    if (response.ok) router.refresh();
  }

  return (
    <Card className="shadow-sm">
      <CardContent className="grid gap-5 p-5 lg:grid-cols-[1fr_0.8fr]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-0 bg-amber-100 text-amber-900 hover:bg-amber-100">In verifica</Badge>
            <span className="text-xs text-muted-foreground">{formatDate(membership.requested_at)}</span>
          </div>
          <h3 className="font-display mt-3 text-xl">
            {membership.user_name ?? membership.user_email}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">{membership.user_email}</p>

          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Organizzazione</dt>
              <dd className="mt-1 font-medium">
                {membership.organizations?.org_name ?? membership.org_code}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Ruolo dichiarato</dt>
              <dd className="mt-1 font-medium">{membership.requested_role ?? "Non indicato"}</dd>
            </div>
          </dl>

          {membership.request_message && (
            <div className="mt-4 rounded-lg bg-secondary/60 p-3 text-sm leading-6 text-foreground/80">
              {membership.request_message}
            </div>
          )}
        </div>

        <div className="grid content-start gap-3 rounded-lg border border-border bg-background p-4">
          <div className="grid gap-2">
            <Label htmlFor={`decision-note-${membership.id}`}>Nota di decisione</Label>
            <Textarea
              id={`decision-note-${membership.id}`}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              maxLength={800}
              placeholder="Motivazione o indicazioni visibili all'utente"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => decide("approved")} disabled={busy !== null}>
              <Check size={15} />
              {busy === "approved" ? "Approvazione..." : "Approva"}
            </Button>
            <Button variant="outline" onClick={() => decide("rejected")} disabled={busy !== null}>
              <X size={15} />
              {busy === "rejected" ? "Aggiornamento..." : "Rifiuta"}
            </Button>
          </div>
          <Feedback result={result} />
        </div>
      </CardContent>
    </Card>
  );
}

function ActiveMemberCard({ membership }: { membership: AdminMembership }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function revoke() {
    setBusy(true);
    setResult(null);
    const response = await revokeMembership({ membershipId: membership.id, note });
    setResult(response);
    setBusy(false);
    if (response.ok) router.refresh();
  }

  return (
    <Card className="shadow-none">
      <CardContent className="grid gap-4 p-4 md:grid-cols-[1fr_auto] md:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-0 bg-emerald-100 text-emerald-900 hover:bg-emerald-100">Attivo</Badge>
            <span className="text-xs text-muted-foreground">
              Approvato {formatDate(membership.approved_at)}
            </span>
          </div>
          <p className="mt-2 truncate text-sm font-semibold">
            {membership.user_name ?? membership.user_email}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {membership.user_email} · {membership.organizations?.org_name ?? membership.org_code}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            aria-label="Motivo della revoca"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Motivo della revoca"
            className="sm:w-52"
            maxLength={800}
          />
          <Button variant="outline" onClick={revoke} disabled={busy}>
            <UserMinus size={15} />
            {busy ? "Revoca..." : "Revoca"}
          </Button>
        </div>
        {result && <div className="md:col-span-2"><Feedback result={result} /></div>}
      </CardContent>
    </Card>
  );
}

function InvitationRow({ invitation }: { invitation: AdminInvitation }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"resend" | "revoke" | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const isPending = invitation.status === "pending";

  async function act(action: "resend" | "revoke") {
    setBusy(action);
    setResult(null);
    const response =
      action === "resend"
        ? await resendOrganizationInvitation(invitation.id)
        : await revokeOrganizationInvitation(invitation.id);
    setResult(response);
    setBusy(null);
    if (response.ok) router.refresh();
  }

  const statusLabel = {
    pending: "In attesa",
    accepted: "Accettato",
    declined: "Rifiutato",
    revoked: "Revocato",
    expired: "Scaduto",
  }[invitation.status];

  return (
    <Card className="shadow-none">
      <CardContent className="grid gap-4 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={invitation.status === "accepted" ? "default" : "secondary"}>
              {statusLabel}
            </Badge>
            <Badge
              variant="outline"
              className={invitation.delivery_status === "failed" ? "border-destructive text-destructive" : ""}
            >
              {invitation.delivery_status === "email_sent"
                ? "Email inviata"
                : invitation.delivery_status === "failed"
                  ? "Consegna fallita"
                  : invitation.delivery_status === "in_app"
                    ? "Solo in-app"
                    : "Invio in corso"}
            </Badge>
          </div>
          <p className="mt-2 truncate text-sm font-semibold">{invitation.email}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {invitation.organizations?.org_name ?? invitation.org_code} · creato {formatDate(invitation.created_at)} ·
            scade {formatDate(invitation.expires_at)}
          </p>
          {invitation.delivery_error && (
            <p className="mt-2 text-xs text-destructive">{invitation.delivery_error}</p>
          )}
          <Feedback result={result} />
        </div>
        {isPending && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => act("resend")} disabled={busy !== null}>
              <RefreshCw size={14} />
              {busy === "resend" ? "Invio..." : "Reinvia"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => act("revoke")} disabled={busy !== null}>
              <X size={14} />
              {busy === "revoke" ? "Revoca..." : "Revoca"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InvitationComposer({ data }: { data: AdminControlCenterData }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [orgCode, setOrgCode] = useState(data.organizations[0]?.org_code ?? "");
  const [role, setRole] = useState("");
  const [note, setNote] = useState("");
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setResult(null);
    const response = await createOrganizationInvitation({
      email,
      orgCode,
      invitedRole: role,
      note,
      expiresInDays,
    });
    setResult(response);
    setBusy(false);
    if (response.ok) {
      setEmail("");
      setRole("");
      setNote("");
      router.refresh();
    }
  }

  return (
    <Card className="border-[hsl(174_46%_24%)]/30 shadow-sm">
      <CardHeader className="border-b border-border">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2.5 text-[hsl(174_46%_24%)]">
            <MailPlus size={18} />
          </div>
          <div>
            <CardTitle className="font-display text-2xl">Invita una persona</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Il destinatario riceve un collegamento email e trova lo stesso invito nell&apos;app.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-5 md:p-6">
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="nome@organizzazione.it"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="invite-organization">Organizzazione</Label>
            <select
              id="invite-organization"
              required
              value={orgCode}
              onChange={(event) => setOrgCode(event.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {data.organizations.map((organization) => (
                <option key={organization.org_code} value={organization.org_code}>
                  {organization.org_name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="invite-role">Ruolo previsto</Label>
            <Input
              id="invite-role"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              maxLength={120}
              placeholder="Es. Referente farmaceutico regionale"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="invite-expiry">Validità</Label>
            <select
              id="invite-expiry"
              value={expiresInDays}
              onChange={(event) => setExpiresInDays(Number(event.target.value))}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value={3}>3 giorni</option>
              <option value={7}>7 giorni</option>
              <option value={14}>14 giorni</option>
              <option value={30}>30 giorni</option>
            </select>
          </div>
          <div className="grid gap-2 md:col-span-2">
            <Label htmlFor="invite-note">Messaggio</Label>
            <Textarea
              id="invite-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={1200}
              rows={3}
              placeholder="Perché stai concedendo l'accesso e cosa può essere valutato nella demo?"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 md:col-span-2">
            <Button type="submit" disabled={busy || data.organizations.length === 0}>
              <Send size={15} />
              {busy ? "Invio in corso..." : "Invia invito"}
            </Button>
            <Feedback result={result} />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function AccessControlCenter({
  adminEmail,
  data,
}: {
  adminEmail: string;
  data: AdminControlCenterData;
}) {
  const [view, setView] = useState<CenterView>("requests");
  const pendingInvites = data.invitations.filter((invitation) => invitation.status === "pending");

  return (
    <div className="min-h-svh bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 md:px-8">
          <div className="flex items-center gap-5">
            <VisLogo size="sm" />
            <div className="hidden h-8 w-px bg-border sm:block" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Admin</p>
              <p className="text-sm font-semibold">Control Center</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeSwitcher />
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard-review/spend">
                <ArrowLeft size={14} />
                Torna alla piattaforma
              </Link>
            </Button>
            <LogoutButton label="Esci" className="text-muted-foreground" />
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-7 px-5 py-8 md:px-8 md:py-10">
        <section className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(174_46%_24%)]">
              <ShieldCheck size={15} />
              Governance degli accessi
            </div>
            <h1 className="font-display text-3xl md:text-5xl">Accessi e inviti.</h1>
            <p className="mt-3 text-sm text-muted-foreground">Approva, invita o revoca da un’unica vista.</p>
          </div>
          <div className="rounded-lg border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
            Sessione amministratore
            <span className="ml-2 font-semibold text-foreground">{adminEmail}</span>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Candidature"
            value={data.pendingMemberships.length}
            helper="richiedono una decisione"
            icon={Clock3}
            active={view === "requests"}
            onClick={() => setView("requests")}
          />
          <MetricCard
            label="Inviti aperti"
            value={pendingInvites.length}
            helper="in attesa del destinatario"
            icon={MailPlus}
            active={view === "invitations"}
            onClick={() => setView("invitations")}
          />
          <MetricCard
            label="Membri attivi"
            value={data.activeMemberships.length}
            helper="con perimetro autorizzato"
            icon={UsersRound}
            active={view === "members"}
            onClick={() => setView("members")}
          />
          <MetricCard
            label="Decisioni recenti"
            value={data.recentDecisions.length}
            helper="rifiuti e revoche tracciati"
            icon={History}
            active={view === "history"}
            onClick={() => setView("history")}
          />
        </section>

        {view === "requests" && (
          <section className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Coda di approvazione
              </p>
              <h2 className="font-display mt-1 text-2xl">Candidature alla demo</h2>
            </div>
            {data.pendingMemberships.length === 0 ? (
              <Card className="border-dashed shadow-none">
                <CardContent className="flex min-h-44 flex-col items-center justify-center p-6 text-center">
                  <UserRoundCheck className="mb-3 text-primary" size={24} />
                  <p className="text-sm font-semibold">Coda aggiornata</p>
                  <p className="mt-1 text-xs text-muted-foreground">Nessuna candidatura richiede una decisione.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {data.pendingMemberships.map((membership) => (
                  <MembershipDecisionCard key={membership.id} membership={membership} />
                ))}
              </div>
            )}
          </section>
        )}

        {view === "invitations" && (
          <section className="space-y-6">
            <InvitationComposer data={data} />
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Registro degli inviti
                </p>
                <h2 className="font-display mt-1 text-2xl">Consegna e risposta</h2>
              </div>
              {data.invitations.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nessun invito inviato.</p>
              ) : (
                <div className="grid gap-3">
                  {data.invitations.map((invitation) => (
                    <InvitationRow key={invitation.id} invitation={invitation} />
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {view === "members" && (
          <section className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Accessi correnti
              </p>
              <h2 className="font-display mt-1 text-2xl">Membri attivi</h2>
            </div>
            {data.activeMemberships.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessun membro attivo.</p>
            ) : (
              <div className="grid gap-3">
                {data.activeMemberships.map((membership) => (
                  <ActiveMemberCard key={membership.id} membership={membership} />
                ))}
              </div>
            )}
          </section>
        )}

        {view === "history" && (
          <section className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Audit operativo
              </p>
              <h2 className="font-display mt-1 text-2xl">Rifiuti e revoche recenti</h2>
            </div>
            {data.recentDecisions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessuna decisione registrata.</p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-border bg-card">
                {data.recentDecisions.map((membership) => (
                  <div
                    key={membership.id}
                    className="grid gap-2 border-b border-border p-4 last:border-b-0 md:grid-cols-[1fr_1fr_auto] md:items-center"
                  >
                    <div>
                      <p className="text-sm font-semibold">{membership.user_name ?? membership.user_email}</p>
                      <p className="text-xs text-muted-foreground">{membership.user_email}</p>
                    </div>
                    <div>
                      <p className="text-sm">{membership.organizations?.org_name ?? membership.org_code}</p>
                      <p className="text-xs text-muted-foreground">{membership.decision_note ?? "Nessuna nota"}</p>
                    </div>
                    <div className="flex items-center gap-2 md:justify-end">
                      <Badge variant={membership.status === "revoked" ? "destructive" : "secondary"}>
                        {membership.status === "revoked" ? "Revocato" : "Rifiutato"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{formatDate(membership.decided_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <div className="flex items-center gap-2 border-t border-border pt-5 text-xs text-muted-foreground">
          <Building2 size={14} />
          Tutte le decisioni sono limitate alle organizzazioni configurate in Supabase e vengono
          registrate con identità e timestamp.
        </div>
      </main>
    </div>
  );
}
