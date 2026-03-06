'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Enrollment, Class, Student, Parent, Branch, Subject, Teacher } from '@/types/models';
import { getEnrollment, cancelEnrollment, updateEnrollment, deleteEnrollment } from '@/lib/services/enrollments';
import { getClass } from '@/lib/services/classes';
import { getParent, getStudent } from '@/lib/services/parents';
import { getBranch } from '@/lib/services/branches';
import { getSubject } from '@/lib/services/subjects';
import { getTeacher } from '@/lib/services/teachers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronLeft, 
  Edit, 
  Printer,
  DollarSign,
  Calendar,
  Clock,
  MapPin,
  User,
  Users,
  School,
  Phone,
  Mail,
  AlertCircle,
  History,
  XCircle,
  Trash2,
  MoreVertical,
  CreditCard,
  CheckCircle,
  Loader2
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { SectionLoading } from '@/components/ui/loading';
import { formatDate, formatCurrency, getDayName, calculateAge } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getMakeupClassesByStudent } from '@/lib/services/makeup';
import { getPaymentSummary, createPaymentTransaction, deletePaymentTransaction } from '@/lib/services/payment-transactions';
import { getBranchPaymentSettings } from '@/lib/services/branch-payment-settings';
import { PaymentTransaction, PaymentMethod, BranchPaymentSettings } from '@/types/models';
import PaymentSummaryCard from '@/components/enrollments/payment/payment-summary-card';
import PaymentTransactionList from '@/components/enrollments/payment/payment-transaction-list';
import AddPaymentDialog from '@/components/enrollments/payment/add-payment-dialog';
import { useBranch } from '@/contexts/BranchContext';
import { useAuth } from '@/hooks/useAuth';
import { PermissionGuard } from '@/components/auth/permission-guard';
import { ActionButton } from '@/components/ui/action-button';
import { Invoice } from '@/types/models';
import { createInvoice } from '@/lib/services/invoices';
import ReceiptPrintDialog from '@/components/invoices/receipt-print-dialog';
import CreditNotePrintDialog from '@/components/invoices/credit-note-print-dialog';
import IssueCreditNoteDialog from '@/components/invoices/issue-credit-note-dialog';

const statusColors = {
  'active': 'bg-green-100 text-green-700',
  'completed': 'bg-gray-100 text-gray-700',
  'dropped': 'bg-red-100 text-red-700',
  'transferred': 'bg-blue-100 text-blue-700',
};

const statusLabels = {
  'active': 'กำลังเรียน',
  'completed': 'จบแล้ว',
  'dropped': 'ยกเลิก',
  'transferred': 'ย้ายคลาส',
};

const paymentStatusColors = {
  'pending': 'bg-yellow-100 text-yellow-700',
  'partial': 'bg-orange-100 text-orange-700',
  'paid': 'bg-green-100 text-green-700',
};

const paymentStatusLabels = {
  'pending': 'รอชำระ',
  'partial': 'ชำระบางส่วน',
  'paid': 'ชำระแล้ว',
};

const paymentMethodLabels: Record<string, string> = {
  'cash': 'เงินสด',
  'bank_transfer': 'โอนเงิน',
  'promptpay': 'PromptPay',
  'credit_card': 'บัตรเครดิต',
  'online': 'ชำระออนไลน์',
  // Legacy
  'transfer': 'โอนเงิน',
  'credit': 'บัตรเครดิต',
};

