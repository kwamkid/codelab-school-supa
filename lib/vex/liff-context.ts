// lib/vex/liff-context.ts
// Shared resolver for the public LIFF routes: verify the LINE user, map to a
// registered codelab parent, and resolve the team from the slug + kind. Returns a
// discriminated-ish result the route turns into 401/403/404 or proceeds with.

import { resolveLiffUser } from '@/lib/line/verify-liff-token'
import { getVexParentByLineId, type VexParent } from '@/lib/vex/api'
import { resolveTeamBySlug } from '@/lib/vex/public-team'
import { readTeamSessionCookie, verifyTeamSession } from '@/lib/vex/team-session'
import type { LinkKind, Team } from '@/lib/vex/types'

// Single shape (no discriminated union) — this project has strict:false, so union
// narrowing on `ok` is unreliable. On error, status/error are set; on success,
// team/parent/lineUserId are set. Mirrors lib/server/admin-auth.ts.
export interface LiffContextResult {
  ok: boolean
  team?: Team
  parent?: VexParent
  lineUserId?: string
  status?: 401 | 403 | 404
  error?: string
}

/** Thai message shown when a LINE user isn't a registered codelab parent. */
export const UNREGISTERED_MESSAGE =
  'บัญชี LINE นี้ยังไม่ได้ลงทะเบียนกับ CodeLab กรุณาลงทะเบียนก่อนใช้งาน'

export async function resolveLiffContext(
  request: Request,
  body: any,
  slug: string,
  kind: LinkKind
): Promise<LiffContextResult> {
  // Identity comes from EITHER the LIFF ID token (in-app LINE browser) OR the
  // web-login session cookie (Safari/Chrome outside LINE). Try LIFF first.
  let lineUserId: string | null = null
  const liffUser = await resolveLiffUser(request, body)
  if (liffUser) lineUserId = liffUser.lineUserId
  if (!lineUserId) {
    lineUserId = verifyTeamSession(readTeamSessionCookie(request))
  }
  if (!lineUserId) return { ok: false, status: 401, error: 'ไม่พบข้อมูลผู้ใช้ LINE' }

  const parent = await getVexParentByLineId(lineUserId)
  if (!parent) return { ok: false, status: 403, error: UNREGISTERED_MESSAGE }

  const team = await resolveTeamBySlug(slug, kind)
  if (!team) return { ok: false, status: 404, error: 'ไม่พบทีม (ลิงก์ไม่ถูกต้อง)' }

  return { ok: true, team, parent, lineUserId }
}
