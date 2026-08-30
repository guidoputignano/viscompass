import { DashboardReviewNav } from "@/components/dashboard-review/nav";
import { VisLogo } from "@/components/vis-logo";
import { getCurrentOrg } from "@/lib/auth/get-current-org";

// Reads the live session on every request — there's no meaningful static
// shell to prerender for a page whose entire content depends on who is
// asking.
export const instant = false;

export default async function DashboardReviewLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const org = await getCurrentOrg();

  if (!org) {
    return (
      <div className="flex min-h-svh w-full flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <VisLogo size="sm" />
        <h1 className="font-display text-xl">Nessuna organizzazione approvata</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Il tuo accesso è in fase di verifica. Questa sezione diventa visibile non appena
          un&apos;organizzazione approva la tua richiesta di adesione.
        </p>
      </div>
    );
  }

  return <DashboardReviewNav org={org}>{children}</DashboardReviewNav>;
}
