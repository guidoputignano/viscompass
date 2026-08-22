import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { VisLogo } from "@/components/vis-logo";
import { Reveal } from "@/components/reveal";

const MARKET_STATS = [
  {
    value: "€17,8 mld",
    label: "spesa farmaceutica pubblica, 2024 (+10% sull'anno precedente)",
  },
  {
    value: "12,06%",
    label:
      "spesa per acquisti diretti sul Fondo Sanitario Nazionale, primi 10 mesi 2025",
  },
  {
    value: "8,3%",
    label: "tetto programmato — lo sforamento nazionale supera i 4,2 mld €",
  },
];

const PROOF_STATS = [
  { value: "4", label: "Aziende Sanitarie" },
  { value: "261.153", label: "record di erogazione elaborati" },
  { value: "€452,7 mln", label: "di spesa analizzata" },
  { value: "28,5%", label: "della spesa concentrata nelle prime 20 specialità" },
];

const TAPPE = [
  {
    n: "0",
    name: "Orizzonte",
    tag: "M7",
    text: "Impatto di budget stimato prima che il farmaco entri in prontuario",
  },
  {
    n: "1",
    name: "Programmazione",
    tag: "M1",
    text: "Spesa riconciliata per Azienda, canale, ATC, fino alla specialità",
  },
  {
    n: "2",
    name: "Acquisto",
    tag: "M2",
    text: "Scadenze brevettuali e opportunità biosimilari tracciate a giorni",
  },
  {
    n: "3",
    name: "Custodia",
    tag: "M4",
    text: "Scorte, scadenze e carenze visibili prima che diventino una perdita",
  },
  {
    n: "4",
    name: "Erogazione",
    tag: "M5",
    text: "Sprechi di allestimento misurati in aggregato, mai per paziente",
  },
  {
    n: "5",
    name: "Rendicontazione",
    tag: "M3",
    text: "Registri AIFA e File F riconciliati prima della scadenza",
  },
  {
    n: "6",
    name: "Confronto e chiusura",
    tag: "M6",
    text: "Ogni Azienda confrontata sulla stessa molecola, stesso canale",
  },
];

type Maturity = "IN ESERCIZIO" | "IN RILASCIO" | "IN SVILUPPO";

const MODULES: { id: string; name: string; desc: string; status: Maturity }[] = [
  {
    id: "M1",
    name: "Cruscotto direzionale della spesa",
    desc: "Spesa riconciliata per Azienda, canale, ATC, fino alla specialità.",
    status: "IN ESERCIZIO",
  },
  {
    id: "M2",
    name: "Radar scadenze brevettuali e biosimilari",
    desc: "Scadenze brevettuali e opportunità biosimilari tracciate a giorni.",
    status: "IN ESERCIZIO",
  },
  {
    id: "M3",
    name: "Registri AIFA, File F e flussi",
    desc: "Registri AIFA e File F riconciliati prima della scadenza.",
    status: "IN RILASCIO",
  },
  {
    id: "M4",
    name: "Scorte, scadenze e carenze",
    desc: "Scorte, scadenze e carenze visibili prima che diventino una perdita.",
    status: "IN RILASCIO",
  },
  {
    id: "M5",
    name: "Oncologia, sprechi di allestimento",
    desc: "Sprechi di allestimento misurati in aggregato, mai per paziente.",
    status: "IN RILASCIO",
  },
  {
    id: "M6",
    name: "Confronto fra Aziende",
    desc: "Ogni Azienda confrontata sulla stessa molecola, stesso canale.",
    status: "IN ESERCIZIO",
  },
  {
    id: "M7",
    name: "Orizzonte e simulazione di impatto",
    desc: "Impatto di budget stimato prima che il farmaco entri in prontuario.",
    status: "IN SVILUPPO",
  },
];

// Deliberate, minimal exception to the token-only rule: the three maturity
// states need to read as genuinely distinct (teal / amber / neutral), and
// the token system has no warm/amber hue. Amber here matches the same
// status-amber already used elsewhere in this product family, not an
// invented color.
const MATURITY_STYLE: Record<Maturity, { bg: string; text: string }> = {
  "IN ESERCIZIO": { bg: "hsl(174 82% 39% / 0.1)", text: "hsl(174 70% 28%)" },
  "IN RILASCIO": { bg: "hsl(38 92% 50% / 0.14)", text: "hsl(32 70% 32%)" },
  "IN SVILUPPO": { bg: "hsl(var(--muted))", text: "hsl(var(--muted-foreground))" },
};

const FA_ROWS = [
  "Legge i flussi esistenti",
  "Aggrega per molecola, ATC, canale, Azienda",
  "Quantifica in euro le opportunità",
  "Segnala scostamenti e scadenze",
  "Traccia ogni analisi",
];

const NON_FA_ROWS = [
  "Non scrive su cartella clinica o gestionali",
  "Non elabora dati sul singolo paziente",
  "Non raccomanda terapie o dosaggi",
  "Non emette alert clinici",
  "Non sostituisce il gestionale di farmacia",
];

