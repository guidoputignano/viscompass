"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Building2, MapPinned } from "lucide-react";
import { registerUser } from "@/app/auth/sign-up/actions";
import { ACCOUNT_TYPE_OPTIONS, type RequestedAccountType } from "@/lib/access/account-onboarding";

export function SignUpForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [requestedAccountType, setRequestedAccountType] = useState<RequestedAccountType | "">("");
  const [visNewsletter, setVisNewsletter] = useState(false);
  const [partnerNewsletter, setPartnerNewsletter] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!requestedAccountType) {
      setError("Seleziona il tipo di account: Regione o Azienda sanitaria.");
      setIsLoading(false);
      return;
    }

    if (password !== repeatPassword) {
      setError("Le password non coincidono");
      setIsLoading(false);
      return;
    }

    try {
      const result = await registerUser({
        fullName,
        email,
        password,
        visNewsletter,
        partnerNewsletter,
        requestedAccountType,
      });
      if (!result.ok) throw new Error(result.message);
      router.push("/auth/sign-up-success");
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Registrati</CardTitle>
          <CardDescription>Crea un nuovo account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignUp}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-x-4 sm:gap-y-6">
              <fieldset className="grid gap-3 sm:col-span-2">
                <legend className="mb-3 text-sm font-medium">Tipo di account richiesto</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {ACCOUNT_TYPE_OPTIONS.map((option) => {
                    const Icon = option.value === "regione" ? MapPinned : Building2;
                    return (
                      <label key={option.value} className="relative cursor-pointer">
                        <input
                          type="radio"
                          name="requested-account-type"
                          value={option.value}
                          required
                          checked={requestedAccountType === option.value}
                          onChange={() => setRequestedAccountType(option.value)}
                          className="peer sr-only"
                        />
                        <span className="flex h-full gap-3 rounded-xl border border-border bg-background p-4 transition-colors hover:border-primary/50 hover:bg-primary/[0.03] peer-checked:border-primary peer-checked:bg-primary/[0.07] peer-checked:ring-1 peer-checked:ring-primary peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2">
                          <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
                          <span className="grid gap-1">
                            <span className="text-sm font-semibold">{option.label}</span>
                            <span className="text-xs leading-5 text-muted-foreground">{option.description}</span>
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-xs leading-5 text-muted-foreground">
                  Organizzazione e ruolo saranno verificati dopo la conferma dell&apos;email.
                </p>
              </fieldset>
              <div className="grid gap-2">
                <Label htmlFor="full-name">Nome e cognome</Label>
                <Input
                  id="full-name"
                  type="text"
                  autoComplete="name"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="m@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  maxLength={128}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="repeat-password">Conferma password</Label>
                </div>
                <Input
                  id="repeat-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  maxLength={128}
                  required
                  value={repeatPassword}
                  onChange={(e) => setRepeatPassword(e.target.value)}
                />
              </div>
              <div className="grid gap-3 rounded-xl border border-border bg-secondary/30 p-4 sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Comunicazioni facoltative
                </p>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="vis-newsletter"
                    checked={visNewsletter}
                    onCheckedChange={(checked) => setVisNewsletter(checked === true)}
                  />
                  <Label htmlFor="vis-newsletter" className="cursor-pointer text-sm font-normal leading-5">
                    Desidero ricevere aggiornamenti da VIS Pharma Compass.
                  </Label>
                </div>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="partner-newsletter"
                    checked={partnerNewsletter}
                    onCheckedChange={(checked) => setPartnerNewsletter(checked === true)}
                  />
                  <Label htmlFor="partner-newsletter" className="cursor-pointer text-sm font-normal leading-5">
                    Desidero ricevere comunicazioni dai partner selezionati di VIS Pharma Compass.
                  </Label>
                </div>
                <p className="text-[11px] leading-4 text-muted-foreground">
                  Entrambe le scelte sono opzionali e non influenzano la richiesta di accesso.
                </p>
              </div>
              {error && (
                <p className="text-sm text-red-500 sm:col-span-2">{error}</p>
              )}
              <Button
                type="submit"
                className="w-full sm:col-span-2"
                disabled={isLoading}
              >
                {isLoading ? "Creazione account..." : "Registrati"}
              </Button>
              <p className="text-xs leading-5 text-muted-foreground sm:col-span-2">
                Dopo la conferma dell&apos;email potrai richiedere l&apos;accesso selezionando la tua
                organizzazione e indicando il ruolo professionale.
              </p>
            </div>
            <div className="mt-4 text-center text-sm">
              Hai già un account?{" "}
              <Link href="/auth/login" className="underline underline-offset-4">
                Accedi
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
