'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Parent, Student, Branch } from '@/types/models';
import { getParentWithStudents, updateParent, checkParentPhoneExists } from '@/lib/services/parents';
import { getBranch, getActiveBranches } from '@/lib/services/branches';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ParentBadge } from '@/components/ui/parent-badge';
import { StudentMiniCard } from '@/components/students/student-mini-card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  QrCode,
  Save,
  X
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

  // This page is edit-only now; read-only viewing happens in the list's modal.
  const [isEditing, setIsEditing] = useState(true);
  const [saving, setSaving] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const emptyForm = {
    displayName: '', phone: '', emergencyPhone: '', email: '',
    lineUserId: '', pictureUrl: '', preferredBranchId: '',
    address: { houseNumber: '', street: '', subDistrict: '', district: '', province: '', postalCode: '' },
  };
  const [formData, setFormData] = useState(emptyForm);

  // Populate the edit form from a parent record
  const fillForm = (p: Parent) => setFormData({
    displayName: p.displayName || '',
    phone: p.phone || '',
    emergencyPhone: p.emergencyPhone || '',
    email: p.email || '',
    lineUserId: p.lineUserId || '',
    pictureUrl: p.pictureUrl || '',
    preferredBranchId: p.preferredBranchId || '',
    address: {
      houseNumber: p.address?.houseNumber || '',
      street: p.address?.street || '',
      subDistrict: p.address?.subDistrict || '',
      district: p.address?.district || '',
      province: p.address?.province || '',
      postalCode: p.address?.postalCode || '',
    },
  });
  
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

  // Load branches for the preferred-branch dropdown (edit mode)
  useEffect(() => {
    getActiveBranches().then(setBranches).catch(() => setBranches([]));
  }, []);

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
      fillForm(parentData);

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

  const cancelEdit = () => {
    router.push('/parents');
  };

  // Save inline-edited parent info. Validation mirrors components/parents/parent-form.tsx.
  const handleSave = async () => {
    if (!parent) return;

    if (!formData.displayName || !formData.phone) {
      toast.error('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
      return;
    }
    const phoneRegex = /^[0-9]{9,10}$/;
    const cleanPhone = formData.phone.replace(/-/g, '');
    if (!phoneRegex.test(cleanPhone)) {
      toast.error('เบอร์โทรศัพท์ไม่ถูกต้อง');
      return;
    }
    if (formData.emergencyPhone) {
      const cleanEmergency = formData.emergencyPhone.replace(/-/g, '');
      if (!phoneRegex.test(cleanEmergency)) {
        toast.error('เบอร์โทรฉุกเฉินไม่ถูกต้อง');
        return;
      }
    }
    if (formData.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        toast.error('อีเมลไม่ถูกต้อง');
        return;
      }
    }
    const hasAddressData = Object.values(formData.address).some((v) => v.trim() !== '');
    if (hasAddressData) {
      if (!formData.address.houseNumber || !formData.address.subDistrict ||
          !formData.address.district || !formData.address.province) {
        toast.error('กรุณากรอกข้อมูลที่อยู่ให้ครบถ้วน (บ้านเลขที่, แขวง/ตำบล, เขต/อำเภอ, จังหวัด)');
        return;
      }
    }

    setSaving(true);
    try {
      const phoneExists = await checkParentPhoneExists(cleanPhone, parent.id);
      if (phoneExists) {
        toast.error('เบอร์โทรศัพท์นี้มีอยู่ในระบบแล้ว');
        setSaving(false);
        return;
      }

      await updateParent(parent.id, {
        displayName: formData.displayName,
        phone: cleanPhone,
        emergencyPhone: formData.emergencyPhone ? formData.emergencyPhone.replace(/-/g, '') : undefined,
        email: formData.email || undefined,
        preferredBranchId: formData.preferredBranchId || undefined,
        lineUserId: formData.lineUserId || undefined,
        pictureUrl: formData.pictureUrl || undefined,
        address: hasAddressData ? formData.address : undefined,
      });

      toast.success('อัปเดตข้อมูลผู้ปกครองเรียบร้อยแล้ว');
      router.push('/parents');
    } catch (error) {
      console.error('Error updating parent:', error);
      toast.error('ไม่สามารถอัปเดตข้อมูลได้');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateQR = async () => {
    if (!parent) return;
    
    setGeneratingQR(true);
    try {
      const res = await fetch('/api/admin/link-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId: parent.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'ไม่สามารถสร้าง QR Code ได้');
      }
      const token = data.token;

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
        lineDisplayName: null,
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
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={cancelEdit} disabled={saving}>
            <X className="h-4 w-4 mr-2" />
            ยกเลิก
          </Button>
          <Button className="bg-red-500 hover:bg-red-600" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            บันทึก
          </Button>
        </div>
      </div>

      {/* Parent Header — compact card with an inline stat strip */}
      <Card className="mb-6">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start gap-4">
            {parent.pictureUrl ? (
              <img
                src={parent.pictureUrl}
                alt={parent.displayName}
                className="w-16 h-16 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                <Users className="h-8 w-8 text-gray-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <ParentBadge
                  name={parent.displayName}
                  imageUrl={parent.pictureUrl}
                  showAvatar={false}
                  size="lg"
                  className="text-xl sm:text-2xl font-bold text-gray-900"
                />
                {parent.lineUserId && (
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                    <img src="/line-icon.svg" alt="LINE" className="w-3.5 h-3.5 mr-1" />
                    LINE
                  </Badge>
                )}
              </div>

              {/* Stat strip — fills the header width, anchors the page */}
              {!isEditing && (
                <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                  <span className="flex items-center gap-1.5 text-gray-700">
                    <Phone className="h-4 w-4 text-gray-400" />
                    {parent.phone || '—'}
                  </span>
                  <span className="flex items-center gap-1.5 text-gray-700">
                    <Users className="h-4 w-4 text-gray-400" />
                    {activeStudents.length} นักเรียน
                  </span>
                  {preferredBranch && (
                    <span className="flex items-center gap-1.5 text-gray-700">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      {preferredBranch.name}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5 text-gray-400">
                    ลงทะเบียน {formatDate(parent.createdAt, 'long')}
                  </span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Students column — right side; LINE/QR sits under it */}
        <div className="lg:order-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>ข้อมูลนักเรียน ({activeStudents.length})</CardTitle>
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
                    <StudentMiniCard
                      key={student.id}
                      student={student}
                      variant="full"
                      editHref={`/parents/${parentId}/students/${student.id}/edit`}
                    />
                  ))}

                  {/* Add-student button below the list */}
                  <Link href={`/parents/${parentId}/students/new`} className="block">
                    <Button
                      variant="outline"
                      className="w-full border-dashed text-gray-600 hover:text-red-600 hover:border-red-300 hover:bg-red-50"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      เพิ่มนักเรียน
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* LINE Connection — stacked directly under students */}
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
                      <div>
                        <ParentBadge
                          name={parent.lineDisplayName || parent.displayName}
                          imageUrl={parent.pictureUrl}
                          size="lg"
                        />
                        <p className="text-xs text-gray-500 mt-1">LINE Display Name</p>
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

        {/* Parent info column — left side (contact + address) */}
        <div className="lg:order-1 space-y-6">
          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>ข้อมูลติดต่อ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditing ? (
                <>
                  <div className="space-y-1">
                    <Label htmlFor="displayName">ชื่อ-นามสกุล *</Label>
                    <Input id="displayName" value={formData.displayName}
                      onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                      placeholder="ชื่อ-นามสกุล" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="phone">เบอร์โทรหลัก *</Label>
                      <Input id="phone" value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="08x-xxx-xxxx" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="emergencyPhone">เบอร์โทรฉุกเฉิน</Label>
                      <Input id="emergencyPhone" value={formData.emergencyPhone}
                        onChange={(e) => setFormData({ ...formData, emergencyPhone: e.target.value })}
                        placeholder="08x-xxx-xxxx" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="email">อีเมล</Label>
                    <Input id="email" type="email" value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="parent@example.com" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="preferredBranchId">สาขาหลัก</Label>
                    <Select
                      value={formData.preferredBranchId || 'none'}
                      onValueChange={(v) => setFormData({ ...formData, preferredBranchId: v === 'none' ? '' : v })}
                    >
                      <SelectTrigger><SelectValue placeholder="เลือกสาขา" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">ไม่ระบุ</SelectItem>
                        {branches.map((b) => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <>
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
                </>
              )}

              {!isEditing && parent.lastLoginAt && (
                <div className="pt-3 border-t">
                  <p className="text-sm text-gray-500">เข้าใช้งานล่าสุด</p>
                  <p className="text-sm">{formatDate(parent.lastLoginAt, 'long')}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Address */}
          {(isEditing || parent.address) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Home className="h-5 w-5" />
                  ที่อยู่
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label>บ้านเลขที่</Label>
                        <Input value={formData.address.houseNumber} placeholder="123/45"
                          onChange={(e) => setFormData({ ...formData, address: { ...formData.address, houseNumber: e.target.value } })} />
                      </div>
                      <div className="space-y-1">
                        <Label>ถนน</Label>
                        <Input value={formData.address.street} placeholder="ถนนสุขุมวิท"
                          onChange={(e) => setFormData({ ...formData, address: { ...formData.address, street: e.target.value } })} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label>แขวง/ตำบล</Label>
                        <Input value={formData.address.subDistrict} placeholder="คลองเตย"
                          onChange={(e) => setFormData({ ...formData, address: { ...formData.address, subDistrict: e.target.value } })} />
                      </div>
                      <div className="space-y-1">
                        <Label>เขต/อำเภอ</Label>
                        <Input value={formData.address.district} placeholder="คลองเตย"
                          onChange={(e) => setFormData({ ...formData, address: { ...formData.address, district: e.target.value } })} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label>จังหวัด</Label>
                        <Input value={formData.address.province} placeholder="กรุงเทพมหานคร"
                          onChange={(e) => setFormData({ ...formData, address: { ...formData.address, province: e.target.value } })} />
                      </div>
                      <div className="space-y-1">
                        <Label>รหัสไปรษณีย์</Label>
                        <Input value={formData.address.postalCode} placeholder="10110" maxLength={5}
                          onChange={(e) => setFormData({ ...formData, address: { ...formData.address, postalCode: e.target.value } })} />
                      </div>
                    </div>
                  </div>
                ) : parent.address && (
                  <div className="space-y-1 text-sm">
                    <p>
                      {parent.address.houseNumber}
                      {parent.address.street && ` ถ.${parent.address.street}`}
                    </p>
                    <p>แขวง/ตำบล {parent.address.subDistrict}</p>
                    <p>เขต/อำเภอ {parent.address.district}</p>
                    <p>จังหวัด {parent.address.province} {parent.address.postalCode}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
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