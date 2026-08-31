"use client";

import { CircleAlert, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-5 py-10">
      <div className="max-w-lg rounded-2xl border border-border bg-card p-7 text-center shadow-sm">
        <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-rose-50 text-rose-700"><CircleAlert size={20} /></span>
        <h1 className="font-display mt-4 text-2xl">L’analisi non è disponibile</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">La richiesta non ha prodotto un risultato verificabile. Riprova; se il problema persiste, controlla lo stato delle fonti e dei caricamenti.</p>
        <Button className="mt-5" onClick={reset}><RotateCcw size={14} /> Riprova</Button>
      </div>
    </div>
  );
}
