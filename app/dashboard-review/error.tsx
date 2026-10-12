"use client";

import { useEffect, useRef, useState } from "react";
import { CircleAlert, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isDomDesync, markDesyncReload, sessionStore, shouldReloadAfterDesync } from "@/lib/dashboard-review/dom-desync";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // A DOM DESYNC IS NOT A DATA FAILURE. A browser's machine translation (or an
  // extension) replaced nodes React still owned, and an in-place update threw
  // NotFoundError. The address bar holds every filter and panel option, so a
  // reload restores the same view on a fresh page, translated again. Once per
  // document: a page that is itself the product of such a reload shows the
  // card below instead (lib/dashboard-review/dom-desync.ts).
  const desync = isDomDesync(error);
  const [reloading] = useState(() => desync && typeof window !== "undefined"
    && shouldReloadAfterDesync(sessionStore(), performance.timeOrigin));
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (reloading) {
      markDesyncReload(sessionStore(), Date.now());
      window.location.reload();
    } else if (desync) {
      // The panel and its focused button are gone: move focus to the card.
      heading.current?.focus();
    }
  }, [reloading, desync]);

  if (reloading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-5 py-10">
        <p className="text-sm text-muted-foreground" role="alert">Aggiornamento della pagina…</p>
      </div>
    );
  }
  if (desync) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-5 py-10">
        <div className="max-w-lg rounded-2xl border border-border bg-card p-7 text-center shadow-sm" role="alert">
          <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-amber-50 text-amber-700"><CircleAlert size={20} /></span>
          <h1 ref={heading} tabIndex={-1} className="font-display mt-4 text-2xl outline-none">La pagina non si è aggiornata correttamente</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            La traduzione automatica o un’estensione del browser ha modificato la pagina mentre si aggiornava.
            Ricaricala per ripristinare la vista: i filtri e le opzioni scelte restano gli stessi.
          </p>
          <Button className="mt-5" onClick={() => window.location.reload()}><RotateCcw size={14} /> Ricarica</Button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-5 py-10">
      <div className="max-w-lg rounded-2xl border border-border bg-card p-7 text-center shadow-sm">
        <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-rose-50 text-rose-700"><CircleAlert size={20} /></span>
        <h1 className="font-display mt-4 text-2xl">L’analisi non è disponibile</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">La richiesta non ha prodotto un risultato verificabile. Riprova; se il problema persiste, controlla lo stato delle fonti e dei caricamenti.</p>
        <Button className="mt-5" onClick={reset}><RotateCcw size={14} /> Riprova</Button>
      </div>
    </div>
  );
}
