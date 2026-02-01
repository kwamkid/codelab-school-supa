"use client"

import Datepicker from "react-tailwindcss-datepicker"

import { cn } from "@/lib/utils"

interface DateRangePickerProps {
  value?: { from?: string; to?: string }
  onChange: (range: { from: string; to: string } | undefined) => void
  placeholder?: string
  className?: string
}

function toDateStr(d: Date | string | null | undefined): string {
  if (!d) return ""
  if (typeof d === "string") return d.slice(0, 10)
  return d.toISOString().slice(0, 10)
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = "เลือกช่วงวันที่",
  className,
}: DateRangePickerProps) {
  const pickerValue = {
    startDate: value?.from || null,
    endDate: value?.to || null,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleChange = (newValue: any) => {
    const start = toDateStr(newValue?.startDate)
    const end = toDateStr(newValue?.endDate)
    if (start && end) {
      onChange({ from: start, to: end })
    } else {
      onChange(undefined)
    }
  }

  const now = new Date()

  const configs = {
    shortcuts: {
      today: "วันนี้",
      yesterday: "เมื่อวาน",
      past: (days: number) =>
        days === 7 ? "7 วันย้อนหลัง" : days === 30 ? "30 วันย้อนหลัง" : `${days} วันย้อนหลัง`,
      currentMonth: "เดือนนี้",
      pastMonth: "เดือนที่แล้ว",
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
    <div className={cn("w-full md:w-auto md:min-w-[280px]", className)}>
      <Datepicker
        i18n="th"
        configs={configs}
        value={pickerValue}
        onChange={handleChange}
        showShortcuts={true}
        showFooter={true}
        separator="—"
        displayFormat="D MMM YYYY"
        placeholder={placeholder}
        inputClassName="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        primaryColor="red"
      />
    </div>
  )
}
