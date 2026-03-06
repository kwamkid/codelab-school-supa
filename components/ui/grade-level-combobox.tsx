'use client'

import { useMemo, useCallback } from "react"
import { AutocompleteInput, AutocompleteOption } from "@/components/ui/autocomplete-input"
import { gradeLevels, searchGradeLevels } from "@/lib/constants/grade-levels"

interface GradeLevelComboboxProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  allowCustom?: boolean
  className?: string
}

export function GradeLevelCombobox({
  value,
  onChange,
  placeholder = "พิมพ์ระดับชั้น เช่น ป.4, Grade 3...",
  className,
}: GradeLevelComboboxProps) {
  const options = useMemo((): AutocompleteOption[] => {
    return gradeLevels.map(g => ({
      value: g.value,
      label: g.label,
      group: g.category,
    }))
  }, [])

  // Custom filter using searchGradeLevels (supports searchTerms aliases)
  const filterFn = useCallback((_opts: AutocompleteOption[], query: string): AutocompleteOption[] => {
    const results = searchGradeLevels(query)
    return results.map(g => ({
      value: g.value,
      label: g.label,
      group: g.category,
    }))
  }, [])

  // Find display label for current value
  const displayValue = useMemo(() => {
    const found = gradeLevels.find(g => g.value === value)
    return found?.label || value
  }, [value])

  return (
    <AutocompleteInput
      value={displayValue}
      onChange={onChange}
      placeholder={placeholder}
      options={options}
      filterFn={filterFn}
      freeInput={false}
      className={className}
    />
  )
}
