'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Parent, Student, Branch } from '@/types/models';
import { getParentWithStudents, updateParent } from '@/lib/services/parents';
import { getBranch } from '@/lib/services/branches';
import { generateLinkToken } from '@/lib/services/link-tokens';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  ChevronLeft, 
  Edit, 
  Phone, 
  Mail, 
  MapPin,
  Users,
  Plus,
  User,
  Cake,
  School,
  Home,
  CheckCircle,
  AlertCircle,
  Link as LinkIcon,
  Unlink,
  Loader2,
  QrCode
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { SectionLoading } from '@/components/ui/loading';
import { formatDate, calculateAge } from '@/lib/utils';
import { QRCodeSVG } from 'qrcode.react';

export default function ParentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const parentId = params.id as string;
  
  const [parent, setParent] = useState<Parent | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [preferredBranch, setPreferredBranch] = useState<Branch | null>(null);
  const [loading, setLoading] = useState(true);
  
  // QR Dialog states
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [generatingQR, setGeneratingQR] = useState(false);
  const [qrLink, setQrLink] = useState('');
  
  // Unlink dialog states
  const [showUnlinkDialog, setShowUnlinkDialog] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  useEffect(() => {
    if (parentId) {
      loadParentDetails();
    }
  }, [parentId]);

  const loadParentDetails = async () => {
    try {
      const { parent: parentData, students: studentsData } = await getParentWithStudents(parentId);
      
      if (!parentData) {
        toast.error('ไม่พบข้อมูลผู้ปกครอง');
        router.push('/parents');
        return;
      }
      
      setParent(parentData);
      setStudents(studentsData);
      
      // Load preferred branch if exists
      if (parentData.preferredBranchId) {
        const branch = await getBranch(parentData.preferredBranchId);
        setPreferredBranch(branch);
      }
    } catch (error) {
      console.error('Error loading parent details:', error);
      toast.error('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateQR = async () => {
    if (!parent) return;
    
    setGeneratingQR(true);
    try {
      const token = await generateLinkToken(parent.id);
      
      // Get LIFF ID from environment or settings
      const liffId = process.env.NEXT_PUBLIC_LIFF_ID || '2007575627-GmKBZJdo';
      
      // Create LIFF URL with token
      const link = `https://liff.line.me/${liffId}/link-account?token=${token}`;
      
      console.log('Generated QR link:', link);
      
      setQrLink(link);
      setShowQRDialog(true);
    } catch (error: any) {
      console.error('Error generating QR:', error);
      if (error.message === 'Parent already linked to LINE') {
        toast.error('ผู้ปกครองเชื่อมต่อ LINE แล้ว');
      } else {
        toast.error('ไม่สามารถสร้าง QR Code ได้');
      }
    } finally {
      setGeneratingQR(false);
    }
  };

  const handleUnlink = async () => {
    if (!parent) return;
    
    setUnlinking(true);
    try {
      // Clear LINE data by passing null (will use deleteField in service)
      await updateParent(parent.id, {
        lineUserId: null,
        pictureUrl: null
      });
      
      toast.success('ยกเลิกการเชื่อมต่อ LINE เรียบร้อยแล้ว');
      setShowUnlinkDialog(false);
      
      // Reload data
      await loadParentDetails();
    } catch (error) {
      console.error('Error unlinking:', error);
      toast.error('ไม่สามารถยกเลิกการเชื่อมต่อได้');
    } finally {
      setUnlinking(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('คัดลอกลิงก์แล้ว');
    } catch (err) {
      toast.error('ไม่สามารถคัดลอกได้');
    }
  };

  if (loading) {
    return <SectionLoading text="กำลังโหลดข้อมูล..." />;
  }

  if (!parent) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">ไม่พบข้อมูลผู้ปกครอง</p>
        <Link href="/parents" className="text-red-500 hover:text-red-600 mt-4 inline-block">
          กลับไปหน้ารายการผู้ปกครอง
        </Link>
      </div>
    );
  }

  const activeStudents = students.filter(s => s.isActive);

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <Link 
          href="/parents" 
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          กลับไปหน้ารายการผู้ปกครอง
        </Link>
        
        <Link href={`/parents/${parentId}/edit`}>
          <Button variant="outline">
            <Edit className="h-4 w-4 mr-2" />
            แก้ไขข้อมูล
          </Button>
        </Link>
      </div>

      {/* Parent Header */}
      <div className="mb-8">
        <div className="flex items-start gap-4">
          {parent.pictureUrl ? (
            <img
              src={parent.pictureUrl}
              alt={parent.displayName}
              className="w-20 h-20 rounded-full object-cover"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center">
              <Users className="h-10 w-10 text-gray-500" />
            </div>
          )}
          <div className="flex-1">
            <h1 className="text-xl sm:text-3xl font-bold text-gray-900">{parent.displayName}</h1>
            <div className="flex items-center gap-4 mt-2">
              {parent.lineUserId && (
                <Badge className="bg-green-100 text-green-700">
                  <img src="/line-icon.svg" alt="LINE" className="w-4 h-4 mr-1" />
                  เชื่อมต่อ LINE แล้ว
                </Badge>
              )}
              <span className="text-sm text-gray-500">
                ลงทะเบียนเมื่อ {formatDate(parent.createdAt, 'long')}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Column 1: Students (สำคัญที่สุด) */}
        <div>
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>ข้อมูลนักเรียน ({activeStudents.length})</CardTitle>
                <Link href={`/parents/${parentId}/students/new`}>
                  <Button size="sm" className="bg-red-500 hover:bg-red-600">
                    <Plus className="h-4 w-4 mr-2" />
                    เพิ่มนักเรียน
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {students.length === 0 ? (
                <div className="text-center py-8">
                  <User className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600 mb-4">ยังไม่มีข้อมูลนักเรียน</p>
                  <Link href={`/parents/${parentId}/students/new`}>
                    <Button className="bg-red-500 hover:bg-red-600">
                      <Plus className="h-4 w-4 mr-2" />
                      เพิ่มนักเรียนคนแรก
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {students.map((student) => (
                    <div 
                      key={student.id} 
                      className={`border rounded-lg p-4 ${!student.isActive ? 'opacity-60 bg-gray-50' : ''}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          {student.profileImage ? (
                            <img
                              src={student.profileImage}
                              alt={student.name}
                              className="w-16 h-16 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center">
                              <User className="h-8 w-8 text-gray-500" />
                            </div>
                          )}
                          <div className="space-y-2">
                            <div>
                              <h4 className="font-semibold text-lg">
                                {student.nickname || student.name}
                              </h4>
                              <p className="text-sm text-gray-600">{student.name}</p>
                            </div>
                            
                            <div className="flex flex-wrap gap-4 text-sm">
                              <div className="flex items-center gap-1">
                                <Cake className="h-4 w-4 text-gray-400" />
                                <span>{formatDate(student.birthdate)} ({calculateAge(student.birthdate)} ปี)</span>
                              </div>
                              {student.schoolName && (
                                <div className="flex items-center gap-1">
                                  <School className="h-4 w-4 text-gray-400" />
                                  <span>{student.schoolName}</span>
                                  {student.gradeLevel && (
                                    <span className="text-gray-500">({student.gradeLevel})</span>
                                  )}
                                </div>
                              )}
                              <Badge variant={student.gender === 'M' ? 'secondary' : 'default'}>
                                {student.gender === 'M' ? 'ชาย' : 'หญิง'}
                              </Badge>
                              {!student.isActive && (
                                <Badge variant="destructive">ไม่ใช้งาน</Badge>
                              )}
                            </div>

                            {student.allergies && (
                              <div className="mt-2">
                                <span className="text-sm text-red-600">⚠️ แพ้: {student.allergies}</span>
                              </div>
                            )}

                            {student.specialNeeds && (
                              <div className="mt-1">
                                <span className="text-sm text-orange-600">📋 ความต้องการพิเศษ: {student.specialNeeds}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <Link href={`/parents/${parentId}/students/${student.id}/edit`}>
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                      
                      {/* Emergency Contact */}
                      {(student.emergencyContact || student.emergencyPhone) && (
                        <div className="mt-3 pt-3 border-t text-sm">
                          <p className="text-gray-500 mb-1">ติดต่อฉุกเฉิน</p>
                          <p>
                            {student.emergencyContact} 
                            {student.emergencyPhone && ` - ${student.emergencyPhone}`}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Column 2: Contact, Address, and LINE */}
        <div className="space-y-6">
          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>ข้อมูลติดต่อ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {parent.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">เบอร์โทรหลัก</p>
                    <p>{parent.phone}</p>
                  </div>
                </div>
              )}
              
              {parent.emergencyPhone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-red-400" />
                  <div>
                    <p className="text-sm text-gray-500">เบอร์โทรฉุกเฉิน</p>
                    <p>{parent.emergencyPhone}</p>
                  </div>
                </div>
              )}
              
              {parent.email && (
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <span className="break-all">{parent.email}</span>
                </div>
              )}
              
              {preferredBranch && (
                <div className="flex items-center gap-3 pt-3 border-t">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">สาขาหลัก</p>
                    <p>{preferredBranch.name}</p>
                  </div>
                </div>
              )}

              {parent.lastLoginAt && (
                <div className="pt-3 border-t">
                  <p className="text-sm text-gray-500">เข้าใช้งานล่าสุด</p>
                  <p className="text-sm">{formatDate(parent.lastLoginAt, 'long')}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Address */}
          {parent.address && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Home className="h-5 w-5" />
                  ที่อยู่
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 text-sm">
                  <p>
                    {parent.address.houseNumber} 
                    {parent.address.street && ` ถ.${parent.address.street}`}
                  </p>
                  <p>
                    แขวง/ตำบล {parent.address.subDistrict}
                  </p>
                  <p>
                    เขต/อำเภอ {parent.address.district}
                  </p>
                  <p>
                    จังหวัด {parent.address.province} {parent.address.postalCode}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* LINE Connection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LinkIcon className="h-5 w-5" />
                การเชื่อมต่อ LINE
              </CardTitle>
            </CardHeader>
            <CardContent>
              {parent.lineUserId ? (
                <div className="space-y-4">
                  {/* Connected Status */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="font-medium text-green-900">เชื่อมต่อสำเร็จ</p>
                        <p className="text-sm text-green-700">สามารถรับการแจ้งเตือนผ่าน LINE</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* LINE Profile */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      {parent.pictureUrl && (
                        <img 
                          src={parent.pictureUrl} 
                          alt={parent.displayName}
                          className="w-12 h-12 rounded-full"
                        />
                      )}
                      <div>
                        <p className="font-medium">{parent.displayName}</p>
                        <p className="text-xs text-gray-500">LINE Display Name</p>
                      </div>
                    </div>
                    
                    <div className="pt-3 border-t">
                      <div className="text-xs space-y-1">
                        <p className="text-gray-500">LINE User ID</p>
                        <p className="font-mono text-xs bg-gray-100 p-2 rounded break-all">
                          {parent.lineUserId}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Unlink Button */}
                  <Button 
                    variant="outline" 
                    className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => setShowUnlinkDialog(true)}
                  >
                    <Unlink className="h-4 w-4 mr-2" />
                    ยกเลิกการเชื่อมต่อ
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <Alert className="border-orange-200 bg-orange-50">
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                    <AlertDescription className="text-orange-800">
                      ยังไม่ได้เชื่อมต่อ LINE
                    </AlertDescription>
                  </Alert>
                  
                  <div className="text-center py-6">
                    <LinkIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 mb-4">
                      เชื่อมต่อ LINE เพื่อรับการแจ้งเตือน<br />
                      และใช้งานระบบผ่าน LINE
                    </p>
                    
                    <Button 
                      className="bg-green-600 hover:bg-green-700"
                      onClick={handleGenerateQR}
                      disabled={generatingQR}
                    >
                      {generatingQR ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          กำลังสร้าง...
                        </>
                      ) : (
                        <>
                          <QrCode className="h-4 w-4 mr-2" />
                          สร้าง QR Code เชื่อมต่อ
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* QR Code Dialog */}
      <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>QR Code สำหรับเชื่อมต่อ LINE</DialogTitle>
            <DialogDescription>
              ให้ผู้ปกครองสแกน QR Code นี้ผ่าน LINE
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-lg border flex justify-center">
              <QRCodeSVG value={qrLink} size={200} level="M" />
            </div>
            
            <div className="space-y-2">
              <p className="text-sm text-gray-600 text-center">
                หรือคัดลอกลิงก์ด้านล่าง
              </p>
              <div className="flex gap-2">
                <Input value={qrLink} readOnly className="text-xs" />
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => copyToClipboard(qrLink)}
                >
                  คัดลอก
                </Button>
              </div>
            </div>
            
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <strong>ขั้นตอนการใช้งาน:</strong>
                <ol className="list-decimal list-inside mt-2 space-y-1">
                  <li>ให้ผู้ปกครองสแกน QR Code ผ่าน LINE</li>
                  <li>กรอกเบอร์โทร {parent.phone}</li>
                  <li>ยืนยันการเชื่อมต่อ</li>
                </ol>
              </AlertDescription>
            </Alert>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQRDialog(false)}>
              ปิด
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unlink Confirmation Dialog */}
      <Dialog open={showUnlinkDialog} onOpenChange={setShowUnlinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยืนยันการยกเลิกการเชื่อมต่อ</DialogTitle>
            <DialogDescription>
              คุณต้องการยกเลิกการเชื่อมต่อ LINE ของ {parent.displayName} หรือไม่?
            </DialogDescription>
          </DialogHeader>
          
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              หลังจากยกเลิกการเชื่อมต่อ ผู้ปกครองจะไม่ได้รับการแจ้งเตือนผ่าน LINE
            </AlertDescription>
          </Alert>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowUnlinkDialog(false)}
              disabled={unlinking}
            >
              ไม่ยกเลิก
            </Button>
            <Button 
              variant="destructive"
              onClick={handleUnlink}
              disabled={unlinking}
            >
              {unlinking ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  กำลังดำเนินการ...
                </>
              ) : (
                'ยืนยันยกเลิก'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}