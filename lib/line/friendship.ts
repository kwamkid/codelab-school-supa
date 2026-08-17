// เช็คว่า LINE userId นี้เพิ่ม OA เป็นเพื่อนแล้วหรือยัง
//
// Messaging API `GET /v2/bot/profile/{userId}` ตอบ 200 เฉพาะคนที่เพิ่ม OA เป็นเพื่อน
// (หรือเคยทักหา OA) และตอบ 404 ถ้าไม่ใช่ — จึงใช้เป็นตัวเช็ค friendship ได้
// (LINE ไม่มี endpoint เช็ค friendship ตรง ๆ จาก userId; liff.getFriendship()
//  ใช้ได้เฉพาะในหน้า LIFF ซึ่งฝั่งแอดมินไม่ได้เปิดผ่าน LINE)
//
// 'unknown' = เช็คไม่ได้ (ไม่มี token / เน็ตล่ม / LINE ตอบ error อื่น) — ผู้เรียก
// ต้องถือว่า "ผ่าน" ไม่ใช่ "ไม่เป็นเพื่อน" จะได้ไม่ล็อกครูออกจากระบบเพราะ LINE ล่ม

import { getLineSettings } from '@/lib/supabase/services/line-settings'

export type FriendshipState = 'friend' | 'not_friend' | 'unknown'

export async function checkOaFriendship(lineUserId: string): Promise<FriendshipState> {
  try {
    const settings = await getLineSettings()
    const token = settings.messagingChannelAccessToken
    if (!token) return 'unknown'

    const res = await fetch(`https://api.line.me/v2/bot/profile/${encodeURIComponent(lineUserId)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (res.ok) return 'friend'
    if (res.status === 404) return 'not_friend'

    console.warn('[checkOaFriendship] unexpected status', res.status, await res.text())
    return 'unknown'
  } catch (e) {
    console.error('[checkOaFriendship] failed:', e)
    return 'unknown'
  }
}
