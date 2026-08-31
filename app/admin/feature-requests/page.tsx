import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FeatureRequestResponseForm } from "@/components/admin/feature-request-response-form";
import { getAdminEmail } from "@/lib/auth/admin";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { formatDate } from "@/lib/dashboard-review/format";

// Reads the live session on every request to re-check the admin
// allow-list — there's nothing here safe to prerender.
export const instant = false;

interface PendingRequestRow {
  id: number;
  org_code: string | null;
  description: string;
  decision_impact: string | null;
  frequency: string | null;
  created_at: string;
  organizations: { org_name: string } | null;
}

export default async function AdminFeatureRequestsPage() {
  const adminEmail = await getAdminEmail();

  if (!adminEmail) {
    return (
      <div className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="font-display text-xl">Accesso riservato</h1>
        <p className="text-sm text-muted-foreground">
          Questa sezione è visibile solo agli amministratori autorizzati.
        </p>
      </div>
    );
  }

  // feature_requests' own RLS only lets a caller read requests they
  // submitted themselves (see supabase_schema.sql), so an admin listing
  // everyone's pending requests has to go through the service-role
  // client — the admin gate above is what makes that safe here.
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("feature_requests")
    .select("id, org_code, description, decision_impact, frequency, created_at, organizations(org_name)")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .returns<PendingRequestRow[]>();

  if (error) throw new Error(`feature_requests admin query failed: ${error.message}`);
  const requests = data ?? [];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-8 md:px-10">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.15em] text-primary">Admin</p>
        <h1 className="font-display mt-1 text-2xl md:text-3xl">Richieste in attesa</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Autenticato come {adminEmail}. Rispondere qui imposta lo stato della richiesta e la
          risposta visibile a chi l&apos;ha inviata.
        </p>
      </div>

      {requests.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nessuna richiesta in attesa.</p>
      ) : (
        requests.map((r) => (
          <Card key={r.id}>
            <CardHeader>
              <CardTitle className="text-base">
                {r.organizations?.org_name ?? r.org_code ?? "Organizzazione sconosciuta"}
              </CardTitle>
              <p className="text-xs text-muted-foreground">{formatDate(r.created_at)}</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <p className="text-sm text-foreground">{r.description}</p>
                {r.decision_impact && (
                  <p className="text-xs text-muted-foreground">
                    Decisione che aiuterebbe a prendere: {r.decision_impact}
                  </p>
                )}
                {r.frequency && (
                  <p className="text-xs text-muted-foreground">Frequenza: {r.frequency}</p>
                )}
              </div>

              <FeatureRequestResponseForm requestId={r.id} />
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
