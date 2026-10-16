/** Presentation only: no analysis filters, data access or release state. */
import { C_WORKBOOK_SECTIONS, type CWorkbookSectionId } from "@/lib/dashboard-review/pillar-c/workbook";
export const PILLAR_C_SECTIONS = [
  { id: "spesa", number: "01", label: "Spesa", description: "Andamento e importi" },
  { id: "cambiamento", number: "02", label: "Variazioni", description: "Confronti nel tempo" },
  { id: "pianificazione", number: "03", label: "Budget", description: "Piani e allocazioni" },
  { id: "numerosita", number: "04", label: "Numerosità", description: "Scenari CO" },
  { id: "previsione", number: "05", label: "Previsione", description: "Regionale, fonte pubblica" },
  // Evidence stays last: it documents every section above it.
  { id: "evidenza", number: "06", label: "Evidenza", description: "Fonti e metodo" },
] as const;

export type PillarCSectionId = CWorkbookSectionId;
export const PILLAR_C_ALL_SECTIONS = C_WORKBOOK_SECTIONS.map(([id, label, description], i) => ({ id, label, description, number: String(i + 1).padStart(2, "0") }));

/** The last section above the reading line, including long sections. Near the
 * document end the final short section must still be able to become current. */
export function pillarCSectionAtViewport(
  positions: readonly { id: PillarCSectionId; top: number }[],
  readingLine: number,
  atBottom = false,
  sections: readonly { id: PillarCSectionId }[] = PILLAR_C_SECTIONS,
): PillarCSectionId {
  const present = sections.filter((section) => positions.some((p) => p.id === section.id && Number.isFinite(p.top)));
  if (atBottom && present.length) return present[present.length - 1].id;
  let current: PillarCSectionId = "spesa";
  for (const section of present) {
    if (positions.some((p) => p.id === section.id && p.top <= readingLine)) current = section.id;
  }
  return current;
}
