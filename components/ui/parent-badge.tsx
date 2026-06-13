import { PersonBadge } from '@/components/ui/teacher-badge'

// Shared badge for a parent's name (+ avatar). Cool/blue tones so parents are
// visually distinct from teachers (warm) and students (green chip).
// See components/ui/teacher-badge.tsx for the shared renderer + role colour system.

const PARENT_PALETTE = [
  'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300',
]

export function ParentBadge(props: {
  name?: string | null
  imageUrl?: string | null
  size?: 'sm' | 'md' | 'lg'
  showAvatar?: boolean
  className?: string
}) {
  return (
    <PersonBadge
      {...props}
      palette={PARENT_PALETTE}
      ring="ring-blue-200 dark:ring-blue-500/30"
    />
  )
}
