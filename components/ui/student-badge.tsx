'use client'

import { cn } from '@/lib/utils'

// Shared badge for a student's name/nickname so it looks identical everywhere
// (LIFF + admin). Change the style here to restyle it system-wide.
//
// Color is derived from the name, so the same kid gets the same color on every
// page/tab without any shared state — a multi-kid parent can tell students
// apart at a glance. Each color has two weights:
//   soft  → เม็ดสีอ่อน ใช้เป็นป้ายชื่อทั่วไป
//   solid → สีเข้มตัวหนังสือขาว ใช้ตอนถูกเลือก (แถบเลือกลูก)
//
// แถบเลือกลูกทุกที่ใช้ <StudentChips /> ตัวเดียวกัน — เดิมแต่ละหน้าปั้นปุ่มเอง
// (หน้าตารางเรียนใช้ Button, หน้าทีมใช้ span) ทำให้ชื่อเด็กคนเดียวกันคนละสีคนละทรง

const PALETTE = [
  {
    soft: 'bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-400',
    solid: 'bg-green-600 text-white',
  },
  {
    soft: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
    solid: 'bg-blue-600 text-white',
  },
  {
    soft: 'bg-purple-50 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400',
    solid: 'bg-purple-600 text-white',
  },
  {
    soft: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
    solid: 'bg-amber-500 text-white',
  },
  {
    soft: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
    solid: 'bg-rose-600 text-white',
  },
  {
    soft: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-400',
    solid: 'bg-cyan-600 text-white',
  },
] as const

function paletteFor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0
  return PALETTE[Math.abs(h) % PALETTE.length]
}

/** สีประจำตัวเด็ก (soft) — เผื่ออยากเอาไปทาพื้นหลังแถว/จุดสีเอง */
export function studentColor(name: string): string {
  return paletteFor(name).soft
}

const SIZES = {
  sm: 'px-2.5 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
  lg: 'px-4 py-2 text-base',
} as const

export function StudentBadge({
  name,
  size = 'sm',
  variant = 'soft',
  className,
}: {
  name?: string | null
  size?: keyof typeof SIZES
  variant?: 'soft' | 'solid'
  className?: string
}) {
  if (!name) return null
  const colors = paletteFor(name)
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-semibold whitespace-nowrap',
        variant === 'solid' ? colors.solid : colors.soft,
        SIZES[size],
        className
      )}
    >
      {name}
    </span>
  )
}

export interface StudentChipOption {
  id: string
  name: string
}

/**
 * แถบเลือกลูก — ใช้สีประจำตัวเด็กเหมือนป้ายชื่อ ตัวที่เลือกเป็นสีเข้ม
 * ที่เหลือเป็นสีอ่อน. ส่ง `allLabel` ถ้าอยากมีตัวเลือก "ทุกคน" (ค่า id = '')
 */
export function StudentChips({
  options,
  value,
  onChange,
  allLabel,
  className,
}: {
  options: StudentChipOption[]
  value: string
  onChange: (id: string) => void
  allLabel?: string
  className?: string
}) {
  if (options.length <= 1 && !allLabel) return null
  return (
    <div className={cn('flex gap-2 overflow-x-auto', className)}>
      {allLabel && (
        <button
          type="button"
          onClick={() => onChange('')}
          className={cn(
            'shrink-0 rounded-full px-4 py-2 text-base font-semibold transition-colors',
            value === '' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'
          )}
        >
          {allLabel}
        </button>
      )}
      {options.map((o) => {
        const colors = paletteFor(o.name)
        const active = value === o.id
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={cn(
              'shrink-0 rounded-full px-4 py-2 text-base font-semibold transition-colors',
              active ? colors.solid : colors.soft
            )}
          >
            {o.name}
          </button>
        )
      })}
    </div>
  )
}
