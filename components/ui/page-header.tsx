import Link from 'next/link'
import { ArrowLeft, LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  description?: string
  icon?: LucideIcon
  iconColor?: string
  badge?: React.ReactNode
  action?: React.ReactNode
  /** แสดงลูกศรย้อนกลับหน้าชื่อหน้า (บรรทัดเดียวกับ title) */
  backHref?: string
  className?: string
}

export function PageHeader({
  title,
  description,
  icon: Icon,
  iconColor = 'text-blue-500',
  badge,
  action,
  backHref,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('flex justify-between items-center mb-8', className)}>
      <div className="flex items-center gap-1 sm:gap-2">
        {backHref && (
          <Button asChild variant="ghost" size="icon" className="shrink-0 -ml-2">
            <Link href={backHref} aria-label="ย้อนกลับ">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
        )}
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-gray-900 flex items-center gap-3">
            {Icon && <Icon className={cn('h-8 w-8', iconColor)} />}
            {title}
            {badge}
          </h1>
          {description && (
            <p className="text-gray-600 mt-1">{description}</p>
          )}
        </div>
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  )
}
