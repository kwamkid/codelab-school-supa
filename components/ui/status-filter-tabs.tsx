'use client'

import { cn } from '@/lib/utils'

export interface StatusFilterTab {
  value: string
  label: string
  count: number
  /** bg when active (e.g. 'bg-blue-600') */
  activeBg: string
  /** bg when inactive (e.g. 'bg-blue-50') */
  inactiveBg: string
  /** label color when inactive */
  inactiveLabel: string
  /** count color when inactive */
  inactiveCount: string
  /** always show even when count is 0 (e.g. the "ทั้งหมด" tab) */
  always?: boolean
  /** optional small line(s) under the count, e.g. an amount summary */
  subtitle?: React.ReactNode
}

interface StatusFilterTabsProps {
  tabs: StatusFilterTab[]
  value: string
  onChange: (value: string) => void
  className?: string
}

/**
 * Clickable "filter cards" row used as a status filter on list pages
 * (classes, events, …). Each card shows a label + count and highlights when
 * active. Tabs with count 0 are hidden unless `always` is set.
 */
export function StatusFilterTabs({ tabs, value, onChange, className }: StatusFilterTabsProps) {
  return (
    <div className={cn('flex flex-wrap gap-3', className)}>
      {tabs
        .filter((tab) => tab.always || tab.count > 0)
        .map((tab) => {
          const isActive = value === tab.value
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => onChange(tab.value)}
              className={cn(
                'flex flex-col items-center justify-center min-w-24 px-3 py-2 min-h-[72px] rounded-xl transition-all',
                isActive ? `${tab.activeBg} shadow-md` : `${tab.inactiveBg} hover:shadow-sm`
              )}
            >
              <span className={cn('text-sm font-medium whitespace-nowrap', isActive ? 'text-white' : tab.inactiveLabel)}>
                {tab.label}
              </span>
              <span className={cn('text-2xl font-bold mt-0.5 leading-none', isActive ? 'text-white' : tab.inactiveCount)}>
                {tab.count}
              </span>
              {tab.subtitle && (
                <span className={cn('text-[11px] mt-1 whitespace-nowrap leading-tight text-center', isActive ? 'text-white/90' : 'text-gray-500')}>
                  {tab.subtitle}
                </span>
              )}
            </button>
          )
        })}
    </div>
  )
}
