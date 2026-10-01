import type { TherapeuticAreaStatus } from "./types";

export interface TherapeuticAreaResult { label: string; status: TherapeuticAreaStatus; basis: string | null }

const ATC2_AREAS: Record<string, Omit<TherapeuticAreaResult, "basis">> = {
  A10: { label: "Diabetologia", status: "supported_by_atc" },
  B03: { label: "Ematologia", status: "supported_by_atc" },
  J01: { label: "Infettivologia", status: "supported_by_atc" },
  J02: { label: "Infettivologia", status: "supported_by_atc" },
  J04: { label: "Infettivologia", status: "supported_by_atc" },
  J05: { label: "Infettivologia", status: "supported_by_atc" },
  L01: { label: "Oncologia / ematologia", status: "supported_by_atc" },
  L02: { label: "Oncologia", status: "supported_by_atc" },
  L03: { label: "Immunologia / ematologia", status: "review_required" },
  L04: { label: "Immunologia · specialità da verificare", status: "review_required" },
  N04: { label: "Neurologia", status: "supported_by_atc" },
  N05: { label: "Neurologia / psichiatria", status: "review_required" },
  N06: { label: "Neurologia / psichiatria", status: "review_required" },
  R03: { label: "Pneumologia", status: "supported_by_atc" },
};

const ATC1_AREAS: Record<string, string> = {
  A: "Gastroenterologia / metabolismo", B: "Ematologia / cardiovascolare", C: "Cardiologia",
  D: "Dermatologia", G: "Urologia / ginecologia", H: "Endocrinologia", J: "Infettivologia",
  L: "Oncologia / immunologia", M: "Area muscolo-scheletrica", N: "Neurologia / psichiatria",
  P: "Malattie parassitarie", R: "Pneumologia", S: "Oftalmologia / otorinolaringoiatria",
  V: "Diagnostica / supporto",
};

/** An ATC-derived analytical area, not a verified clinical indication. */
export function classifyTherapeuticArea(...atcCodes: Array<string | null | undefined>): TherapeuticAreaResult {
  const code = atcCodes.map((value) => (value ?? "").trim().toUpperCase()).find(Boolean) ?? "";
  if (!code) return { label: "Da classificare", status: "unmapped", basis: null };
  const atc2 = code.slice(0, 3);
  const exact = ATC2_AREAS[atc2];
  if (exact) return { ...exact, basis: atc2 };
  const atc1 = code.slice(0, 1);
  const broad = ATC1_AREAS[atc1];
  if (broad) return { label: `${broad} · da verificare`, status: "review_required", basis: atc1 };
  return { label: "Da classificare", status: "unmapped", basis: code };
}

export function combineTherapeuticAreas(values: TherapeuticAreaResult[]): TherapeuticAreaResult {
  const mapped = values.filter((value) => value.status !== "unmapped");
  const labels = [...new Set(mapped.map((value) => value.label))];
  if (labels.length === 0) return { label: "Da classificare", status: "unmapped", basis: null };
  if (labels.length > 1) return { label: "Più aree terapeutiche", status: "review_required", basis: null };
  return {
    label: labels[0],
    status: mapped.some((value) => value.status === "review_required") ? "review_required" : "supported_by_atc",
    basis: mapped[0]?.basis ?? null,
  };
}
