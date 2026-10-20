"use client";

import { createContext, useContext, useMemo } from "react";
import type { CClientAudience } from "@/lib/dashboard-review/pillar-c/audience-rules";
import { cClientAudience } from "@/lib/dashboard-review/pillar-c/audience-view";

/**
 * The Pillar C client audience (recommendation 5): which organisation keys, labels, capabilities and export label the
 * interface may use. MANDATORY: there is no default. Every Pillar C component that names an organisation, offers an
 * «Ambito» option or fetches an analysis reads it here and renders nothing, and fetches nothing, without it; a value
 * that is not a complete audience counts as none. The reviewer branch passes the reviewer audience explicitly.
 */
const PillarCAudienceContext = createContext<CClientAudience | null>(null);

export function PillarCAudienceProvider({ audience, children }: { audience: CClientAudience; children: React.ReactNode }) {
  const value = useMemo(() => cClientAudience(audience), [audience]);
  return <PillarCAudienceContext.Provider value={value}>{children}</PillarCAudienceContext.Provider>;
}

/** The audience of this subtree, or null: a caller must then render nothing and fetch nothing. */
export function usePillarCAudience(): CClientAudience | null {
  return useContext(PillarCAudienceContext);
}
