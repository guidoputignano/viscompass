import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  CalendarClock,
  Check,
  CircleDollarSign,
  Columns3,
  DatabaseZap,
  FileCheck2,
  FlaskConical,
  LineChart,
  Radar,
  ReceiptText,
  Route,
  SearchCheck,
  ShieldCheck,
  ShoppingCart,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DemoPrompt } from "@/components/demo-prompt";
import { DecisionDemo } from "@/components/home/decision-demo";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { VisLogo } from "@/components/vis-logo";

const PROOF_STATS = [
  { value: "€29,7 mld", label: "spesa nazionale 2025" },
  { value: "529.979", label: "record nazionali" },
  { value: "21", label: "regioni e province" },
  { value: "73,8%", label: "prodotti interpretati" },
];

const BENEFITS = [
  {
    icon: LineChart,
    kicker: "Vedi prima",
    title: "Scopri lo scostamento mentre puoi ancora agire.",
    visual: "trend",
  },
  {
    icon: CircleDollarSign,
    kicker: "Confronta bene",
    title: "Misura il costo vero, non il prezzo della confezione.",
    visual: "cost",
  },
  {
    icon: SearchCheck,
    kicker: "Verifica subito",
    title: "Dal segnale alla fonte, senza ricostruire PDF.",
    visual: "evidence",
  },
] as const;

const PHASES = [
  {
    number: "0",
    icon: CalendarClock,
    title: "Programmazione",
    description: "Farmaci in arrivo e stime d’impatto.",
  },
  {
    number: "1",
    icon: BarChart3,
    title: "Reportistica",
    description: "Analisi di spesa direzionale e ad hoc.",
  },
  {
    number: "2",
    icon: ShoppingCart,
    title: "Acquisto",
    description: "Istruttoria gare e Commissione Terapeutica.",
  },
  {
    number: "3",
    icon: Boxes,
    title: "Scorte",
    description: "Scadenze e redistribuzioni sotto controllo.",
  },
  {
    number: "4",
    icon: FlaskConical,
    title: "Allestimento",
    description: "Quadratura aggregata dei consumi oncologici.",
  },
  {
    number: "5",
    icon: ReceiptText,
    title: "Rendicontazione",
    description: "Riconciliazione File F e registri AIFA.",
  },
  {
    number: "6",
    icon: Columns3,
    title: "Confronto e chiusura",
    description: "Benchmark tra aziende, su mandato regionale.",
  },
] as const;

const MODULES = [
  {
    id: "M1",
    icon: LineChart,
    title: "Spesa e consumi",
    description: "Scostamenti rilevati mentre l’esercizio è ancora aperto.",
  },
  {
    id: "M2",
    icon: Radar,
    title: "Biosimilari e brevetti",
    description: "Opportunità e scadenze identificate prima che sia tardi.",
  },
  {
    id: "M3",
    icon: ShieldCheck,
    title: "File F e rimborsi",
    description: "Termini e anomalie verificati prima di perdere il rimborso.",
  },
  {
    id: "M4",
    icon: Boxes,
    title: "Scorte e carenze",
    description: "Scorte a rischio segnalate prima che diventino una perdita.",
  },
  {
    id: "M5",
    icon: FlaskConical,
    title: "Allestimenti",
    description: "Sprechi oncologici misurati in aggregato, mai per paziente.",
  },
  {
    id: "M6",
    icon: Columns3,
    title: "Confronto tra aziende",
    description: "Stessa molecola e stesso canale, con titolarità regionale.",
  },
  {
    id: "M7",
    icon: CircleDollarSign,
    title: "Budget impact",
    description: "Impatto stimato prima dell’ingresso del farmaco in prontuario.",
  },
] as const;

