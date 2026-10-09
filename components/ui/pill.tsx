// components/ui/pill.tsx
// ป้ายสถานะเล็ก ๆ (ควรโทรเลย / จบแล้ว / ลูกค้าเก่า …) ขนาด text-sm ตามกติกาตัวหนังสือ
// tone = ชุดสีพื้นอ่อน+ตัวเข้ม · ใช้แทนการปั้น `rounded px-1.5 py-0.5 text-xs bg-…` เอง
// (สถานะที่มี preset อยู่แล้ว เช่น paid/pending ใช้ StatusBadge)

import { cn } from '@/lib/utils'

export type PillTone = 'gray' | 'red' | 'orange' | 'amber' | 'green' | 'emerald' | 'blue' | 'indigo' | 'violet' | 'teal'

const TONES: Record<PillTone, string> = {
  gray: 'bg-gray-100 text-gray-600',
  red: 'bg-red-100 text-red-700',
  orange: 'bg-orange-100 text-orange-700',
  amber: 'bg-amber-100 text-amber-700',
  green: 'bg-green-100 text-green-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  blue: 'bg-blue-50 text-blue-700',
  indigo: 'bg-indigo-50 text-indigo-700',
  violet: 'bg-violet-100 text-violet-700',
  teal: 'bg-teal-50 text-teal-700',
}

export function Pill({ tone = 'gray', className, children }: { tone?: PillTone; className?: string; children: React.ReactNode }) {
  return <span className={cn('pill', TONES[tone], className)}>{children}</span>
}
