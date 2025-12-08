'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Student } from '@/types/models';
import { Label } from '@/components/ui/label';
import { 
  Search, 
  User, 
  X,
  ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface StudentSearchSelectProps {
  students: (Student & { parentName: string; parentPhone: string; lineDisplayName?: string })[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  label?: string;
  required?: boolean;
}

export default function StudentSearchSelect({
  students,
  value,
  onValueChange,
  placeholder = "ค้นหานักเรียน...",
  disabled = false,
  label,
  required = false
}: StudentSearchSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [inputElement, setInputElement] = useState<HTMLInputElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter active students only
  const activeStudents = students.filter(s => s.isActive);

  // Get selected student
  const selectedStudent = activeStudents.find(s => s.id === value);

  // Filter students based on search term
  const filteredStudents = useMemo(() => {
    if (!searchTerm.trim()) return activeStudents;
    
    const searchLower = searchTerm.toLowerCase();
    return activeStudents.filter(student => {
      // Search in student name
      if (student.name.toLowerCase().includes(searchLower)) return true;
      // Search in nickname
      if (student.nickname?.toLowerCase().includes(searchLower)) return true;
      // Search in parent name
      if (student.parentName.toLowerCase().includes(searchLower)) return true;
      // Search in LINE display name
      if (student.lineDisplayName?.toLowerCase().includes(searchLower)) return true;
      // Search in phone number
      if (student.parentPhone.includes(searchTerm)) return true;
      
      return false;
    });
  }, [activeStudents, searchTerm]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        inputElement &&
        !inputElement.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [inputElement]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredStudents.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredStudents[highlightedIndex]) {
          handleSelect(filteredStudents[highlightedIndex].id);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  const handleSelect = (studentId: string) => {
    onValueChange(studentId);
    setIsOpen(false);
    setSearchTerm('');
    setHighlightedIndex(0);
  };

  const handleClear = () => {
    onValueChange('');
    setSearchTerm('');
    setHighlightedIndex(0);
    inputElement?.focus();
  };

  return (
    <div className="space-y-2">
      {label && (
        <Label>
          {label} {required && <span className="text-red-500">*</span>}
        </Label>
      )}
      
      <div className="relative">
        {/* Selected Student Display / Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          
          {selectedStudent && !isOpen ? (
            // Display selected student
            <div 
              className={cn(
                "flex items-center justify-between w-full px-10 py-2 text-sm bg-white border rounded-md cursor-pointer",
                "hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500",
                disabled && "opacity-50 cursor-not-allowed"
              )}
              onClick={() => !disabled && setIsOpen(true)}
            >
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-500" />
                <div>
                  <span className="font-medium">{selectedStudent.nickname || selectedStudent.name}</span>
                  <span className="text-gray-500 text-xs ml-2">({selectedStudent.parentName})</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClear();
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
            // Search input - ใช้ <input> ธรรมดาแทน Input component เพื่อหลีกเลี่ยง ref warning
            <input
              ref={setInputElement}
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setIsOpen(true);
                setHighlightedIndex(0);
              }}
              onFocus={() => setIsOpen(true)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              className={cn(
                "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none",
                "placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground",
                "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                "disabled:cursor-not-allowed disabled:opacity-50",
                "pl-10 pr-10 md:text-sm"
              )}
            />
          )}
          
          {/* Clear button for search */}
          {searchTerm && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-200 rounded"
            >
              <X className="h-4 w-4 text-gray-400" />
            </button>
          )}
        </div>

        {/* Dropdown */}
        {isOpen && !disabled && (
          <div 
            ref={dropdownRef}
            className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto"
          >
            {filteredStudents.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500 text-center">
                {searchTerm ? 'ไม่พบนักเรียนที่ค้นหา' : 'ไม่มีนักเรียน'}
              </div>
            ) : (
              <ul className="py-1">
                {filteredStudents.map((student, index) => (
                  <li
                    key={student.id}
                    onClick={() => handleSelect(student.id)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={cn(
                      "px-4 py-2 cursor-pointer hover:bg-gray-100",
                      highlightedIndex === index && "bg-gray-100",
                      value === student.id && "bg-red-50"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <User className="h-4 w-4 text-gray-400 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {highlightSearchTerm(student.nickname || student.name, searchTerm)}
                          </span>
                          {student.nickname && (
                            <span className="text-sm text-gray-500">
                              ({highlightSearchTerm(student.name, searchTerm)})
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 space-y-0.5">
                          <div>
                            ผู้ปกครอง: {highlightSearchTerm(student.parentName, searchTerm)}
                            {student.lineDisplayName && student.lineDisplayName !== student.parentName && (
                              <span className="ml-1">
                                (LINE: {highlightSearchTerm(student.lineDisplayName, searchTerm)})
                              </span>
                            )}
                          </div>
                          <div>โทร: {highlightSearchTerm(student.parentPhone, searchTerm)}</div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Helper function to highlight search term
function highlightSearchTerm(text: string, searchTerm: string): React.ReactNode {
  if (!searchTerm.trim()) return text;
  
  const parts = text.split(new RegExp(`(${escapeRegExp(searchTerm)})`, 'gi'));
  
  return parts.map((part, index) => 
    part.toLowerCase() === searchTerm.toLowerCase() ? (
      <mark key={index} className="bg-yellow-200 px-0.5 rounded">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

// Helper function to escape special characters in regex
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}