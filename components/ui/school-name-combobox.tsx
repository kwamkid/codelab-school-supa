'use client'

import { useCallback } from "react"
import { AutocompleteInput, AutocompleteOption } from "@/components/ui/autocomplete-input"
import { normalizeSchoolName } from "@/lib/utils/normalize-school-name"

interface SchoolNameComboboxProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function SchoolNameCombobox({
  value,
  onChange,
  placeholder = "ชื่อโรงเรียน",
  className,
}: SchoolNameComboboxProps) {
  const handleSearch = useCallback(async (query: string): Promise<AutocompleteOption[]> => {
    const params = new URLSearchParams({ search: query })
    const res = await fetch(`/api/schools?${params}`)
    const data = await res.json()
    if (data.success) {
      return (data.schools || []).map((s: { name: string; count: number }) => ({
        value: s.name,
        label: s.name,
        description: `(${s.count})`,
      }))
    }
    return []
  }, [])

  return (
    <AutocompleteInput
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      onSearch={handleSearch}
      onNormalize={normalizeSchoolName}
      className={className}
    />
  )
}
