'use client'

// Searchable id-based select: click to open (shows all), type to filter, clear to
// reset to "all". Modelled on SubjectSearchSelect but generic over {id,label}.
// value === '' (or 'all') means no selection ("ทุกทีม").

import { useState, useEffect, useRef, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Search, X, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface TeamSearchOption {
  id: string
  label: string
}

interface Props {
  options: TeamSearchOption[]
  value: string // '' or 'all' = none selected
  onValueChange: (value: string) => void
  placeholder?: string
  allLabel?: string
  className?: string
  disabled?: boolean
}

export function TeamSearchSelect({
  options,
  value,
  onValueChange,
  placeholder = 'ค้นหา...',
  allLabel = 'ทั้งหมด',
  className,
  disabled = false,
}: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [highlighted, setHighlighted] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const isAll = !value || value === 'all'
  const selected = options.find((o) => o.id === value)

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, searchTerm])

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
        setSearchTerm('')
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const select = (id: string) => {
    onValueChange(id)
    setIsOpen(false)
    setSearchTerm('')
    setHighlighted(0)
  }

  const clear = () => {
    onValueChange('all')
    setSearchTerm('')
    setHighlighted(0)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown') setIsOpen(true)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted((p) => (p < filtered.length - 1 ? p + 1 : p))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted((p) => (p > 0 ? p - 1 : 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[highlighted]) select(filtered[highlighted].id)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setIsOpen(false)
      setSearchTerm('')
    }
  }

  return (
    <div className={cn('relative', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
        {!isOpen ? (
          <div
            className={cn(
              'flex items-center justify-between w-full pl-10 pr-3 h-10 text-sm bg-white border rounded-md cursor-pointer hover:bg-gray-50',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
            onClick={() => !disabled && setIsOpen(true)}
          >
            {isAll ? (
              <span className="text-gray-500">{allLabel}</span>
            ) : (
              <span className="font-medium truncate">{selected?.label ?? value}</span>
            )}
            <div className="flex items-center gap-1 flex-shrink-0">
              {!isAll && !disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    clear()
                  }}
                  className="p-1 hover:bg-gray-200 rounded"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </div>
          </div>
        ) : (
          <Input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setIsOpen(true)
              setHighlighted(0)
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className="pl-10 pr-3 h-10 text-sm"
            autoFocus
          />
        )}
      </div>

      {isOpen && !disabled && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-80 overflow-auto text-sm"
        >
          {/* "all" row */}
          <div
            onClick={() => select('all')}
            className={cn('px-3 py-2 cursor-pointer hover:bg-gray-100', isAll && 'bg-red-50 font-medium')}
          >
            {allLabel}
          </div>
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-gray-500 text-center">ไม่พบรายการ</div>
          ) : (
            filtered.map((o, i) => (
              <div
                key={o.id}
                onClick={() => select(o.id)}
                onMouseEnter={() => setHighlighted(i)}
                className={cn(
                  'px-3 py-2 cursor-pointer hover:bg-gray-100 truncate',
                  highlighted === i && 'bg-gray-100',
                  value === o.id && 'bg-red-50 font-medium'
                )}
              >
                {o.label}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
