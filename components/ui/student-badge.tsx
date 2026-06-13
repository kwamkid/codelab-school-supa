import { cn } from '@/lib/utils'

// Shared badge for a student's name/nickname so it looks identical everywhere
// (LIFF + admin). Change the style here to restyle it system-wide.
export function StudentBadge({
  name,
  className,
}: {
  name?: string | null
  className?: string
}) {
  if (!name) return null
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full bg-green-50 text-green-700',
        'dark:bg-green-500/15 dark:text-green-400',
        'px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
        className
      )}
    >
      {name}
    </span>
  )
}
