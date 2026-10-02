"use client";

// A panel-local segmented control whose state lives in the URL.
//
// Unlike the global filter bar, these options do not change what the server
// fetches: they re-sort, re-slice or re-colour rows the reader already holds.
// So a change must NOT navigate — a navigation re-renders the page on the
// server (~10 s at reviewer scale) for nothing. The option is written into
// the URL with history.replaceState and read back on a fresh load by the
// server (parseViewOptions), so a shared link opens in the same state.
//
// THE STATE ARGUMENT MUST BE null. The App Router patches replaceState: with
// a null state it re-attaches its own internals and syncs the router's
// canonical URL without a fetch; handed its own state object back (the one
// with `__NA`) it treats the call as internal and ignores it, and the next
// router update (a refresh, a server action) rewrites the address bar to the
// stale URL — the copied link would then open on the default view.

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { localOptionParams, withViewOption } from "@/lib/dashboard-review/pillar-b/view-options";

/** Fired after a local option is written to the URL, so the filter bar can tell a local view from the default. */
export const VIEW_OPTION_EVENT = "pillarb:viewoption";

export function useUrlOption<T extends string | number>(
  key: string, initial: T, defaultValue: T,
): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(initial);
  const set = useCallback((next: T) => {
    setValue(next);
    if (typeof window === "undefined") return;
    const search = withViewOption(window.location.search, key, next, defaultValue);
    window.history.replaceState(null, "", `${window.location.pathname}${search}${window.location.hash}`);
    window.dispatchEvent(new Event(VIEW_OPTION_EVENT));
  }, [key, defaultValue]);
  return [value, set];
}

export function LocalToggle<T extends string | number>({
  label, value, options, onChange, ariaLabel,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string; title?: string }>;
  onChange: (next: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="flex flex-wrap items-center gap-0.5 rounded-lg bg-secondary p-0.5" role="group" aria-label={ariaLabel}>
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            title={o.title}
            aria-pressed={o.value === value}
            onClick={() => onChange(o.value)}
            className={
              "rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary " +
              (o.value === value ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-card hover:text-foreground")
            }
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * A link to another global-filter state that keeps the panel-local options
 * the reader has set since the page loaded. A server-rendered href only knows
 * the options of the request; this appends the current ones at click time, the
 * same way the filter bar does, so the address bar never drops a local choice
 * the panels still show. Without JavaScript it is an ordinary link.
 */
export function KeepLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <Link href={href} scroll={false} className={className} onClick={(e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      const url = new URL(href, window.location.origin);
      localOptionParams(window.location.search).forEach((v, k) => { if (!url.searchParams.has(k)) url.searchParams.set(k, v); });
      router.replace(`${url.pathname}${url.search}`, { scroll: false });
    }}>
      {children}
    </Link>
  );
}
