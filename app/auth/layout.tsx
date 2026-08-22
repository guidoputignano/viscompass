function AuthMark() {
  return (
    <svg width="36" height="36" viewBox="0 0 40 40" aria-hidden="true">
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

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-svh w-full flex-col items-center bg-background px-6 py-16 animate-in fade-in duration-700 md:py-24">
      <div className="flex w-full max-w-[460px] flex-col items-center">
        <AuthMark />
        <div className="mt-3 flex flex-col items-center leading-tight">
          <span className="text-base font-bold tracking-tight text-foreground">
            VIS PHARMA
          </span>
          <span className="text-base font-normal tracking-tight text-foreground">
            COMPASS
          </span>
        </div>
        <div className="mt-10 w-full">{children}</div>
      </div>
    </div>
  );
}
