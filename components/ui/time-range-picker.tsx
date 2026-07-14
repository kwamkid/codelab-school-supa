'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

// --- Generate time slots ---
function generateTimeSlots(step: number, min?: string, max?: string): string[] {
  const slots: string[] = []
  const minMinutes = min ? parseTime(min) : 0
  const maxMinutes = max ? parseTime(max) : 24 * 60 - 1
  for (let m = 0; m < 24 * 60; m += step) {
    if (m >= minMinutes && m <= maxMinutes) {
      const hh = String(Math.floor(m / 60)).padStart(2, '0')
      const mm = String(m % 60).padStart(2, '0')
      slots.push(`${hh}:${mm}`)
    }
  }
  return slots
}

function parseTime(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

function formatTimeDisplay(t: string): string {
  if (!t) return ''
  const [h, m] = t.split(':')
  return `${h}:${m}`
}

// --- Single time picker ---
interface TimePickerDropdownProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  step?: number
  min?: string
  max?: string
  className?: string
}

// Normalize free-typed input into "HH:MM" (24h). Accepts "9", "930", "9:3",
// "9.30", "0930" etc. Returns '' if it can't make a valid time.
function normalizeTimeInput(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '')
  if (!digits) return ''
  let h: number, m: number
  if (digits.length <= 2) {
    h = parseInt(digits, 10); m = 0
  } else if (digits.length === 3) {
    h = parseInt(digits.slice(0, 1), 10); m = parseInt(digits.slice(1), 10)
  } else {
    h = parseInt(digits.slice(0, 2), 10); m = parseInt(digits.slice(2, 4), 10)
  }
  if (isNaN(h) || isNaN(m) || h > 23 || m > 59) return ''
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function TimePickerDropdown({
  value,
  onChange,
  placeholder = 'เวลา',
  disabled = false,
  step = 30,
  min,
  max,
  className,
}: TimePickerDropdownProps) {
  const [open, setOpen] = React.useState(false)
  // Display HH:MM only — value from DB may be "HH:MM:SS", strip the seconds.
  const [text, setText] = React.useState(formatTimeDisplay(value))
  // Keyboard-navigation highlight (index into `filtered`); -1 = none.
  const [highlight, setHighlight] = React.useState(-1)
  const listRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const wrapRef = React.useRef<HTMLDivElement>(null)

  const slots = React.useMemo(() => generateTimeSlots(step, min, max), [step, min, max])

  // Keep the input text in sync when the value changes from outside (e.g. start
  // time auto-sets end time), but not while the user is actively typing.
  React.useEffect(() => {
    if (!open) setText(formatTimeDisplay(value))
  }, [value, open])

  // Filter the slot list by what's typed. Accepts "8", "8:", "8.00", "8:3",
  // "0800", "830" etc. Splits on the first ':' or '.' into hour + minute parts;
  // hour matches with or without a leading zero ("8" → 08), minute is a prefix.
  const filtered = React.useMemo(() => {
    const raw = text.trim()
    if (!raw) return slots

    const sep = raw.search(/[:.]/)
    let hourPart: string
    let minPart: string | null
    if (sep >= 0) {
      hourPart = raw.slice(0, sep).replace(/[^0-9]/g, '')
      minPart = raw.slice(sep + 1).replace(/[^0-9]/g, '')
    } else {
      const digits = raw.replace(/[^0-9]/g, '')
      if (digits.length <= 2) { hourPart = digits; minPart = null }
      else { hourPart = digits.slice(0, digits.length - 2); minPart = digits.slice(-2) }
    }

    return slots.filter((s) => {
      const [sh, sm] = s.split(':') // slot is "HH:MM"
      // hour: match as number (8 === 08) OR as string prefix ("1" → 10,11,...)
      const hourOk =
        hourPart === '' ||
        (Number(hourPart) === Number(sh)) ||
        sh.startsWith(hourPart)
      if (!hourOk) return false
      if (minPart == null || minPart === '') return true
      return sm.startsWith(minPart)
    })
  }, [slots, text])

  // On open, highlight the current value (or first item); scroll it into view.
  React.useEffect(() => {
    if (!open) { setHighlight(-1); return }
    const idx = value ? filtered.findIndex((s) => s === formatTimeDisplay(value)) : -1
    setHighlight(idx >= 0 ? idx : 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Keep highlight in range when the filtered list changes (typing).
  React.useEffect(() => {
    if (!open) return
    setHighlight((h) => (filtered.length === 0 ? -1 : Math.min(Math.max(h, 0), filtered.length - 1)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered.length])

  // Scroll the highlighted item into view.
  React.useEffect(() => {
    if (!open || highlight < 0) return
    const container = listRef.current
    const el = container?.querySelector(`[data-index="${highlight}"]`) as HTMLElement | null
    if (container && el) {
      const top = el.offsetTop
      const bottom = top + el.clientHeight
      if (top < container.scrollTop) container.scrollTop = top
      else if (bottom > container.scrollTop + container.clientHeight)
        container.scrollTop = bottom - container.clientHeight
    }
  }, [highlight, open])

  const commit = (raw: string) => {
    const normalized = normalizeTimeInput(raw)
    if (normalized) {
      onChange(normalized)
      setText(normalized)
    } else {
      setText(formatTimeDisplay(value)) // revert invalid input
    }
  }

  const pick = (slot: string) => {
    onChange(slot)
    setText(slot)
    setOpen(false)
  }

  // Plain absolutely-positioned dropdown (no Radix Popover) — its focus/dismiss
  // layer fought the input anchor and made the list flicker / uncklickable.
  // Close on click outside the wrapper.
  React.useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        commit(text)
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, text])

  return (
    <div ref={wrapRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={text}
        disabled={disabled}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onChange={(e) => {
          setText(e.target.value)
          if (!open) setOpen(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            if (!open) { setOpen(true); return }
            setHighlight((h) => (filtered.length === 0 ? -1 : (h + 1) % filtered.length))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            if (!open) { setOpen(true); return }
            setHighlight((h) => (filtered.length === 0 ? -1 : (h - 1 + filtered.length) % filtered.length))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            if (highlight >= 0 && filtered[highlight]) pick(filtered[highlight])
            else if (filtered.length > 0 && text.replace(/[^0-9:]/g, '')) pick(filtered[0])
            else commit(text)
            setOpen(false)
          } else if (e.key === 'Escape') {
            setText(formatTimeDisplay(value))
            setOpen(false)
          }
        }}
        className={cn(
          'w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-base',
          'ring-offset-background placeholder:text-muted-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
      />
      {open && !disabled && (
        <div
          ref={listRef}
          className="absolute z-50 mt-1 w-[120px] max-h-[240px] overflow-y-auto rounded-md border bg-popover p-1 shadow-md"
          style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          {filtered.length === 0 ? (
            <div className="py-3 text-center text-sm text-muted-foreground">ไม่พบเวลา</div>
          ) : (
            filtered.map((slot, i) => (
              <button
                key={slot}
                type="button"
                data-index={i}
                onMouseDown={(e) => e.preventDefault()} // keep input from blurring first
                onMouseEnter={() => setHighlight(i)}
                onClick={() => pick(slot)}
                className={cn(
                  'flex w-full items-center justify-center rounded-sm px-2 py-1.5 text-sm outline-none select-none cursor-pointer',
                  i === highlight && 'bg-accent text-accent-foreground',
                  value === slot && 'font-medium'
                )}
              >
                {formatTimeDisplay(slot)}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// --- Time Range Picker (pair) ---
interface TimeRangePickerProps {
  startTime: string
  endTime: string
  onStartTimeChange: (value: string) => void
  onEndTimeChange: (value: string) => void
  startPlaceholder?: string
  endPlaceholder?: string
  disabled?: boolean
  step?: number
  min?: string
  max?: string
  className?: string
}

function addMinutes(time: string, minutes: number): string {
  const total = parseTime(time) + minutes
  const hh = String(Math.floor(total / 60) % 24).padStart(2, '0')
  const mm = String(total % 60).padStart(2, '0')
  return `${hh}:${mm}`
}

export function TimeRangePicker({
  startTime,
  endTime,
  onStartTimeChange,
  onEndTimeChange,
  startPlaceholder = 'เริ่ม',
  endPlaceholder = 'สิ้นสุด',
  disabled = false,
  step = 30,
  min,
  max,
  className,
}: TimeRangePickerProps) {
  // Default to 09:00 / 10:00 on mount if both empty
  const initialized = React.useRef(false)
  React.useEffect(() => {
    if (!initialized.current && !startTime && !endTime) {
      initialized.current = true
      onStartTimeChange('09:00')
      onEndTimeChange('10:00')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // When start time changes, auto-set end time to +1 hour
  const handleStartTimeChange = (v: string) => {
    onStartTimeChange(v)
    onEndTimeChange(addMinutes(v, 60))
  }

  return (
    <div className={cn('grid grid-cols-2 gap-1.5', className)}>
      <TimePickerDropdown
        value={startTime}
        onChange={handleStartTimeChange}
        placeholder={startPlaceholder}
        disabled={disabled}
        step={step}
        min={min}
        max={max}
      />
      <TimePickerDropdown
        value={endTime}
        onChange={onEndTimeChange}
        placeholder={endPlaceholder}
        disabled={disabled}
        step={step}
        min={startTime || min}
        max={max}
      />
    </div>
  )
}

// --- Single Time Picker (for standalone use like reminderTime) ---
export { TimePickerDropdown as TimePicker }
