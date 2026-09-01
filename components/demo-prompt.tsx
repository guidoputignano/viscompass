"use client";

import Link from "next/link";
import { ArrowRight, BarChart3, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const SESSION_KEY = "vis-pharma-demo-prompt-seen";

export function DemoPrompt() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(SESSION_KEY)) return;
    } catch {
      return;
    }

    const timer = window.setTimeout(() => setOpen(true), 1400);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open]);

  function close() {
    try {
      window.sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // The prompt remains safely dismissible when storage is unavailable.
    }
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[hsl(204_48%_10%/0.68)] p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="demo-prompt-title"
        className="relative grid w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl md:grid-cols-[0.9fr_1.1fr]"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Chiudi"
          className="absolute right-4 top-4 z-10 flex size-9 items-center justify-center rounded-full bg-white/90 text-muted-foreground shadow-sm transition hover:text-foreground"
        >
          <X size={17} />
        </button>

        <div className="flex flex-col justify-center p-7 md:p-10">
          <span className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-secondary text-primary">
            <BarChart3 size={22} />
          </span>
          <h2 id="demo-prompt-title" className="text-3xl font-semibold leading-tight text-[hsl(204_48%_16%)] md:text-4xl">
            Guarda il dato diventare una decisione.
          </h2>
          <p className="mt-4 max-w-md text-base leading-7 text-slate-600">
            Esplora la demo VIS Pharma Compass con un esempio già pronto.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/auth/sign-up" onClick={close}>
                Registrati <ArrowRight size={16} />
              </Link>
            </Button>
            <Button type="button" variant="outline" size="lg" onClick={close}>
              Non ora
            </Button>
          </div>
        </div>

        <div className="hidden min-h-[31rem] bg-[linear-gradient(145deg,hsl(174_48%_94%),hsl(204_40%_96%))] p-8 md:flex md:items-center">
          <div className="w-full rotate-[1.5deg] rounded-2xl border border-white bg-white p-5 shadow-[0_30px_80px_-35px_rgba(13,43,52,0.55)]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-teal-700">Spesa 2025</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">€29,7 mld</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">21 regioni</span>
            </div>
            <div className="mt-6 flex h-44 items-end gap-3 rounded-xl bg-slate-50 px-5 pb-4 pt-7">
              {[48, 72, 58, 88, 66, 94, 81].map((height, index) => (
                <div key={index} className="flex h-full flex-1 items-end">
                  <div
                    className="w-full rounded-t-md bg-[hsl(174_66%_40%)]"
                    style={{ height: `${height}%`, opacity: 0.45 + index * 0.07 }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {["Variazione", "Biosimilari", "Qualità"].map((label, index) => (
                <div key={label} className="rounded-xl border border-slate-100 p-3">
                  <p className="text-[9px] uppercase tracking-wide text-slate-400">{label}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">{["+5,9%", "91,4%", "73,8%"][index]}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
