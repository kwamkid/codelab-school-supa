// A real LINE messaging userId is "U" + 32 hex chars. Only these can be pushed to.
//
// Why this exists: `teachers.line_user_id` predates any LINE integration and was
// filled in by hand with e-mails / LINE display IDs (7 rows as of 2026-08-18).
// Those values are NOT pushable, so every read that decides "is this teacher
// reachable on LINE?" must go through here — never truthiness of the column.
export function isLineUserId(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^U[0-9a-f]{32}$/i.test(value.trim())
}
