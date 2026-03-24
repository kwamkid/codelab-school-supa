'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Subject } from '@/types/models';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  X,
  ChevronDown,
  BookOpen
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SubjectSearchSelectProps {
  subjects: Subject[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  label?: string;
  required?: boolean;
}

export default function SubjectSearchSelect({
  subjects,
  value,
  onValueChange,
  placeholder = "ค้นหาวิชา...",
  disabled = false,
  label,
  required = false
}: SubjectSearchSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Use all provided subjects (caller decides filtering)
  const activeSubjects = subjects;

  // Get selected subject
  const selectedSubject = activeSubjects.find(s => s.id === value);

  // Filter subjects based on search term
  const filteredSubjects = useMemo(() => {
    if (!searchTerm.trim()) return activeSubjects;
    
    const searchLower = searchTerm.toLowerCase();
    return activeSubjects.filter(subject => {
      // Search in subject name
      if (subject.name.toLowerCase().includes(searchLower)) return true;
      // Search in code
      if (subject.code.toLowerCase().includes(searchLower)) return true;
      // Search in category
      if (subject.category.toLowerCase().includes(searchLower)) return true;
      // Search in level
      if (subject.level.toLowerCase().includes(searchLower)) return true;
      
      return false;
    });
  }, [activeSubjects, searchTerm]);

  // Group subjects by category
  const groupedSubjects = useMemo(() => {
    const grouped = new Map<string, Subject[]>();
    filteredSubjects.forEach(subject => {
      if (!grouped.has(subject.category)) {
        grouped.set(subject.category, []);
      }
      grouped.get(subject.category)!.push(subject);
    });
    return grouped;
  }, [filteredSubjects]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
          prev < filteredSubjects.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredSubjects[highlightedIndex]) {
          handleSelect(filteredSubjects[highlightedIndex].id);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  const handleSelect = (subjectId: string) => {
    onValueChange(subjectId);
    setIsOpen(false);
    setSearchTerm('');
    setHighlightedIndex(0);
  };

  const handleClear = () => {
    onValueChange('');
    setSearchTerm('');
    setHighlightedIndex(0);
    inputRef.current?.focus();
  };

  // Get level badge color
  const getLevelColor = (level: string) => {
    switch (level) {
      case 'Beginner':
        return 'bg-green-100 text-green-700';
      case 'Intermediate':
        return 'bg-yellow-100 text-yellow-700';
      case 'Advanced':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  // Get level Thai label
  const getLevelLabel = (level: string) => {
    switch (level) {
      case 'Beginner':
        return 'เริ่มต้น';
      case 'Intermediate':
        return 'ปานกลาง';
      case 'Advanced':
        return 'ขั้นสูง';
      default:
        return level;
    }
  };

  return (
    <div className="space-y-2">
      {label && (
        <Label>
          {label} {required && <span className="text-red-500">*</span>}
        </Label>
      )}
      
      <div className="relative">
        {/* Selected Subject Display / Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          
          {!isOpen ? (
            // Display selected subject or placeholder
            <div
              className={cn(
                "flex items-center justify-between w-full pl-10 pr-3 py-2 text-sm bg-white border rounded-md cursor-pointer",
                "hover:bg-gray-50",
                disabled && "opacity-50 cursor-not-allowed"
              )}
              onClick={() => !disabled && setIsOpen(true)}
            >
              {selectedSubject ? (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: selectedSubject.color }}
                  />
                  <span className="font-medium truncate">{selectedSubject.name}</span>
                  <span className="text-xs text-gray-400">{selectedSubject.code}</span>
                </div>
              ) : (
                <span className="text-gray-400">--- ทุกวิชา ---</span>
              )}
              <div className="flex items-center gap-1 flex-shrink-0">
                {selectedSubject && !disabled && (
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
            // Search input
            <Input
              ref={inputRef}
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
              className="pl-10 pr-10 text-sm"
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
            className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-80 overflow-auto text-sm"
          >
            {filteredSubjects.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500 text-center">
                {searchTerm ? 'ไม่พบวิชาที่ค้นหา' : 'ไม่มีวิชา'}
              </div>
            ) : (
              <div className="py-0.5">
                {Array.from(groupedSubjects.entries()).map(([category, subjects]) => (
                  <div key={category}>
                    <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50 sticky top-0">
                      {category}
                    </div>
                    {subjects.map((subject) => {
                      const globalIndex = filteredSubjects.findIndex(s => s.id === subject.id);
                      return (
                        <div
                          key={subject.id}
                          onClick={() => handleSelect(subject.id)}
                          onMouseEnter={() => setHighlightedIndex(globalIndex)}
                          className={cn(
                            "flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-gray-100",
                            highlightedIndex === globalIndex && "bg-gray-100",
                            value === subject.id && "bg-red-50"
                          )}
                        >
                          <div
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: subject.color }}
                          />
                          <span className="font-medium truncate">
                            {highlightSearchTerm(subject.name, searchTerm)}
                          </span>
                          <span className="text-xs text-gray-400 flex-shrink-0">
                            {subject.code}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
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