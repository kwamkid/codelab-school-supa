'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { 
  Bell, 
  Send, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  User,
  Users,
  BookOpen,
  AlertCircle,
  Search,
  ChevronRight
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface TestResult {
  success: boolean;
  message: string;
  timestamp: string;
}

interface Parent {
  id: string;
  displayName: string;
  phone: string;
  lineUserId: string;
}

interface Student {
  id: string;
  name: string;
  nickname: string;
  profileImage?: string;
}

interface ClassItem {
  enrollmentId: string;
  classId: string;
  className: string;
  classCode: string;
  subjectName: string;
  branchName: string;
  status: string;
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
}

export default function TestNotificationsPage() {
  const [step, setStep] = useState(1);
  const [selectedParent, setSelectedParent] = useState<Parent | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  // ดึงข้อมูลผู้ปกครอง
  const { data: parentsData, isLoading: loadingParents } = useQuery({
    queryKey: ['test-parents'],
    queryFn: async () => {
      const res = await fetch('/api/notifications/test?type=parents-with-line');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    }
  });

  // ดึงข้อมูลนักเรียน
  const { data: studentsData, isLoading: loadingStudents } = useQuery({
    queryKey: ['test-students', selectedParent?.id],
    queryFn: async () => {
      if (!selectedParent) return { data: [] };
      const res = await fetch(`/api/notifications/test?type=students-by-parent&parentId=${selectedParent.id}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    enabled: !!selectedParent
  });

  // ดึงข้อมูลคลาส
  const { data: classesData, isLoading: loadingClasses } = useQuery({
    queryKey: ['test-classes', selectedStudent?.id],
    queryFn: async () => {
      if (!selectedStudent) return { data: [] };
      const res = await fetch(`/api/notifications/test?type=classes-by-student&studentId=${selectedStudent.id}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    enabled: !!selectedStudent
  });

  // Filter parents by search term
  const filteredParents = parentsData?.data?.filter((parent: Parent) => {
    const term = searchTerm.toLowerCase();
    return parent.displayName.toLowerCase().includes(term) || 
           parent.phone.includes(term);
  }) || [];

  // Reset selections when going back
  useEffect(() => {
    if (step < 2) {
      setSelectedStudent(null);
      setSelectedClass(null);
    }
    if (step < 3) {
      setSelectedClass(null);
    }
  }, [step]);

  const handleSelectParent = (parent: Parent) => {
    setSelectedParent(parent);
    setStep(2);
  };

  const handleSelectStudent = (student: Student) => {
    setSelectedStudent(student);
    setStep(3);
  };

  const handleSelectClass = (classItem: ClassItem) => {
    setSelectedClass(classItem);
    setStep(4);
  };

  const handleTestSend = async () => {
    if (!selectedParent || !selectedStudent || !selectedClass) {
      alert('กรุณาเลือกข้อมูลให้ครบถ้วน');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'class-reminder',
          studentId: selectedStudent.id,
          classId: selectedClass.classId
        })
      });

      const result = await response.json();

      setResult({
        success: result.success,
        message: result.message || (result.success ? 'สำเร็จ' : 'ล้มเหลว'),
        timestamp: new Date().toLocaleString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      });

    } catch (error) {
      console.error('Test error:', error);
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด',
        timestamp: new Date().toLocaleString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      });
    } finally {
      setLoading(false);
    }
  };

  const getDayNames = (days: number[]) => {
    const dayNames = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
    return days.map(d => dayNames[d]).join(', ');
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-3xl font-bold flex items-center gap-2">
          <Bell className="w-8 h-8" />
          ทดสอบการแจ้งเตือน LINE
        </h1>
        <p className="text-muted-foreground mt-2">
          ทดสอบการส่งข้อความแจ้งเตือนคลาสเรียนผ่าน LINE Messaging API
        </p>
      </div>

      {/* Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>หมายเหตุ:</strong> การทดสอบจะส่งข้อความจริงไปยังผู้ปกครองที่เชื่อมต่อ LINE แล้ว
          กรุณาตรวจสอบว่าเปิดการแจ้งเตือนในการตั้งค่า LINE แล้ว
        </AlertDescription>
      </Alert>

      {/* Result */}
      {result && (
        <Alert variant={result.success ? 'default' : 'destructive'}>
          {result.success ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          <AlertDescription>
            <div className="space-y-1">
              <p className="font-semibold">{result.message}</p>
              <p className="text-xs text-muted-foreground">{result.timestamp}</p>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Progress Steps */}
      <div className="flex items-center justify-between max-w-2xl mx-auto">
        {[
          { num: 1, label: 'เลือกผู้ปกครอง', icon: User },
          { num: 2, label: 'เลือกนักเรียน', icon: Users },
          { num: 3, label: 'เลือกคลาส', icon: BookOpen },
          { num: 4, label: 'ส่งการแจ้งเตือน', icon: Send }
        ].map((item, index) => (
          <div key={item.num} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                step >= item.num 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted text-muted-foreground'
              }`}>
                <item.icon className="w-5 h-5" />
              </div>
              <span className="text-xs mt-1 text-center">{item.label}</span>
            </div>
            {index < 3 && (
              <ChevronRight className={`w-4 h-4 mx-2 ${
                step > item.num ? 'text-primary' : 'text-muted-foreground'
              }`} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Select Parent */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              ขั้นตอนที่ 1: เลือกผู้ปกครอง
            </CardTitle>
            <CardDescription>
              เลือกผู้ปกครองที่เชื่อมต่อ LINE แล้ว
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search Box */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="ค้นหาชื่อหรือเบอร์โทร..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Parents List */}
            {loadingParents ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredParents.length === 0 ? (
                  <div className="text-center text-muted-foreground p-8">
                    {searchTerm ? 'ไม่พบผู้ปกครองที่ค้นหา' : 'ไม่พบผู้ปกครองที่เชื่อมต่อ LINE'}
                  </div>
                ) : (
                  filteredParents.map((parent: Parent) => (
                    <button
                      key={parent.id}
                      onClick={() => handleSelectParent(parent)}
                      className="w-full p-4 border rounded-lg hover:bg-accent text-left transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="font-medium">{parent.displayName}</p>
                          <p className="text-sm text-muted-foreground">{parent.phone}</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Select Student */}
      {step === 2 && selectedParent && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              ขั้นตอนที่ 2: เลือกนักเรียน
            </CardTitle>
            <CardDescription>
              เลือกนักเรียนของคุณ {selectedParent.displayName}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStep(1)}
            >
              ← เปลี่ยนผู้ปกครอง
            </Button>

            {loadingStudents ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : (
              <div className="space-y-2">
                {studentsData?.data?.length === 0 ? (
                  <div className="text-center text-muted-foreground p-8">
                    ไม่พบนักเรียนในบัญชีนี้
                  </div>
                ) : (
                  studentsData?.data?.map((student: Student) => (
                    <button
                      key={student.id}
                      onClick={() => handleSelectStudent(student)}
                      className="w-full p-4 border rounded-lg hover:bg-accent text-left transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {student.profileImage ? (
                            <img
                              src={student.profileImage}
                              alt={student.name}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="w-5 h-5 text-primary" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium">{student.nickname || student.name}</p>
                            {student.nickname && (
                              <p className="text-sm text-muted-foreground">{student.name}</p>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Select Class */}
      {step === 3 && selectedStudent && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              ขั้นตอนที่ 3: เลือกคลาสเรียน
            </CardTitle>
            <CardDescription>
              เลือกคลาสที่ต้องการทดสอบส่งการแจ้งเตือน
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStep(2)}
            >
              ← เปลี่ยนนักเรียน
            </Button>

            {loadingClasses ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : (
              <div className="space-y-2">
                {classesData?.data?.length === 0 ? (
                  <div className="text-center text-muted-foreground p-8">
                    ไม่พบคลาสเรียนที่กำลังเรียนอยู่
                  </div>
                ) : (
                  classesData?.data?.map((classItem: ClassItem) => (
                    <button
                      key={classItem.classId}
                      onClick={() => handleSelectClass(classItem)}
                      className="w-full p-4 border rounded-lg hover:bg-accent text-left transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{classItem.className}</p>
                            <Badge variant="secondary">{classItem.status}</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>📚 {classItem.subjectName}</p>
                            <p>📍 {classItem.branchName}</p>
                            <p>🕐 {getDayNames(classItem.daysOfWeek)} • {classItem.startTime?.substring(0, 5)}-{classItem.endTime?.substring(0, 5)}</p>
                            <p className="text-xs">รหัส: {classItem.classCode}</p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 4: Confirm and Send */}
      {step === 4 && selectedParent && selectedStudent && selectedClass && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              ขั้นตอนที่ 4: ยืนยันและส่งการแจ้งเตือน
            </CardTitle>
            <CardDescription>
              ตรวจสอบข้อมูลและกดปุ่มเพื่อทดสอบส่ง
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStep(3)}
            >
              ← เปลี่ยนคลาส
            </Button>

            {/* Summary */}
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">ผู้ปกครอง</p>
                  <p className="font-medium">{selectedParent.displayName}</p>
                  <p className="text-sm text-muted-foreground">{selectedParent.phone}</p>
                </div>

                <div className="border-t pt-3">
                  <p className="text-sm text-muted-foreground">นักเรียน</p>
                  <p className="font-medium">{selectedStudent.nickname || selectedStudent.name}</p>
                </div>

                <div className="border-t pt-3">
                  <p className="text-sm text-muted-foreground">คลาสเรียน</p>
                  <p className="font-medium">{selectedClass.className}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedClass.subjectName} • {selectedClass.branchName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {getDayNames(selectedClass.daysOfWeek)} • {selectedClass.startTime?.substring(0, 5)}-{selectedClass.endTime?.substring(0, 5)}
                  </p>
                </div>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  ระบบจะส่งข้อความแจ้งเตือนคลาสเรียน (พรุ่งนี้) ไปยัง LINE ของผู้ปกครอง
                </AlertDescription>
              </Alert>
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={handleTestSend}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  กำลังส่ง...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  ทดสอบส่งการแจ้งเตือน
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>วิธีการทดสอบ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 text-sm">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs">
                1
              </div>
              <div>
                <p className="font-medium">เลือกผู้ปกครอง</p>
                <p className="text-muted-foreground">
                  ค้นหาและเลือกผู้ปกครองที่เชื่อมต่อ LINE แล้ว
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs">
                2
              </div>
              <div>
                <p className="font-medium">เลือกนักเรียน</p>
                <p className="text-muted-foreground">
                  เลือกนักเรียนที่อยู่ภายใต้ผู้ปกครองที่เลือก
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs">
                3
              </div>
              <div>
                <p className="font-medium">เลือกคลาสเรียน</p>
                <p className="text-muted-foreground">
                  เลือกคลาสที่นักเรียนกำลังเรียนอยู่
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs">
                4
              </div>
              <div>
                <p className="font-medium">ส่งการแจ้งเตือน</p>
                <p className="text-muted-foreground">
                  ตรวจสอบข้อมูลและกดปุ่มทดสอบส่ง ระบบจะส่งข้อความไปที่ LINE ทันที
                </p>
              </div>
            </div>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>สำคัญ:</strong> ตรวจสอบว่าผู้ปกครองได้เพิ่มเพื่อน LINE Bot แล้ว 
              และเปิด "Enable Notifications" ใน Settings → LINE Integration
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}