'use client'

// สถานะการเชื่อม LINE ของครูที่ล็อกอินอยู่ — ใช้ร่วมกันระหว่าง
// หน้าบังคับเชื่อม (line-gate) และแถวสถานะในหน้าโปรไฟล์
//
// applicable = บัญชีนี้เป็นครูที่มี teachers row จริง (แอดมินทั่วไป = false)
// linked     = ผูก LINE userId จริงแล้ว (ไม่นับค่าเก่าที่เป็นอีเมล — ดู
//              lib/line/line-user-id.ts ฝั่งเซิร์ฟเวอร์)

import { useCallback, useEffect, useState } from 'react'
import { authFetch } from '@/lib/auth-fetch'

export interface TeacherLineStatusState {
  loading: boolean
  applicable: boolean
  linked: boolean
  /** เพิ่ม OA เป็นเพื่อนแล้ว? null = เช็คไม่ได้/ยังไม่ผูก → ถือว่าผ่าน ห้ามบล็อก */
  friend: boolean | null
  refresh: () => Promise<void>
}

export function useTeacherLineStatus(enabled = true): TeacherLineStatusState {
  const [loading, setLoading] = useState(true)
  const [applicable, setApplicable] = useState(false)
  const [linked, setLinked] = useState(false)
  const [friend, setFriend] = useState<boolean | null>(null)

  const refresh = useCallback(async () => {
    if (!enabled) {
      setLoading(false)
      return
    }
    try {
      const res = await authFetch('/api/teacher/line-status')
      const data = await res.json()
      setApplicable(!!data.applicable)
      setLinked(!!data.linked)
      setFriend(data.friend === true ? true : data.friend === false ? false : null)
    } catch {
      // เช็คไม่ได้ → ถือว่าไม่ต้องบังคับ ดีกว่าล็อกครูออกจากระบบเพราะเน็ตสะดุด
      setApplicable(false)
      setLinked(false)
      setFriend(null)
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { loading, applicable, linked, friend, refresh }
}