function MaturityBadge({ status }: { status: Maturity }) {
  const s = MATURITY_STYLE[status];
  return (
    <span
      className="inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {status}
    </span>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-svh w-full flex-col">
      {/* Nav */}
      <nav className="sticky top-0 z-10 w-full border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3 md:px-10">
          <VisLogo size="sm" />
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/auth/login">Accedi</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/auth/sign-up">Registrati</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="w-full px-6 pb-16 pt-16 md:px-10 md:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">
              Governance della spesa farmaceutica
            </p>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="font-display mt-5 text-3xl leading-tight md:text-5xl">
              Ridurre il ritardo con cui un&apos;opportunità già esistente
              diventa un&apos;azione.
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground md:text-lg">
              Strumento di analisi gestionale in sola lettura per la Direzione
              di Farmacia, la Direzione Sanitaria e il Servizio Farmaceutico
              Regionale.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-8">
              <Button asChild size="lg">
                <Link href="/auth/sign-up">Registrati</Link>
              </Button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Market context strip */}
      <section className="w-full border-y border-border bg-secondary/40 px-6 py-12 md:px-10">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <p className="text-center text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
              Il contesto nazionale
            </p>
          </Reveal>
          <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-3">
            {MARKET_STATS.map((s, i) => (
              <Reveal key={s.value} delay={i * 100}>
                <div className="text-center">
                  <p className="font-display text-3xl text-foreground md:text-4xl">
                    {s.value}
                  </p>
                  <p className="mx-auto mt-2 max-w-[16rem] text-sm text-muted-foreground">
                    {s.label}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Product-capability proof strip */}
      <section className="w-full px-6 py-16 md:px-10">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <h2 className="text-center text-sm font-semibold uppercase tracking-[0.1em] text-primary">
              Evidenze dal prototipo su dati reali
            </h2>
          </Reveal>
          <div className="mt-8 grid grid-cols-2 gap-6 md:grid-cols-4">
            {PROOF_STATS.map((s, i) => (
              <Reveal key={s.label} delay={i * 100}>
                <Card className="h-full text-center">
                  <div className="p-6">
                    <p className="font-display text-2xl text-foreground md:text-3xl">
                      {s.value}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground md:text-sm">
                      {s.label}
                    </p>
                  </div>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Seven tappe */}
      <section className="w-full bg-secondary/40 px-6 py-16 md:px-10">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <h2 className="font-display text-center text-2xl md:text-3xl">
              Il percorso, in sette tappe
            </h2>
          </Reveal>
          <div className="mt-10 flex flex-col gap-0">
            {TAPPE.map((t, i) => (
              <Reveal key={t.tag} delay={i * 60}>
                <div className="flex gap-4 pb-8 last:pb-0">
                  <div className="flex flex-col items-center">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                      style={{
                        backgroundColor: "hsl(174 82% 39% / 0.12)",
                        color: "hsl(174 70% 28%)",
                      }}
                    >
                      {t.n}
                    </span>
                    {i < TAPPE.length - 1 && (
                      <span className="mt-1 w-px flex-1 bg-border" />
                    )}
                  </div>
                  <div className="pb-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t.name} <span className="text-primary">({t.tag})</span>
                    </p>
                    <p className="mt-1 text-sm text-foreground md:text-base">
                      {t.text}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Module grid */}
      <section className="w-full px-6 py-16 md:px-10">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <h2 className="font-display text-center text-2xl md:text-3xl">
              I sette moduli
            </h2>
          </Reveal>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map((m, i) => (
              <Reveal key={m.id} delay={(i % 3) * 80}>
                <Card className="h-full">
                  <div className="p-6">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {m.id}
                      </span>
                      <MaturityBadge status={m.status} />
                    </div>
                    <h3 className="mt-2 text-base font-semibold text-foreground">
                      {m.name}
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {m.desc}
                    </p>
                  </div>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Che cosa fa / Che cosa non fa */}
      <section className="w-full bg-secondary/40 px-6 py-16 md:px-10">
        <div className="mx-auto max-w-4xl">
          <Reveal>
            <h2 className="font-display text-center text-2xl md:text-3xl">
              Che cosa fa · Che cosa non fa
            </h2>
          </Reveal>
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <Reveal>
              <Card className="h-full">
                <div className="p-6">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                    Fa
                  </p>
                  <ul className="mt-4 flex flex-col gap-3">
                    {FA_ROWS.map((row) => (
                      <li
                        key={row}
                        className="flex gap-2 text-sm text-foreground"
                      >
                        <span className="text-primary">＋</span>
                        <span>{row}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            </Reveal>
            <Reveal delay={100}>
              <Card className="h-full">
                <div className="p-6">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Non fa
                  </p>
                  <ul className="mt-4 flex flex-col gap-3">
                    {NON_FA_ROWS.map((row) => (
                      <li
                        key={row}
                        className="flex gap-2 text-sm text-muted-foreground"
                      >
                        <span>−</span>
                        <span>{row}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Regulatory note */}
      <section className="w-full px-6 py-12 md:px-10">
        <Reveal>
          <p className="mx-auto max-w-2xl text-center text-xs leading-relaxed text-muted-foreground">
            Non è un dispositivo medico ai sensi dell&apos;art. 2 del
            Regolamento UE 2017/745 e della guida MDCG 2019-11: elabora
            esclusivamente informazioni aggregate a fini organizzativi ed
            economici, e non genera informazioni cliniche riferite a un
            individuo.
          </p>
        </Reveal>
      </section>

      {/* Final CTA */}
      <section className="w-full border-y border-border bg-secondary/40 px-6 py-16 md:px-10">
        <Reveal>
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
            <h2 className="font-display text-2xl md:text-3xl">
              Registrati per accedere al prototipo.
            </h2>
            <Button asChild size="lg">
              <Link href="/auth/sign-up">Registrati</Link>
            </Button>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="w-full px-6 py-10 md:px-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
          <VisLogo size="sm" />
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/auth/login" className="hover:text-foreground">
              Accedi
            </Link>
            <Link href="/auth/sign-up" className="hover:text-foreground">
              Registrati
            </Link>
            <span>© 2026 VIS Pharma Compass</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
