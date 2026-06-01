'use client'

import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface SearchInputProps {
  placeholder?: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
  /** 'onDark' = white text/icon + glassy bg, for use on dark/colored backgrounds */
  variant?: 'default' | 'onDark'
}

export function SearchInput({
  placeholder = 'ค้นหา...',
  value,
  onChange,
  disabled = false,
  className,
  variant = 'default',
}: SearchInputProps) {
  const onDark = variant === 'onDark'
  return (
    <div className={cn('relative', className)}>
      <Search className={cn('absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4', onDark ? 'text-white/80' : 'text-gray-400')} />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value) {
            onChange('')
          }
        }}
        className={cn(
          'pl-10 pr-8 h-11',
          onDark && 'bg-white/15 border-white/40 text-white placeholder:text-white/70 focus-visible:ring-white/50 focus-visible:border-white/70'
        )}
        disabled={disabled}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className={cn('absolute right-3 top-1/2 transform -translate-y-1/2', onDark ? 'text-white/80 hover:text-white' : 'text-gray-400 hover:text-gray-600')}
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
