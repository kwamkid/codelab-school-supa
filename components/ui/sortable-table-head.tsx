'use client'

import * as React from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { TableHead } from '@/components/ui/table'
import { cn } from '@/lib/utils'

// Shared sortable column header + hook. Drop SortableTableHead into any table
// and drive it with useSortableTable — restyle the sort affordance here once and
// every table follows.

export type SortDirection = 'asc' | 'desc'

export interface SortState<K extends string = string> {
  key: K | null
  direction: SortDirection
}

/**
 * Click cycle per column: asc → desc → cleared (back to default order).
 * `sortRows` applies the current sort to a list given a per-key value getter.
 */
export function useSortableTable<K extends string = string>(initial?: SortState<K>) {
  const [sort, setSort] = React.useState<SortState<K>>(initial ?? { key: null, direction: 'asc' })

  const toggle = React.useCallback((key: K) => {
    setSort((prev) => {
      if (prev.key !== key) return { key, direction: 'asc' }
      if (prev.direction === 'asc') return { key, direction: 'desc' }
      return { key: null, direction: 'asc' } // third click clears
    })
  }, [])

  /** Sort a copy of `rows` using `getValue(row, key)` → string | number. */
  const sortRows = React.useCallback(
    <T,>(rows: T[], getValue: (row: T, key: K) => string | number | null | undefined): T[] => {
      if (!sort.key) return rows
      const key = sort.key
      const dir = sort.direction === 'asc' ? 1 : -1
      return [...rows].sort((a, b) => {
        const av = getValue(a, key)
        const bv = getValue(b, key)
        // nulls last
        if (av == null && bv == null) return 0
        if (av == null) return 1
        if (bv == null) return -1
        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
        return String(av).localeCompare(String(bv), 'th') * dir
      })
    },
    [sort]
  )

  return { sort, toggle, sortRows }
}

interface SortableTableHeadProps extends Omit<React.ComponentProps<'th'>, 'onClick'> {
  sortKey: string
  currentSort: SortState
  onSort: (key: string) => void
}

export function SortableTableHead({
  sortKey,
  currentSort,
  onSort,
  className,
  children,
  ...props
}: SortableTableHeadProps) {
  const active = currentSort.key === sortKey
  return (
    <TableHead className={cn('p-0', className)} {...props}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          'flex items-center gap-1 w-full h-12 px-4 select-none transition-colors',
          'hover:text-gray-900 dark:hover:text-white',
          active ? 'text-gray-900 dark:text-white font-semibold' : 'text-foreground',
          // align arrow with right-aligned headers (price)
          className?.includes('text-right') && 'justify-end',
          className?.includes('text-center') && 'justify-center'
        )}
      >
        <span className="truncate">{children}</span>
        {active ? (
          currentSort.direction === 'asc' ? (
            <ChevronUp className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 shrink-0" />
          )
        ) : (
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-gray-300 dark:text-gray-500" />
        )}
      </button>
    </TableHead>
  )
}
