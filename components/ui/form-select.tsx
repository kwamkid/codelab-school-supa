'use client'

import * as React from 'react'
import { Check, ChevronsUpDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

export interface FormSelectOption {
  value: string
  label: string
  color?: string
}

interface FormSelectProps {
  value: string
  onValueChange: (value: string) => void
  options: FormSelectOption[]
  placeholder?: string
  disabled?: boolean
  className?: string
  searchThreshold?: number
  searchPlaceholder?: string
}

export function FormSelect({
  value,
  onValueChange,
  options,
  placeholder = 'เลือก...',
  disabled = false,
  className,
  searchThreshold = 7,
  searchPlaceholder = 'ค้นหา...',
}: FormSelectProps) {
  const useSearch = options.length > searchThreshold

  if (useSearch) {
    return (
      <SearchableSelect
        value={value}
        onValueChange={onValueChange}
        options={options}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
        searchPlaceholder={searchPlaceholder}
      />
    )
  }

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={cn('w-full', className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            <span className="flex items-center gap-2">
              {opt.color && (
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: opt.color }}
                />
              )}
              {opt.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder,
  disabled,
  className,
  searchPlaceholder,
}: Omit<FormSelectProps, 'searchThreshold'>) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)

  const selectedOption = React.useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value]
  )

  const filtered = React.useMemo(() => {
    if (!search.trim()) return options
    const q = search.toLowerCase()
    return options.filter((opt) => opt.label.toLowerCase().includes(q))
  }, [options, search])

  React.useEffect(() => {
    if (open) {
      setSearch('')
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

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
          <span className="truncate flex items-center gap-2">
            {selectedOption?.color && (
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: selectedOption.color }}
              />
            )}
            {selectedOption?.label || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="min-w-[--radix-popover-trigger-width] w-auto p-0"
        align="start"
        collisionPadding={8}
        style={{ maxHeight: '320px', overflow: 'hidden', minWidth: '240px' }}
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="size-4 shrink-0 opacity-50" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="flex h-8 w-full bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        {/* Scrollable options list */}
        <div
          className="p-1"
          style={{ maxHeight: '260px', overflowY: 'scroll', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          {filtered.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              ไม่พบข้อมูล
            </div>
          ) : (
            filtered.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onValueChange(opt.value)
                  setOpen(false)
                }}
                className={cn(
                  'relative flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none',
                  'hover:bg-accent hover:text-accent-foreground',
                  value === opt.value && 'bg-accent/10 font-medium'
                )}
              >
                <Check
                  className={cn(
                    'mr-1 h-4 w-4 shrink-0',
                    value === opt.value ? 'opacity-100' : 'opacity-0'
                  )}
                />
                {opt.color && (
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: opt.color }}
                  />
                )}
                {opt.label}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