function DashboardPreview() {
  return (
    <div className="vis-soft-float relative mx-auto w-full max-w-2xl">
      <div className="absolute -inset-8 -z-10 rounded-[3rem] bg-[radial-gradient(circle_at_top_left,hsl(174_70%_79%/0.55),transparent_48%),radial-gradient(circle_at_bottom_right,hsl(204_65%_82%/0.45),transparent_46%)] blur-2xl" />
      <div className="overflow-hidden rounded-[1.7rem] border border-white/80 bg-white shadow-[0_36px_100px_-42px_rgba(13,43,52,0.6)]">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-rose-300" />
            <span className="size-2 rounded-full bg-amber-300" />
            <span className="size-2 rounded-full bg-emerald-300" />
          </div>
          <span className="rounded-full bg-teal-50 px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-teal-700">Dati verificabili</span>
        </div>
        <div className="grid min-h-[29rem] grid-cols-[5rem_1fr] sm:grid-cols-[8.5rem_1fr]">
          <aside className="bg-[hsl(204_48%_17%)] p-3 text-white sm:p-4">
            <div className="mb-7 flex size-9 items-center justify-center rounded-xl bg-[hsl(174_66%_40%)] text-[11px] font-bold">VIS</div>
            <div className="space-y-2">
              {[BarChart3, DatabaseZap, Route, FileCheck2].map((Icon, index) => (
                <div
                  key={index}
                  className={`flex items-center gap-2 rounded-lg px-2.5 py-2.5 ${index === 0 ? "bg-[hsl(174_66%_40%)]" : "text-white/55"}`}
                >
                  <Icon size={14} />
                  <span className="hidden text-[10px] font-medium sm:block">{["Spesa", "Biosimilari", "Benchmark", "Qualità"][index]}</span>
                </div>
              ))}
            </div>
          </aside>
          <div className="min-w-0 bg-[hsl(210_25%_98%)] p-4 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-teal-700">Quadro esecutivo</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-900">Spesa e consumo</h2>
              </div>
              <span className="text-[10px] text-slate-400">Italia · 2025</span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                ["Spesa", "€29,7 mld"],
                ["Var. a/a", "+5,9%"],
                ["Copertura", "73,8%"],
                ["Regioni", "21"],
              ].map(([label, value], index) => (
                <div key={label} className={`rounded-xl border p-3 ${index === 0 ? "border-teal-200 bg-teal-50" : "border-slate-100 bg-white"}`}>
                  <p className="text-[8px] uppercase tracking-wide text-slate-400">{label}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-[1.45fr_0.75fr]">
              <div className="rounded-xl border border-slate-100 bg-white p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold text-slate-700">Spesa per categoria ATC</p>
                  <span className="text-[8px] text-slate-400">milioni €</span>
                </div>
                <div className="mt-5 flex h-36 items-end justify-around gap-3 border-b border-slate-100 px-2">
                  {[84, 44, 31, 24, 18].map((height, index) => (
                    <div key={index} className="flex h-full flex-1 items-end gap-1">
                      <div className="w-1/2 rounded-t bg-slate-200" style={{ height: `${height - 5}%` }} />
                      <div className="w-1/2 rounded-t bg-[hsl(174_66%_40%)]" style={{ height: `${height}%` }} />
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex justify-around text-[8px] text-slate-400"><span>L</span><span>B</span><span>A</span><span>J</span><span>N</span></div>
              </div>
              <div className="rounded-xl border border-slate-100 bg-white p-4">
                <p className="text-[10px] font-semibold text-slate-700">Segnali</p>
                <div className="mt-4 space-y-3">
                  {["ATC L", "Biosimilari", "Mapping"].map((label, index) => (
                    <div key={label} className="flex items-center justify-between gap-2">
                      <span className="text-[9px] text-slate-500">{label}</span>
                      <span className={`text-[9px] font-semibold ${index === 1 ? "text-emerald-600" : "text-rose-500"}`}>{["+€608M", "91,4%", "73,8%"][index]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-5 -left-3 rounded-2xl border border-white bg-white px-4 py-3 shadow-xl sm:-left-8">
        <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-teal-700">Segnale pronto</p>
        <p className="mt-1 text-sm font-semibold text-slate-900">ATC L · +7,4%</p>
      </div>
    </div>
  );
}

function BenefitVisual({ type }: { type: (typeof BENEFITS)[number]["visual"] }) {
  if (type === "trend") {
    return (
      <div className="flex h-32 items-end gap-2 rounded-2xl bg-white p-5">
        {[38, 48, 45, 63, 59, 78, 91].map((height, index) => (
          <div key={index} className="flex h-full flex-1 items-end">
            <div className="w-full rounded-t bg-primary" style={{ height: `${height}%`, opacity: 0.35 + index * 0.08 }} />
          </div>
        ))}
      </div>
    );
  }
  if (type === "cost") {
    return (
      <div className="flex h-32 flex-col justify-center gap-4 rounded-2xl bg-white p-5">
        <div><div className="mb-1 flex justify-between text-[9px] text-slate-400"><span>Prezzo confezione</span><span>€124</span></div><div className="h-2 rounded-full bg-slate-100"><div className="h-full w-4/5 rounded-full bg-slate-300" /></div></div>
        <div><div className="mb-1 flex justify-between text-[9px] font-semibold text-teal-700"><span>Costo normalizzato</span><span>€0,42/mg</span></div><div className="h-2 rounded-full bg-teal-50"><div className="h-full w-2/5 rounded-full bg-primary" /></div></div>
      </div>
    );
  }
  return (
    <div className="flex h-32 items-center justify-center rounded-2xl bg-white p-5">
      {[UploadCloud, DatabaseZap, FileCheck2].map((Icon, index) => (
        <div key={index} className="flex items-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-primary"><Icon size={20} /></span>
          {index < 2 && <span className="mx-2 h-px w-6 bg-primary/35" />}
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-svh overflow-hidden bg-background">
      <DemoPrompt />

      <nav className="sticky top-0 z-30 border-b border-border/80 bg-white/90 backdrop-blur-xl dark:bg-background/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-3.5 md:px-8">
          <VisLogo size="sm" />
          <div className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a href="#benefici" className="hover:text-foreground">Benefici</a>
            <a href="#percorso" className="hover:text-foreground">Percorso</a>
            <a href="#moduli" className="hover:text-foreground">Moduli</a>
            <a href="#come-funziona" className="hover:text-foreground">Come funziona</a>
          </div>
          <div className="flex items-center gap-1.5">
            <ThemeSwitcher />
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex"><Link href="/auth/login">Accedi</Link></Button>
            <Button asChild size="sm"><Link href="/auth/sign-up">Registrati</Link></Button>
          </div>
        </div>
      </nav>

      <main>
        <section className="relative px-5 pb-24 pt-16 md:px-8 md:pb-32 md:pt-24">
          <div className="mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-[0.82fr_1.18fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary shadow-sm dark:bg-card">
                <ShieldCheck size={14} /> Governance farmaceutica, non clinica
              </div>
              <h1 className="mt-7 max-w-xl text-5xl font-semibold leading-[0.98] tracking-[-0.045em] text-foreground md:text-7xl">
                Vedi prima.<br /><span className="text-primary">Decidi meglio.</span>
              </h1>
              <p className="mt-6 max-w-lg text-lg leading-8 text-muted-foreground md:text-xl">
                Trasforma i dati farmaceutici già disponibili in segnali economici verificabili.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" className="rounded-xl px-6"><Link href="/auth/sign-up">Registrati per la demo <ArrowRight size={17} /></Link></Button>
                <Button asChild size="lg" variant="outline" className="rounded-xl px-6"><Link href="/auth/login">Accedi</Link></Button>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2">
                {["Dati AIFA e regionali", "€/mg e €/DDD", "Nessun dato paziente"].map((item) => (
                  <span key={item} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Check size={14} className="text-primary" /> {item}</span>
                ))}
              </div>
            </div>
            <DashboardPreview />
          </div>
        </section>

        <section id="evidenze" className="border-y border-border bg-white px-5 py-8 dark:bg-card md:px-8">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-7 md:grid-cols-4">
            {PROOF_STATS.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-40 motion-reduce:animate-none" />
                    <span className="relative inline-flex size-2 rounded-full bg-primary" />
                  </span>
                  {stat.value}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="benefici" className="px-5 py-20 md:px-8 md:py-28">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Il beneficio, subito</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-5xl">Meno ricerca. Più tempo per agire.</h2>
            </div>
            <div className="mt-12 grid gap-5 lg:grid-cols-3">
              {BENEFITS.map((benefit) => {
                const Icon = benefit.icon;
                return (
                  <article key={benefit.kicker} className="rounded-3xl border border-border bg-secondary/35 p-5 md:p-6">
                    <BenefitVisual type={benefit.visual} />
                    <div className="mt-6 flex items-start gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-primary shadow-sm dark:bg-card"><Icon size={19} /></span>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-primary">{benefit.kicker}</p>
                        <h3 className="mt-2 text-xl font-semibold leading-7 text-foreground">{benefit.title}</h3>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="percorso" className="border-y border-border bg-white px-5 py-20 dark:bg-card md:px-8 md:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="max-w-2xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Il percorso operativo</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-5xl">Dalla programmazione alla chiusura.</h2>
              </div>
              <p className="max-w-sm text-sm leading-6 text-muted-foreground">Un filo unico rende visibile dove nasce un segnale e chi può trasformarlo in azione.</p>
            </div>

            <div className="relative mt-12 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
              <div className="absolute left-[7%] right-[7%] top-7 hidden h-px bg-primary/20 xl:block" />
              {PHASES.map((phase) => {
                const Icon = phase.icon;
                return (
                  <article key={phase.number} className="relative rounded-2xl border border-border bg-background p-4">
                    <span className="relative z-10 flex size-11 items-center justify-center rounded-xl bg-secondary text-primary"><Icon size={19} /></span>
                    <h3 className="mt-5 text-sm font-semibold text-foreground">{phase.title}</h3>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{phase.description}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="moduli" className="px-5 py-20 md:px-8 md:py-28">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Aree connesse</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-5xl">Sette moduli. Un’unica vista decisionale.</h2>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {MODULES.map((module, index) => {
                const Icon = module.icon;
                return (
                  <article
                    key={module.id}
                    className={`group rounded-3xl border p-5 transition-transform hover:-translate-y-1 ${index === 0 ? "border-primary/30 bg-primary text-primary-foreground" : "border-border bg-white dark:bg-card"}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`flex size-11 items-center justify-center rounded-xl ${index === 0 ? "bg-white/15" : "bg-secondary text-primary"}`}><Icon size={20} /></span>
                      <ArrowRight className={index === 0 ? "text-white/55" : "text-primary/50"} size={16} />
                    </div>
                    <h3 className="mt-6 text-lg font-semibold">{module.title}</h3>
                    <p className={`mt-2 text-sm leading-6 ${index === 0 ? "text-white/75" : "text-muted-foreground"}`}>{module.description}</p>
                  </article>
                );
              })}
              <div className="flex min-h-48 flex-col justify-between rounded-3xl border border-dashed border-primary/35 bg-secondary/45 p-5">
                <Route className="text-primary" size={24} />
                <div>
                  <p className="text-sm font-semibold text-foreground">Un percorso, non sette silos.</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">Ogni modulo conserva metodo, fonte e responsabilità.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="come-funziona" className="px-5 pb-20 md:px-8 md:pb-28">
          <div className="mx-auto max-w-6xl rounded-[2rem] border border-teal-100 bg-[linear-gradient(120deg,hsl(174_56%_94%),hsl(203_70%_96%),hsl(76_65%_94%))] px-6 py-10 text-[hsl(204_48%_16%)] shadow-[0_28px_80px_-58px_rgba(13,43,52,0.55)] md:px-10 md:py-12">
            <div className="grid gap-8 md:grid-cols-[0.72fr_1.28fr] md:items-center">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Un percorso semplice</p>
                <h2 className="mt-3 text-3xl font-semibold leading-tight md:text-4xl">Dal file alla decisione.</h2>
              </div>
              <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr]">
                {[
                  [UploadCloud, "Carica"],
                  [DatabaseZap, "Normalizza"],
                  [FileCheck2, "Verifica"],
                ].map(([Icon, label], index) => {
                  const StepIcon = Icon as typeof UploadCloud;
                  return (
                    <div key={label as string} className="contents">
                      <div className="flex items-center gap-3 rounded-2xl border border-white/80 bg-white/75 p-4 shadow-sm">
                        <span className="flex size-11 items-center justify-center rounded-xl bg-secondary text-primary"><StepIcon size={20} /></span>
                        <p className="font-semibold">{label as string}</p>
                      </div>
                      {index < 2 && <ArrowRight className="mx-auto hidden text-primary/45 sm:block" size={18} />}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="px-5 pb-20 md:px-8 md:pb-28">
          <div className="mx-auto max-w-6xl">
            <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Provalo</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">Un segnale, prima della dashboard.</h2>
              </div>
              <p className="max-w-sm text-sm text-muted-foreground">Tocca un anno. Il dato cambia, l’interpretazione emerge.</p>
            </div>
            <DecisionDemo />
          </div>
        </section>

        <section className="px-5 pb-20 md:px-8 md:pb-28">
          <div className="mx-auto max-w-5xl rounded-[2.2rem] bg-[linear-gradient(135deg,hsl(174_66%_38%),hsl(174_58%_31%))] px-6 py-14 text-center text-white shadow-[0_30px_80px_-45px_rgba(13,148,136,0.8)] md:px-12 md:py-20">
            <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">Porta i tuoi dati. Trova il prossimo segnale.</h2>
            <Button asChild size="lg" variant="secondary" className="mt-7 rounded-xl bg-white px-7 text-[hsl(174_58%_28%)] hover:bg-white/90">
              <Link href="/auth/sign-up">Registrati per la demo <ArrowRight size={17} /></Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-white px-5 py-7 dark:bg-card md:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <VisLogo size="sm" />
          <p>Governance organizzativa · dati aggregati · nessuna raccomandazione clinica</p>
        </div>
      </footer>
    </div>
  );
}
