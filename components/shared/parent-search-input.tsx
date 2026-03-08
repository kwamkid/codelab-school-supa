'use client';

import { useState, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Search, User, Loader2, Phone, GraduationCap, School } from 'lucide-react';
import { Student } from '@/types/models';
import { searchParentsUnified, ParentSearchResult } from '@/lib/services/parents';

export interface ParentSearchSelection {
  parentId: string;
  parentName: string;
  parentPhone: string;
  students: Student[];
}

interface ParentSearchInputProps {
  onSelect: (selection: ParentSearchSelection) => void;
  placeholder?: string;
  className?: string;
  debounceMs?: number;
}

export interface ParentSearchInputRef {
  focus: () => void;
}

export const ParentSearchInput = forwardRef<ParentSearchInputRef, ParentSearchInputProps>(function ParentSearchInput({
  onSelect,
  placeholder = 'ค้นหาด้วยชื่อหรือเบอร์โทร...',
  className,
  debounceMs = 600,
}, ref) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<ParentSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
  }));

  const handleChange = useCallback((value: string) => {
    setSearchTerm(value);

    if (timerRef.current) clearTimeout(timerRef.current);

    if (!value || value.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    timerRef.current = setTimeout(async () => {
      try {
        const data = await searchParentsUnified(value);
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, debounceMs);
  }, [debounceMs]);

  const handleSelect = (r: ParentSearchResult) => {
    onSelect({
      parentId: r.parent.id,
      parentName: r.parent.displayName || r.parent.phone,
      parentPhone: r.parent.phone,
      students: r.students,
    });
    setSearchTerm('');
    setResults([]);
  };

  return (
    <div className={cn('space-y-2', className)}>
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          ref={inputRef}
          value={searchTerm}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
          className="pl-10"
        />
      </div>

      {/* Searching indicator */}
      {searching && (
        <div className="text-sm text-gray-500 text-center py-2">
          <Loader2 className="h-4 w-4 animate-spin inline mr-1" />
          กำลังค้นหา...
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="border rounded-lg dark:border-slate-700 max-h-64 overflow-y-auto divide-y dark:divide-slate-700">
          {results.map((r) => (
            <button
              key={r.parent.id}
              type="button"
              onClick={() => handleSelect(r)}
              className="w-full px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
            >
              {/* Parent row */}
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-400 shrink-0" />
                <span className="text-sm font-medium dark:text-white">
                  {r.parent.displayName || 'ไม่ระบุชื่อ'}
                </span>
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Phone className="h-3 w-3" />
                  {r.parent.phone}
                </span>
                {r.matchedVia === 'student_name' && (
                  <Badge variant="outline" className="text-xs ml-auto">ค้นจากชื่อนักเรียน</Badge>
                )}
              </div>

              {/* Students rows */}
              {r.students.length > 0 && (
                <div className="mt-1.5 ml-6 space-y-1">
                  {r.students.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                      <span className="font-medium text-gray-700 dark:text-gray-300 min-w-[80px]">
                        {s.nickname || s.name}
                      </span>
                      {s.schoolName && (
                        <span className="flex items-center gap-1">
                          <School className="h-3 w-3 shrink-0" />
                          {s.schoolName}
                        </span>
                      )}
                      {s.gradeLevel && (
                        <span className="flex items-center gap-1">
                          <GraduationCap className="h-3 w-3 shrink-0" />
                          {s.gradeLevel}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
