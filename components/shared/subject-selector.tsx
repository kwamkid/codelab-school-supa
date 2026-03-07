'use client';

import { useState, useMemo } from 'react';
import { Search, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Subject } from '@/types/models';

interface SubjectSelectorProps {
  subjects: Subject[];
  selectedSubjects: string[];
  onToggle: (subjectId: string) => void;
  compact?: boolean;
}

export function SubjectSelector({
  subjects,
  selectedSubjects,
  onToggle,
  compact = false,
}: SubjectSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredSubjects = useMemo(() => {
    let filtered = [...subjects];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.name.toLowerCase().includes(term) ||
          s.category.toLowerCase().includes(term) ||
          s.level.toLowerCase().includes(term)
      );
    }
    filtered.sort((a, b) => a.name.localeCompare(b.name, 'th'));
    return filtered;
  }, [subjects, searchTerm]);

  return (
    <div className="space-y-3">
      {subjects.length > 6 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="ค้นหาวิชา..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      )}

      <div className={compact ? 'grid grid-cols-1 gap-2' : 'grid grid-cols-1 md:grid-cols-2 gap-3'}>
        {filteredSubjects.length === 0 ? (
          <div className="col-span-2 text-center py-6 text-gray-500">
            <Search className="h-6 w-6 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">ไม่พบวิชาที่ค้นหา</p>
          </div>
        ) : (
          filteredSubjects.map((subject) => {
            const isSelected = selectedSubjects.includes(subject.id);
            return (
              <div
                key={subject.id}
                onClick={() => onToggle(subject.id)}
                className={`
                  p-3 rounded-lg border cursor-pointer transition-all
                  ${isSelected
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20 dark:border-green-600'
                    : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                  }
                `}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-sm dark:text-white">{subject.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {subject.category} • {subject.level}
                    </div>
                    {subject.ageRange && (
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        อายุ {subject.ageRange.min}-{subject.ageRange.max} ปี
                      </div>
                    )}
                  </div>
                  {isSelected && (
                    <div className="ml-2 shrink-0">
                      <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    </div>
                  )}
                </div>
                {isSelected && (
                  <Badge className="mt-2 bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border-green-300 dark:border-green-700">
                    เลือกแล้ว
                  </Badge>
                )}
              </div>
            );
          })
        )}
      </div>

      {selectedSubjects.length > 0 && (
        <div className="text-sm text-gray-600 dark:text-gray-400 text-center pt-2 border-t dark:border-slate-700">
          เลือกแล้ว {selectedSubjects.length} วิชา
        </div>
      )}
    </div>
  );
}
