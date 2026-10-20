// The object path of a hospital upload in the private 'uploads' bucket, checked before it is recorded and again
// before it is read.
//
// Why. components/dashboard-review/upload-shell.tsx uploads to `${org_code}/${Date.now()}-${file.name}` under the
// caller's own session, where Storage RLS (supabase_schema.sql section 7) admits only the caller's own organisation
// folder. The path then comes back to the server as a client-supplied string (recordUpload in
// lib/dashboard-review/actions.ts, a server action anyone signed in can call directly), and
// lib/uploads/process-upload.ts downloads it with the SERVICE ROLE, which bypasses RLS. storage-js puts the path
// into the request URL unencoded, and the URL parser resolves dot segments ("..", "%2e%2e") and reads a backslash
// as a slash, so "../<bucket>/<object>" would leave 'uploads' and read any private bucket (review finding
// REC5-SEC-03).
//
// The rule: exactly `<org_code>/<one file segment>`, where
//   - org_code is the caller's own organisation (recordUpload) or the uploads row's (processUpload), never a value
//     the client chose;
//   - the segment starts with a letter or a digit and uses only the characters Storage itself accepts in an object
//     key (storage-api VALID_OBJECT_KEY), without "/": so no second folder, no leading slash, no backslash, no
//     percent sign (no encoded traversal), no control, whitespace other than the space, or non-ASCII character;
//   - the segment contains no "..";
//   - the whole path is at most 1024 characters (the S3 key limit).
// Every path the upload shell writes for a file Storage accepted passes: it starts with the timestamp's digits,
// and Storage has already refused any other character.
const ORG_CODE = /^[A-Za-z0-9]{1,32}$/;
const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9_!.*'() &$=@;:+,?-]*$/;
export const C_UPLOAD_PATH_MAX = 1024;

/** True only for `<orgCode>/<segment>` as above. Any other value, of any type, is refused. */
export function isUploadStoragePath(path: unknown, orgCode: unknown): path is string {
  if (typeof path !== "string" || typeof orgCode !== "string" || !ORG_CODE.test(orgCode)) return false;
  if (path.length > C_UPLOAD_PATH_MAX || !path.startsWith(`${orgCode}/`)) return false;
  const segment = path.slice(orgCode.length + 1);
  return SEGMENT.test(segment) && !segment.includes("..");
}

/**
 * The object path the upload shell writes for a file: `<orgCode>/<timestamp>-<name>`, where the name keeps every
 * character the rule above admits and replaces any other (accents, "#", "/", "%", a backslash, a control character)
 * with "_", and a run of dots with one dot, so a file Storage accepts is never refused afterwards when its row is
 * recorded. The original file name is still recorded as file_name. Always passes isUploadStoragePath.
 */
export function cUploadStoragePath(orgCode: string, fileName: string, timestamp: number): string {
  const prefix = `${orgCode}/${Math.trunc(timestamp)}-`;
  const name = (fileName.normalize("NFC").replace(/[^A-Za-z0-9_!.*'() &$=@;:+,?-]/g, "_").replace(/[.]{2,}/g, ".") || "file")
    .slice(0, C_UPLOAD_PATH_MAX - prefix.length);
  return `${prefix}${name}`;
}
