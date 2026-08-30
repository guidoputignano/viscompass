"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { VisLogo } from "@/components/vis-logo";
import type { Organization } from "@/lib/dashboard-review/types";

const MODULES = [
  { href: "/dashboard-review/spend", label: "Spesa" },
  { href: "/dashboard-review/ricerca", label: "Ricerca" },
  { href: "/dashboard-review/biosimilar-to-euros", label: "Biosimilare → Euro" },
  { href: "/dashboard-review/obiettivi", label: "Obiettivi" },
  { href: "/dashboard-review/richieste", label: "Richieste" },
  { href: "/dashboard-review/dati", label: "Dati" },
];

const ORG_TYPE_LABEL: Record<Organization["org_type"], string> = {
  asl: "Azienda sanitaria locale",
  regione: "Vista regionale",
};

export function DashboardReviewNav({
  org,
  children,
}: {
  org: Organization;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-svh w-full flex-col md:flex-row">
      <aside className="flex w-full flex-col gap-6 border-b border-border bg-card px-5 py-5 md:min-h-svh md:w-60 md:border-b-0 md:border-r">
        <Link href="/dashboard-review/spend">
          <VisLogo size="sm" />
        </Link>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {ORG_TYPE_LABEL[org.org_type]}
          </span>
          <span className="text-sm font-medium text-foreground">{org.org_name}</span>
          <span className="text-[11px] text-muted-foreground">
            Anteprima interna — non ancora la destinazione post-accesso
          </span>
        </div>

        <nav className="flex flex-row flex-wrap gap-1 md:flex-col">
          {MODULES.map((m) => {
            const active = pathname === m.href;
            return (
              <Link
                key={m.href}
                href={m.href}
                className={
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors " +
                  (active
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-secondary")
                }
              >
                {m.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto hidden md:block">
          <span
            className="inline-block rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide"
            style={{ backgroundColor: "hsl(38 92% 50% / 0.14)", color: "hsl(32 70% 32%)" }}
          >
            Accesso reale, dati in verifica
          </span>
        </div>
      </aside>

      <main className="flex-1 bg-background px-5 py-6 md:px-10 md:py-8">{children}</main>
    </div>
  );
}
