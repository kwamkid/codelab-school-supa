"use client"

import Datepicker from "react-tailwindcss-datepicker"

import { cn } from "@/lib/utils"

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
}

type DateRangePickerProps = DateRangePickerRangeProps | DateRangePickerSingleProps

const INPUT_CLASS =
  "w-full h-10 rounded-md border border-input bg-background pl-3 pr-10 py-2.5 text-base ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"

export function DateRangePicker(props: DateRangePickerProps) {
  const { placeholder, className, minDate, maxDate, disabled, popoverDirection } = props

  const now = new Date()

  if (props.mode === "single") {
    // --- Single date mode ---
    const dateObj = toDate(props.value)
    const pickerValue = { startDate: dateObj, endDate: dateObj }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleChange = (newValue: any) => {
      const date = toDateStr(newValue?.startDate)
      props.onChange(date || undefined)
    }

    return (
      <div className={cn("w-full datepicker-custom", className)}>
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
    shortcuts: {
      today: "วันนี้",
      yesterday: "เมื่อวาน",
      past: (days: number) =>
        days === 7 ? "7 วันย้อนหลัง" : days === 30 ? "30 วันย้อนหลัง" : `${days} วันย้อนหลัง`,
      thisMonth: {
        text: "เดือนนี้",
        period: {
          start: new Date(now.getFullYear(), now.getMonth(), 1),
          end: new Date(now.getFullYear(), now.getMonth() + 1, 0),
        },
      },
      prevMonth: {
        text: "เดือนที่แล้ว",
        period: {
          start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
          end: new Date(now.getFullYear(), now.getMonth(), 0),
        },
      },
      thisYear: {
        text: "ปีนี้",
        period: {
          start: new Date(now.getFullYear(), 0, 1),
          end: new Date(now.getFullYear(), 11, 31),
        },
      },
      lastYear: {
        text: "ปีที่แล้ว",
        period: {
          start: new Date(now.getFullYear() - 1, 0, 1),
          end: new Date(now.getFullYear() - 1, 11, 31),
        },
      },
    },
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
        showShortcuts={true}
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
