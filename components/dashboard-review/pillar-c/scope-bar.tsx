"use client";

/** The page scope bar of Pillar C (docs/PILLAR_C_SIX_SECTIONS_20261022.md §4.1): organisation and channel, «Copia
 * vista», «Azzera», the tampered note and the screen-reader status. Presentation only: the options, the scope
 * sentence and the tampered text arrive as props, and the bar never writes the URL. It calls `onChange` and
 * `onReset`; the workspace that mounts it owns the one `pushState` that writes the organisation and channel keys
 * and the reset. The file holds no organisation key, label map or channel list and imports nothing from the
 * Pillar C libs, so it can sit in the entry chunk of every reader. */
import { useState } from "react";
import { Copy, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

export type PillarCScopeOption = { value: string; label: string };

export type PillarCScopeBarProps = {
  /** The «Ambito» options, in the order the caller gives them. */
  orgOptions: readonly PillarCScopeOption[];
  org: string;
  /** The «Canale» options (for example «Tutti i canali», then the channel codes). */
  channelOptions: readonly PillarCScopeOption[];
  channel: string;
  onChange: (patch: { org?: string; channel?: string }) => void;
  onReset: () => void;
  /** What «Copia vista» writes to the clipboard; defaults to window.location.href. */
  copyHref?: () => string;
  tampered?: boolean;
  /** The note shown when `tampered` is true: the link named an organisation that is not available to the reader. */
  tamperedText: string;
  /** "{organisation label} · {channel label}", built by the caller. */
  scope: string;
  resetLabel?: string;
  className?: string;
};

// 44 px targets (h-11, min-h-11); otherwise the field and action classes of review-blocks.tsx.
const selectClass = "mt-2 h-11 w-full min-w-0 rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";
const actionClass = "inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-xs font-medium hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";

export function PillarCScopeBar({ orgOptions, org, channelOptions, channel, onChange, onReset, copyHref, tampered = false, tamperedText, scope, resetLabel = "Azzera", className }: PillarCScopeBarProps) {
  const [copied, setCopied] = useState(false);
  const change = (patch: { org?: string; channel?: string }) => { setCopied(false); onChange(patch); };
  const copy = async () => { try { await navigator.clipboard.writeText(copyHref ? copyHref() : window.location.href); setCopied(true); } catch { setCopied(false); } };
  return <section aria-label="Ambito di revisione" className={cn("rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6", className)}>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[1.5fr_1fr_auto]">
      <label className="text-xs font-medium text-muted-foreground">Ambito<select aria-label="Ambito aziendale" className={selectClass} value={org} onChange={(e) => change({ org: e.target.value })}>{orgOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
      <label className="text-xs font-medium text-muted-foreground">Canale<select aria-label="Canale dell’analisi" className={selectClass} value={channel} onChange={(e) => change({ channel: e.target.value })}>{channelOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
      <div className="flex flex-wrap items-end gap-2">
        <button type="button" className={actionClass} onClick={copy}><Copy size={14} aria-hidden="true" /><span key={copied ? "copied" : "copy"}>{copied ? "Link copiato" : "Copia vista"}</span></button>
        <button type="button" className={actionClass} onClick={() => { setCopied(false); onReset(); }}><RotateCcw size={14} aria-hidden="true" />{resetLabel}</button>
      </div>
    </div>
    {tampered ? <p role="note" className="mt-4 text-xs font-medium">{tamperedText}</p> : null}
    <p className="sr-only" role="status" aria-live="polite"><span key={scope}>{`${scope}. Selezione aggiornata.`}</span></p>
  </section>;
}