export default function EnrollmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const enrollmentId = params.id as string;
  const { canViewBranch } = useBranch();
  const { adminUser } = useAuth();
  
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [classData, setClassData] = useState<Class | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [parent, setParent] = useState<Parent | null>(null);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelRefundType, setCancelRefundType] = useState<'none' | 'full' | 'partial'>('full');
  const [cancelRefundAmount, setCancelRefundAmount] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [makeupClasses, setMakeupClasses] = useState<any[]>([]);

  // Payment transaction states
  const [paymentTransactions, setPaymentTransactions] = useState<PaymentTransaction[]>([]);
  const [paymentTotalPaid, setPaymentTotalPaid] = useState(0);
  const [paymentRemaining, setPaymentRemaining] = useState(0);
  const [paymentSettings, setPaymentSettings] = useState<BranchPaymentSettings>({ id: '', branchId: '', enabledMethods: ['cash', 'bank_transfer'], bankAccounts: [], onlinePaymentEnabled: false });
  const [showAddPaymentDialog, setShowAddPaymentDialog] = useState(false);

  // Invoice states
  const [invoices, setInvoices] = useState<any[]>([]);
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [printInvoiceId, setPrintInvoiceId] = useState<string>('');

  // Credit note states
  const [creditNotes, setCreditNotes] = useState<any[]>([]);
  const [showIssueCNDialog, setShowIssueCNDialog] = useState(false);
  const [showCNPrintDialog, setShowCNPrintDialog] = useState(false);
  const [printCNId, setPrintCNId] = useState<string>('');

  useEffect(() => {
    if (adminUser) {
      loadEnrollmentDetails();
    }
  }, [enrollmentId, adminUser]);

  const loadEnrollmentDetails = async () => {
    if (!enrollmentId) {
      setLoading(false);
      return;
    }

    console.log('Loading enrollment details for:', enrollmentId);
    
    try {
      const enrollmentData = await getEnrollment(enrollmentId);
      console.log('Enrollment data:', enrollmentData);
      
      if (!enrollmentData) {
        toast.error('ไม่พบข้อมูลการลงทะเบียน');
        router.push('/enrollments');
        return;
      }
      
      // Check if user can view this enrollment's branch
      if (!canViewBranch(enrollmentData.branchId)) {
        toast.error('คุณไม่มีสิทธิ์ดูข้อมูลการลงทะเบียนนี้');
        router.push('/enrollments');
        return;
      }
      
      setEnrollment(enrollmentData);
      
      // Load all related data
      const [classInfo, parentInfo, studentInfo] = await Promise.all([
        getClass(enrollmentData.classId),
        getParent(enrollmentData.parentId),
        getStudent(enrollmentData.parentId, enrollmentData.studentId)
      ]);
      
      console.log('Related data:', { classInfo, parentInfo, studentInfo });
      
      if (!classInfo || !parentInfo || !studentInfo) {
        toast.error('ไม่สามารถโหลดข้อมูลที่เกี่ยวข้องได้');
        setLoading(false);
        return;
      }
      
      setClassData(classInfo);
      setParent(parentInfo);
      setStudent(studentInfo);
      
      // Load additional data
      const [branchInfo, subjectInfo, teacherInfo, makeupData] = await Promise.all([
        getBranch(classInfo.branchId),
        getSubject(classInfo.subjectId),
        getTeacher(classInfo.teacherId),
        getMakeupClassesByStudent(enrollmentData.studentId)
      ]);
      
      setBranch(branchInfo);
      setSubject(subjectInfo);
      setTeacher(teacherInfo);
      setMakeupClasses(makeupData.filter(m => m.originalClassId === enrollmentData.classId));

      // Load payment data + invoices
      try {
        const [paymentSummary, settings] = await Promise.all([
          getPaymentSummary(enrollmentId),
          getBranchPaymentSettings(classInfo.branchId),
        ]);
        setPaymentTransactions(paymentSummary.transactions);
        setPaymentTotalPaid(paymentSummary.totalPaid);
        setPaymentRemaining(paymentSummary.remaining);
        setPaymentSettings(settings);
      } catch (error) {
        console.error('Error loading payment data:', error);
      }

      // Load invoices + credit notes
      try {
        const [invoiceRes, cnRes] = await Promise.all([
          fetch(`/api/admin/invoices?enrollmentId=${enrollmentId}`),
          fetch(`/api/admin/credit-notes?enrollmentId=${enrollmentId}`),
        ]);
        if (invoiceRes.ok) {
          setInvoices(await invoiceRes.json() || []);
        }
        if (cnRes.ok) {
          setCreditNotes(await cnRes.json() || []);
        }
      } catch (error) {
        console.error('Error loading invoices/credit notes:', error);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading enrollment details:', error);
      toast.error('ไม่สามารถโหลดข้อมูลได้');
      setLoading(false);
    }
  };

  const handleCancelEnrollment = async () => {
    if (!cancelReason.trim()) {
      toast.error('กรุณาระบุเหตุผลในการยกเลิก');
      return;
    }

    setCancelling(true);
    try {
      await cancelEnrollment(enrollmentId, cancelReason);
      toast.success('ยกเลิกการลงทะเบียนเรียบร้อยแล้ว');

      // Auto-create credit note if refund is selected and invoices exist
      if (cancelRefundType !== 'none' && invoices.length > 0) {
        try {
          const { createCreditNote } = await import('@/lib/services/credit-notes');
          const inv = invoices[0]; // Use first invoice as reference
          const maxRefund = inv.paid_amount || inv.total_amount || 0;
          const refundAmt = cancelRefundType === 'full'
            ? maxRefund
            : Math.min(Number(cancelRefundAmount) || 0, maxRefund);

          if (refundAmt > 0) {
            const cnId = await createCreditNote({
              invoiceCompanyId: inv.invoice_company_id,
              originalInvoiceId: inv.id,
              enrollmentId,
              branchId: enrollment!.branchId,
              customerName: inv.customer_name,
              customerPhone: inv.customer_phone,
              customerEmail: inv.customer_email,
              billingType: inv.billing_type,
              billingName: inv.billing_name,
              billingAddress: inv.billing_address,
              billingTaxId: inv.billing_tax_id,
              billingCompanyBranch: inv.billing_company_branch,
              items: [{
                description: `คืนเงิน${cancelRefundType === 'partial' ? 'บางส่วน' : ''} - ${inv.invoice_number}`,
                amount: refundAmt,
              }],
              refundAmount: refundAmt,
              reason: cancelReason,
              refundType: cancelRefundType === 'full' ? 'full' : 'partial',
              createdBy: adminUser?.id,
            });

            // Open credit note print dialog
            setPrintCNId(cnId);
            setShowCNPrintDialog(true);
            toast.success('สร้างใบลดหนี้เรียบร้อย');
          }
        } catch (cnError) {
          console.error('Error creating credit note:', cnError);
          toast.error('ยกเลิกสำเร็จ แต่ไม่สามารถสร้างใบลดหนี้ได้');
        }
      }

      loadEnrollmentDetails();
    } catch (error) {
      console.error('Error cancelling enrollment:', error);
      toast.error('ไม่สามารถยกเลิกการลงทะเบียนได้');
    } finally {
      setCancelling(false);
      setCancelReason('');
      setCancelRefundType('full');
      setCancelRefundAmount('');
    }
  };

  const handleDeleteEnrollment = async () => {
    setDeleting(true);
    try {
      await deleteEnrollment(enrollmentId);
      toast.success('ลบการลงทะเบียนเรียบร้อยแล้ว');
      router.push('/enrollments');
    } catch (error) {
      console.error('Error deleting enrollment:', error);
      toast.error('ไม่สามารถลบการลงทะเบียนได้');
    } finally {
      setDeleting(false);
    }
  };

  const handleAddPayment = async (data: {
    amount: number;
    method: PaymentMethod;
    note?: string;
  }) => {
    try {
      // 1. Record payment transaction
      await createPaymentTransaction({
        enrollmentId,
        amount: data.amount,
        method: data.method,
        transactionDate: new Date(),
        note: data.note,
        recordedBy: adminUser?.id,
      });

      // 2. Auto-create invoice for this payment
      if (branch?.invoiceCompanyId && enrollment) {
        try {
          const firstInvoice = invoices[0];
          const studentName = student?.nickname || student?.firstName || '';
          const className = classData?.name || '';
          const refLabel = firstInvoice
            ? ` (อ้างอิง ${firstInvoice.invoice_number})`
            : '';

          await createInvoice({
            invoiceCompanyId: branch.invoiceCompanyId,
            enrollmentId,
            branchId: enrollment.branchId,
            billingType: (firstInvoice?.billing_type as 'personal' | 'company') || 'personal',
            billingName: firstInvoice?.billing_name || parent?.name || '',
            billingAddress: firstInvoice?.billing_address || undefined,
            billingTaxId: firstInvoice?.billing_tax_id || undefined,
            billingCompanyBranch: firstInvoice?.billing_company_branch || undefined,
            wantTaxInvoice: firstInvoice?.want_tax_invoice || false,
            customerName: parent?.name || '',
            customerPhone: parent?.phone || undefined,
            customerEmail: parent?.email || undefined,
            items: [{
              description: `ชำระค่าเรียนเพิ่มเติม${refLabel}`,
              studentName,
              className,
              amount: data.amount,
            }],
            subtotal: data.amount,
            totalAmount: data.amount,
            paymentMethod: data.method,
            paymentType: 'deposit',
            paidAmount: data.amount,
            createdBy: adminUser?.id,
          });
        } catch (invoiceError) {
          console.error('Error creating invoice:', invoiceError);
          // Payment was recorded successfully, just invoice creation failed
          toast.error('บันทึกการชำระสำเร็จ แต่ออกใบเสร็จไม่ได้');
        }
      }

      toast.success('บันทึกการชำระเงิน + ออกใบเสร็จเรียบร้อย');
      loadEnrollmentDetails();
    } catch (error) {
      console.error('Error adding payment:', error);
      toast.error('ไม่สามารถบันทึกการชำระเงินได้');
      throw error;
    }
  };

  const handleDeleteTransaction = async (txId: string) => {
    try {
      await deletePaymentTransaction(txId, enrollmentId);
      toast.success('ลบรายการชำระเงินเรียบร้อย');
      loadEnrollmentDetails();
    } catch (error) {
      console.error('Error deleting transaction:', error);
      toast.error('ไม่สามารถลบรายการได้');
    }
  };

  const handlePrintReceipt = (invoiceId?: string) => {
    const id = invoiceId || invoices[0]?.id;
    if (!id) {
      toast.error('ไม่พบใบเสร็จ');
      return;
    }
    setPrintInvoiceId(id);
    setShowReceiptDialog(true);
  };

  if (loading) {
    return <SectionLoading text="กำลังโหลดข้อมูล..." />;
  }

  if (!enrollment || !classData || !student || !parent) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">ไม่พบข้อมูลการลงทะเบียน</p>
        <Link href="/enrollments" className="text-red-500 hover:text-red-600 mt-4 inline-block">
          กลับไปหน้ารายการลงทะเบียน
        </Link>
      </div>
    );
  }

  const isActive = enrollment.status === 'active';

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <Link 
          href="/enrollments" 
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          กลับไปหน้ารายการลงทะเบียน
        </Link>
        
        <div className="flex gap-2">
          {/* Print Receipt Button */}
          {invoices.length > 0 && (
            <Button
              variant="outline"
              onClick={() => handlePrintReceipt()}
            >
              <Printer className="h-4 w-4 mr-2" />
              พิมพ์ใบเสร็จ
            </Button>
          )}

