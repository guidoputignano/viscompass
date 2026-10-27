import type { HospitalValidationReport, HospitalValidationScope } from "@/lib/uploads/hospital-file";

/** Only the configured server-side organization defines the file's allowed scope. */
export function uploadValidationScope(orgCode: unknown, org: { org_type?: unknown; region_code?: unknown } | null): HospitalValidationScope | null {
  if (typeof orgCode !== "string" || !/^\d{3}$/.test(orgCode) || !org || typeof org.region_code !== "string" || !/^\d{3}$/.test(org.region_code)) return null;
  if (org.org_type === "asl") return { orgType: "asl", orgCode: `${org.region_code}${orgCode}`, regionCode: org.region_code };
  if (org.org_type === "regione" && orgCode === org.region_code) return { orgType: "regione", orgCode, regionCode: org.region_code };
  return null;
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Source coverage is monthly: a declaration must contain the whole represented months, not claim day precision. */
export function uploadPeriodError(report: HospitalValidationReport, start: unknown, end: unknown): string | null {
  if ((start != null && !validDate(start)) || (end != null && !validDate(end))) return "Il periodo dichiarato contiene una data non valida.";
  if (typeof start === "string" && typeof end === "string" && start > end) return "L’inizio del periodo dichiarato è successivo alla fine.";
  const { coverageStart, coverageEnd } = report.summary;
  if (!coverageStart || !coverageEnd) return "Il file non contiene una copertura mensile verificabile: serve una revisione del periodo.";
  if ((typeof start === "string" && coverageStart < start) || (typeof end === "string" && coverageEnd > end)) {
    return "I mesi presenti nel file non rientrano nel periodo dichiarato. Il controllo usa mesi interi, non date di singola erogazione.";
  }
  return null;
}

export const UPLOAD_MANUAL_COMPARISON_REASON = "Confronto con i dati pubblicati non eseguito: manca un contratto verificato che allinei versione attiva, periodo, perimetro e base di costo. È richiesta una revisione manuale.";
