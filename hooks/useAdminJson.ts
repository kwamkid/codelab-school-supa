// hooks/useAdminJson.ts
// GET JSON จาก /api/admin/* (แนบ Bearer token ผ่าน authFetch) + toast เมื่อพัง + reload()
// ใช้ในหน้ารายงาน: const { data, loading, reload } = useAdminJson<T>(`/api/admin/reports/x?${qs}`)
// url = null → ยังไม่ยิง (เช่นรอสิทธิ์/ตัวกรอง) · เปลี่ยน url = ยิงใหม่อัตโนมัติ (ข้อมูลเดิมค้างไว้ระหว่างโหลด)

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { authFetch } from '@/lib/auth-fetch'

export function useAdminJson<T>(url: string | null, errorText = 'โหลดข้อมูลไม่สำเร็จ') {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(!!url)
  const seq = useRef(0)

  const reload = useCallback(async () => {
    if (!url) return
    const mine = ++seq.current
    setLoading(true)
    try {
      const res = await authFetch(url)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || errorText)
      if (mine === seq.current) setData(json as T)
    } catch (e) {
      if (mine === seq.current) toast.error(e instanceof Error ? e.message : errorText)
    } finally {
      if (mine === seq.current) setLoading(false)
    }
  }, [url, errorText])

  useEffect(() => { reload() }, [reload])

  return { data, loading, reload }
}
