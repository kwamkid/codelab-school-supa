'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  AlertCircle,
  Save,
  DollarSign,
  Calendar,
  User,
  School,
  CreditCard,
  FileText,
  X,
  Clock,
  Users,
  ArrowRight,
  History
} from 'lucide-react';
import { Enrollment, Student, Parent, Class, Branch, Subject, Teacher } from '@/types/models';
import { 
  updateEnrollment, 
  transferEnrollment, 
  checkAvailableSeats,
  getAvailableClassesForTransfer,
  getEnrollmentTransferHistory
} from '@/lib/services/enrollments';
import { getStudent, getParent } from '@/lib/services/parents';
import { getClass } from '@/lib/services/classes';
import { getBranch } from '@/lib/services/branches';
import { getSubject } from '@/lib/services/subjects';
import { getTeacher } from '@/lib/services/teachers';
import { toast } from 'sonner';
import { formatCurrency, formatDate, getDayName, calculateAge } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

interface EnrollmentEditFormProps {
  enrollment: Enrollment;
}

export default function EnrollmentEditForm({ enrollment }: EnrollmentEditFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Related data
  const [student, setStudent] = useState<Student | null>(null);
  const [parent, setParent] = useState<Parent | null>(null);
  const [currentClass, setCurrentClass] = useState<Class | null>(null);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  
  // Form data
  const [formData, setFormData] = useState({
    // Pricing
    discount: enrollment.pricing.discount,
    discountType: enrollment.pricing.discountType,
    promotionCode: enrollment.pricing.promotionCode || '',
    
    // Payment
    paymentMethod: enrollment.payment.method,
    paymentStatus: enrollment.payment.status,
    paidAmount: enrollment.payment.paidAmount,
    receiptNumber: enrollment.payment.receiptNumber || '',
    paymentNote: '',
  });
  
  // Transfer class
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [eligibleClasses, setEligibleClasses] = useState<any[]>([]);
  const [allClasses, setAllClasses] = useState<any[]>([]);
  const [selectedNewClassId, setSelectedNewClassId] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [transferHistory, setTransferHistory] = useState<any[]>([]);
  const [showOnlyEligible, setShowOnlyEligible] = useState(true);

  useEffect(() => {
    loadRelatedData();
  }, [enrollment]);

  const loadRelatedData = async () => {
    try {
      const [studentData, parentData, classData] = await Promise.all([
        getStudent(enrollment.parentId, enrollment.studentId),
        getParent(enrollment.parentId),
        getClass(enrollment.classId)
      ]);
      
      if (!studentData || !parentData || !classData) {
        toast.error('ไม่สามารถโหลดข้อมูลที่เกี่ยวข้องได้');
        return;
      }
      
      setStudent(studentData);
      setParent(parentData);
      setCurrentClass(classData);
      
      // Load additional data
      const [branchData, subjectData, teacherData] = await Promise.all([
        getBranch(classData.branchId),
        getSubject(classData.subjectId),
        getTeacher(classData.teacherId)
      ]);
      
      setBranch(branchData);
      setSubject(subjectData);
      setTeacher(teacherData);
      
      // Load available classes for transfer
      const studentAge = calculateAge(studentData.birthdate);
      const { eligibleClasses, allClasses } = await getAvailableClassesForTransfer(
        enrollment.studentId,
        enrollment.classId,
        studentAge
      );
      
      setEligibleClasses(eligibleClasses);
      setAllClasses(allClasses);
      
      // Load transfer history
      const history = await getEnrollmentTransferHistory(enrollment.id);
      setTransferHistory(history);
    } catch (error) {
      console.error('Error loading related data:', error);
      toast.error('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  const calculateFinalPrice = () => {
    if (!currentClass) return 0;
    
    const basePrice = currentClass.pricing.totalPrice;
    let discount = 0;
    
    if (formData.discount > 0) {
      if (formData.discountType === 'percentage') {
        discount = basePrice * (formData.discount / 100);
      } else {
        discount = formData.discount;
      }
    }
    
    return Math.max(0, basePrice - discount);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    
    try {
      // Prepare update data
      const updateData: Partial<Enrollment> = {
        pricing: {
          originalPrice: enrollment.pricing.originalPrice,
          discount: formData.discount,
          discountType: formData.discountType,
          finalPrice: calculateFinalPrice(),
        },
        payment: {
          method: formData.paymentMethod,
          status: formData.paymentStatus,
          paidAmount: formData.paidAmount,
        }
      };
      
      // Add optional fields if they have values
      if (formData.promotionCode) {
        updateData.pricing!.promotionCode = formData.promotionCode;
      }
      
      if (formData.receiptNumber) {
        updateData.payment!.receiptNumber = formData.receiptNumber;
      }
      
      // Update payment date if status changed to paid
      if (formData.paymentStatus === 'paid' && enrollment.payment.status !== 'paid') {
        updateData.payment!.paidDate = new Date();
      }
      
      await updateEnrollment(enrollment.id, updateData);
      toast.success('บันทึกข้อมูลเรียบร้อยแล้ว');
      router.push(`/enrollments`);
    } catch (error) {
      console.error('Error updating enrollment:', error);
      toast.error('ไม่สามารถบันทึกข้อมูลได้');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransferClass = async () => {
    if (!selectedNewClassId || !transferReason.trim()) {
      toast.error('กรุณาเลือกคลาสใหม่และระบุเหตุผล');
      return;
    }
    
    setTransferring(true);
    
    try {
      await transferEnrollment(enrollment.id, selectedNewClassId, transferReason);
      toast.success('ย้ายคลาสเรียบร้อยแล้ว');
      
      // Reload page to show updated data
      window.location.reload();
    } catch (error) {
      console.error('Error transferring enrollment:', error);
      toast.error('ไม่สามารถย้ายคลาสได้');
    } finally {
      setTransferring(false);
      setShowTransferDialog(false);
    }
  };

  // Get class info for display
  const getClassInfo = (classId: string) => {
    const cls = [...eligibleClasses, ...allClasses].find(c => c.id === classId);
    return cls;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  if (!student || !parent || !currentClass) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">ไม่สามารถโหลดข้อมูลที่เกี่ยวข้องได้</p>
      </div>
    );
  }

  const isActive = enrollment.status === 'active';

  // Filter classes based on tab selection
  const displayClasses = showOnlyEligible ? eligibleClasses : allClasses;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Student and Class Info (Read-only) */}
      <Card className="bg-gray-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            ข้อมูลนักเรียนและคลาส
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">นักเรียน</p>
            <p className="font-medium">{student.nickname} ({student.name})</p>
            <p className="text-sm text-gray-600">อายุ {calculateAge(student.birthdate)} ปี</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">ผู้ปกครอง</p>
            <p className="font-medium">{parent.displayName}</p>
            <p className="text-sm text-gray-600">{parent.phone}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">คลาส</p>
            <p className="font-medium">{currentClass.name}</p>
            <p className="text-sm text-gray-600">{currentClass.code}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">ตารางเรียน</p>
            <p className="font-medium">{currentClass.daysOfWeek.map(d => getDayName(d)).join(', ')}</p>
            <p className="text-sm text-gray-600">{currentClass.startTime} - {currentClass.endTime} น.</p>
          </div>
        </CardContent>
      </Card>

      {/* Transfer History */}
      {transferHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              ประวัติการย้ายคลาส
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {transferHistory.map((transfer, index) => {
                const fromClass = getClassInfo(transfer.fromClassId);
                const toClass = getClassInfo(transfer.toClassId);
                
                return (
                  <div key={index} className="flex items-center gap-3 text-sm">
                    <Badge variant="outline">{formatDate(transfer.transferredAt)}</Badge>
                    <div className="flex items-center gap-2">
                      <span>{fromClass?.name || transfer.fromClassId}</span>
                      <ArrowRight className="h-4 w-4" />
                      <span className="font-medium">{toClass?.name || transfer.toClassId}</span>
                    </div>
                    {transfer.reason && (
                      <span className="text-gray-500">({transfer.reason})</span>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transfer Class Option */}
      {isActive && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <School className="h-5 w-5" />
              ย้ายคลาส
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
              <DialogTrigger asChild>
                <Button variant="outline">ย้ายไปคลาสอื่น</Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                  <DialogTitle>ย้ายคลาส</DialogTitle>
                  <DialogDescription>
                    เลือกคลาสใหม่ที่ต้องการย้าย (นักเรียนอายุ {calculateAge(student.birthdate)} ปี)
                  </DialogDescription>
                </DialogHeader>
                
                <div className="flex-1 overflow-y-auto space-y-4 py-4">
                  <Tabs defaultValue="eligible" onValueChange={(value) => setShowOnlyEligible(value === 'eligible')}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="eligible">
                        คลาสที่เหมาะกับอายุ ({eligibleClasses.length})
                      </TabsTrigger>
                      <TabsTrigger value="all">
                        คลาสทั้งหมด ({allClasses.length})
                      </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="eligible" className="mt-4">
                      {eligibleClasses.length === 0 ? (
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            ไม่พบคลาสที่เหมาะสมกับช่วงอายุของนักเรียน
                          </AlertDescription>
                        </Alert>
                      ) : null}
                    </TabsContent>
                    
                    <TabsContent value="all" className="mt-4">
                      {!showOnlyEligible && (
                        <Alert className="mb-4">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            แสดงคลาสทั้งหมด รวมถึงคลาสที่อาจไม่เหมาะกับช่วงอายุของนักเรียน
                          </AlertDescription>
                        </Alert>
                      )}
                    </TabsContent>
                  </Tabs>

                  <div className="space-y-2">
                    {displayClasses.map(cls => {
                      const isEligible = eligibleClasses.some(ec => ec.id === cls.id);
                      const statusColor = 
                        cls.status === 'published' ? 'bg-blue-100 text-blue-700' :
                        cls.status === 'started' ? 'bg-green-100 text-green-700' :
                        cls.status === 'completed' ? 'bg-gray-100 text-gray-700' :
                        cls.status === 'draft' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700';
                      
                      return (
                        <div
                          key={cls.id}
                          className={`border rounded-lg p-4 cursor-pointer transition-all ${
                            selectedNewClassId === cls.id 
                              ? 'border-red-500 bg-red-50' 
                              : 'hover:border-gray-300'
                          }`}
                          onClick={() => setSelectedNewClassId(cls.id)}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium">{cls.name}</h4>
                                <Badge className={statusColor}>
                                  {cls.status === 'published' ? 'เปิดรับสมัคร' :
                                   cls.status === 'started' ? 'กำลังเรียน' :
                                   cls.status === 'completed' ? 'จบแล้ว' :
                                   cls.status === 'draft' ? 'ร่าง' : 'ยกเลิก'}
                                </Badge>
                                {!isEligible && (
                                  <Badge variant="outline" className="text-orange-600 border-orange-300">
                                    อายุไม่ตรง (ต้อง {cls.subject?.ageRange.min}-{cls.subject?.ageRange.max} ปี)
                                  </Badge>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                                <div>
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {getDayName(cls.daysOfWeek[0])} {cls.startTime} - {cls.endTime}
                                  </span>
                                  <span className="text-xs">
                                    {formatDate(cls.startDate)} - {formatDate(cls.endDate)}
                                  </span>
                                </div>
                                <div>
                                  <span className="flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    {cls.enrolledCount}/{cls.maxStudents} คน
                                    {cls.enrolledCount >= cls.maxStudents && (
                                      <Badge variant="destructive" className="text-xs ml-1">เต็ม</Badge>
                                    )}
                                  </span>
                                  <span className="text-xs">
                                    ราคา: {formatCurrency(cls.pricing.totalPrice)}
                                  </span>
                                </div>
                              </div>
                            </div>
                            {selectedNewClassId === cls.id && (
                              <div className="text-red-500">
                                <AlertCircle className="h-5 w-5" />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  <div>
                    <Label>เหตุผลในการย้าย *</Label>
                    <Textarea
                      placeholder="กรุณาระบุเหตุผล..."
                      value={transferReason}
                      onChange={(e) => setTransferReason(e.target.value)}
                      className="mt-2"
                    />
                  </div>
                </div>
                
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowTransferDialog(false)}>
                    ยกเลิก
                  </Button>
                  <Button 
                    onClick={handleTransferClass}
                    disabled={!selectedNewClassId || !transferReason.trim() || transferring}
                    className="bg-red-500 hover:bg-red-600"
                  >
                    {transferring ? 'กำลังย้าย...' : 'ยืนยันการย้าย'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      )}

      {/* Pricing Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            ข้อมูลราคาและส่วนลด
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-gray-500">ราคาเต็ม</p>
            <p className="text-xl font-bold">{formatCurrency(currentClass.pricing.totalPrice)}</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>รหัสโปรโมชั่น</Label>
              <Input
                value={formData.promotionCode}
                onChange={(e) => setFormData(prev => ({ ...prev, promotionCode: e.target.value }))}
                placeholder="ใส่รหัสโปรโมชั่น (ถ้ามี)"
              />
            </div>
            
            <div>
              <Label>ส่วนลดพิเศษ</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={formData.discount || ''}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    discount: parseFloat(e.target.value) || 0 
                  }))}
                  placeholder="0"
                />
                <Select 
                  value={formData.discountType}
                  onValueChange={(value: 'percentage' | 'fixed') => 
                    setFormData(prev => ({ ...prev, discountType: value }))
                  }
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">%</SelectItem>
                    <SelectItem value="fixed">฿</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          {/* Price Summary */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span>ราคาเต็ม</span>
              <span>{formatCurrency(currentClass.pricing.totalPrice)}</span>
            </div>
            {formData.discount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>
                  ส่วนลด {formData.discountType === 'percentage' 
                    ? `${formData.discount}%` 
                    : formatCurrency(formData.discount)
                  }
                </span>
                <span>
                  -{formatCurrency(
                    formData.discountType === 'percentage'
                      ? currentClass.pricing.totalPrice * (formData.discount / 100)
                      : formData.discount
                  )}
                </span>
              </div>
            )}
            <div className="pt-2 border-t flex justify-between font-semibold">
              <span>ยอดที่ต้องชำระ</span>
              <span className="text-green-600">{formatCurrency(calculateFinalPrice())}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            ข้อมูลการชำระเงิน
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>วิธีการชำระเงิน</Label>
              <Select 
                value={formData.paymentMethod}
                onValueChange={(value: 'cash' | 'transfer' | 'credit') => 
                  setFormData(prev => ({ ...prev, paymentMethod: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">เงินสด</SelectItem>
                  <SelectItem value="transfer">โอนเงิน</SelectItem>
                  <SelectItem value="credit">บัตรเครดิต</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>สถานะการชำระเงิน</Label>
              <Select 
                value={formData.paymentStatus}
                onValueChange={(value: 'pending' | 'partial' | 'paid') => 
                  setFormData(prev => ({ ...prev, paymentStatus: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">รอชำระ</SelectItem>
                  <SelectItem value="partial">ชำระบางส่วน</SelectItem>
                  <SelectItem value="paid">ชำระแล้ว</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>ยอดที่ชำระแล้ว</Label>
              <Input
                type="number"
                value={formData.paidAmount || ''}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  paidAmount: parseFloat(e.target.value) || 0 
                }))}
                placeholder="0"
              />
            </div>
            
            <div>
              <Label>เลขที่ใบเสร็จ</Label>
              <Input
                value={formData.receiptNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, receiptNumber: e.target.value }))}
                placeholder="เลขที่ใบเสร็จ (ถ้ามี)"
              />
            </div>
          </div>
          
          <div>
            <Label>หมายเหตุการชำระเงิน</Label>
            <Textarea
              value={formData.paymentNote}
              onChange={(e) => setFormData(prev => ({ ...prev, paymentNote: e.target.value }))}
              placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
              rows={3}
            />
          </div>
          
          {/* Payment Status Summary */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600">สถานะปัจจุบัน</p>
                <p className="font-medium">
                  {formData.paymentStatus === 'paid' 
                    ? 'ชำระครบแล้ว' 
                    : formData.paymentStatus === 'partial'
                    ? `ชำระแล้ว ${formatCurrency(formData.paidAmount)} จาก ${formatCurrency(calculateFinalPrice())}`
                    : `รอชำระ ${formatCurrency(calculateFinalPrice())}`
                  }
                </p>
              </div>
              {formData.paidAmount < calculateFinalPrice() && formData.paymentStatus !== 'paid' && (
                <div className="text-right">
                  <p className="text-sm text-gray-600">คงเหลือ</p>
                  <p className="font-medium text-red-600">
                    {formatCurrency(calculateFinalPrice() - formData.paidAmount)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status Alert */}
      {enrollment.status !== 'active' && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            การลงทะเบียนนี้มีสถานะ "{enrollment.status === 'dropped' ? 'ยกเลิก' : enrollment.status === 'transferred' ? 'ย้ายคลาส' : 'จบแล้ว'}" 
            สามารถแก้ไขได้เฉพาะข้อมูลการชำระเงินเท่านั้น
          </AlertDescription>
        </Alert>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => router.push(`/enrollments`)}
        >
          <X className="h-4 w-4 mr-2" />
          ยกเลิก
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={submitting}
          className="bg-red-500 hover:bg-red-600"
        >
          {submitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              กำลังบันทึก...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              บันทึกการเปลี่ยนแปลง
            </>
          )}
        </Button>
      </div>
    </div>
  );
}