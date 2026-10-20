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

export type PillarCSectionId = CWorkbookSectionId | "portafogli" | "scenari" | "evidence-workflow";
export type PillarCNavSection = { id: PillarCSectionId; label: string; description: string; number: string };
/** Workbook sections keep their 01–14 numbers. The three working areas, the dossier, the planning workspace that
 * follows it and the shared review queue, are unnumbered; the queue follows Priorità, whose review questions it turns into cases. */
export const PILLAR_C_ALL_SECTIONS: readonly PillarCNavSection[] = [{id:"portafogli",label:"Dossier",description:"Portafogli e prossimi passi",number:""},{id:"scenari",label:"Scenari",description:"Ipotesi e intervalli per portafogli",number:""},...C_WORKBOOK_SECTIONS.flatMap(([id, label, description], i): PillarCNavSection[] => {
  const section = { id, label, description, number: String(i + 1).padStart(2, "0") };
  return id === "priorita" ? [section, { id: "evidence-workflow", label: "Verifiche", description: "Coda condivisa 2025", number: "" }] : [section];
})];

/** An organisation-scoped audience (Pillar C recommendation 5): the dossier and the planning workspace, then the
 * review sections and the attribution analysis it can read, numbered in page order. No workbook section, no shared
 * review queue: those stay in the project review. */
export const PILLAR_C_SCOPED_SECTIONS: readonly PillarCNavSection[] = [
  { id: "portafogli", label: "Dossier", description: "Portafogli e prossimi passi", number: "" },
  { id: "scenari", label: "Scenari", description: "Ipotesi e intervalli per portafogli", number: "" },
  { id: "spesa", number: "01", label: "Spesa", description: "Andamento e importi" },
  { id: "attribuzione", number: "02", label: "Attribuzione", description: "Copertura e incertezza" },
  { id: "cambiamento", number: "03", label: "Variazioni", description: "Confronti nel tempo" },
  { id: "pianificazione", number: "04", label: "Budget", description: "Atti pubblicati e allocazioni" },
  { id: "numerosita", number: "05", label: "Numerosità", description: "Scenari CO" },
  { id: "previsione", number: "06", label: "Previsione", description: "Regionale, fonte pubblica" },
  { id: "evidenza", number: "07", label: "Evidenza", description: "Fonti e metodo" },
];

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
