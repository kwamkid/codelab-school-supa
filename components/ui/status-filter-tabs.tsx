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
 * Responsive: on mobile the tabs render as compact pills in ONE horizontally
 * scrollable row (big cards wrapped into a tall 2×2 block and pushed content
 * off-screen); from sm: up they are the original 78px filter cards.
 *
 * A tab with `subtitle` uses a horizontal layout (big count left, label +
 * subtitle stacked right; subtitle hidden on mobile). A tab with
 * `separatorBefore` gets a thin divider on its left so distinct groups
 * (e.g. payment states vs. "cancelled") read apart.
 */
export function StatusFilterTabs({ tabs, value, onChange, className }: StatusFilterTabsProps) {
  const visibleTabs = tabs.filter((tab) => tab.always || tab.count > 0)

  return (
    <div
      className={cn(
        // mobile: single scrollable row; sm+: wrapping card row (original look)
        'flex items-stretch gap-2 overflow-x-auto pb-1 -mb-1',
        'sm:flex-wrap sm:overflow-x-visible sm:gap-2.5 sm:pb-0 sm:mb-0',
        className
      )}
    >
      {visibleTabs.map((tab) => {
        const isActive = value === tab.value
        const hasSubtitle = !!tab.subtitle
        return (
          <div key={tab.value} className="flex items-stretch gap-2 sm:gap-2.5 shrink-0">
            {tab.separatorBefore && (
              <div className="w-px self-stretch my-1.5 bg-gray-200" aria-hidden />
            )}
            <button
              type="button"
              onClick={() => onChange(tab.value)}
              className={cn(
                'group transition-all ring-1 ring-inset whitespace-nowrap',
                // mobile: compact pill
                'flex items-center gap-1.5 rounded-xl px-3 py-2',
                // sm+: original big filter card
                'sm:h-[78px] sm:rounded-2xl',
                hasSubtitle
                  ? 'sm:gap-3 sm:pl-4 sm:pr-5 sm:text-left'
                  : 'sm:flex-col sm:justify-center sm:gap-0 sm:px-5 sm:min-w-[104px]',
                isActive
                  ? `${tab.activeBg} shadow-md ring-transparent`
                  : `${tab.inactiveBg} ring-black/[0.04] hover:shadow-sm hover:ring-black/[0.08]`
              )}
            >
              {hasSubtitle ? (
                <>
                  <span className={cn('text-base sm:text-[34px] font-bold leading-none tabular-nums', isActive ? 'text-white' : tab.inactiveCount)}>
                    {tab.count}
                  </span>
                  <span className="flex flex-col justify-center gap-0.5">
                    <span className={cn('text-xs sm:text-sm font-semibold whitespace-nowrap', isActive ? 'text-white' : tab.inactiveLabel)}>
                      {tab.label}
                    </span>
                    <span className={cn('hidden sm:block text-[11px] leading-tight whitespace-nowrap', isActive ? 'text-white/85' : 'text-gray-500')}>
                      {tab.subtitle}
                    </span>
                  </span>
                </>
              ) : (
                <>
                  <span className={cn('text-xs font-semibold whitespace-nowrap', isActive ? 'text-white/90' : tab.inactiveLabel)}>
                    {tab.label}
                  </span>
                  <span className={cn('text-base sm:text-[28px] font-bold leading-none sm:mt-1 tabular-nums', isActive ? 'text-white' : tab.inactiveCount)}>
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
