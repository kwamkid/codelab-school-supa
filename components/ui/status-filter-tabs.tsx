'use client'

import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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
 * Status filter used on list pages (classes, events, enrollments, vexteam, …).
 * Tabs with count 0 are hidden unless `always` is set.
 *
 * Responsive, site-wide:
 * - **mobile (below sm): a dropdown** — the 78px filter cards can't fit a
 *   390px viewport without wrapping into a tall block or scrolling, so the
 *   whole row collapses into one Select showing the active status + count,
 *   with a status-color dot per option.
 * - **sm and up: the original clickable filter cards** (label + big count;
 *   `subtitle` variant shows the amount line; `separatorBefore` draws a
 *   divider between groups).
 */
export function StatusFilterTabs({ tabs, value, onChange, className }: StatusFilterTabsProps) {
  const visibleTabs = tabs.filter((tab) => tab.always || tab.count > 0)

  return (
    <>
      {/* Mobile: one dropdown, no overflow possible */}
      <div className={cn('sm:hidden', className)}>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {visibleTabs.map((tab) => (
              <SelectItem key={tab.value} value={tab.value}>
                <span className="flex items-center gap-2">
                  <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', tab.activeBg)} aria-hidden />
                  <span>
                    {tab.label}{' '}
                    <span className="font-semibold tabular-nums">({tab.count})</span>
                    {tab.subtitle ? <span className="text-gray-500"> · {tab.subtitle}</span> : null}
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* sm+: the original filter-card row */}
      <div className={cn('hidden sm:flex flex-wrap items-stretch gap-2.5', className)}>
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
    </>
  )
}
