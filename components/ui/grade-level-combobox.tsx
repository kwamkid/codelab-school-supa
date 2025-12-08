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
import { gradeLevels, searchGradeLevels } from "@/lib/constants/grade-levels"

interface GradeLevelComboboxProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  allowCustom?: boolean
}

export function GradeLevelCombobox({ 
  value, 
  onChange, 
  placeholder = "เลือกระดับชั้น...",
  allowCustom = true 
}: GradeLevelComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState("")

  // Filter grade levels based on search
  const filteredGrades = React.useMemo(() => {
    // แก้ไขตรงนี้: แสดงผลเฉพาะเมื่อพิมพ์อย่างน้อย 1 ตัวอักษร
    if (!searchValue || searchValue.length < 1) {
      return []; // ไม่แสดงอะไรเลยถ้ายังไม่ได้พิมพ์
    }
    
    return searchGradeLevels(searchValue)
  }, [searchValue])

  // Group filtered grades by category
  const groupedGrades = React.useMemo(() => {
    const grouped = filteredGrades.reduce((acc, grade) => {
      if (!acc[grade.category]) {
        acc[grade.category] = []
      }
      acc[grade.category].push(grade)
      return acc
    }, {} as Record<string, typeof gradeLevels>)
    
    return grouped
  }, [filteredGrades])

  // Find label for current value
  const currentLabel = gradeLevels.find(g => g.value === value)?.label || value

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue)
    setOpen(false)
    setSearchValue("")
  }

  const handleCustomValue = () => {
    if (allowCustom && searchValue && !gradeLevels.find(g => 
      g.value.toLowerCase() === searchValue.toLowerCase() ||
      g.label.toLowerCase() === searchValue.toLowerCase()
    )) {
      onChange(searchValue)
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
            // แก้ไข: ลบ focus styles ที่ทำให้ border เกิน
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          )}
        >
          <span className="truncate">{value ? currentLabel : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[var(--radix-popover-trigger-width)] p-0" 
        align="start"
        // แก้ไข: เพิ่ม sideOffset เพื่อให้ dropdown ไม่ชิดกับ button มากเกินไป
        sideOffset={4}
      >
        <Command>
          <CommandInput 
            placeholder="ค้นหา ป.4, ม.1, Grade 3..." 
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            {/* แสดงเมื่อยังไม่ได้พิมพ์ */}
            {searchValue.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                พิมพ์เพื่อค้นหาระดับชั้น...
              </div>
            ) : (
              // แสดงผลการค้นหา
              <>
                <CommandEmpty>
                  {allowCustom && searchValue ? (
                    <div 
                      className="px-4 py-2 cursor-pointer hover:bg-gray-100 text-sm"
                      onClick={handleCustomValue}
                    >
                      ใช้ &quot;{searchValue}&quot; เป็นระดับชั้น
                    </div>
                  ) : (
                    "ไม่พบระดับชั้นที่ค้นหา"
                  )}
                </CommandEmpty>
                
                {Object.entries(groupedGrades).map(([category, grades]) => (
                  <CommandGroup key={category} heading={category}>
                    {grades.map((grade) => (
                      <CommandItem
                        key={grade.value}
                        value={grade.value}
                        onSelect={() => handleSelect(grade.value)}
                        className="cursor-pointer"
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            value === grade.value ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {grade.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}