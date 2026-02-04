'use client'

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { normalizeSchoolName } from "@/lib/utils/normalize-school-name"

interface SchoolNameComboboxProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function SchoolNameCombobox({
  value,
  onChange,
  placeholder = "ชื่อโรงเรียน",
}: SchoolNameComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState("")
  const [schools, setSchools] = React.useState<Array<{ name: string; count: number }>>([])
  const [loading, setLoading] = React.useState(false)
  const debounceRef = React.useRef<NodeJS.Timeout | null>(null)

  // Fetch school names from API when search changes
  React.useEffect(() => {
    if (!open) return

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (searchValue) params.append('search', searchValue)
        const res = await fetch(`/api/schools?${params}`)
        const data = await res.json()
        if (data.success) {
          setSchools(data.schools || [])
        }
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [searchValue, open])

  // Load initial list when opening
  React.useEffect(() => {
    if (open && schools.length === 0) {
      setSearchValue("")
    }
  }, [open])

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue)
    setOpen(false)
    setSearchValue("")
  }

  const handleCustomValue = () => {
    if (searchValue) {
      const normalized = normalizeSchoolName(searchValue)
      onChange(normalized || searchValue)
      setOpen(false)
      setSearchValue("")
    }
  }

  // Reset search when popover closes
  React.useEffect(() => {
    if (!open) {
      setSearchValue("")
    }
  }, [open])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between text-left font-normal",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          )}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        sideOffset={4}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="พิมพ์ชื่อโรงเรียน..."
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            {loading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                กำลังค้นหา...
              </div>
            ) : schools.length === 0 && searchValue ? (
              <CommandEmpty>
                <div
                  className="px-4 py-2 cursor-pointer hover:bg-gray-100 text-sm"
                  onClick={handleCustomValue}
                >
                  ใช้ &quot;{normalizeSchoolName(searchValue) || searchValue}&quot;
                </div>
              </CommandEmpty>
            ) : schools.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                พิมพ์เพื่อค้นหาโรงเรียน...
              </div>
            ) : (
              <>
                <CommandGroup heading={`โรงเรียน (${schools.length})`}>
                  {schools.map((school) => (
                    <CommandItem
                      key={school.name}
                      value={school.name}
                      onSelect={() => handleSelect(school.name)}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === school.name ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="flex-1">{school.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        ({school.count})
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
                {searchValue && !schools.find(s => s.name.toLowerCase() === searchValue.toLowerCase()) && (
                  <CommandGroup heading="เพิ่มใหม่">
                    <CommandItem
                      value={`custom-${searchValue}`}
                      onSelect={handleCustomValue}
                      className="cursor-pointer"
                    >
                      <span className="text-sm">
                        ใช้ &quot;{normalizeSchoolName(searchValue) || searchValue}&quot;
                      </span>
                    </CommandItem>
                  </CommandGroup>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
