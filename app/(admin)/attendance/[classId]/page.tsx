'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageLoading } from '@/components/ui/loading';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from '@/hooks/useAuth';
import { getClass, getClassSchedules } from '@/lib/services/classes';
import { getSubject } from '@/lib/services/subjects';
import { getEnrollmentsByClass } from '@/lib/services/enrollments';
import { Class, ClassSchedule, Subject } from '@/types/models';
import { formatDate, formatDateWithDay } from '@/lib/utils';
import { toast } from 'sonner';
import QRCode from 'qrcode';
import { 
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info,
  ChevronRight,
  Lock,
  QrCode as QrCodeIcon,
  Download,
  Printer,
  Copy,
  CheckCheck
} from 'lucide-react';

interface SessionWithStatus extends ClassSchedule {
  isPast: boolean;
  isToday: boolean;
  isFuture: boolean;
  canCheckAttendance: boolean;
}

export default function AttendanceSessionSelectPage() {
  const router = useRouter();
  const params = useParams();
  const classId = params.classId as string;
  const { user, isTeacher } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [classData, setClassData] = useState<Class | null>(null);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [sessions, setSessions] = useState<SessionWithStatus[]>([]);
  const [totalEnrolled, setTotalEnrolled] = useState<number>(0);
  
  // QR Code states
  const [showQR, setShowQR] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (classId) {
      loadClassAndSessions();
    }
  }, [classId]);

  useEffect(() => {
    if (showQR && classId) {
      generateQRCode();
    }
  }, [showQR, classId]);

  const loadClassAndSessions = async () => {
    try {
      setLoading(true);

      // Load class data
      const cls = await getClass(classId);
      if (!cls) {
        router.push('/attendance');
        return;
      }
      setClassData(cls);

      // Check permission for teachers
      if (isTeacher() && cls.teacherId !== user?.uid) {
        // Teacher can only check attendance for their own classes
        // Unless they are assigned as substitute teacher
        router.push('/attendance');
        return;
      }

      // Load subject
      const subj = await getSubject(cls.subjectId);
      setSubject(subj);

      // Load enrollments to get actual student count
      const enrollments = await getEnrollmentsByClass(classId);
      setTotalEnrolled(enrollments.length);

      // Load all schedules
      const schedules = await getClassSchedules(classId);
      
      // Process schedules with status
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const processedSessions = schedules.map(schedule => {
        const sessionDate = new Date(schedule.sessionDate);
        sessionDate.setHours(0, 0, 0, 0);
        
        const isPast = sessionDate < today;
        const isToday = sessionDate.getTime() === today.getTime();
        const isFuture = sessionDate > today;
        
        // Can check attendance only for past sessions and today
        const canCheckAttendance = isPast || isToday;
        
        return {
          ...schedule,
          isPast,
          isToday,
          isFuture,
          canCheckAttendance
        } as SessionWithStatus;
      });
      
      setSessions(processedSessions);
    } catch (error) {
      console.error('Error loading class sessions:', error);
      router.push('/attendance');
    } finally {
      setLoading(false);
    }
  };

  const generateQRCode = async () => {
    try {
      const attendanceUrl = `${window.location.origin}/attendance/${classId}`;
      const qrDataUrl = await QRCode.toDataURL(attendanceUrl, {
        width: 400,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      setQrCodeUrl(qrDataUrl);
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast.error('เกิดข้อผิดพลาดในการสร้าง QR Code');
    }
  };

  const getSessionStatus = (session: SessionWithStatus) => {
    if (session.status === 'cancelled') {
      return { label: 'ยกเลิก', icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-50' };
    }

    // Only show "checked" if there are actual attendance records
    if (session.attendance && session.attendance.length > 0) {
      // Count unique students only (remove duplicates)
      const uniqueStudents = new Set(session.attendance?.map(a => a.studentId) || []);
      const uniqueAttendance = Array.from(uniqueStudents).map(studentId =>
        session.attendance?.find(a => a.studentId === studentId)
      ).filter(a => a !== undefined);

      // Count students by status
      const presentCount = uniqueAttendance.filter(a => a!.status === 'present').length;
      const lateCount = uniqueAttendance.filter(a => a!.status === 'late').length;
      const absentCount = uniqueAttendance.filter(a =>
        a!.status === 'absent' || a!.status === 'sick' || a!.status === 'leave'
      ).length;
      const totalStudents = totalEnrolled;

      // Build label - only show non-zero counts
      const attended = presentCount + lateCount;
      let label = '';
      if (attended > 0) label += `มา ${attended}`;
      if (absentCount > 0) {
        if (label) label += ' ';
        label += `ขาด ${absentCount}`;
      }
      label += ` / ${totalStudents}`;

      return {
        label,
        icon: CheckCircle,
        color: 'text-green-600',
        bgColor: 'bg-green-50'
      };
    }

    if (session.isFuture) {
      return { label: 'ยังไม่ถึงเวลา', icon: Lock, color: 'text-gray-400', bgColor: 'bg-gray-50' };
    }

    if (session.isToday) {
      return { label: 'วันนี้ - รอเช็คชื่อ', icon: AlertCircle, color: 'text-orange-600', bgColor: 'bg-orange-50' };
    }

    return { label: 'ยังไม่เช็คชื่อ', icon: AlertCircle, color: 'text-yellow-600', bgColor: 'bg-yellow-50' };
  };

  const handleSessionClick = (sessionId: string, canCheck: boolean) => {
    if (!canCheck) return;
    router.push(`/attendance/${classId}/${sessionId}`);
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.download = `attendance-qr-${classData?.code}.png`;
    link.href = qrCodeUrl;
    link.click();
    toast.success('ดาวน์โหลด QR Code แล้ว');
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow && classData && subject) {
      printWindow.document.write(`
        <html>
          <head>
            <title>QR Code - ${classData.name}</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                margin: 0;
                padding: 20px;
              }
              .container {
                text-align: center;
                max-width: 600px;
              }
              h1 {
                margin-bottom: 10px;
                font-size: 32px;
              }
              h2 {
                margin-top: 0;
                color: #666;
                font-size: 24px;
                font-weight: normal;
              }
              .info {
                margin: 20px 0;
                font-size: 18px;
                color: #333;
              }
              .qr-code {
                margin: 30px 0;
              }
              .url {
                margin-top: 20px;
                padding: 15px;
                background: #f5f5f5;
                border-radius: 8px;
                font-family: monospace;
                font-size: 16px;
                word-break: break-all;
              }
              @media print {
                body {
                  min-height: auto;
                }
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>QR Code สำหรับเช็คชื่อ</h1>
              <h2>${classData.name}</h2>
              <div class="info">
                <p><strong>รหัสคลาส:</strong> ${classData.code}</p>
                <p><strong>วิชา:</strong> ${subject.name}</p>
              </div>
              <div class="qr-code">
                <img src="${qrCodeUrl}" width="400" height="400" />
              </div>
              <div class="url">
                ${window.location.origin}/attendance/${classId}
              </div>
            </div>
            <script>
              window.onload = function() {
                window.print();
                window.onafterprint = function() {
                  window.close();
                }
              }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/attendance/${classId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('คัดลอกลิงก์แล้ว');
      setTimeout(() => setCopied(false), 3000);
    } catch (error) {
      toast.error('ไม่สามารถคัดลอกลิงก์ได้');
    }
  };

  if (loading) return <PageLoading />;
  if (!classData) return null;

  return (
    <div className="space-y-6">
      <div>
        <Button
          variant="ghost"
          onClick={() => router.push('/attendance')}
          className="mb-4"
        >
          ← กลับ
        </Button>
        
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold tracking-tight">{classData.name}</h1>
            <p className="text-muted-foreground">
              {subject?.name} • รหัสคลาส: {classData.code}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowQR(true)}
            className="gap-2"
          >
            <QrCodeIcon className="h-4 w-4" />
            QR Code
          </Button>
        </div>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          สามารถเช็คชื่อได้เฉพาะคาบเรียนที่ผ่านมาแล้ว หรือคาบเรียนของวันนี้เท่านั้น
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>เลือกคาบเรียน</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {sessions.map((session) => {
              const status = getSessionStatus(session);
              const StatusIcon = status.icon;
              
              return (
                <div
                  key={session.id}
                  onClick={() => handleSessionClick(session.id, session.canCheckAttendance)}
                  className={`p-4 flex items-center justify-between transition-colors ${
                    session.canCheckAttendance 
                      ? 'hover:bg-gray-50 cursor-pointer' 
                      : 'opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${status.bgColor}`}>
                        <StatusIcon className={`h-5 w-5 ${status.color}`} />
                      </div>
                      <div>
                        <div className="font-medium">
                          ครั้งที่ {session.sessionNumber}
                          {session.isToday && (
                            <Badge variant="default" className="ml-2">วันนี้</Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatDateWithDay(session.sessionDate)}
                        </div>
                        {session.topic && (
                          <div className="text-sm text-muted-foreground mt-1">
                            หัวข้อ: {session.topic}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={session.attendance && session.attendance.length > 0 ? 'default' : 'secondary'}
                      className="min-w-[120px] justify-center"
                    >
                      {status.label}
                    </Badge>
                    {session.canCheckAttendance && (
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* QR Code Dialog */}
      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>QR Code สำหรับเช็คชื่อ</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {qrCodeUrl && (
              <>
                <div className="flex justify-center">
                  <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
                    <img 
                      src={qrCodeUrl} 
                      alt="QR Code" 
                      className="w-64 h-64"
                    />
                  </div>
                </div>
                
                <div className="text-center text-sm text-muted-foreground">
                  <p>{classData.name}</p>
                  <p>รหัสคลาส: {classData.code}</p>
                </div>
                
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">URL สำหรับเช็คชื่อ:</p>
                  <code className="text-xs bg-white px-2 py-1 rounded border block overflow-x-auto">
                    {window.location.origin}/attendance/{classId}
                  </code>
                </div>
                
                <div className="flex flex-wrap gap-2 justify-center">
                  <Button onClick={handleDownload} variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    ดาวน์โหลด
                  </Button>
                  <Button onClick={handlePrint} variant="outline" size="sm">
                    <Printer className="h-4 w-4 mr-2" />
                    พิมพ์
                  </Button>
                  <Button 
                    onClick={handleCopyLink} 
                    variant="outline" 
                    size="sm"
                    className={copied ? 'text-green-600' : ''}
                  >
                    {copied ? (
                      <>
                        <CheckCheck className="h-4 w-4 mr-2" />
                        คัดลอกแล้ว
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        คัดลอกลิงก์
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}