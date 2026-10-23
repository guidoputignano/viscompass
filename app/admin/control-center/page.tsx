import Link from "next/link";
import { AccessControlCenter } from "@/components/admin/access-control-center";
import { VisLogoLink } from "@/components/vis-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminControlCenterData } from "@/lib/access/admin";
import { getAdminEmail } from "@/lib/auth/admin";
import { getCurrentOrg } from "@/lib/auth/get-current-org";
import { hasServiceRoleConfig } from "@/lib/supabase/service-role";

export const instant = false;

function Restricted() {
  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <VisLogoLink size="sm" />
      <h1 className="font-display text-2xl">Accesso riservato</h1>
      <p className="text-sm leading-6 text-muted-foreground">
        Il Control Center è visibile solo agli indirizzi autorizzati nella variabile server
        ADMIN_EMAILS.
      </p>
      <Button asChild variant="outline"><Link href="/dashboard-review/spend">Torna alla piattaforma</Link></Button>
    </div>
  );
}

function SetupRequired({ detail, embedded = false }: { detail?: string; embedded?: boolean }) {
  return (
    <div className={embedded ? "flex max-w-2xl flex-col gap-5 px-6 py-12" : "mx-auto flex min-h-svh max-w-2xl flex-col justify-center gap-5 px-6 py-12"}>
      {!embedded && <VisLogoLink size="sm" className="self-start" />}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-2xl">Attivazione Control Center richiesta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
          <p>
            Il codice applicativo è pronto. Per abilitare le operazioni amministrative, applica la
            migrazione Supabase e configura le variabili server del deployment.
          </p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>Esegui <code className="text-foreground">supabase/migrations/20260831224500_access_control_center.sql</code>.</li>
            <li>Configura <code className="text-foreground">SUPABASE_SERVICE_ROLE_KEY</code>.</li>
            <li>Aggiungi gli amministratori a <code className="text-foreground">ADMIN_EMAILS</code>.</li>
          </ol>
          {detail && (
            <p className="rounded-md bg-secondary p-3 text-xs text-foreground">Dettaglio tecnico: {detail}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default async function ControlCenterPage() {
  const adminEmail = await getAdminEmail();
  if (!adminEmail) return <Restricted />;
  // R20-05: with an approved membership the admin layout wraps this page in the dashboard shell (the same decision:
  // org and admin), so every view below drops its own chrome there.
  const embedded = Boolean(await getCurrentOrg());
  if (!hasServiceRoleConfig()) return <SetupRequired embedded={embedded} />;

  // The data read is the only thing that can throw; the JSX is built outside
  // the try so a render error is not mistaken for a schema error.
  let data: Awaited<ReturnType<typeof getAdminControlCenterData>>;
  try {
    data = await getAdminControlCenterData();
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Schema non disponibile";
    return <SetupRequired detail={detail} embedded={embedded} />;
  }
  return <AccessControlCenter adminEmail={adminEmail} data={data} embedded={embedded} />;
}
