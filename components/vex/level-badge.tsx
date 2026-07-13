// components/vex/level-badge.tsx
// Displays a VEX level as the program logo (IQ / V5) + short grade label
// (ES / MS / HS). Replaces the long "VEX V5 — Middle School" text everywhere.
// Uses a plain <img> for the SVG (the repo renders SVGs via <img>, not next/image).

import { cn } from '@/lib/utils'
import { LEVEL_META, LEVEL_LABELS, PROGRAM_LOGO, type Level } from '@/lib/vex/types'

interface LevelBadgeProps {
  level: Level
  className?: string
  /** Logo height in px (width auto). Default 18. */
  logoHeight?: number
}

export function LevelBadge({ level, className, logoHeight = 18 }: LevelBadgeProps) {
  const meta = LEVEL_META[level]
  if (!meta) return null
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border bg-white px-2 py-1 leading-none',
        className
      )}
      title={LEVEL_LABELS[level]}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={PROGRAM_LOGO[meta.program]}
        alt={meta.program === 'iq' ? 'VEX IQ' : 'VEX V5'}
        style={{ height: logoHeight, width: 'auto' }}
        className="object-contain"
      />
      <span className="text-xs font-bold tracking-wide text-gray-700">{meta.short}</span>
    </span>
  )
}
