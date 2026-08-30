"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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

export function DashboardReviewNav({
  orgs,
  children,
}: {
  orgs: Organization[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentOrg = searchParams.get("org") ?? orgs[0]?.org_code ?? "";

  function onScopeChange(orgCode: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("org", orgCode);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex min-h-svh w-full flex-col md:flex-row">
      <aside className="flex w-full flex-col gap-6 border-b border-border bg-card px-5 py-5 md:min-h-svh md:w-60 md:border-b-0 md:border-r">
        <Link href="/dashboard-review/spend">
          <VisLogo size="sm" />
        </Link>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Visualizza come
          </label>
          <select
            value={currentOrg}
            onChange={(e) => onScopeChange(e.target.value)}
            className="rounded-md border border-input bg-transparent px-2.5 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {orgs.map((o) => (
              <option key={o.org_code} value={o.org_code}>
                {o.org_name}
              </option>
            ))}
          </select>
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
                href={`${m.href}?org=${currentOrg}`}
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
            Dati dimostrativi
          </span>
        </div>
      </aside>

      <main className="flex-1 bg-background px-5 py-6 md:px-10 md:py-8">{children}</main>
    </div>
  );
}
