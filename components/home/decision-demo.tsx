"use client";

import Link from "next/link";
import { ArrowRight, CircleDollarSign, Gauge, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

const YEARS = [
  {
    year: 2023,
    spend: 7.08,
    ddd: 706,
    costPerDdd: 10.03,
    spendIndex: 100,
    dddIndex: 100,
    signal: "Baseline consolidata",
  },
  {
    year: 2024,
    spend: 6.71,
    ddd: 751,
    costPerDdd: 8.93,
    spendIndex: 94.8,
    dddIndex: 106.4,
    signal: "Il consumo cresce, il costo unitario scende",
  },
  {
    year: 2025,
    spend: 6.15,
    ddd: 783,
    costPerDdd: 7.85,
    spendIndex: 86.9,
    dddIndex: 110.9,
    signal: "Priorità: capire dove si concentra la variazione",
  },
] as const;

const X = [44, 160, 276];
const y = (value: number) => 122 - (value - 82) * 2.05;

function formatMillion(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value) + " mln";
}

export function DecisionDemo() {
  const [selectedYear, setSelectedYear] = useState(2025);
  const selected = YEARS.find((row) => row.year === selectedYear) ?? YEARS[2];
  const previous = YEARS.find((row) => row.year === selectedYear - 1);
  const spendChange = previous ? selected.spend / previous.spend - 1 : null;
  const dddChange = previous ? selected.ddd / previous.ddd - 1 : null;
  const spendPath = useMemo(
    () => YEARS.map((row, index) => `${X[index]},${y(row.spendIndex)}`).join(" "),
    [],
  );
  const dddPath = useMemo(
    () => YEARS.map((row, index) => `${X[index]},${y(row.dddIndex)}`).join(" "),
    [],
  );

  return (
    <section className="overflow-hidden rounded-[2rem] border border-teal-100 bg-white shadow-[0_34px_90px_-55px_rgba(13,43,52,0.55)]">
      <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between md:px-7">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.13em] text-teal-700">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-teal-500 opacity-50 motion-reduce:animate-none" />
                <span className="relative inline-flex size-2 rounded-full bg-teal-600" />
              </span>
              Demo interattiva
            </span>
            <span className="rounded-full border border-slate-200 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Dati sintetici
            </span>
          </div>
          <h3 className="mt-3 text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">
            Quando spesa e consumo raccontano storie diverse.
          </h3>
        </div>
        <div className="flex rounded-xl bg-slate-100 p-1" aria-label="Seleziona l'anno">
          {YEARS.map((row) => (
            <button
              key={row.year}
              type="button"
              onClick={() => setSelectedYear(row.year)}
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                row.year === selectedYear
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
              aria-pressed={row.year === selectedYear}
            >
              {row.year}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[1.12fr_0.88fr]">
        <div className="border-b border-slate-100 p-5 lg:border-b-0 lg:border-r md:p-7">
          <div className="flex items-center justify-between gap-4 text-[10px] font-semibold uppercase tracking-[0.12em]">
            <span className="inline-flex items-center gap-2 text-teal-700"><span className="size-2 rounded-full bg-teal-500" /> DDD · indice</span>
            <span className="inline-flex items-center gap-2 text-indigo-700"><span className="size-2 rounded-full bg-indigo-500" /> Spesa · indice</span>
          </div>
          <svg viewBox="0 0 320 160" className="mt-4 h-52 w-full" role="img" aria-label="Andamento sintetico di spesa e DDD dal 2023 al 2025">
            {[42, 82, 122].map((lineY) => (
              <line key={lineY} x1="24" x2="296" y1={lineY} y2={lineY} stroke="#e2e8f0" strokeDasharray="4 5" />
            ))}
            <polyline points={dddPath} fill="none" stroke="#0f9f91" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="vis-line-draw" />
            <polyline points={spendPath} fill="none" stroke="#6366f1" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="vis-line-draw vis-line-draw-delay" />
            {YEARS.map((row, index) => (
              <g key={row.year} className="cursor-pointer" onClick={() => setSelectedYear(row.year)}>
                <circle cx={X[index]} cy={y(row.dddIndex)} r={row.year === selectedYear ? 6 : 4} fill="#0f9f91" stroke="white" strokeWidth="2" />
                <circle cx={X[index]} cy={y(row.spendIndex)} r={row.year === selectedYear ? 6 : 4} fill="#6366f1" stroke="white" strokeWidth="2" />
                <text x={X[index]} y="151" textAnchor="middle" className="fill-slate-400 text-[9px] font-semibold">{row.year}</text>
              </g>
            ))}
          </svg>
        </div>

        <div className="flex flex-col justify-between bg-[linear-gradient(145deg,#f5fffd,#f8fafc)] p-5 md:p-7">
          <div className="grid grid-cols-3 gap-2.5">
            <div className="rounded-2xl border border-white bg-white p-3 shadow-sm">
              <CircleDollarSign className="text-indigo-500" size={17} />
              <p className="mt-4 text-lg font-semibold text-slate-900">{formatMillion(selected.spend)}</p>
              <p className="mt-1 text-[10px] text-slate-500">Spesa</p>
            </div>
            <div className="rounded-2xl border border-white bg-white p-3 shadow-sm">
              <Gauge className="text-teal-600" size={17} />
              <p className="mt-4 text-lg font-semibold text-slate-900">{selected.ddd}k</p>
              <p className="mt-1 text-[10px] text-slate-500">DDD</p>
            </div>
            <div className="rounded-2xl border border-white bg-white p-3 shadow-sm">
              <ShieldCheck className="text-emerald-600" size={17} />
              <p className="mt-4 text-lg font-semibold text-slate-900">€{selected.costPerDdd.toFixed(2)}</p>
              <p className="mt-1 text-[10px] text-slate-500">per DDD</p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl bg-[hsl(204_48%_16%)] p-5 text-white">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-teal-300">Segnale {selected.year}</p>
            <p className="mt-2 text-base font-semibold leading-6">{selected.signal}</p>
            {previous && (
              <div className="mt-4 flex flex-wrap gap-2 text-[10px]">
                <span className="rounded-full bg-white/10 px-2.5 py-1">Spesa {spendChange! < 0 ? "↓" : "↑"} {Math.abs(spendChange! * 100).toFixed(1)}%</span>
                <span className="rounded-full bg-white/10 px-2.5 py-1">DDD {dddChange! < 0 ? "↓" : "↑"} {Math.abs(dddChange! * 100).toFixed(1)}%</span>
              </div>
            )}
          </div>

          <Button asChild variant="link" className="mt-3 w-fit px-0 text-teal-700">
            <Link href="/auth/sign-up">Esplora la demo completa <ArrowRight size={15} /></Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
