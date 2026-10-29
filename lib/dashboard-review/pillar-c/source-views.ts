/** Pillar C source views (joint feedback 2, G2-01/G2-02, owner decision of 27 Oct 2026): one channel view of the
 * expenditure ledger at a time, and the two flows that count people, DPC and File F, opened separately. Each view keeps
 * its own source, period and coverage; the channel selector belongs to the ledger view only. Browser-safe: labels and
 * the URL parameter, no figure, no organisation key. */
export const C_SOURCE_VIEWS = ["spesa", "dpc", "filef"] as const;
export type CSourceView = (typeof C_SOURCE_VIEWS)[number];
export const C_SOURCE_PARAM = "c_fonte";

export const C_SOURCE_LABELS: Readonly<Record<CSourceView, { label: string; source: string }>> = {
  spesa: { label: "Spesa per canale", source: "Registro della spesa 2024–2026 · CO, DD e DPC" },
  dpc: { label: "Assistiti e servizio DPC", source: "Flussi DPC riferiti a gennaio 2026" },
  filef: { label: "File F", source: "File F 2025" },
};

/** The page heading describes the source actually open. The spending scope is already resolved against the
 * reader's authorized options; the flow coverage comes from the units delivered to that reader. A ledger's CO/DD
 * selection must never appear to filter the DPC or File F heading. */
export function cWorkspaceHeading(view: CSourceView, spendingScope: string, coverage: { dpc: string; fileF: string }) {
  if (view === "dpc") return {
    title: "Assistiti e servizio DPC",
    description: "Assistiti, costi dei farmaci e servizio delle farmacie nei flussi riferiti a gennaio 2026.",
    scope: coverage.dpc,
  };
  if (view === "filef") return {
    title: "File F",
    description: "Importi riportati e identificativi nei dati File F del 2025.",
    scope: coverage.fileF,
  };
  return {
    title: "Spesa, budget e aree cliniche",
    description: "Spesa, variazioni e budget dell’ambito selezionato. Le analisi DPC e File F hanno una vista dedicata.",
    scope: spendingScope,
  };
}

/** The view a URL asks for; anything else is the ledger view, which needs no parameter. */
export function cSourceView(params: URLSearchParams): CSourceView {
  const v = params.get(C_SOURCE_PARAM);
  return v === "dpc" || v === "filef" ? v : "spesa";
}

/** The same search with only the view changed: every filter of the page is kept as it is. */
export function cSourceViewSearch(search: string, view: CSourceView): string {
  const params = new URLSearchParams(search);
  if (view === "spesa") params.delete(C_SOURCE_PARAM); else params.set(C_SOURCE_PARAM, view);
  return params.size ? `?${params}` : "";
}

/** «ASL 1, ASL 2 e ASL 4»: an Italian list of labels. */
export function cItalianList(labels: readonly string[]): string {
  return labels.length <= 1 ? labels.join("") : `${labels.slice(0, -1).join(", ")} e ${labels[labels.length - 1]}`;
}
