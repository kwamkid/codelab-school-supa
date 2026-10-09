// components/ui/chart-card.tsx
// การ์ดหัวข้อ + คำอธิบาย สำหรับกราฟ/ตารางในหน้ารายงาน (Card ที่ min-w-0 กัน ResponsiveContainer ดันกริดล้น)
// `contentClassName` เช่น 'overflow-x-auto' สำหรับตารางกว้าง

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface ChartCardProps {
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
  contentClassName?: string
  children: React.ReactNode
}

export function ChartCard({ title, description, action, className, contentClassName, children }: ChartCardProps) {
  return (
    <Card className={cn('min-w-0', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-lg">{title}</CardTitle>
            {description && <CardDescription className="text-base mt-1">{description}</CardDescription>}
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  )
}
