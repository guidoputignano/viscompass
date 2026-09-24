"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  ChartSpline,
  ChartNoAxesCombined,
  Database,
  ListTree,
  ClipboardList,
  KeyRound,
  MessageSquareText,
  ShieldPlus,
} from "lucide-react";
import { VisLogo } from "@/components/vis-logo";
import { LogoutButton } from "@/components/logout-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import type { Organization } from "@/lib/dashboard-review/types";

const NAV_GROUPS = [
  {
    label: "Monitoraggio",
    items: [
      { href: "/dashboard-review/spend", label: "Quadro esecutivo", icon: ChartNoAxesCombined },
      { href: "/dashboard-review/benchmark", label: "Benchmark territoriale", icon: ChartSpline },
      { href: "/dashboard-review/biosimilar-to-euros", label: "Biosimilari → Euro", icon: ArrowLeftRight },
    ],
  },
  {
    label: "Esplorazione",
    items: [
      { href: "/pillar-a", label: "Pillar A · fonti pubbliche", icon: ChartSpline },
      { href: "/dashboard-review/ricerca", label: "Regione → AIC", icon: ListTree },
      { href: "/dashboard-review/antibiotici", label: "Antibiotici AWaRe", icon: ShieldPlus },
    ],
  },
  {
    label: "Governance",
    items: [
      { href: "/dashboard-review/obiettivi", label: "Revisioni e obiettivi", icon: ClipboardList },
      { href: "/dashboard-review/dati", label: "Fonti e qualità", icon: Database },
      { href: "/dashboard-review/richieste", label: "Richieste", icon: MessageSquareText },
    ],
  },
];

export function DashboardReviewNav({
  org,
  isAdmin = false,
  viewer = null,
  children,
}: {
  org: Organization;
  isAdmin?: boolean;
  /** The signed-in account, resolved server-side. Null only before sign-in. */
  viewer?: { email: string; name: string; nameIsEmail: boolean; isReviewer: boolean } | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-svh w-full max-w-full flex-col overflow-x-hidden md:flex-row">
      <aside className="flex w-full flex-col gap-6 border-b border-border bg-card px-5 py-5 md:sticky md:top-0 md:min-h-svh md:w-64 md:self-start md:border-b-0 md:border-r md:px-6 md:py-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/dashboard-review/spend" aria-label="Vai alla panoramica della spesa">
            <VisLogo size="sm" />
          </Link>
          <ThemeSwitcher />
        </div>

        {/* A reviewer is identified by who they are, not by which Azienda they
            belong to — naming one would suggest a perimeter that does not apply
            to them. Everyone else sees their own name above their Azienda and
            the scope statement that is true for them.

            The name falls back to the email when the account has never set one
            (lib/auth/viewer.ts); it is never derived from the address. This
            block makes no claim about the scope actually granted to a reviewer:
            whether the wider read succeeded is stated on the page performing
            it, because only that page knows. */}
        <div className="flex flex-col gap-1 rounded-lg border border-border bg-secondary/35 p-3.5">
          {viewer?.isReviewer ? (
            <span className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary">
                Revisore
              </span>
              <span
                className={`min-w-0 break-words font-medium text-foreground ${viewer.nameIsEmail ? "text-[13px]" : "text-sm"}`}
              >
                {viewer.name}
              </span>
            </span>
          ) : (
            <>
              {viewer && (
                <span
                  className={`break-words font-medium text-foreground ${viewer.nameIsEmail ? "text-[13px]" : "text-sm"}`}
                >
                  {viewer.name}
                </span>
              )}
              <span className="break-words text-[11px] text-muted-foreground">{org.org_name}</span>
              <span className="text-[11px] text-muted-foreground">
                Dati limitati al perimetro autorizzato
              </span>
            </>
          )}
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
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-foreground hover:bg-secondary")
                      }
                    >
                      <Icon
                        aria-hidden="true"
                        className={active ? "text-white" : "text-muted-foreground"}
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

        {isAdmin && (
          <div className="border-t border-border pt-4">
            <span className="hidden px-3 pb-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground md:block">
              Amministrazione
            </span>
            <Link
              href="/admin/control-center"
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              <KeyRound className="text-muted-foreground" size={15} strokeWidth={1.8} />
              Control Center
            </Link>
          </div>
        )}

        <div className="mt-auto hidden md:block">
          <LogoutButton label="Esci" className="w-full text-muted-foreground hover:text-foreground" />
        </div>
      </aside>

      <main className="min-w-0 max-w-full flex-1 overflow-x-hidden bg-background px-5 py-6 md:px-8 md:py-8 xl:px-10">
        <div className="mx-auto min-w-0 w-full max-w-[1480px]">{children}</div>
      </main>
    </div>
  );
}
