"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function UploadShell() {
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <label
        htmlFor="upload-shell-input"
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-secondary/30 px-6 py-10 text-center transition-colors hover:bg-secondary/50"
      >
        <span className="text-sm font-medium text-foreground">
          {fileName ?? "Trascina un file qui o clicca per selezionarlo"}
        </span>
        <span className="text-xs text-muted-foreground">CSV o XLSX</span>
        <input
          id="upload-shell-input"
          type="file"
          accept=".csv,.xlsx"
          className="sr-only"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
        />
      </label>

      <div className="flex items-center gap-3">
        <Button type="button" disabled>
          Carica
        </Button>
        <span className="text-xs text-muted-foreground">
          Anteprima dell&apos;interfaccia — il caricamento non è ancora attivo.
        </span>
      </div>
    </div>
  );
}
