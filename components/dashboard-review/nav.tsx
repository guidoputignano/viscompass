"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  ChartNoAxesCombined,
  Database,
  FlaskConical,
  Goal,
  MessageSquareText,
  ShieldPlus,
} from "lucide-react";
import { VisLogo } from "@/components/vis-logo";
import type { Organization } from "@/lib/dashboard-review/types";

const NAV_GROUPS = [
  {
    label: "Monitoraggio",
    items: [
      { href: "/dashboard-review/spend", label: "Spesa", icon: ChartNoAxesCombined },
      { href: "/dashboard-review/biosimilar-to-euros", label: "Biosimilare → Euro", icon: ArrowLeftRight },
      { href: "/dashboard-review/antibiotici", label: "Antibiotici", icon: ShieldPlus },
    ],
  },
  {
    label: "Decision support",
    items: [
      { href: "/dashboard-review/ricerca", label: "Ricerca molecole", icon: FlaskConical },
      { href: "/dashboard-review/obiettivi", label: "Obiettivi", icon: Goal },
    ],
  },
  {
    label: "Operazioni",
    items: [
      { href: "/dashboard-review/dati", label: "Dati e caricamenti", icon: Database },
      { href: "/dashboard-review/richieste", label: "Richieste", icon: MessageSquareText },
    ],
  },
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
      <aside className="flex w-full flex-col gap-6 border-b border-border bg-card px-5 py-5 md:sticky md:top-0 md:min-h-svh md:w-64 md:self-start md:border-b-0 md:border-r md:px-6 md:py-6">
        <Link href="/dashboard-review/spend" aria-label="Vai alla panoramica della spesa">
          <VisLogo size="sm" />
        </Link>

        <div className="flex flex-col gap-1 rounded-lg border border-border bg-secondary/35 p-3.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {ORG_TYPE_LABEL[org.org_type]}
          </span>
          <span className="text-sm font-medium text-foreground">{org.org_name}</span>
          <span className="text-[11px] text-muted-foreground">
            Dati limitati al perimetro autorizzato
          </span>
        </div>

        <nav className="flex flex-row flex-wrap gap-4 md:flex-col md:gap-5" aria-label="Moduli del cruscotto">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="flex min-w-0 flex-col gap-1">
              <span className="hidden px-3 pb-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground md:block">
                {group.label}
              </span>
              <div className="flex flex-row flex-wrap gap-1 md:flex-col">
                {group.items.map((item) => {
                  const active = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={
                        "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors " +
                        (active
                          ? "bg-[hsl(174_46%_24%)] text-white"
                          : "text-foreground hover:bg-secondary")
                      }
                    >
                      <Icon
                        aria-hidden="true"
                        className={active ? "text-[hsl(78_75%_60%)]" : "text-muted-foreground"}
                        size={15}
                        strokeWidth={1.8}
                      />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-auto hidden md:block">
          <span
            className="inline-block rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide"
            style={{ backgroundColor: "hsl(38 92% 50% / 0.14)", color: "hsl(32 70% 32%)" }}
          >
            Evidenza operativa · non clinica
          </span>
        </div>
      </aside>

      <main className="min-w-0 flex-1 bg-background px-5 py-6 md:px-8 md:py-8 xl:px-10">
        <div className="mx-auto w-full max-w-[1480px]">{children}</div>
      </main>
    </div>
  );
}
