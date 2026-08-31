"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { respondToFeatureRequest } from "@/app/admin/feature-requests/actions";

export function FeatureRequestResponseForm({ requestId }: { requestId: number }) {
  const [response, setResponse] = useState("");
  const [outcome, setOutcome] = useState<"answered" | "declined">("answered");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent" | "error">("idle");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!response.trim()) return;
    setStatus("submitting");
    try {
      await respondToFeatureRequest({ requestId, outcome, response });
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  if (status === "sent") {
    return <p className="text-sm font-medium text-foreground">Risposta inviata.</p>;
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <div className="grid gap-2">
        <Label htmlFor={`response-${requestId}`}>Risposta</Label>
        <Textarea
          id={`response-${requestId}`}
          required
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          rows={3}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={outcome}
          onChange={(e) => setOutcome(e.target.value as "answered" | "declined")}
          className="rounded-md border border-input bg-transparent px-2.5 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="answered">Rispondi</option>
          <option value="declined">Rifiuta</option>
        </select>
        <Button type="submit" disabled={status === "submitting" || !response.trim()}>
          {status === "submitting" ? "Invio in corso..." : "Invia"}
        </Button>
        {status === "error" && (
          <span className="text-xs text-destructive">
            Invio non riuscito. Riprova.
          </span>
        )}
      </div>
    </form>
  );
}
