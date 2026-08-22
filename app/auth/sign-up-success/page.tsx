import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-md">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">
                Grazie per esserti registrato!
              </CardTitle>
              <CardDescription>
                Controlla la tua email per confermare
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                La registrazione è andata a buon fine. Controlla la tua email
                per confermare l&apos;account prima di accedere.
              </p>
              <Button asChild className="mt-4 w-full">
                <Link href="/auth/login">Accedi ora</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
