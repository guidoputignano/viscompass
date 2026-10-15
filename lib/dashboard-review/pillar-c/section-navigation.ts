/** Presentation only: no analysis filters, data access or release state. */
export const PILLAR_C_SECTIONS = [
  { id: "spesa", number: "01", label: "Spesa", description: "Andamento e importi" },
  { id: "cambiamento", number: "02", label: "Variazioni", description: "Confronti nel tempo" },
  { id: "pianificazione", number: "03", label: "Budget", description: "Piani e allocazioni" },
  { id: "numerosita", number: "04", label: "Numerosità", description: "Scenari CO" },
  { id: "evidenza", number: "05", label: "Evidenza", description: "Fonti e metodo" },
] as const;

export type PillarCSectionId = typeof PILLAR_C_SECTIONS[number]["id"];

/** The last section above the reading line, including long sections. Near the
 * document end the final short section must still be able to become current. */
export function pillarCSectionAtViewport(
  positions: readonly { id: PillarCSectionId; top: number }[],
  readingLine: number,
  atBottom = false,
): PillarCSectionId {
  const present = PILLAR_C_SECTIONS.filter((section) => positions.some((p) => p.id === section.id && Number.isFinite(p.top)));
  if (atBottom && present.length) return present[present.length - 1].id;
  let current: PillarCSectionId = "spesa";
  for (const section of present) {
    if (positions.some((p) => p.id === section.id && p.top <= readingLine)) current = section.id;
  }
  return current;
}
