// components/ui/loading-overlay.tsx
// ม่านโหลดทับเนื้อหาเดิมระหว่าง re-fetch (เปลี่ยนเดือน/สาขา/กดรีเฟรช) — ข้อมูลเดิมยังเห็นจาง ๆ
// ใช้คู่กับ PageLoading ตอนโหลดครั้งแรก: `if (loading && !data) return <PageLoading />`
// parent ต้องเป็น `relative` · ใช้ class `.loading-overlay` (globals.css)

import { Loading } from '@/components/ui/loading'

export function LoadingOverlay({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <div className="loading-overlay">
      <Loading size="md" />
    </div>
  )
}