{/* Actions Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>จัดการ</DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              {isActive && (
                <PermissionGuard requiredRole={['super_admin', 'branch_admin']}>
                  <Link href={`/enrollments/${enrollmentId}/edit`}>
                    <DropdownMenuItem>
                      <Edit className="h-4 w-4 mr-2" />
                      แก้ไขข้อมูล
                    </DropdownMenuItem>
                  </Link>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem 
                        className="text-orange-600"
                        onSelect={(e) => e.preventDefault()}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        ยกเลิกการลงทะเบียน
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>ยืนยันการยกเลิก</AlertDialogTitle>
                        <AlertDialogDescription>
                          คุณแน่ใจหรือไม่ที่จะยกเลิกการลงทะเบียนของ {student.nickname} ({student.name})?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <div className="my-4 space-y-4">
                        <div>
                          <label className="text-sm font-medium">เหตุผลในการยกเลิก</label>
                          <Textarea
                            placeholder="กรุณาระบุเหตุผล..."
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            className="mt-2"
                          />
                        </div>

                        {/* Refund options - only show if has invoices */}
                        {invoices.length > 0 && (
                          <div>
                            <label className="text-sm font-medium">การคืนเงิน</label>
                            <Select value={cancelRefundType} onValueChange={(v) => setCancelRefundType(v as any)}>
                              <SelectTrigger className="mt-2">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="full">
                                  คืนเต็มจำนวน ({formatCurrency(invoices[0]?.paid_amount || invoices[0]?.total_amount || 0)})
                                </SelectItem>
                                <SelectItem value="partial">คืนบางส่วน</SelectItem>
                                <SelectItem value="none">ไม่คืนเงิน</SelectItem>
                              </SelectContent>
                            </Select>

                            {cancelRefundType === 'partial' && (
                              <div className="mt-2">
                                <label className="text-xs text-gray-500">
                                  จำนวนเงินคืน (สูงสุด {formatCurrency(invoices[0]?.paid_amount || invoices[0]?.total_amount || 0)})
                                </label>
                                <Input
                                  type="number"
                                  min={0}
                                  max={invoices[0]?.paid_amount || invoices[0]?.total_amount || 0}
                                  value={cancelRefundAmount}
                                  onChange={(e) => setCancelRefundAmount(e.target.value)}
                                  placeholder="0"
                                  className="mt-1"
                                />
                              </div>
                            )}

                            {cancelRefundType !== 'none' && (
                              <p className="text-xs text-orange-600 mt-2">
                                * ระบบจะออกใบลดหนี้อัตโนมัติ
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                      <AlertDialogFooter>
                        <AlertDialogCancel>ไม่ยกเลิก</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleCancelEnrollment}
                          className="bg-red-500 hover:bg-red-600"
                          disabled={cancelling || !cancelReason.trim()}
                        >
                          {cancelling ? 'กำลังยกเลิก...' : 'ยืนยันการยกเลิก'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </PermissionGuard>
              )}
              
              {/* Delete Option - Super Admin Only */}
              <PermissionGuard requiredRole={['super_admin']}>
                <DropdownMenuSeparator />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem 
                      className="text-red-600"
                      onSelect={(e) => e.preventDefault()}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      ลบการลงทะเบียน
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>ยืนยันการลบ</AlertDialogTitle>
                      <AlertDialogDescription>
                        คุณแน่ใจหรือไม่ที่จะลบการลงทะเบียนของ {student.nickname} ({student.name})?
                        การกระทำนี้ไม่สามารถย้อนกลับได้
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleDeleteEnrollment}
                        className="bg-red-500 hover:bg-red-600"
                        disabled={deleting}
                      >
                        {deleting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            กำลังลบ...
                          </>
                        ) : (
                          'ลบการลงทะเบียน'
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </PermissionGuard>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Title */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold text-gray-900">รายละเอียดการลงทะเบียน</h1>
            <p className="text-gray-600 mt-2">วันที่ลงทะเบียน: {formatDate(enrollment.enrolledAt, 'long')}</p>
          </div>
          {(() => {
            const isUpcoming = enrollment.status === 'active' && classData?.startDate && new Date(classData.startDate) > new Date();
            return (
              <Badge className={isUpcoming ? 'bg-yellow-100 text-yellow-700' : statusColors[enrollment.status]}>
                {isUpcoming ? 'รอเริ่มเรียน' : statusLabels[enrollment.status]}
              </Badge>
            );
          })()}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Student Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                ข้อมูลนักเรียน
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">ชื่อ-นามสกุล</p>
                  <p className="font-medium">{student.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">ชื่อเล่น</p>
                  <p className="font-medium">{student.nickname}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">อายุ</p>
                  <p className="font-medium">{calculateAge(student.birthdate)} ปี</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">เพศ</p>
                  <p className="font-medium">{student.gender === 'M' ? 'ชาย' : 'หญิง'}</p>
                </div>
                {student.schoolName && (
                  <>
                    <div>
                      <p className="text-sm text-gray-500">โรงเรียน</p>
                      <p className="font-medium">{student.schoolName}</p>
                    </div>
                    {student.gradeLevel && (
                      <div>
                        <p className="text-sm text-gray-500">ระดับชั้น</p>
                        <p className="font-medium">{student.gradeLevel}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
              
              {(student.allergies || student.specialNeeds) && (
                <div className="mt-4 pt-4 border-t space-y-2">
                  {student.allergies && (
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-red-600">ประวัติการแพ้</p>
                        <p className="text-sm">{student.allergies}</p>
                      </div>
                    </div>
                  )}
                  {student.specialNeeds && (
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-orange-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-orange-600">ความต้องการพิเศษ</p>
                        <p className="text-sm">{student.specialNeeds}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Parent Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                ข้อมูลผู้ปกครอง
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">ชื่อผู้ปกครอง</p>
                  <p className="font-medium">{parent.displayName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">เบอร์โทรหลัก</p>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <p className="font-medium">{parent.phone}</p>
                  </div>
                </div>
                {parent.emergencyPhone && (
                  <div>
                    <p className="text-sm text-gray-500">เบอร์โทรฉุกเฉิน</p>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-red-400" />
                      <p className="font-medium">{parent.emergencyPhone}</p>
                    </div>
                  </div>
                )}
                {parent.email && (
                  <div>
                    <p className="text-sm text-gray-500">อีเมล</p>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <p className="font-medium">{parent.email}</p>
                    </div>
                  </div>
                )}
              </div>
              
              {parent.lineUserId && (
                <div className="mt-4 pt-4 border-t">
                  <Badge className="bg-green-100 text-green-700">
                    <img src="/line-icon.svg" alt="LINE" className="w-4 h-4 mr-1" />
                    เชื่อมต่อ LINE แล้ว
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Class Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <School className="h-5 w-5" />
                ข้อมูลคลาสเรียน
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500">ชื่อคลาส</p>
                  <p className="font-medium text-lg">{classData.name}</p>
                  <p className="text-sm text-gray-500">รหัส: {classData.code}</p>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">วิชา</p>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: subject?.color }}
                      />
                      <p className="font-medium">{subject?.name}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">ระดับ</p>
                    <p className="font-medium">{subject?.level}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">ครูผู้สอน</p>
                    <p className="font-medium">{teacher?.nickname || teacher?.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">สาขา</p>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <p className="font-medium">{branch?.name}</p>
                    </div>
                  </div>
                </div>
                
                <div className="pt-4 border-t">
                  <p className="text-sm text-gray-500 mb-2">ตารางเรียน</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span>{classData.daysOfWeek.map(d => getDayName(d)).join(', ')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <span>{classData.startTime} - {classData.endTime} น.</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      {formatDate(classData.startDate)} ถึง {formatDate(classData.endDate)}
                      <span className="ml-2">({classData.totalSessions} ครั้ง)</span>
                    </div>
                  </div>
                </div>

                {/* Makeup Classes Summary */}
                {makeupClasses.length > 0 && (
                  <div className="pt-4 border-t">
                    <p className="text-sm text-gray-500 mb-2">ประวัติ Makeup Class</p>
                    <div className="text-sm">
                      <p>จำนวน Makeup ทั้งหมด: {makeupClasses.length} ครั้ง</p>
                      <p>เสร็จสิ้นแล้ว: {makeupClasses.filter(m => m.status === 'completed').length} ครั้ง</p>
                      <p>รอนัดเรียน: {makeupClasses.filter(m => m.status === 'pending').length} ครั้ง</p>
                      <p>นัดแล้ว: {makeupClasses.filter(m => m.status === 'scheduled').length} ครั้ง</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Side Info */}
        <div className="space-y-6">
          {/* Unified Payment Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  การชำระเงิน
                </span>
                <Badge className={paymentStatusColors[enrollment.payment.status as keyof typeof paymentStatusColors] || ''}>
                  {paymentStatusLabels[enrollment.payment.status as keyof typeof paymentStatusLabels] || enrollment.payment.status}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Pricing Summary */}
              <div className="space-y-2 text-base">
                <div className="flex justify-between">
                  <span className="text-gray-500">ค่าเรียนปกติ</span>
                  <span>{formatCurrency(enrollment.pricing.originalPrice)}</span>
                </div>
                {enrollment.pricing.discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>
                      ส่วนลด
                      {enrollment.pricing.discountType === 'percentage'
                        ? ` (${enrollment.pricing.discount}%)`
                        : ''}
                    </span>
                    <span>-{formatCurrency(
                      enrollment.pricing.discountType === 'percentage'
                        ? enrollment.pricing.originalPrice * (enrollment.pricing.discount / 100)
                        : enrollment.pricing.discount
                    )}</span>
                  </div>
                )}
                {enrollment.pricing.promotionCode && (
                  <div className="text-sm text-gray-500">
                    โปรโมชั่น: <span className="font-medium">{enrollment.pricing.promotionCode}</span>
                  </div>
                )}
                <div className="pt-2 border-t flex justify-between font-semibold">
                  <span>ยอดที่ต้องชำระ</span>
                  <span>{formatCurrency(enrollment.pricing.finalPrice)}</span>
                </div>
              </div>

              {/* Invoice List */}
              {invoices.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-500">ใบเสร็จ / Invoice</p>
                  {invoices.map((inv: any) => (
                    <div key={inv.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-base">{inv.invoice_number}</span>
                          <span className="font-semibold text-base">{formatCurrency(inv.total_amount)}</span>
                        </div>
                        <p className="text-sm text-gray-500">
                          {formatDate(inv.issued_at || inv.created_at, 'short')}
                          {inv.payment_method && ` · ${paymentMethodLabels[inv.payment_method] || inv.payment_method}`}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePrintReceipt(inv.id)}
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Payment Summary */}
              <div className="pt-2 border-t space-y-1 text-base">
                <div className="flex justify-between">
                  <span className="text-gray-500">ชำระแล้ว</span>
                  <span className="text-green-600 font-medium">{formatCurrency(paymentTotalPaid)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>คงเหลือ</span>
                  <span className={paymentRemaining <= 0 ? 'text-green-600' : 'text-red-600'}>
                    {paymentRemaining <= 0 ? (
                      <span className="flex items-center gap-1">
                        <CheckCircle className="h-4 w-4" /> ชำระครบแล้ว
                      </span>
                    ) : (
                      formatCurrency(paymentRemaining)
                    )}
                  </span>
                </div>
              </div>

              {/* Add Payment Button */}
              {enrollment.payment.status !== 'paid' && enrollment.status !== 'dropped' && (
                <PermissionGuard requiredRole={['super_admin', 'branch_admin']}>
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700 text-base"
                    onClick={() => setShowAddPaymentDialog(true)}
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    รับชำระเพิ่ม
                  </Button>
                </PermissionGuard>
              )}

              {/* Credit Notes */}
              {creditNotes.length > 0 && (
                <div className="pt-2 border-t space-y-2">
                  <p className="text-sm font-medium text-red-600">ใบลดหนี้ / Credit Note</p>
                  {creditNotes.map((cn: any) => (
                    <div key={cn.id} className="flex items-center justify-between bg-red-50 rounded-lg px-3 py-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-base text-red-600">{cn.credit_note_number}</span>
                          <span className="font-semibold text-base text-red-600">-{formatCurrency(cn.refund_amount)}</span>
                        </div>
                        <p className="text-sm text-gray-500">
                          {formatDate(cn.issued_date || cn.created_at, 'short')}
                          {cn.reason && ` · ${cn.reason}`}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setPrintCNId(cn.id);
                          setShowCNPrintDialog(true);
                        }}
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Issue Credit Note Button */}
              {enrollment.status === 'dropped' && invoices.length > 0 && (
                <PermissionGuard requiredRole={['super_admin', 'branch_admin']}>
                  <Button
                    variant="outline"
                    className="w-full text-red-600 border-red-300 hover:bg-red-50 text-base"
                    onClick={() => setShowIssueCNDialog(true)}
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    ออกใบลดหนี้เพิ่ม
                  </Button>
                </PermissionGuard>
              )}
            </CardContent>
          </Card>

          {/* Status Information */}
          {enrollment.status === 'dropped' && enrollment.droppedReason && (
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="text-red-600">ข้อมูลการยกเลิก</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{enrollment.droppedReason}</p>
              </CardContent>
            </Card>
          )}
          
          {enrollment.status === 'transferred' && enrollment.transferHistory && enrollment.transferHistory.length > 0 && (
            <Card className="border-blue-200">
              <CardHeader>
                <CardTitle className="text-blue-600 flex items-center gap-2">
                  <History className="h-5 w-5" />
                  ประวัติการย้ายคลาส
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {enrollment.transferHistory.map((transfer, index) => (
                    <div key={index} className="text-sm space-y-1">
                      <p className="font-medium">ครั้งที่ {index + 1}</p>
                      <p>วันที่: {formatDate(transfer.transferredAt, 'long')}</p>
                      <p>เหตุผล: {transfer.reason}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Add Payment Dialog */}
      <AddPaymentDialog
        open={showAddPaymentDialog}
        onOpenChange={setShowAddPaymentDialog}
        enrollmentId={enrollmentId}
        remaining={paymentRemaining}
        paymentSettings={paymentSettings}
        onSubmit={handleAddPayment}
      />

      {/* Receipt Print Dialog */}
      <ReceiptPrintDialog
        open={showReceiptDialog}
        onOpenChange={setShowReceiptDialog}
        invoiceId={printInvoiceId}
      />

      {/* Issue Credit Note Dialog */}
      <IssueCreditNoteDialog
        open={showIssueCNDialog}
        onOpenChange={setShowIssueCNDialog}
        enrollmentId={enrollmentId}
        branchId={enrollment.branchId}
        invoices={invoices}
        onSuccess={(creditNoteId) => {
          setPrintCNId(creditNoteId);
          setShowCNPrintDialog(true);
          loadEnrollmentDetails(); // Reload to show new CN
        }}
      />

      {/* Credit Note Print Dialog */}
      <CreditNotePrintDialog
        open={showCNPrintDialog}
        onOpenChange={setShowCNPrintDialog}
        creditNoteId={printCNId}
      />
    </div>
  );
}