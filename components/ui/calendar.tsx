"use client"

import * as React from "react"
import {
  CalendarDays,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react"
import {
  DayPicker,
  getDefaultClassNames,
  type DayButton,
} from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant = "ghost",
  formatters,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>["variant"]
}) {
  const defaultClassNames = getDefaultClassNames()

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        "bg-background group/calendar p-3 [--cell-size:2rem] [[data-slot=card-content]_&]:bg-transparent [[data-slot=popover-content]_&]:bg-transparent",
        String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
        String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
        className
      )}
      captionLayout={captionLayout}
      formatters={{
        formatMonthDropdown: (date) =>
          date.toLocaleString("default", { month: "short" }),
        ...formatters,
      }}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn(
          "flex gap-4 flex-col md:flex-row relative",
          defaultClassNames.months
        ),
        month: cn("flex flex-col w-full gap-4", defaultClassNames.month),
        nav: cn(
          "flex items-center gap-1 w-full absolute top-0 inset-x-0 justify-between",
          defaultClassNames.nav
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          "h-[var(--cell-size)] w-[var(--cell-size)] aria-disabled:opacity-50 p-0 select-none",
          defaultClassNames.button_previous
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          "h-[var(--cell-size)] w-[var(--cell-size)] aria-disabled:opacity-50 p-0 select-none",
          defaultClassNames.button_next
        ),
        month_caption: cn(
          "flex items-center justify-center h-[var(--cell-size)] w-full px-[var(--cell-size)]",
          defaultClassNames.month_caption
        ),
        dropdowns: cn(
          "w-full flex items-center text-sm font-medium justify-center h-[var(--cell-size)] gap-1.5",
          defaultClassNames.dropdowns
        ),
        dropdown_root: cn(
          "relative has-focus:border-ring border border-input shadow-xs has-focus:ring-ring/50 has-focus:ring-[3px] rounded-md",
          defaultClassNames.dropdown_root
        ),
        dropdown: cn(
          "absolute bg-popover inset-0 opacity-0",
          defaultClassNames.dropdown
        ),
        caption_label: cn(
          "select-none font-medium",
          captionLayout === "label"
            ? "text-sm"
            : "rounded-md pl-2 pr-1 flex items-center gap-1 text-sm h-8 [&>svg]:text-muted-foreground [&>svg]:size-3.5",
          defaultClassNames.caption_label
        ),
        table: "w-full border-collapse",
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "text-muted-foreground rounded-md flex-1 font-normal text-[0.8rem] select-none",
          defaultClassNames.weekday
        ),
        week: cn("flex w-full mt-2", defaultClassNames.week),
        week_number_header: cn(
          "select-none w-[var(--cell-size)]",
          defaultClassNames.week_number_header
        ),
        week_number: cn(
          "text-[0.8rem] select-none text-muted-foreground",
          defaultClassNames.week_number
        ),
        day: cn(
          "relative w-full h-full p-0 text-center [&:last-child[data-selected=true]_button]:rounded-r-md group/day aspect-square select-none",
          props.showWeekNumber
            ? "[&:nth-child(2)[data-selected=true]_button]:rounded-l-md"
            : "[&:first-child[data-selected=true]_button]:rounded-l-md",
          defaultClassNames.day
        ),
        range_start: cn(
          "rounded-l-md bg-accent",
          defaultClassNames.range_start
        ),
        range_middle: cn("rounded-none", defaultClassNames.range_middle),
        range_end: cn("rounded-r-md bg-accent", defaultClassNames.range_end),
        today: cn(
          "bg-accent text-accent-foreground rounded-md data-[selected=true]:rounded-none",
          defaultClassNames.today
        ),
        outside: cn(
          "text-muted-foreground aria-selected:text-muted-foreground",
          defaultClassNames.outside
        ),
        disabled: cn(
          "text-muted-foreground opacity-50",
          defaultClassNames.disabled
        ),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className, rootRef, ...props }) => {
          return (
            <div
              data-slot="calendar"
              ref={rootRef}
              className={cn(className)}
              {...props}
            />
          )
        },
        Chevron: ({ className, orientation, ...props }) => {
          if (orientation === "left") {
            return (
              <ChevronLeftIcon className={cn("size-4", className)} {...props} />
            )
          }

          if (orientation === "right") {
            return (
              <ChevronRightIcon
                className={cn("size-4", className)}
                {...props}
              />
            )
          }

          return (
            <ChevronDownIcon className={cn("size-4", className)} {...props} />
          )
        },
        DayButton: CalendarDayButton,
        WeekNumber: ({ children, ...props }) => {
          return (
            <td {...props}>
              <div className="flex h-[var(--cell-size)] w-[var(--cell-size)] items-center justify-center text-center">
                {children}
              </div>
            </td>
          )
        },
        ...components,
      }}
      {...props}
    />
  )
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const defaultClassNames = getDefaultClassNames()

  const ref = React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString()}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        "data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground data-[range-middle=true]:bg-accent data-[range-middle=true]:text-accent-foreground data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-ring/50 dark:hover:text-accent-foreground flex aspect-square size-auto w-full min-w-[var(--cell-size)] flex-col gap-1 leading-none font-normal group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:ring-[3px] data-[range-end=true]:rounded-md data-[range-end=true]:rounded-r-md data-[range-middle=true]:rounded-none data-[range-start=true]:rounded-md data-[range-start=true]:rounded-l-md [&>span]:text-xs [&>span]:opacity-70",
        defaultClassNames.day,
        className
      )}
      {...props}
    />
  )
}


