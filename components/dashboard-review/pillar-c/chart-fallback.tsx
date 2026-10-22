"use client";

/** Point 19: the chart drawings load after hydration (chart-canvases.tsx). If that chunk fails to load, the slot keeps its
 * size and says so, instead of the error reaching the route's error boundary; the exact values stay in the table beside
 * every chart. */
import type { ComponentType } from "react";

function ChartUnavailable() {
  return <p className="flex h-full items-center justify-center p-4 text-center text-xs text-muted-foreground">Il grafico non è disponibile. I valori restano nella tabella.</p>;
}

export function cLazyChart<P>(load: Promise<ComponentType<P>>): Promise<ComponentType<P>> {
  return load.catch(() => ChartUnavailable as ComponentType<P>);
}
