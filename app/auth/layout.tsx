"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { VisLogo } from "@/components/vis-logo";

const TAGLINE =
  "Una distanza più breve fra un'opportunità di risparmio e la decisione di agire.";

const TAPPE = [
  {
    label: "0 · Orizzonte (M7)",
    text: "Impatto di budget stimato prima che il farmaco entri in prontuario",
  },
  {
    label: "1 · Programmazione (M1)",
    text: "Spesa riconciliata per Azienda, canale, ATC, fino alla specialità",
  },
  {
    label: "2 · Acquisto (M2)",
    text: "Scadenze brevettuali e opportunità biosimilari tracciate a giorni",
  },
  {
    label: "3 · Custodia (M4)",
    text: "Scorte, scadenze e carenze visibili prima che diventino una perdita",
  },
  {
    label: "4 · Erogazione (M5)",
    text: "Sprechi di allestimento misurati in aggregato, mai per paziente",
  },
  {
    label: "5 · Rendicontazione (M3)",
    text: "Registri AIFA e File F riconciliati prima della scadenza",
  },
  {
    label: "6 · Confronto e chiusura (M6)",
    text: "Ogni Azienda confrontata sulla stessa molecola, stesso canale",
  },
];

function TappeCarousel() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let fadeTimeout: ReturnType<typeof setTimeout>;
    const interval = setInterval(() => {
      setVisible(false);
      fadeTimeout = setTimeout(() => {
        setIndex((i) => (i + 1) % TAPPE.length);
        setVisible(true);
      }, 300);
    }, 4000);
    return () => {
      clearInterval(interval);
      clearTimeout(fadeTimeout);
    };
  }, []);

  const step = TAPPE[index];

  return (
    <div className="flex flex-col gap-6">
      <div
        className="transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
      >
        <p className="text-xs font-medium uppercase tracking-[0.15em] opacity-60">
          {step.label}
        </p>
        <p className="font-display text-2xl leading-snug lg:text-3xl mt-3">
          {step.text}
        </p>
      </div>
      <div className="flex gap-2">
        {TAPPE.map((_, i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full transition-colors duration-300"
            style={{
              backgroundColor:
                i === index ? "hsl(174 82% 39%)" : "rgba(255,255,255,0.25)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isSignUp = pathname === "/auth/sign-up";

  return (
    <div className="flex min-h-svh w-full animate-in fade-in duration-700">
      <div
        className="hidden md:flex md:w-[42%] lg:w-[40%] flex-col justify-center gap-6 px-12 lg:px-16"
        style={{ backgroundColor: "hsl(204 63% 12%)", color: "hsl(160 13% 95%)" }}
      >
        <VisLogo size="md" />
        <div
          className="h-[2px] w-10"
          style={{ backgroundColor: "hsl(174 82% 39%)" }}
        />
        {isSignUp ? (
          <TappeCarousel />
        ) : (
          <p className="font-display text-2xl leading-snug lg:text-3xl">
            {TAGLINE}
          </p>
        )}
      </div>
      <div className="flex flex-1 items-center justify-center bg-background">
        {children}
      </div>
    </div>
  );
}
