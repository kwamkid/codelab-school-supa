import { LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// Common status color presets
export const statusPresets = {
  // General
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-700',
  pending: 'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-red-100 text-red-700',
  completed: 'bg-green-100 text-green-700',

  // Trial
  new: 'bg-blue-100 text-blue-700',
  contacted: 'bg-yellow-100 text-yellow-700',
  scheduled: 'bg-purple-100 text-purple-700',
  converted: 'bg-emerald-100 text-emerald-700',

  // Enrollment
  dropped: 'bg-red-100 text-red-700',
  transferred: 'bg-blue-100 text-blue-700',

  // Payment
  paid: 'bg-green-100 text-green-700',
  partial: 'bg-orange-100 text-orange-700',

  // Event
  draft: 'bg-gray-100 text-gray-700',
  published: 'bg-green-100 text-green-700',

  // Category
  coding: 'bg-blue-100 text-blue-700',
  robotics: 'bg-green-100 text-green-700',
  ai: 'bg-purple-100 text-purple-700',

  // Level
  beginner: 'bg-emerald-100 text-emerald-700',
  intermediate: 'bg-amber-100 text-amber-700',
  advanced: 'bg-red-100 text-red-700',
} as const

export type StatusPreset = keyof typeof statusPresets

interface StatusBadgeProps {
  status?: StatusPreset
  color?: string
  label: string
  icon?: LucideIcon
  className?: string
}

export function StatusBadge({
  status,
  color,
  label,
  icon: Icon,
  className,
}: StatusBadgeProps) {
  const colorClass = color || (status ? statusPresets[status] : 'bg-gray-100 text-gray-700')

  return (
    <Badge className={cn(colorClass, className)}>
      {Icon && <Icon className="h-3 w-3 mr-1" />}
      {label}
    </Badge>
  )
}
