/** Presentation only: no analysis filters, data access or release state. */
// The six sections of the page (docs/PILLAR_C_SIX_SECTIONS_20261022.md §1), in page order, for every reader.
export const PILLAR_C_SECTIONS = [
  { id: "quadro", number: "1", label: "Quadro decisionale", question: "La spesa è cambiata perché più persone sono state trattate o perché i prodotti costano di più, e di quanto?" },
  { id: "destinatari", number: "2", label: "Destinatari e utilizzo", question: "Quante persone trattate raggiunge la spesa e con quale utilizzo?" },
  { id: "portafogli-attribuzione", number: "3", label: "Portafogli e attribuzione", question: "Quanto spende ciascun raggruppamento terapeutico e quanta spesa resta condivisa o incerta?" },
  { id: "fattori", number: "4", label: "Fattori di spesa", question: "Come cambia la spesa nel tempo e quali prodotti spiegano la variazione?" },
  { id: "budget-scenari", number: "5", label: "Budget e scenari", question: "Che cosa dicono gli atti di budget, le ipotesi dichiarate e la previsione regionale?" },
  { id: "priorita-evidenza", number: "6", label: "Priorità ed evidenza", question: "Che cosa verificare per primo e su quali fonti si basano le analisi?" },
] as const;
export type PillarCSectionId = (typeof PILLAR_C_SECTIONS)[number]["id"];
export type PillarCSection = { id: PillarCSectionId; number: string; label: string; question: string };

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
  let current: PillarCSectionId = "quadro";
  for (const section of present) {
    if (positions.some((p) => p.id === section.id && p.top <= readingLine)) current = section.id;
  }
  return current;
}
