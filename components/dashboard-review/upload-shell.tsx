"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { recordUpload } from "@/lib/dashboard-review/actions";

const BUCKET = "uploads";

export function UploadShell({ orgCode }: { orgCode: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function onUpload() {
    if (!file) return;
    setStatus("uploading");
    setErrorMessage(null);

    try {
      // Uploaded directly from the browser under the caller's own
      // session — Storage RLS (supabase_schema.sql section 7) is what
      // actually restricts writes to the caller's own org folder, the
      // same way the uploads table's own INSERT policy restricts the row
      // below. Nothing here re-implements that check.
      const storagePath = `${orgCode}/${Date.now()}-${file.name}`;
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, file);
      if (uploadError) throw uploadError;

      await recordUpload({
        storagePath,
        fileName: file.name,
        periodCoveredStart: periodStart || null,
        periodCoveredEnd: periodEnd || null,
      });

      setStatus("done");
      setFile(null);
      setPeriodStart("");
      setPeriodEnd("");
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Caricamento non riuscito.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <label
        htmlFor="upload-shell-input"
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-secondary/30 px-6 py-10 text-center transition-colors hover:bg-secondary/50"
      >
        <span className="text-sm font-medium text-foreground">
          {file?.name ?? "Trascina un file qui o clicca per selezionarlo"}
        </span>
        <span className="text-xs text-muted-foreground">CSV o XLSX</span>
        <input
          id="upload-shell-input"
          type="file"
          accept=".csv,.xlsx"
          className="sr-only"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setStatus("idle");
          }}
        />
      </label>

      <div className="flex flex-wrap gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="period-start" className="text-xs">
            Periodo coperto, da (facoltativo)
          </Label>
          <Input
            id="period-start"
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            className="w-auto"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="period-end" className="text-xs">
            a (facoltativo)
          </Label>
          <Input
            id="period-end"
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            className="w-auto"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="button" disabled={!file || status === "uploading"} onClick={onUpload}>
          {status === "uploading" ? "Caricamento in corso..." : "Carica"}
        </Button>
        {status === "done" && (
          <span className="text-xs text-muted-foreground">Caricato.</span>
        )}
        {status === "error" && (
          <span className="text-xs text-destructive">{errorMessage}</span>
        )}
      </div>
    </div>
  );
}
