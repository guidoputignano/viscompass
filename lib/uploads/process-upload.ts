import { createServiceRoleClient, hasServiceRoleConfig } from "@/lib/supabase/service-role";
import { parseGoldFile } from "@/lib/uploads/gold-file";
import { reconcileRows, summariseReconciliation, type CanonicalTotals } from "@/lib/uploads/reconcile";

// Turns a stored upload into a reconciliation result.
//
// Split from reconcile.ts deliberately: that module is pure and its tests import
// it directly, so it must stay free of server-only imports. Everything that
// touches Storage or the database lives here.
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

/**
 * Totals canonical_fact holds for this organization and year.
 *
 * Returns null when the table cannot be read at all, and a zero rowCount when
 * it can be read but holds nothing. reconcileRows treats those differently and
 * reports both as unavailable — an empty comparison always agrees, so calling
 * it a pass would be indistinguishable from a real one.
 *
 * The key mapping is UNVERIFIED. uploads.org_code is '201'; the gold file's own
 * ASL column is '130201', i.e. region_code + org_code. canonical_fact is empty,
 * so which form its asl_code takes cannot be observed. Both are queried, and
 * this must be confirmed against real rows before the result is trusted.
 */
async function readCanonicalTotals(
  db: ReturnType<typeof createServiceRoleClient>,
  orgCode: string,
  regionCode: string | null,
  years: number[],
): Promise<CanonicalTotals | null> {
  if (years.length === 0) return null;
  const aslKeys = [orgCode, regionCode ? `${regionCode}${orgCode}` : null].filter(
    (v): v is string => Boolean(v),
  );
  const { data, error } = await db
    .from("canonical_fact")
    .select("total_cost_eur")
    .in("asl_code", aslKeys)
    .in("year", years);
  if (error) return null;
  const rows = data ?? [];
  return {
    rowCount: rows.length,
    costEur: rows.reduce((s, r) => s + (Number(r.total_cost_eur) || 0), 0),
  };
}

export async function processUpload(uploadId: number): Promise<void> {
  // Without the service role there is no write path. Leaving the row in its
  // 'uploaded' default is the truthful outcome; inventing one is not.
  if (!hasServiceRoleConfig()) return;

  let db: ReturnType<typeof createServiceRoleClient>;
  try {
    db = createServiceRoleClient();
  } catch {
    return;
  }

  const fail = async (message: string) => {
    // Recorded on the row, not thrown at the user. status returns to 'uploaded'
    // because nothing was reconciled.
    await db
      .from("uploads")
      .update({
        status: "uploaded" satisfies UploadStatus,
        reconciliation_summary: { ok: false, message, at: new Date().toISOString() },
      })
      .eq("id", uploadId);
  };

  try {
    const { data: upload, error } = await db
      .from("uploads")
      .select("id, org_code, storage_path")
      .eq("id", uploadId)
      .single();
    if (error || !upload) return;

    await db.from("uploads").update({ status: "processing" satisfies UploadStatus }).eq("id", uploadId);

    const file = await db.storage.from(BUCKET).download(upload.storage_path);
    if (file.error || !file.data) {
      await fail(`Il file non è leggibile dallo storage: ${file.error?.message ?? "nessun contenuto"}.`);
      return;
    }

    let parsed: Awaited<ReturnType<typeof parseGoldFile>>;
    try {
      parsed = await parseGoldFile(await file.data.arrayBuffer());
    } catch (e) {
      // A shape assertion failing is the parser working: the file is not the
      // extraction this loader understands, and loading it anyway would put
      // figures on an unknown basis into the product.
      await fail(`Il file non corrisponde al tracciato atteso. ${e instanceof Error ? e.message : String(e)}`);
      return;
    }

    const { data: org } = await db
      .from("organizations")
      .select("region_code")
      .eq("org_code", upload.org_code)
      .single();

    const canonical = await readCanonicalTotals(
      db,
      upload.org_code,
      org?.region_code ?? null,
      parsed.meta.years,
    );

    const report = reconcileRows(parsed.rows, { canonical });
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
