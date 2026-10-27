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
