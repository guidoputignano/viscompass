import type {UploadRecord} from '@/lib/dashboard-review/types';

/** A maintenance archive is not reconciliation. The row and original file stay recoverable. */
export function isArchivedUpload(upload:Pick<UploadRecord,'reconciliation_summary'>):boolean {
  const archive=upload.reconciliation_summary?.maintenance_archive;
  if(!archive||typeof archive!=='object'||Array.isArray(archive))return false;
  const a=archive as Record<string,unknown>;
  return a.version===1&&a.reason==='test_upload'&&typeof a.archived_at==='string'&&Number.isFinite(Date.parse(a.archived_at));
}
