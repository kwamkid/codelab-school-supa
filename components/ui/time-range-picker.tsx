'use client'

import * as React from 'react'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'

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

function TimePickerDropdown({
  value,
  onChange,
  placeholder = 'เวลา',
  disabled = false,
  step = 15,
  min,
  max,
  className,
}: TimePickerDropdownProps) {
  const [open, setOpen] = React.useState(false)
  const listRef = React.useRef<HTMLDivElement>(null)

  const slots = React.useMemo(() => generateTimeSlots(step, min, max), [step, min, max])

  // Scroll to selected time when opened
  React.useEffect(() => {
    if (!open || !value) return
    let attempts = 0
    const tryScroll = () => {
      const container = listRef.current
      const el = container?.querySelector(`[data-value="${value}"]`) as HTMLElement
      if (container && el) {
        container.scrollTop = el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2
      } else if (attempts < 5) {
        attempts++
        setTimeout(tryScroll, 50)
      }
    }
    setTimeout(tryScroll, 0)
  }, [open, value])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full h-10 justify-between font-normal text-base',
            !value && 'text-muted-foreground',
            className
          )}
        >
          <span className="truncate">
            {value ? formatTimeDisplay(value) : placeholder}
          </span>
          <Clock className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[120px] p-0"
        align="start"
        collisionPadding={8}
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        <div
          ref={listRef}
          className="max-h-[240px] overflow-y-scroll p-1"
          style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          {slots.map((slot) => (
            <button
              key={slot}
              type="button"
              data-value={slot}
              onClick={() => {
                onChange(slot)
                setOpen(false)
              }}
              className={cn(
                'flex w-full items-center justify-center rounded-sm px-2 py-1.5 text-sm outline-none select-none',
                'hover:bg-accent hover:text-accent-foreground',
                value === slot && 'bg-accent/10 font-medium'
              )}
            >
              {formatTimeDisplay(slot)}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
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
  step = 15,
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
