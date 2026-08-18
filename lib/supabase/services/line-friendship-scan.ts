// lib/supabase/services/line-friendship-scan.ts
// สแกนว่าผู้ปกครองที่ผูก LINE ไว้ "เพิ่ม OA เป็นเพื่อนแล้วหรือยัง" แล้วเก็บผลลง
// parents.line_friend_state (ดู migration 20260818_line_friendship_cache)
//
// จำเป็นเพราะผูก LINE แล้วไม่ได้แปลว่าส่งข้อความถึง — ถ้าไม่ได้แอด OA
// (หรือแอดแล้วบล็อก/ลบเพื่อน) push จะเงียบหายโดยไม่มีใครรู้
//
// เรียกจาก: cron รายวัน + ปุ่ม "ตรวจสอบสถานะ LINE" ในหน้ารายชื่อผู้ปกครอง

import { createServiceClient } from '../server'
import { checkOaFriendship } from '@/lib/line/friendship'

const CONCURRENCY = 8 // ยิง LINE พร้อมกันแค่พอประมาณ กัน rate limit

export interface FriendshipScanResult {
  checked: number
  friends: number
  notFriends: number
  unknown: number
}

/** เช็คทีละกลุ่มแบบขนาน แล้วอัปเดตกลับเข้า parents */
export async function scanParentFriendship(): Promise<FriendshipScanResult> {
  const result: FriendshipScanResult = { checked: 0, friends: 0, notFriends: 0, unknown: 0 }
  const supabase = createServiceClient()

  const { data: parents, error } = await supabase
    .from('parents')
    .select('id, line_user_id')
    .not('line_user_id', 'is', null)
  if (error) {
    console.error('[friendship-scan] load parents failed:', error.message)
    return result
  }

  // เฉพาะ userId จริง (คอลัมน์นี้เคยมีอีเมล/LINE ID พิมพ์มือปนอยู่)
  const targets = (parents || []).filter((p: any) => /^U[0-9a-f]{32}$/i.test(p.line_user_id || ''))
  const now = new Date().toISOString()

  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const batch = targets.slice(i, i + CONCURRENCY)
    const states = await Promise.all(
      batch.map((p: any) => checkOaFriendship(p.line_user_id).catch(() => 'unknown' as const))
    )

    await Promise.all(
      batch.map((p: any, idx: number) => {
        const state = states[idx]
        result.checked++
        if (state === 'friend') result.friends++
        else if (state === 'not_friend') result.notFriends++
        else result.unknown++
        return supabase
          .from('parents')
          .update({ line_friend_state: state, line_friend_checked_at: now } as any)
          .eq('id', p.id)
      })
    )
  }

  return result
}
