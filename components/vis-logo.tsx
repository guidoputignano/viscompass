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

const TAGLINE_SIZE = {
  sm: "text-[9px]",
  md: "text-[10px]",
  lg: "text-xs",
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
        stroke="#12B5A5"
        strokeWidth="1.4"
      />
      <circle
        cx="20"
        cy="20"
        r="13.5"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1"
        opacity=".45"
      />
      <path
        d="M20 4v3.4M20 32.6V36M4 20h3.4M32.6 20H36"
        stroke="#ffffff"
        strokeWidth="1.2"
        opacity=".55"
      />
      <path d="M26.5 13.5 17.8 17.8 13.5 26.5 22.2 22.2Z" fill="#12B5A5" />
      <circle
        cx="20"
        cy="20"
        r="2.1"
        fill="#0B2130"
        stroke="#ffffff"
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
      <div className="flex flex-col leading-tight">
        <span
          className={cn("font-bold tracking-tight", TEXT_SIZE[size])}
        >
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
        <span
          className={cn("opacity-60 mt-0.5", TAGLINE_SIZE[size])}
        >
          governance for hospital pharmacy spend
        </span>
      </div>
    </div>
  );
}
