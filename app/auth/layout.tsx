"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// NOTE: copy below is in English. Flag for confirmation: should this be
// Italian instead, matching the rest of the product's locale? Not changed
// without explicit sign-off.
const EYEBROW = "VIS PHARMA COMPASS";
const TAGLINE =
  "A shorter distance between a savings opportunity and the decision to act on it.";

const TAPPE = [
  {
    label: "0 · Orizzonte (M7)",
    text: "Budget impact estimated before a drug enters the formulary",
  },
  {
    label: "1 · Programmazione (M1)",
    text: "Spend reconciled by Azienda, channel, ATC, down to specialità",
  },
  {
    label: "2 · Acquisto (M2)",
    text: "Biosimilar and loss-of-exclusivity windows tracked to the day",
  },
  {
    label: "3 · Custodia (M4)",
    text: "Stock, expiry, and shortage risk visible before it becomes a loss",
  },
  {
    label: "4 · Erogazione (M5)",
    text: "Compounding waste measured in aggregate, never per patient",
  },
  {
    label: "5 · Rendicontazione (M3)",
    text: "AIFA registries and File F reconciled before the deadline",
  },
  {
    label: "6 · Confronto e chiusura (M6)",
    text: "Every Azienda compared on the same molecule, same channel",
  },
];

function BrandMark() {
  return (
    <svg width="42" height="42" viewBox="0 0 40 40" aria-hidden="true">
      <circle
        cx="20"
        cy="20"
        r="18"
        fill="none"
        stroke="#12B5A5"
        strokeWidth="1.4"
      />
      <circle
        cx="20"
        cy="20"
        r="13.5"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1"
        opacity=".45"
      />
      <path
        d="M20 4v3.4M20 32.6V36M4 20h3.4M32.6 20H36"
        stroke="#ffffff"
        strokeWidth="1.2"
        opacity=".55"
      />
      <path d="M26.5 13.5 17.8 17.8 13.5 26.5 22.2 22.2Z" fill="#12B5A5" />
      <circle
        cx="20"
        cy="20"
        r="2.1"
        fill="#0B2130"
        stroke="#ffffff"
        strokeWidth="1.1"
      />
    </svg>
  );
}

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
        <BrandMark />
        <span className="text-xs font-medium uppercase tracking-[0.2em] opacity-70">
          {EYEBROW}
        </span>
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
