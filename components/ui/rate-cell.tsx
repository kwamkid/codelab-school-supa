// components/ui/rate-cell.tsx
// ช่องตาราง % แบบ heatmap — 0% = แดงอ่อน, มากขึ้น = เขียวเข้มขึ้น, total 0 = '–'
// ใช้กับ conversion / เช็คชื่อ / feedback ในหน้ารายงาน · rateBg() ใช้ทำสีที่อื่นได้

import { TableCell } from '@/components/ui/table'
import { percent } from '@/lib/format'
import { cn } from '@/lib/utils'

export function rateBg(p: number): string {
  return p === 0 ? 'rgba(239,68,68,0.12)' : `rgba(16,185,129,${(0.12 + p / 160).toFixed(2)})`
}

export function RateCell({ value, total, className }: { value: number; total: number; className?: string }) {
  const p = percent(value, total)
  if (p == null) return <TableCell className={cn('text-center text-gray-400', className)}>–</TableCell>
  return (
    <TableCell className={cn('num text-center', className)} style={{ backgroundColor: rateBg(p) }}>
      {p}%
    </TableCell>
  )
}
