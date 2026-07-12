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
  /** render a vertical divider before this tab (visually splits groups) */
  separatorBefore?: boolean
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
 *
 * A tab with `subtitle` uses a horizontal layout (big count left, label +
 * subtitle stacked right). A tab with `separatorBefore` gets a thin divider on
 * its left so distinct groups (e.g. payment states vs. "cancelled") read apart.
 */
export function StatusFilterTabs({ tabs, value, onChange, className }: StatusFilterTabsProps) {
  const visibleTabs = tabs.filter((tab) => tab.always || tab.count > 0)

  return (
    <div className={cn('flex flex-wrap items-stretch gap-2.5', className)}>
      {visibleTabs.map((tab) => {
        const isActive = value === tab.value
        const hasSubtitle = !!tab.subtitle
        return (
          <div key={tab.value} className="flex items-stretch gap-2.5">
            {tab.separatorBefore && (
              <div className="w-px self-stretch my-1.5 bg-gray-200" aria-hidden />
            )}
            <button
              type="button"
              onClick={() => onChange(tab.value)}
              className={cn(
                'group h-[78px] rounded-2xl transition-all',
                'ring-1 ring-inset',
                hasSubtitle
                  ? 'flex items-center gap-3 pl-4 pr-5 text-left'
                  : 'flex flex-col items-center justify-center px-5 min-w-[104px]',
                isActive
                  ? `${tab.activeBg} shadow-md ring-transparent`
                  : `${tab.inactiveBg} ring-black/[0.04] hover:shadow-sm hover:ring-black/[0.08]`
              )}
            >
              {hasSubtitle ? (
                <>
                  <span className={cn('text-[34px] font-bold leading-none tabular-nums', isActive ? 'text-white' : tab.inactiveCount)}>
                    {tab.count}
                  </span>
                  <span className="flex flex-col justify-center gap-0.5">
                    <span className={cn('text-sm font-semibold whitespace-nowrap', isActive ? 'text-white' : tab.inactiveLabel)}>
                      {tab.label}
                    </span>
                    <span className={cn('text-[11px] leading-tight whitespace-nowrap', isActive ? 'text-white/85' : 'text-gray-500')}>
                      {tab.subtitle}
                    </span>
                  </span>
                </>
              ) : (
                <>
                  <span className={cn('text-xs font-semibold whitespace-nowrap', isActive ? 'text-white/90' : tab.inactiveLabel)}>
                    {tab.label}
                  </span>
                  <span className={cn('text-[28px] font-bold leading-none mt-1 tabular-nums', isActive ? 'text-white' : tab.inactiveCount)}>
                    {tab.count}
                  </span>
                </>
              )}
            </button>
          </div>
        )
      })}
    </div>
  )
}
