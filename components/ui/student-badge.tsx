import { cn } from '@/lib/utils'

// Shared badge for a student's name/nickname so it looks identical everywhere
// (LIFF + admin). Change the style here to restyle it system-wide.
//
// Color is derived from the name, so the same kid gets the same color on every
// page/tab without any shared state — a multi-kid parent can tell students
// apart at a glance.
const PALETTE = [
  'bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-400',
  'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  'bg-purple-50 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400',
  'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
  'bg-cyan-50 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-400',
] as const

function colorFor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0
  return PALETTE[Math.abs(h) % PALETTE.length]
}

const SIZES = {
  sm: 'px-2.5 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
} as const

export function StudentBadge({
  name,
  size = 'sm',
  className,
}: {
  name?: string | null
  size?: keyof typeof SIZES
  className?: string
}) {
  if (!name) return null
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-semibold whitespace-nowrap',
        colorFor(name),
        SIZES[size],
        className
      )}
    >
      {name}
    </span>
  )
}
