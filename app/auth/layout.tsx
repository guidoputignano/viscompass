import { ThemeSwitcher } from "@/components/theme-switcher";
import { VisLogoLink } from "@/components/vis-logo";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-svh w-full flex-col items-center bg-background px-6 py-16 animate-in fade-in duration-700 md:py-24">
      <div className="absolute right-5 top-5"><ThemeSwitcher /></div>
      <div className="flex w-full max-w-[460px] flex-col items-center">
        <VisLogoLink size="md" />
        <div className="mt-10 w-full">{children}</div>
      </div>
    </div>
  );
}