// ---------------------------------------------------------------------------
// MonthPicker — "monthly view" ของปฏิทิน: เลือกทั้งเดือน (ไม่ใช่รายวัน)
// ใช้กับหน้าที่ทำงานเป็นรอบเดือน เช่น รายงานประเมินครูรายเดือน
// ค่าเป็นสตริง "YYYY-MM" (ไม่แปลงเป็น Date เพื่อกันปัญหา timezone)
// ---------------------------------------------------------------------------

const TH_MONTHS_FULL = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
]
const TH_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
]

/** "YYYY-MM" → ปี/เดือน (เดือนเริ่มที่ 0) */
function parseMonth(ym: string): { year: number; month: number } {
  const [y, m] = ym.split("-").map(Number)
  return { year: y, month: (m || 1) - 1 }
}

function toMonthStr(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`
}

/** เดือนปัจจุบันเป็น "YYYY-MM" */
export function currentMonthStr(): string {
  const now = new Date()
  return toMonthStr(now.getFullYear(), now.getMonth())
}

/** บวก/ลบเดือนจาก "YYYY-MM" */
export function shiftMonth(ym: string, delta: number): string {
  const { year, month } = parseMonth(ym)
  const total = year * 12 + month + delta
  return toMonthStr(Math.floor(total / 12), total % 12)
}

/** "YYYY-MM" → "มิถุนายน 2569" */
export function formatMonthTH(ym: string): string {
  const { year, month } = parseMonth(ym)
  return `${TH_MONTHS_FULL[month]} ${year + 543}`
}

interface MonthPickerProps {
  /** เดือนที่เลือก รูปแบบ "YYYY-MM" */
  value: string
  onChange: (month: string) => void
  /** เดือนแรกสุดที่เลือกได้ "YYYY-MM" */
  minMonth?: string
  /** เดือนสุดท้ายที่เลือกได้ "YYYY-MM" (ค่าเริ่มต้น = เดือนปัจจุบัน กันเลือกอนาคต) */
  maxMonth?: string
  /** แสดงปุ่ม ‹ › เลื่อนเดือนก่อนหน้า/ถัดไปคร่อมตัวเลือก */
  withStepper?: boolean
  disabled?: boolean
  className?: string
}

const MONTH_TRIGGER_CLASS =
  "h-11 min-w-[190px] inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-slate-800"

const MONTH_STEP_CLASS =
  "h-11 w-11 shrink-0 inline-flex items-center justify-center rounded-md border border-input bg-background text-muted-foreground transition-colors hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-slate-700 dark:hover:text-white disabled:cursor-not-allowed disabled:opacity-50"

function MonthPicker({
  value,
  onChange,
  minMonth,
  maxMonth = currentMonthStr(),
  withStepper = true,
  disabled,
  className,
}: MonthPickerProps) {
  const [open, setOpen] = React.useState(false)
  const selected = parseMonth(value)
  // ปีที่กำลังเปิดดูในกริด (เลื่อนดูปีอื่นได้โดยยังไม่เปลี่ยนค่าที่เลือก)
  const [viewYear, setViewYear] = React.useState(selected.year)

  // เปิด popover ครั้งใหม่ให้กลับไปที่ปีของเดือนที่เลือกอยู่
  React.useEffect(() => {
    if (open) setViewYear(parseMonth(value).year)
  }, [open, value])

  const inRange = (ym: string) =>
    (!minMonth || ym >= minMonth) && (!maxMonth || ym <= maxMonth)

  const prev = shiftMonth(value, -1)
  const next = shiftMonth(value, 1)

  const grid = (
    <div className="p-3 w-[280px]">
      {/* หัวปี — เลื่อนดูปีอื่น */}
      <div className="flex items-center justify-between mb-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setViewYear((y) => y - 1)}
          disabled={!!minMonth && toMonthStr(viewYear - 1, 11) < minMonth}
          aria-label="ปีก่อนหน้า"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </Button>
        <div className="text-base font-semibold tabular-nums">{viewYear + 543}</div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setViewYear((y) => y + 1)}
          disabled={!!maxMonth && toMonthStr(viewYear + 1, 0) > maxMonth}
          aria-label="ปีถัดไป"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </Button>
      </div>

      {/* กริดเดือน 3 คอลัมน์ */}
      <div className="grid grid-cols-3 gap-1.5">
        {TH_MONTHS_SHORT.map((label, i) => {
          const ym = toMonthStr(viewYear, i)
          const isSelected = ym === value
          const allowed = inRange(ym)
          return (
            <button
              key={ym}
              type="button"
              disabled={!allowed}
              onClick={() => {
                onChange(ym)
                setOpen(false)
              }}
              className={cn(
                "h-9 rounded-md text-base transition-colors",
                isSelected
                  ? "bg-primary text-primary-foreground font-medium"
                  : allowed
                    ? "hover:bg-gray-100 dark:hover:bg-slate-700"
                    : "text-gray-300 cursor-not-allowed dark:text-slate-600"
              )}
            >
              {label}
            </button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => {
          onChange(currentMonthStr())
          setOpen(false)
        }}
        className="mt-3 w-full h-9 rounded-md text-sm text-muted-foreground hover:bg-gray-100 dark:hover:bg-slate-700"
      >
        เดือนนี้
      </button>
    </div>
  )

  const trigger = (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" disabled={disabled} className={cn(MONTH_TRIGGER_CLASS, !withStepper && className)}>
          <CalendarDays className="h-4 w-4 text-gray-500 shrink-0" />
          <span className="flex-1 text-left">{formatMonthTH(value)}</span>
          <ChevronDownIcon className="h-4 w-4 text-gray-400 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        {grid}
      </PopoverContent>
    </Popover>
  )

  if (!withStepper) return trigger

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <button
        type="button"
        onClick={() => onChange(prev)}
        disabled={disabled || !inRange(prev)}
        className={MONTH_STEP_CLASS}
        aria-label="เดือนก่อนหน้า"
      >
        <ChevronLeftIcon className="h-4 w-4" />
      </button>
      {trigger}
      <button
        type="button"
        onClick={() => onChange(next)}
        disabled={disabled || !inRange(next)}
        className={MONTH_STEP_CLASS}
        aria-label="เดือนถัดไป"
      >
        <ChevronRightIcon className="h-4 w-4" />
      </button>
    </div>
  )
}

export { Calendar, CalendarDayButton, MonthPicker }
