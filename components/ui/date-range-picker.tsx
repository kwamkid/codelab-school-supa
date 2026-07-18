"use client"

import Datepicker from "react-tailwindcss-datepicker"
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Tooltip } from "@/components/ui/tooltip"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

function toDateStr(d: Date | string | null | undefined): string {
  if (!d) return ""
  if (typeof d === "string") return d.slice(0, 10)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/** Convert date string "YYYY-MM-DD" to Date object safely. Returns null if invalid. */
function toDate(s: string | null | undefined): Date | null {
  if (!s) return null
  const d = new Date(s + "T00:00:00")
  return isNaN(d.getTime()) ? null : d
}

// --- Range mode props (default) ---
interface DateRangePickerRangeProps {
  mode?: "range"
  value?: { from?: string; to?: string }
  onChange: (range: { from: string; to: string } | undefined) => void
  placeholder?: string
  className?: string
  minDate?: Date
  maxDate?: Date
  disabled?: boolean
  popoverDirection?: "up" | "down"
}

// --- Single date mode props ---
interface DateRangePickerSingleProps {
  mode: "single"
  value?: string
  onChange: (date: string | undefined) => void
  placeholder?: string
  className?: string
  minDate?: Date
  maxDate?: Date
  disabled?: boolean
  popoverDirection?: "up" | "down"
  /** Show ‹ › prev/next-day buttons around the picker */
  withStepper?: boolean
}

// --- Multiple discrete dates mode props ---
// (react-tailwindcss-datepicker can't do multi-date, so this mode renders the
// shared shadcn Calendar in a portaled Popover instead — same component API.)
interface DateRangePickerMultipleProps {
  mode: "multiple"
  /** Selected dates as "YYYY-MM-DD" strings (matches the other modes). */
  values?: string[]
  onChange: (dates: string[]) => void
  placeholder?: string
  className?: string
  minDate?: Date
  maxDate?: Date
  disabled?: boolean
  popoverDirection?: "up" | "down"
}

type DateRangePickerProps =
  | DateRangePickerRangeProps
  | DateRangePickerSingleProps
  | DateRangePickerMultipleProps

const INPUT_CLASS =
  "w-full h-10 rounded-md border border-input bg-background pl-3 pr-10 py-2.5 text-base ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"

export function DateRangePicker(props: DateRangePickerProps) {
  const { placeholder, className, minDate, maxDate, disabled, popoverDirection } = props

  const now = new Date()

  if (props.mode === "multiple") {
    // --- Multiple discrete dates ---
    const selectedDates = (props.values || []).map(toDate).filter(Boolean) as Date[]
    const sorted = [...selectedDates].sort((a, b) => a.getTime() - b.getTime())

    return (
      <div className={cn("space-y-2", className)}>
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" disabled={disabled} className={cn(INPUT_CLASS, "flex items-center text-left")}>
              <CalendarDays className="h-4 w-4 mr-2 text-gray-500 shrink-0" />
              {sorted.length === 0 ? (
                <span className="text-muted-foreground">{placeholder || "เลือกวันที่..."}</span>
              ) : (
                `เลือกแล้ว ${sorted.length} วัน`
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="multiple"
              selected={selectedDates}
              onSelect={(d) => props.onChange((d || []).map((x) => toDateStr(x)))}
              disabled={[
                ...(minDate ? [{ before: minDate }] : []),
                ...(maxDate ? [{ after: maxDate }] : []),
              ]}
            />
          </PopoverContent>
        </Popover>

        {sorted.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {sorted.map((d) => (
              <span
                key={d.toISOString()}
                className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 px-2.5 py-0.5 text-sm"
              >
                {d.toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short" })}
                <button
                  type="button"
                  onClick={() => props.onChange((props.values || []).filter((v) => v !== toDateStr(d)))}
                  className="opacity-60 hover:opacity-100"
                  aria-label="เอาวันนี้ออก"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (props.mode === "single") {
    // --- Single date mode ---
    const dateObj = toDate(props.value)
    const pickerValue = { startDate: dateObj, endDate: dateObj }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleChange = (newValue: any) => {
      const date = toDateStr(newValue?.startDate)
      props.onChange(date || undefined)
    }

    const picker = (
      <div className={cn("w-full datepicker-custom", props.withStepper ? "flex-1" : className)}>
        <Datepicker
          i18n="en"
          asSingle={true}
          useRange={false}
          value={pickerValue}
          onChange={handleChange}
          showShortcuts={false}
          showFooter={false}
          displayFormat="D MMM YYYY"
          placeholder={placeholder || "เลือกวันที่"}
          inputClassName={INPUT_CLASS}
          primaryColor="red"
          minDate={minDate}
          maxDate={maxDate}
          disabled={disabled}
          popoverDirection={popoverDirection}
          startFrom={dateObj ?? undefined}
        />
      </div>
    )

    if (!props.withStepper) return picker

    // ‹ [picker] › with prev/next-day stepping
    const shiftDay = (delta: number) => {
      const base = toDate(props.value) ?? new Date()
      base.setDate(base.getDate() + delta)
      props.onChange(toDateStr(base))
    }
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
    const cur = dateObj ?? startOfDay(now)
    const prevDay = new Date(cur); prevDay.setDate(prevDay.getDate() - 1)
    const nextDay = new Date(cur); nextDay.setDate(nextDay.getDate() + 1)
    const canPrev = !disabled && (!minDate || prevDay >= startOfDay(minDate))
    const canNext = !disabled && (!maxDate || nextDay <= startOfDay(maxDate))
    const stepBtn =
      "h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-md border border-input bg-background text-muted-foreground transition-colors hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-slate-700 dark:hover:text-white disabled:cursor-not-allowed disabled:opacity-50"

    return (
      <div className={cn("flex items-center gap-1.5", className)}>
        <Tooltip label="วันก่อนหน้า">
          <button type="button" onClick={() => shiftDay(-1)} disabled={!canPrev} className={stepBtn} aria-label="วันก่อนหน้า">
            <ChevronLeft className="h-4 w-4" />
          </button>
        </Tooltip>
        {picker}
        <Tooltip label="วันถัดไป">
          <button type="button" onClick={() => shiftDay(1)} disabled={!canNext} className={stepBtn} aria-label="วันถัดไป">
            <ChevronRight className="h-4 w-4" />
          </button>
        </Tooltip>
      </div>
    )
  }

  // --- Range mode (default) ---
  const startDateObj = toDate(props.value?.from)
  const endDateObj = toDate(props.value?.to)
  const pickerValue = {
    startDate: startDateObj,
    endDate: endDateObj,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleChange = (newValue: any) => {
    const start = toDateStr(newValue?.startDate)
    const end = toDateStr(newValue?.endDate)
    if (start && end) {
      props.onChange({ from: start, to: end })
    } else {
      props.onChange(undefined)
    }
  }

  const configs = {
    footer: {
      cancel: "ยกเลิก",
      apply: "ตกลง",
    },
  }

  return (
    <div className={cn("w-full md:w-auto md:min-w-[280px] datepicker-custom", className)}>
      <Datepicker
        i18n="en"
        configs={configs}
        value={pickerValue}
        onChange={handleChange}
        showShortcuts={false}
        showFooter={true}
        separator="—"
        displayFormat="D MMM YYYY"
        placeholder={placeholder || "เลือกช่วงวันที่"}
        inputClassName={INPUT_CLASS}
        primaryColor="red"
        minDate={minDate}
        maxDate={maxDate}
        disabled={disabled}
        popoverDirection={popoverDirection}
        startFrom={startDateObj ?? undefined}
      />
    </div>
  )
}
