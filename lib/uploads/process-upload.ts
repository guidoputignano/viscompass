import { createServiceRoleClient, hasServiceRoleConfig } from "@/lib/supabase/service-role";
import { parseGoldFile } from "@/lib/uploads/gold-file";
import { reconcileRows, summariseReconciliation } from "@/lib/uploads/reconcile";
import { isUploadStoragePath } from "@/lib/uploads/storage-path";
import { validateHospitalWorkbook, MAX_HOSPITAL_FILE_BYTES } from "@/lib/uploads/hospital-file";
import { uploadValidationScope, uploadPeriodError, UPLOAD_MANUAL_COMPARISON_REASON } from "@/lib/uploads/processing-contract";
import { createHash } from "node:crypto";

// Validates a stored upload and records whether reconciliation can be attempted.
//
// Split from reconcile.ts deliberately: that module is pure and its tests import
// it directly, so it must stay free of server-only imports. Everything that
// touches Storage or the database lives here.
//
// processUploadWith below is the orchestration this file exists for, and
// orchestration is where the bugs hide, so it has to be reachable from a test.
// tests/_alias-hooks.mjs teaches `node --test` to resolve "@/", which is
// otherwise a bundler-only feature, so this file keeps the codebase's import
// convention and is still driven directly by tests.
//
// THIS FUNCTION NEVER THROWS. lib/dashboard-review/actions.ts inserts the
// uploads row and then calls this; the file is already stored and the row
// already written by that point, so throwing would show the user a failure for
// an upload that actually succeeded. Every failure is recorded on the row
// instead, where it can be read and acted on.
//
// The service role is required because `uploads` has no client-facing UPDATE
// policy by design — reconciliation results are written server-side only. This
// client bypasses RLS, so every query below is scoped explicitly by the
// upload's own org_code rather than relying on the database to scope it.

const BUCKET = "uploads";

/** Only two of the reconciler's five outcomes are states the table can hold. */
type UploadStatus = "uploaded" | "processing" | "reconciled" | "discrepancy_found";

/** The client this module needs. Named so a test can supply one. */
type ServiceClient = ReturnType<typeof createServiceRoleClient>;

/**
 * The uploads.status CHECK constraint allows uploaded / processing /
 * reconciled / discrepancy_found. reconcileRows distinguishes five outcomes,
 * three of which have no column value: canonical_comparison_unavailable,
 * nothing_to_reconcile and incomplete_data.
 *
 * Those three map back to 'uploaded' — NOT to 'reconciled'. A file that was
 * parsed but could not be reconciled has not been reconciled, and the column
 * must not imply otherwise. The real outcome is always in
 * reconciliation_summary, which the UI reads.
 *
 * This is a schema gap, not a design choice: the table cannot express
 * "processed, not reconcilable". Widening the CHECK is a migration and is
 * recorded as outstanding rather than worked around with a misleading value.
 */
function toColumnStatus(status: string): UploadStatus {
  if (status === "reconciled") return "reconciled";
  if (status === "discrepancy_found") return "discrepancy_found";
  return "uploaded";
}

// No upload-to-canonical comparison contract has been accepted for this extraction.
// The old bare row read mixed releases/bases, could hit a row cap, and treated null as zero.
// Until an explicitly versioned, scope/period/basis-matched server aggregate is admitted,
// do not query canonical_fact at all. File validation is useful but is never its certification.

/**
 * The orchestration, with the client passed in.
 *
 * Separated from processUpload so tests can drive every branch — a storage
 * failure, a file outside the uploader's scope, an invalid period or an
 * unavailable comparison — without a live Supabase. processUpload is the thin wrapper that
 * decides whether a real client exists.
 */
