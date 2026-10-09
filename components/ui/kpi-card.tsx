// components/ui/kpi-card.tsx
// การ์ดตัวเลขสรุปพื้นไล่สี (หัวรายงาน) — label + ตัวเลขใหญ่ + บรรทัดรอง
// วางใน grid `grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-4` · min-w-0 + truncate กันตัวเลขยาวดันหน้าล้น
// gradient: 'indigo' | 'blue' | 'violet' | 'cyan' | 'amber' | 'emerald' | 'rose'

import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const GRADIENTS = {
  indigo: 'from-indigo-500 to-indigo-600',
  blue: 'from-blue-500 to-blue-600',
  violet: 'from-violet-500 to-violet-600',
  cyan: 'from-cyan-500 to-cyan-600',
  amber: 'from-amber-500 to-amber-600',
  emerald: 'from-emerald-500 to-emerald-600',
  rose: 'from-rose-500 to-rose-600',
} as const

export type KpiGradient = keyof typeof GRADIENTS

interface KpiCardProps {
  icon: LucideIcon
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  gradient?: KpiGradient
  className?: string
}

export function KpiCard({ icon: Icon, label, value, sub, gradient = 'indigo', className }: KpiCardProps) {
  return (
    <div className={cn('rounded-xl p-4 text-white bg-gradient-to-br min-w-0', GRADIENTS[gradient], className)}>
      <div className="flex items-center gap-2 text-white/90">
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <div className="num text-2xl xl:text-3xl font-bold mt-1 whitespace-nowrap truncate">{value}</div>
      {sub != null && <div className="num text-white/85 mt-1 truncate">{sub}</div>}
    </div>
  )
}
