import { cn } from '@/lib/utils'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'

// Shared badge for a teacher's name (+ avatar) so teachers look identical
// everywhere (classes list, dashboard, attendance, chat, LIFF, etc.).
// Change the style here to restyle every teacher chip system-wide.
//
// Role colour system — each role has its own avatar theme so you can tell
// teacher / parent / student apart at a glance:
//   • Teacher → warm tones (orange / amber / red)  ← this file
//   • Parent  → cool tones (blue / sky / indigo)   ← components/ui/parent-badge.tsx
//   • Student → green chip (no avatar)             ← components/ui/student-badge.tsx

// Warm palette for teachers. Deterministic per name → each teacher keeps the
// same colour everywhere (easier to scan / recognise), but always within the
// teacher (warm) family so the role stays obvious.
const TEACHER_PALETTE = [
  'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
  'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-300',
]

function paletteFor(name: string, palette: string[]): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  }
  return palette[hash % palette.length]
}

// First letter of the first two words (works for "นาย ปิยพนธ์" → "นป",
// "Fluke" → "FL", Thai single word → first 2 chars).
export function getNameInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return name.trim().slice(0, 2).toUpperCase()
}

const SIZES = {
  sm: { avatar: 'h-6 w-6', fallback: 'text-[10px]', text: 'text-xs' },
  md: { avatar: 'h-7 w-7', fallback: 'text-[11px]', text: 'text-sm' },
  lg: { avatar: 'h-9 w-9', fallback: 'text-xs', text: 'text-base' },
}

// Shared internal renderer used by TeacherBadge + ParentBadge so the two
// role badges stay structurally identical and only differ by colour family.
export function PersonBadge({
  name,
  imageUrl,
  size = 'sm',
  showAvatar = true,
  palette,
  ring,
  className,
}: {
  name?: string | null
  imageUrl?: string | null
  size?: keyof typeof SIZES
  showAvatar?: boolean
  palette: string[]
  ring: string
  className?: string
}) {
  if (!name) return null
  const s = SIZES[size]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 min-w-0 text-gray-700 dark:text-gray-200',
        s.text,
        className
      )}
    >
      {showAvatar && (
        <Avatar className={cn('shrink-0 ring-1', ring, s.avatar)}>
          {imageUrl ? <AvatarImage src={imageUrl} alt={name} /> : null}
          <AvatarFallback className={cn('font-semibold', s.fallback, paletteFor(name, palette))}>
            {getNameInitials(name)}
          </AvatarFallback>
        </Avatar>
      )}
      <span className="truncate font-medium" title={name}>{name}</span>
    </span>
  )
}

export function TeacherBadge(props: {
  name?: string | null
  imageUrl?: string | null
  size?: keyof typeof SIZES
  showAvatar?: boolean
  className?: string
}) {
  return (
    <PersonBadge
      {...props}
      palette={TEACHER_PALETTE}
      ring="ring-orange-200 dark:ring-orange-500/30"
    />
  )
}
