import Link from "next/link";
import { Check, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { VisLogo } from "@/components/vis-logo";
import { Reveal } from "@/components/reveal";

const NAV_LINKS = [
  { href: "#come-funziona", label: "Come funziona" },
  { href: "#percorso", label: "Percorso" },
  { href: "#moduli", label: "Moduli" },
  { href: "#sicurezza", label: "Sicurezza" },
];

const TRUST_ROW = [
  "Dati aggregati, non clinici",
  "Basato su dati AIFA e regionali",
  "Conforme al confine EU MDR",
  "Tempo di reazione misurabile",
];

const PROOF_STATS = [
  { value: "73,8%", label: "copertura prodotti" },
  { value: "€832M", label: "spesa analizzata" },
  { value: "261.153", label: "righe di dispensazione" },
  { value: "21", label: "regioni" },
];

const OGGI = [
  "Cruscotti Excel scollegati fra loro",
  "Dati regionali frammentati",
  "Opportunità di risparmio scoperte in ritardo",
  "Tempo professionale assorbito da ricerca manuale",
];

const CON_VIS = [
  "Un'unica vista consolidata",
  "Opportunità segnalate con finestra temporale utile",
  "Decisioni tracciabili e verificabili da terzi",
];

const PERCORSO = [
  {
    n: "0",
    name: "Programmazione",
    desc: "ricerca sui farmaci in arrivo, stime d'impatto",
  },
  {
    n: "1",
    name: "Reportistica",
    desc: "analisi di spesa direzionale e ad hoc",
  },
  {
    n: "2",
    name: "Acquisto",
    desc: "istruttoria gare, Commissione Terapeutica",
  },
  {
    n: "3",
    name: "Scorte",
    desc: "monitoraggio scadenze e redistribuzioni",
  },
  {
    n: "4",
    name: "Allestimento",
    desc: "quadrature consumi oncologici",
  },
  {
    n: "5",
    name: "Rendicontazione",
    desc: "riconciliazione File F, registri AIFA",
  },
  {
    n: "6",
    name: "Confronto e chiusura",
    desc: "benchmark fra Aziende (solo titolarità regionale)",
  },
];

const MODULES = [
  { id: "M1", outcome: "Scostamenti di spesa rilevati mentre l'esercizio è ancora aperto" },
  { id: "M2", outcome: "Nessuna scadenza brevettuale scoperta in ritardo" },
  { id: "M3", outcome: "Nessun rimborso perso per termini scaduti" },
  { id: "M4", outcome: "Scorte a rischio di scadenza segnalate prima che diventino una perdita" },
  { id: "M5", outcome: "Sprechi di allestimento oncologico misurati in aggregato, mai per paziente" },
  { id: "M6", outcome: "Ogni Azienda confrontata sulla stessa molecola, stesso canale — solo titolarità regionale" },
  { id: "M7", outcome: "Impatto di budget stimato prima che il farmaco entri in prontuario" },
];

const CORE_LINE = "Ogni euro farmaceutico segue un percorso. Ora è visibile.";

export default function Home() {
  return (
    <div className="flex min-h-svh w-full flex-col">
      {/* Nav */}
      <nav className="sticky top-0 z-10 w-full border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3 md:px-10">
          <VisLogo size="sm" />
          <div className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="hover:text-foreground">
                {l.label}
              </a>
            ))}
          </div>
          <Button asChild size="sm">
            <Link href="/auth/login">Accedi</Link>
          </Button>
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
              Ogni euro farmaceutico segue <span className="text-primary">un percorso</span>. Ora è
              visibile.
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground md:text-lg">
              <strong className="font-semibold text-foreground">
                La piattaforma non genera il risparmio.
              </strong>{" "}
              Riduce il ritardo tra un&apos;opportunità e la decisione di
              coglierla.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-8">
              <Button asChild size="lg">
                <Link href="/auth/login">Accedi alla piattaforma</Link>
              </Button>
            </div>
          </Reveal>
          <Reveal delay={320}>
            <div className="mx-auto mt-10 flex max-w-2xl flex-wrap items-center justify-center gap-x-6 gap-y-3">
              {TRUST_ROW.map((t) => (
                <span
                  key={t}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground"
                >
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                  {t}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Proof strip */}
      <section className="w-full border-y border-border bg-secondary/40 px-6 py-12 md:px-10">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {PROOF_STATS.map((s, i) => (
              <Reveal key={s.label} delay={i * 100}>
                <div className="text-center">
                  <p className="font-display text-3xl text-foreground md:text-4xl">
                    {s.value}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {s.label}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Il contesto */}
      <section id="come-funziona" className="w-full px-6 py-16 md:px-10">
        <div className="mx-auto max-w-4xl">
          <Reveal>
            <h2 className="font-display text-center text-2xl md:text-3xl">
              Il contesto
            </h2>
          </Reveal>
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <Reveal>
              <Card className="h-full">
                <div className="p-6">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Oggi
                  </p>
                  <ul className="mt-4 flex flex-col gap-3">
                    {OGGI.map((row) => (
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
            <Reveal delay={100}>
              <Card className="h-full">
                <div className="p-6">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                    Con VIS PHARMA COMPASS
                  </p>
                  <ul className="mt-4 flex flex-col gap-3">
                    {CON_VIS.map((row) => (
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
          </div>
        </div>
      </section>

      {/* MDR callout */}
      <section id="sicurezza" className="w-full px-6 pb-16 md:px-10">
        <Reveal>
          <div className="mx-auto flex max-w-3xl items-start gap-4 rounded-lg border border-border bg-card p-6">
            <ShieldCheck className="h-6 w-6 shrink-0 text-primary" />
            <p className="text-sm leading-relaxed text-foreground">
              <strong className="font-semibold">
                Conforme al confine EU MDR.
              </strong>{" "}
              Ogni modulo restituisce dati aggregati a livello organizzativo
              — nessuna raccomandazione clinica per singolo paziente.
            </p>
          </div>
        </Reveal>
      </section>

      {/* Il percorso dell'euro farmaceutico */}
      <section id="percorso" className="w-full bg-secondary/40 px-6 py-16 md:px-10">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <h2 className="font-display text-center text-2xl md:text-3xl">
              Il percorso dell&apos;euro farmaceutico
            </h2>
          </Reveal>
          <div className="mt-12 flex flex-col gap-6 md:flex-row md:flex-wrap md:justify-center md:gap-4">
            {PERCORSO.map((t, i) => (
              <Reveal key={t.n} delay={i * 60} className="md:w-[calc(25%-0.75rem)] md:min-w-[180px]">
                <div className="flex gap-4 md:flex-col md:gap-2">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                    style={{
                      backgroundColor: "hsl(174 82% 39% / 0.12)",
                      color: "hsl(174 70% 28%)",
                    }}
                  >
                    {t.n}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {t.name}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t.desc}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={480}>
            <p className="mx-auto mt-12 max-w-xl text-center text-sm text-muted-foreground">
              114 giornate/anno oggi, 60 liberate — una riduzione del 53%.
            </p>
          </Reveal>
        </div>
      </section>

      {/* I moduli */}
      <section id="moduli" className="w-full px-6 py-16 md:px-10">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <h2 className="font-display text-center text-2xl md:text-3xl">
              I moduli
            </h2>
          </Reveal>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map((m, i) => (
              <Reveal key={m.id} delay={(i % 3) * 80}>
                <Card className="h-full">
                  <div className="p-6">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {m.id}
                    </span>
                    <p className="mt-2 text-sm font-medium text-foreground">
                      {m.outcome}
                    </p>
                  </div>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="w-full border-y border-border bg-secondary/40 px-6 py-16 md:px-10">
        <Reveal>
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
            <h2 className="font-display text-2xl md:text-3xl">
              {CORE_LINE}
            </h2>
            <Button asChild size="lg">
              <Link href="/auth/login">Accedi alla piattaforma</Link>
            </Button>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="w-full px-6 py-10 md:px-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-8">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <VisLogo size="sm" />
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              {NAV_LINKS.map((l) => (
                <a key={l.href} href={l.href} className="hover:text-foreground">
                  {l.label}
                </a>
              ))}
            </div>
          </div>
          <div className="border-t border-border pt-6">
            <p className="text-center text-xs leading-relaxed text-muted-foreground">
              Strumento di governance organizzativa — non genera
              raccomandazioni cliniche né dosaggi per singolo paziente.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