export async function processUploadWith(db: ServiceClient, uploadId: number): Promise<void> {
  const fail = async (message: string) => {
    // Recorded on the row, not thrown at the user. status returns to 'uploaded'
    // because nothing was reconciled.
    await db
      .from("uploads")
      .update({
        status: "uploaded" satisfies UploadStatus,
        reconciliation_summary: { ok: false, message, at: new Date().toISOString() },
        reconciled_at: null,
      })
      .eq("id", uploadId);
  };

  try {
    const { data: upload, error } = await db
      .from("uploads")
      .select("id, org_code, storage_path, file_name, period_covered_start, period_covered_end")
      .eq("id", uploadId)
      .single();
    if (error || !upload) return;

    // storage_path was supplied by the client, and this client bypasses RLS: read nothing outside the row's own
    // organisation folder of 'uploads' (lib/uploads/storage-path.ts, review finding REC5-SEC-03). One message for
    // every refused path, and no read at all, so the row cannot tell anything about objects elsewhere.
    if (!isUploadStoragePath(upload.storage_path, upload.org_code)) {
      await fail("Il percorso del file non è valido: il file non viene letto.");
      return;
    }

    const { data: org, error: orgError } = await db.from("organizations")
      .select("org_type, region_code").eq("org_code", upload.org_code).single();
    const scope = orgError ? null : uploadValidationScope(upload.org_code, org);
    if (!scope) {
      await fail("Il perimetro dell’organizzazione non è verificabile per questo tracciato. È richiesta una revisione manuale.");
      return;
    }
    // Other formats may still be archived, but never enter an XLSX parser or acquire a reconciliation claim.
    if (typeof upload.file_name !== "string" || !/\.xlsx$/i.test(upload.file_name)) {
      await fail("Il controllo automatico supporta solo il tracciato ospedaliero XLSX. Gli altri formati richiedono una revisione manuale.");
      return;
    }

    const started = await db.from("uploads").update({ status: "processing" satisfies UploadStatus,
      reconciled_at: null, reconciliation_summary: { ok: false, message: "Elaborazione avviata e non ancora completata. Se interrotta, il file resta da riesaminare.", at: new Date().toISOString() } }).eq("id", uploadId);
    if (started.error) return;

    const file = await db.storage.from(BUCKET).download(upload.storage_path);
    if (file.error || !file.data) {
      await fail(`Il file non è leggibile dallo storage: ${file.error?.message ?? "nessun contenuto"}.`);
      return;
    }

    if (typeof file.data.size === "number" && file.data.size > MAX_HOSPITAL_FILE_BYTES) {
      await fail("Il file supera il limite previsto per il controllo XLSX.");
      return;
    }
    const bytes = await file.data.arrayBuffer();
    // Reuse the existing bounded XLSX/schema/tenant validator, rather than duplicating its definitions.
    const validation = await validateHospitalWorkbook(bytes, scope);
    if (validation.status === "rejected") {
      const messages = validation.issues.filter((i) => i.severity === "error").slice(0, 3).map((i) => i.message);
      await fail(`Il file non supera i controlli del tracciato e del perimetro autorizzato. ${messages.join(" ")}`);
      return;
    }
    const periodError = uploadPeriodError(validation, upload.period_covered_start, upload.period_covered_end);
    if (periodError) { await fail(periodError); return; }

    let parsed: Awaited<ReturnType<typeof parseGoldFile>>;
    try {
      parsed = await parseGoldFile(bytes);
    } catch (e) {
      // A shape assertion failing is the parser working: the file is not the
      // extraction this loader understands, and loading it anyway would put
      // figures on an unknown basis into the product.
      await fail(`Il file non corrisponde al tracciato atteso. ${e instanceof Error ? e.message : String(e)}`);
      return;
    }

    const report = reconcileRows(parsed.rows);
    report.canonical = { available: false, reason: UPLOAD_MANUAL_COMPARISON_REASON };
    report.notes.push(UPLOAD_MANUAL_COMPARISON_REASON,
      "I controlli sul file non importano dati nei fatti canonici e non modificano i rilasci analitici pubblicati.");
    const columnStatus = toColumnStatus(report.status);

    await db
      .from("uploads")
      .update({
        status: columnStatus,
        reconciliation_summary: {
          ok: true,
          message: summariseReconciliation(report),
          // The reconciler's own status, which the column cannot always hold.
          outcome: report.status,
          rows: report.rows,
          amounts: report.amounts,
          canonical: report.canonical,
          declared: report.declared,
          notes: report.notes,
          // Provenance: what was parsed, and the header the basis assertion passed on.
          source: parsed.meta,
          processingVersion: "gold-upload-validation-v2",
          sourceSha256: createHash("sha256").update(new Uint8Array(bytes)).digest("hex"),
          validation: { formatVersion: validation.formatVersion, status: validation.status,
            coverageStart: validation.summary.coverageStart, coverageEnd: validation.summary.coverageEnd,
            declaredStart: upload.period_covered_start ?? null, declaredEnd: upload.period_covered_end ?? null },
          // Full quarantine detail is the auditable part — every held euro, by reason.
          quarantine: report.quarantine,
          at: new Date().toISOString(),
        },
        // Only a genuine reconciliation stamps a reconciliation time.
        reconciled_at: columnStatus === "reconciled" ? new Date().toISOString() : null,
      })
      .eq("id", uploadId);
  } catch (e) {
    try {
      await fail(`Errore imprevisto durante la riconciliazione: ${e instanceof Error ? e.message : String(e)}`);
    } catch {
      // The row cannot be updated either. Swallow: the upload itself succeeded.
    }
  }
}

export async function processUpload(uploadId: number): Promise<void> {
  // Without the service role there is no write path. Leaving the row in its
  // 'uploaded' default is the truthful outcome; inventing one is not.
  if (!hasServiceRoleConfig()) return;

  let db: ServiceClient;
  try {
    db = createServiceRoleClient();
  } catch {
    return;
  }

  return processUploadWith(db, uploadId);
}
