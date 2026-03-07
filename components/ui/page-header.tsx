import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  description?: string
  icon?: LucideIcon
  iconColor?: string
  badge?: React.ReactNode
  action?: React.ReactNode
  className?: string
}

export function PageHeader({
  title,
  description,
  icon: Icon,
  iconColor = 'text-blue-500',
  badge,
  action,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('flex justify-between items-center mb-8', className)}>
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
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  )
}
