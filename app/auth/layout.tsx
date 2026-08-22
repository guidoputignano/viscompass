// NOTE: copy below is in English. Flag for confirmation: should this be
// Italian instead, matching the rest of the product's locale? Not changed
// without explicit sign-off.
const EYEBROW = "VIS PHARMA COMPASS";
const TAGLINE =
  "A shorter distance between a savings opportunity and the decision to act on it.";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-svh w-full animate-in fade-in duration-700">
      <div
        className="hidden md:flex md:w-[42%] lg:w-[40%] flex-col justify-center gap-6 px-12 lg:px-16"
        style={{ backgroundColor: "hsl(204 63% 12%)", color: "hsl(160 13% 95%)" }}
      >
        <span className="text-xs font-medium uppercase tracking-[0.2em] opacity-70">
          {EYEBROW}
        </span>
        <div
          className="h-[2px] w-10"
          style={{ backgroundColor: "hsl(174 82% 39%)" }}
        />
        <p className="font-display text-2xl leading-snug lg:text-3xl">
          {TAGLINE}
        </p>
      </div>
      <div className="flex flex-1 items-center justify-center bg-background">
        {children}
      </div>
    </div>
  );
}
