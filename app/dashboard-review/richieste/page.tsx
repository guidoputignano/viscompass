"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { resolveScope, submitFeatureRequest } from "@/lib/dashboard-review/queries";

const FREQUENCY_OPTIONS = [
  { value: "quotidiana", label: "Quotidiana" },
  { value: "settimanale", label: "Settimanale" },
  { value: "mensile", label: "Mensile" },
  { value: "una_tantum", label: "Occasionale" },
];

export default function RichiestePage() {
  const searchParams = useSearchParams();
  const org = searchParams.get("org") ?? undefined;

  const [description, setDescription] = useState("");
  const [decisionImpact, setDecisionImpact] = useState("");
  const [frequency, setFrequency] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent">("idle");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;
    setStatus("submitting");
    const scope = await resolveScope(org);
    await submitFeatureRequest({
      org_code: scope.org_code,
      description: description.trim(),
      decision_impact: decisionImpact.trim() || null,
      frequency: frequency || null,
    });
    setStatus("sent");
    setDescription("");
    setDecisionImpact("");
    setFrequency("");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.15em] text-primary">Richieste</p>
        <h1 className="font-display mt-1 text-2xl md:text-3xl">Richiedi una nuova analisi</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Segnala un&apos;analisi che ti servirebbe e non è ancora disponibile. Le risposte del
          team vengono comunicate separatamente, non da questa schermata.
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardContent className="p-6">
          {status === "sent" ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium text-foreground">Richiesta inviata.</p>
              <p className="text-sm text-muted-foreground">
                Riceverai un riscontro separatamente. Puoi inviare un&apos;altra richiesta quando
                vuoi.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 w-fit"
                onClick={() => setStatus("idle")}
              >
                Invia un&apos;altra richiesta
              </Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col gap-5">
              <div className="grid gap-2">
                <Label htmlFor="description">Descrizione</Label>
                <Textarea
                  id="description"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Che cosa vorresti poter vedere o verificare?"
                  rows={4}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="decision-impact">Che decisione aiuterebbe a prendere</Label>
                <Textarea
                  id="decision-impact"
                  value={decisionImpact}
                  onChange={(e) => setDecisionImpact(e.target.value)}
                  placeholder="Facoltativo"
                  rows={3}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="frequency">Con quale frequenza ti servirebbe</Label>
                <select
                  id="frequency"
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Facoltativo</option>
                  {FREQUENCY_OPTIONS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              <Button type="submit" disabled={status === "submitting" || !description.trim()}>
                {status === "submitting" ? "Invio in corso..." : "Invia richiesta"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
