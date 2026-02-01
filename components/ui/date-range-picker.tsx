"use client"

import Datepicker from "react-tailwindcss-datepicker"

import { cn } from "@/lib/utils"

interface DateRangePickerProps {
  value?: { from?: string; to?: string }
  onChange: (range: { from: string; to: string } | undefined) => void
  placeholder?: string
  className?: string
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

  const handleChange = (newValue: { startDate: string | null; endDate: string | null } | null) => {
    if (newValue?.startDate && newValue?.endDate) {
      onChange({
        from: newValue.startDate,
        to: newValue.endDate,
      })
    } else {
      onChange(undefined)
    }
  }

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const configs = {
    shortcuts: {
      today: {
        text: "วันนี้",
        period: {
          start: today.toISOString().slice(0, 10),
          end: today.toISOString().slice(0, 10),
        },
      },
      yesterday: {
        text: "เมื่อวาน",
        period: {
          start: new Date(today.getTime() - 86400000).toISOString().slice(0, 10),
          end: new Date(today.getTime() - 86400000).toISOString().slice(0, 10),
        },
      },
      past: [
        {
          daysNumber: 7,
          text: "7 วันย้อนหลัง",
          period: {
            start: new Date(today.getTime() - 6 * 86400000).toISOString().slice(0, 10),
            end: today.toISOString().slice(0, 10),
          },
        },
        {
          daysNumber: 30,
          text: "30 วันย้อนหลัง",
          period: {
            start: new Date(today.getTime() - 29 * 86400000).toISOString().slice(0, 10),
            end: today.toISOString().slice(0, 10),
          },
        },
      ],
      currentMonth: {
        text: "เดือนนี้",
        period: {
          start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
          end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10),
        },
      },
      pastMonth: {
        text: "เดือนที่แล้ว",
        period: {
          start: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10),
          end: new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10),
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
