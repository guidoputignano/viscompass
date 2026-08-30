"use client";

import { useEffect, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { searchMolecules } from "@/lib/dashboard-review/actions";
import type { CanonicalFact } from "@/lib/dashboard-review/types";
import { formatEur, formatEurPrecise } from "@/lib/dashboard-review/format";

export default function RicercaPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CanonicalFact[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    startTransition(async () => {
      const rows = await searchMolecules(query);
      setResults(rows);
    });
  }, [query]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.15em] text-primary">Ricerca</p>
        <h1 className="font-display mt-1 text-2xl md:text-3xl">Ricerca molecole</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Cerca per principio attivo, marca, AIC o codice ATC nel proprio ambito.
        </p>
      </div>

      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Es. Trastuzumab, L01FD01, Humira..."
        className="max-w-md"
      />

      <Card>
        <CardContent className="overflow-x-auto p-0">
          {query.trim() === "" ? (
            <p className="p-8 text-sm text-muted-foreground">
              Digita per cercare fra i record del proprio ambito.
            </p>
          ) : results.length === 0 ? (
            <p className="p-8 text-sm text-muted-foreground">
              {isPending ? "Ricerca in corso..." : "Nessun risultato."}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Principio attivo</th>
                  <th className="px-4 py-3 font-medium">Marca</th>
                  <th className="px-4 py-3 font-medium">ATC5</th>
                  <th className="px-4 py-3 font-medium">Canale</th>
                  <th className="px-4 py-3 font-medium">ASL</th>
                  <th className="px-4 py-3 text-right font-medium">Spesa totale</th>
                  <th className="px-4 py-3 text-right font-medium">€/mg</th>
                  <th className="px-4 py-3 text-right font-medium">€/DDD</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium text-foreground">{r.active_substance}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.brand_name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.atc5}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.channel}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.asl_code}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      {r.total_cost_eur !== null ? formatEur(r.total_cost_eur) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {r.cost_per_mg !== null ? formatEurPrecise(r.cost_per_mg) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {r.cost_per_ddd !== null ? formatEurPrecise(r.cost_per_ddd) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
                        style={
                          r.biosimilar_flag
                            ? { backgroundColor: "hsl(174 82% 39% / 0.12)", color: "hsl(174 70% 28%)" }
                            : { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }
                        }
                      >
                        {r.biosimilar_flag ? "Biosimilare" : "Originator"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
