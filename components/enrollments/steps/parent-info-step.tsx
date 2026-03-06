'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Search, UserCheck, UserPlus, ChevronRight, ChevronLeft, Loader2, BookOpen, X } from 'lucide-react';
import { toast } from 'sonner';
import { StepProps } from '../enrollment-types';
import { searchParentsUnified, ParentSearchResult, getStudentsByParent } from '@/lib/services/parents';
import { searchTrialBookings, TrialBookingSearchResult } from '@/lib/services/trial-bookings';
import { Parent, Student, TrialBooking } from '@/types/models';

type SearchResult =
  | { type: 'parent'; data: ParentSearchResult }
  | { type: 'trial'; data: TrialBookingSearchResult };

export default function ParentInfoStep({ formData, setFormData, onNext, onBack }: StepProps) {
  const [searchTerm, setSearchTerm] = useState(formData.parentPhone || formData.parentName || '');
  const [searching, setSearching] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedParent, setSelectedParent] = useState<Parent | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<Student[]>([]);
  const [selectedTrialBooking, setSelectedTrialBooking] = useState<TrialBooking | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // If form already has an existing parent selected, restore that state
  useEffect(() => {
    if (formData.parentMode === 'existing' && formData.existingParentId && !selectedParent) {
      // Already selected, keep the form as is
    }
  }, []);

  const doSearch = useCallback(async (term: string) => {
    if (term.trim().length < 2) {
      setResults([]);
      setSearchDone(false);
      return;
    }

    setSearching(true);
    setSearchDone(false);
    try {
      const combined: SearchResult[] = [];

      if (formData.source === 'trial') {
        // From trial: only search trial bookings
        const trialResults = await searchTrialBookings(term);
        for (const t of trialResults) {
          combined.push({ type: 'trial', data: t });
        }
      } else {
        // New/existing: search both
        const [parentResults, trialResults] = await Promise.all([
          searchParentsUnified(term),
          searchTrialBookings(term),
        ]);

        // Existing parents first
        for (const p of parentResults) {
          combined.push({ type: 'parent', data: p });
        }

        // Trial bookings (skip if parent already found with same phone)
        const parentPhones = new Set(parentResults.map(p => p.parent.phone));
        for (const t of trialResults) {
          if (!parentPhones.has(t.booking.parentPhone)) {
            combined.push({ type: 'trial', data: t });
          }
        }
      }

      setResults(combined);
      setSearchDone(true);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setSelectedParent(null);
    setSelectedTrialBooking(null);
    setManualMode(false);

    // Debounce search
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 400);
  };

  const handleSelectParent = async (result: ParentSearchResult) => {
    setSelectedParent(result.parent);
    setSelectedTrialBooking(null);
    setSelectedStudents(result.students);
    setManualMode(false);

    setFormData(prev => ({
      ...prev,
      parentMode: 'existing',
      existingParentId: result.parent.id,
      parentName: result.parent.displayName,
      parentPhone: result.parent.phone,
      parentEmail: result.parent.email || '',
    }));
  };

  const handleSelectTrialBooking = (result: TrialBookingSearchResult) => {
    setSelectedTrialBooking(result.booking);
    setSelectedParent(null);
    setSelectedStudents([]);
    setManualMode(false);

    setFormData(prev => ({
      ...prev,
      parentMode: 'new',
      existingParentId: undefined,
      parentName: result.booking.parentName,
      parentPhone: result.booking.parentPhone,
      parentEmail: result.booking.parentEmail || '',
    }));
  };

  const handleNewParent = () => {
    setSelectedParent(null);
    setSelectedTrialBooking(null);
    setSelectedStudents([]);
    setManualMode(true);

    // Keep whatever is in the search term as phone if it looks like a phone
    const cleanTerm = searchTerm.replace(/[-\s]/g, '');
    const isPhone = /^0[0-9]{7,9}$/.test(cleanTerm);

    setFormData(prev => ({
      ...prev,
      parentMode: 'new',
      existingParentId: undefined,
      parentPhone: isPhone ? cleanTerm : prev.parentPhone,
      parentName: !isPhone ? searchTerm : prev.parentName,
    }));
  };

  const handleClearSelection = () => {
    setSelectedParent(null);
    setSelectedTrialBooking(null);
    setSelectedStudents([]);
    setManualMode(false);
    setFormData(prev => ({
      ...prev,
      parentMode: 'new',
      existingParentId: undefined,
      parentName: '',
      parentEmail: '',
      emergencyPhone: '',
    }));
  };

  const validate = (): boolean => {
    if (formData.parentMode === 'existing' && formData.existingParentId) {
      return true;
    }

    if (!formData.parentName.trim()) {
      toast.error('กรุณากรอกชื่อผู้ปกครอง');
      return false;
    }

    const phone = formData.parentPhone.replace(/[-\s]/g, '');
    if (!/^0[0-9]{8,9}$/.test(phone)) {
      toast.error('เบอร์โทรไม่ถูกต้อง (ต้องขึ้นต้นด้วย 0 และมี 9-10 หลัก)');
      return false;
    }

    return true;
  };

  const handleNext = () => {
    if (validate()) {
      onNext();
    }
  };

  const matchLabel = (matchedVia: string) => {
    switch (matchedVia) {
      case 'parent_name': return 'ชื่อผู้ปกครอง';
      case 'parent_phone': return 'เบอร์โทร';
      case 'student_name': return 'ชื่อนักเรียน';
      default: return '';
    }
  };

  const hasSelection = selectedParent || selectedTrialBooking || manualMode;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">ข้อมูลผู้ปกครอง</h2>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ค้นหาผู้ปกครอง</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={searchTerm}
                onChange={e => handleSearchChange(e.target.value)}
                placeholder="ค้นหาด้วย ชื่อผู้ปกครอง, เบอร์โทร, หรือชื่อเด็ก"
                className="text-base pl-10"
              />
            </div>
            {searching && <Loader2 className="h-5 w-5 animate-spin text-gray-400 self-center" />}
          </div>
          <p className="text-sm text-gray-500 mt-1">พิมพ์อย่างน้อย 2 ตัวอักษรเพื่อค้นหา</p>

          {/* Search Results */}
          {searchDone && results.length > 0 && !hasSelection && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium text-gray-600">ผลการค้นหา ({results.length} รายการ)</p>
              {results.map((result, idx) => (
                result.type === 'parent' ? (
                  <button
                    key={`p-${result.data.parent.id}`}
                    type="button"
                    onClick={() => handleSelectParent(result.data)}
                    className="w-full text-left p-3 border rounded-lg hover:bg-green-50 hover:border-green-300 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-5 w-5 text-green-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-base font-medium">{result.data.parent.displayName}</span>
                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                            ผู้ปกครองเดิม
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            ค้นจาก: {matchLabel(result.data.matchedVia)}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-500">{result.data.parent.phone}</p>
                        {result.data.students.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {result.data.students.map(s => (
                              <Badge key={s.id} variant="secondary" className="text-xs">
                                {s.nickname} ({s.name})
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ) : (
                  <button
                    key={`t-${result.data.booking.id}`}
                    type="button"
                    onClick={() => handleSelectTrialBooking(result.data)}
                    className="w-full text-left p-3 border rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-blue-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-base font-medium">{result.data.booking.parentName}</span>
                          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                            จากทดลองเรียน
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            ค้นจาก: {matchLabel(result.data.matchedVia)}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-500">{result.data.booking.parentPhone}</p>
                        {result.data.booking.students.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {result.data.booking.students.map((s, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {s.name}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                )
              ))}

              {/* Button to create new parent */}
              <button
                type="button"
                onClick={handleNewParent}
                className="w-full text-left p-3 border border-dashed rounded-lg hover:bg-yellow-50 hover:border-yellow-300 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-yellow-600 flex-shrink-0" />
                  <span className="text-base text-yellow-700 font-medium">สร้างผู้ปกครองใหม่</span>
                </div>
              </button>
            </div>
          )}

          {/* No results */}
          {searchDone && results.length === 0 && !hasSelection && (
            <div className="mt-4 space-y-2">
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-base text-yellow-700">ไม่พบข้อมูลในระบบ</p>
              </div>
              <button
                type="button"
                onClick={handleNewParent}
                className="w-full text-left p-3 border border-dashed rounded-lg hover:bg-yellow-50 hover:border-yellow-300 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-yellow-600 flex-shrink-0" />
                  <span className="text-base text-yellow-700 font-medium">สร้างผู้ปกครองใหม่</span>
                </div>
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected existing parent */}
      {selectedParent && (
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 mb-3">
                <UserCheck className="h-5 w-5 text-green-600" />
                <span className="text-base font-medium text-green-700">เลือกผู้ปกครองเดิม</span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleClearSelection}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-base text-gray-700 space-y-1">
              <p>ชื่อ: <strong>{selectedParent.displayName}</strong></p>
              <p>เบอร์โทร: {selectedParent.phone}</p>
              {selectedParent.email && <p>อีเมล: {selectedParent.email}</p>}
              {selectedStudents.length > 0 && (
                <div className="mt-2">
                  <p className="font-medium">นักเรียนในระบบ:</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {selectedStudents.map(s => (
                      <Badge key={s.id} variant="secondary" className="text-base">
                        {s.nickname} ({s.name})
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Selected trial booking */}
      {selectedTrialBooking && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="h-5 w-5 text-blue-600" />
                <span className="text-base font-medium text-blue-700">จากข้อมูลทดลองเรียน (ผู้ปกครองใหม่)</span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleClearSelection}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
              <div>
                <Label className="text-base">ชื่อ-นามสกุล *</Label>
                <Input
                  value={formData.parentName}
                  onChange={e => setFormData(prev => ({ ...prev, parentName: e.target.value }))}
                  placeholder="ชื่อผู้ปกครอง"
                  className="text-base"
                />
              </div>
              <div>
                <Label className="text-base">เบอร์โทร *</Label>
                <Input
                  value={formData.parentPhone}
                  onChange={e => setFormData(prev => ({ ...prev, parentPhone: e.target.value }))}
                  placeholder="0812345678"
                  className="text-base"
                />
              </div>
              <div>
                <Label className="text-base">อีเมล</Label>
                <Input
                  value={formData.parentEmail}
                  onChange={e => setFormData(prev => ({ ...prev, parentEmail: e.target.value }))}
                  placeholder="email@example.com"
                  className="text-base"
                  type="email"
                />
              </div>
              <div>
                <Label className="text-base">เบอร์โทรฉุกเฉิน</Label>
                <Input
                  value={formData.emergencyPhone}
                  onChange={e => setFormData(prev => ({ ...prev, emergencyPhone: e.target.value }))}
                  placeholder="0812345678"
                  className="text-base"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manual new parent form */}
      {manualMode && (
        <Card className="border-yellow-200 bg-yellow-50/50">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 mb-3">
                <UserPlus className="h-5 w-5 text-yellow-600" />
                <span className="text-base font-medium text-yellow-700">สร้างผู้ปกครองใหม่</span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleClearSelection}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
              <div>
                <Label className="text-base">ชื่อ-นามสกุล *</Label>
                <Input
                  value={formData.parentName}
                  onChange={e => setFormData(prev => ({ ...prev, parentName: e.target.value }))}
                  placeholder="ชื่อผู้ปกครอง"
                  className="text-base"
                />
              </div>
              <div>
                <Label className="text-base">เบอร์โทร *</Label>
                <Input
                  value={formData.parentPhone}
                  onChange={e => setFormData(prev => ({ ...prev, parentPhone: e.target.value }))}
                  placeholder="0812345678"
                  className="text-base"
                />
              </div>
              <div>
                <Label className="text-base">อีเมล</Label>
                <Input
                  value={formData.parentEmail}
                  onChange={e => setFormData(prev => ({ ...prev, parentEmail: e.target.value }))}
                  placeholder="email@example.com"
                  className="text-base"
                  type="email"
                />
              </div>
              <div>
                <Label className="text-base">เบอร์โทรฉุกเฉิน</Label>
                <Input
                  value={formData.emergencyPhone}
                  onChange={e => setFormData(prev => ({ ...prev, emergencyPhone: e.target.value }))}
                  placeholder="0812345678"
                  className="text-base"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} className="text-base">
          <ChevronLeft className="h-4 w-4 mr-2" />
          ย้อนกลับ
        </Button>
        <Button onClick={handleNext} className="bg-red-500 hover:bg-red-600 text-base" disabled={!hasSelection}>
          ถัดไป
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
