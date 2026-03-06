'use client'

import * as React from "react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

export interface AutocompleteOption {
  value: string
  label: string
  group?: string
  description?: string
}

interface AutocompleteInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  options?: AutocompleteOption[]
  filterFn?: (options: AutocompleteOption[], query: string) => AutocompleteOption[]
  onSearch?: (query: string) => Promise<AutocompleteOption[]>
  debounceMs?: number
  onNormalize?: (value: string) => string
  minChars?: number
  className?: string
  /** When false, onChange only fires on selection from dropdown. Input reverts on blur. */
  freeInput?: boolean
}

export function AutocompleteInput({
  value,
  onChange,
  placeholder,
  options,
  filterFn,
  onSearch,
  debounceMs = 300,
  onNormalize,
  minChars = 1,
  className,
  freeInput = true,
}: AutocompleteInputProps) {
  const [inputValue, setInputValue] = React.useState(value || "")
  const [suggestions, setSuggestions] = React.useState<AutocompleteOption[]>([])
  const [loading, setLoading] = React.useState(false)
  const [showDropdown, setShowDropdown] = React.useState(false)
  const [highlightIndex, setHighlightIndex] = React.useState(-1)
  const debounceRef = React.useRef<NodeJS.Timeout | null>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  // Track the last confirmed value (for freeInput=false revert)
  const confirmedRef = React.useRef(value || "")

  // Sync external value
  React.useEffect(() => {
    setInputValue(value || "")
    confirmedRef.current = value || ""
  }, [value])

  // Filter static options or fetch async
  React.useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!inputValue || inputValue.length < minChars) {
      setSuggestions([])
      return
    }

    if (options) {
      const filtered = filterFn
        ? filterFn(options, inputValue)
        : options.filter(o => {
            const query = inputValue.toLowerCase()
            return o.label.toLowerCase().includes(query) || o.value.toLowerCase().includes(query)
          })
      setSuggestions(filtered)
    } else if (onSearch) {
      debounceRef.current = setTimeout(async () => {
        setLoading(true)
        try {
          const results = await onSearch(inputValue)
          setSuggestions(results)
        } catch {
          setSuggestions([])
        } finally {
          setLoading(false)
        }
      }, debounceMs)
    }

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [inputValue, options, onSearch, debounceMs, minChars])

  // Close on outside click
  React.useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setInputValue(val)
    if (freeInput) {
      onChange(val)
    }
    setShowDropdown(true)
    setHighlightIndex(-1)
  }

  const handleSelect = (opt: AutocompleteOption) => {
    setInputValue(opt.label)
    confirmedRef.current = opt.label
    onChange(opt.value)
    setShowDropdown(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || suggestions.length === 0) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlightIndex(prev => Math.min(prev + 1, suggestions.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlightIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === "Enter" && highlightIndex >= 0) {
      e.preventDefault()
      handleSelect(suggestions[highlightIndex])
    } else if (e.key === "Escape") {
      setShowDropdown(false)
    }
  }

  const handleBlur = () => {
    if (!freeInput) {
      // Revert to last confirmed value
      setInputValue(confirmedRef.current)
    } else if (onNormalize && inputValue) {
      const normalized = onNormalize(inputValue)
      if (normalized !== inputValue) {
        setInputValue(normalized)
        onChange(normalized)
      }
    }
  }

  // Group suggestions
  const grouped = React.useMemo(() => {
    const groups: { group: string; items: AutocompleteOption[] }[] = []
    let currentGroup: string | null = null
    suggestions.forEach(s => {
      const g = s.group || ""
      if (g !== currentGroup || groups.length === 0) {
        currentGroup = g
        groups.push({ group: g, items: [] })
      }
      groups[groups.length - 1].items.push(s)
    })
    return groups
  }, [suggestions])

  // Flat index for keyboard navigation
  let flatIdx = -1

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => inputValue && inputValue.length >= minChars && setShowDropdown(true)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        className={className}
      />
      {showDropdown && inputValue && inputValue.length >= minChars && (suggestions.length > 0 || loading) && (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
          {loading && suggestions.length === 0 ? (
            <div className="py-3 text-center text-sm text-muted-foreground">
              กำลังค้นหา...
            </div>
          ) : (
            grouped.map((g, gi) => (
              <div key={gi}>
                {g.group && (
                  <div className="px-3 py-1.5 text-xs text-muted-foreground bg-gray-50 font-medium sticky top-0">
                    {g.group}
                  </div>
                )}
                {g.items.map((opt) => {
                  flatIdx++
                  const idx = flatIdx
                  return (
                    <div
                      key={`${opt.value}-${idx}`}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        handleSelect(opt)
                      }}
                      className={cn(
                        "flex items-center justify-between px-3 py-2 text-sm cursor-pointer",
                        idx === highlightIndex ? "bg-accent" : "hover:bg-accent/50"
                      )}
                    >
                      <span>{opt.label}</span>
                      {opt.description && (
                        <span className="text-xs text-muted-foreground ml-2">{opt.description}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
