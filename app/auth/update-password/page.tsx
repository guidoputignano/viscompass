import { UpdatePasswordForm } from "@/components/update-password-form";
import { Suspense } from "react";

async function PasswordMode({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams;
  return <UpdatePasswordForm recovery={mode === "recovery"} />;
}

export default function Page({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Caricamento…</div>}>
      <PasswordMode searchParams={searchParams} />
    </Suspense>
  );
}
