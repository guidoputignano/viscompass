"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function UpdatePasswordForm({
  className,
  recovery = false,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & { recovery?: boolean }) {
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.updateUser(
        recovery ? { password } : { password, current_password: currentPassword },
      );
      if (error) throw error;
      setCurrentPassword("");
      setPassword("");
      router.push("/dashboard-review/spend");
    } catch (error: unknown) {
      console.error("Password update failed", error);
      setError("Non è stato possibile aggiornare la password. Riprova.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Imposta una nuova password</CardTitle>
          <CardDescription>
            {recovery
              ? "Scegli una nuova password tramite il link di recupero."
              : "Conferma la password attuale prima di sceglierne una nuova."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleForgotPassword}>
            <div className="flex flex-col gap-6">
              {!recovery && (
                <div className="grid gap-2">
                  <Label htmlFor="current-password">Password attuale</Label>
                  <Input
                    id="current-password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="password">Nuova password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Nuova password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              {!recovery && (
                <p className="text-xs text-muted-foreground">
                  Non ricordi la password attuale? <Link href="/auth/forgot-password" className="underline">Usa il recupero via email</Link>.
                </p>
              )}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Salvataggio…" : "Salva la nuova password"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
