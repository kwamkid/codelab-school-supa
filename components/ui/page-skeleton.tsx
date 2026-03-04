import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { TableRow, TableCell } from '@/components/ui/table'

// Full page skeleton with header + stats + table
interface PageSkeletonProps {
  statsCount?: number
  rowCount?: number
  showFilters?: boolean
}

export function PageSkeleton({
  statsCount = 0,
  rowCount = 5,
  showFilters = true,
}: PageSkeletonProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>

      {/* Stats cards */}
      {statsCount > 0 && (
        <div className={`grid grid-cols-2 md:grid-cols-${Math.min(statsCount, 6)} gap-4`}>
          {[...Array(statsCount)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-12" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Search/Filters */}
      {showFilters && (
        <Card>
          <CardContent className="p-4">
            <Skeleton className="h-10 w-full max-w-md" />
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-3">
            {[...Array(rowCount)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Table row skeleton for inline loading in existing tables
interface TableRowSkeletonProps {
  columns: number
  rows?: number
}

export function TableRowsSkeleton({ columns, rows = 5 }: TableRowSkeletonProps) {
  return (
    <>
      {[...Array(rows)].map((_, rowIdx) => (
        <TableRow key={rowIdx}>
          {[...Array(columns)].map((_, colIdx) => (
            <TableCell key={colIdx}>
              <Skeleton className="h-4 w-full max-w-[120px]" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

// Inline text skeleton
export function InlineTextSkeleton({ width = 'w-20' }: { width?: string }) {
  return <Skeleton className={`h-4 ${width} inline-block`} />
}
