import Link from "next/link";
import { cn } from "@/lib/utils";

const ICON_SIZE = {
  sm: 30,
  md: 42,
  lg: 56,
} as const;

const TEXT_SIZE = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-xl",
} as const;

const GAP = {
  sm: "gap-2",
  md: "gap-2.5",
  lg: "gap-3.5",
} as const;

function CompassIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
      className="shrink-0"
    >
      <circle
        cx="20"
        cy="20"
        r="18"
        fill="none"
        stroke="hsl(174 82% 39%)"
        strokeWidth="1.4"
      />
      <circle
        cx="20"
        cy="20"
        r="13.5"
        fill="none"
        stroke="hsl(204 63% 12%)"
        strokeWidth="1"
        opacity=".3"
      />
      <path
        d="M20 4v3.4M20 32.6V36M4 20h3.4M32.6 20H36"
        stroke="hsl(204 63% 12%)"
        strokeWidth="1.2"
        opacity=".4"
      />
      <path d="M26.5 13.5 17.8 17.8 13.5 26.5 22.2 22.2Z" fill="hsl(174 82% 39%)" />
      <circle
        cx="20"
        cy="20"
        r="2.1"
        fill="hsl(204 63% 12%)"
        stroke="hsl(0 0% 100%)"
        strokeWidth="1.1"
      />
    </svg>
  );
}

export function VisLogo({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <div className={cn("inline-flex items-center", GAP[size], className)}>
      <CompassIcon size={ICON_SIZE[size]} />
      <div className="flex flex-col whitespace-nowrap leading-tight">
        <span className={cn("font-bold tracking-tight", TEXT_SIZE[size])}>
          VIS PHARMA
        </span>
        <span
          className={cn(
            "font-bold tracking-tight text-primary -mt-0.5",
            TEXT_SIZE[size],
          )}
        >
          COMPASS
        </span>
      </div>
    </div>
  );
}

/**
 * The logo as the way home. Every placement of the wordmark that acts as a
 * link uses this one definition, so the destination and the accessible name
 * cannot drift between the sidebar, the public headers, the portals and the
 * auth pages. The minimum height is the 44 px touch target; the colours are
 * inherited, as they are for the bare VisLogo.
 */
export function VisLogoLink({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <Link
      href="/"
      aria-label="VIS Pharma Compass · torna alla home"
      className={cn(
        "inline-flex min-h-11 items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        className,
      )}
    >
      <VisLogo size={size} />
    </Link>
  );
}
