'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { UnifiedFormData, DEFAULT_FORM_DATA, DEFAULT_STUDENT } from './enrollment-types';
import SourceSelectionStep from './steps/source-selection-step';
import ParentStudentStep from './steps/parent-student-step';
import ClassSelectionStep from './steps/class-selection-step';
import PaymentReviewStep from './steps/payment-review-step';
import { processUnifiedEnrollment } from '@/lib/services/unified-enrollment';
import { getTrialBooking, getTrialSessionsByBooking } from '@/lib/services/trial-bookings';
import { useAuth } from '@/hooks/useAuth';
import { useBranch } from '@/contexts/BranchContext';
import { useDocumentPrint } from '@/hooks/useDocumentPrint';
import PrintDialogs from '@/components/shared/print-dialogs';

const STEP_LABELS = [
  'ประเภท',
  'ผู้ปกครอง & นักเรียน',
  'เลือกคลาส',
  'ชำระเงิน',
];

export default function UnifiedEnrollmentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { adminUser } = useAuth();
  const { selectedBranchId } = useBranch();
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<UnifiedFormData>({ ...DEFAULT_FORM_DATA });
  const [submitting, setSubmitting] = useState(false);
  const submitGuardRef = useRef(false);
  const print = useDocumentPrint();
  const [successEnrollmentId, setSuccessEnrollmentId] = useState<string>('');

  // Check URL params for trial source
  useEffect(() => {
    const from = searchParams.get('from');
    const bookingId = searchParams.get('bookingId');
    const sessionId = searchParams.get('sessionId');

    if (from === 'trial' && bookingId) {
      loadTrialData(bookingId, sessionId || undefined);
    }

    // Set default branch
    if (selectedBranchId) {
      setFormData(prev => ({ ...prev, branchId: selectedBranchId }));
    }
  }, [searchParams, selectedBranchId]);

  const loadTrialData = async (bookingId: string, sessionId?: string) => {
    try {
      const booking = await getTrialBooking(bookingId);
      if (!booking) {
        toast.error('ไม่พบข้อมูลการจองทดลองเรียน');
        return;
      }

      // Load sessions separately
      const sessions = await getTrialSessionsByBooking(bookingId);
      const session = sessionId
        ? sessions.find(s => s.id === sessionId)
        : sessions.find(s => s.status === 'attended' && !s.converted) || sessions[0];

      // Find the matching student from booking
      const bookingStudent = session
        ? booking.students.find(s => s.name === session.studentName)
        : booking.students[0];

      setFormData(prev => ({
        ...prev,
        source: 'trial',
        bookingId,
        sessionId: session?.id || sessionId || undefined,
        parentPhone: booking.parentPhone,
        parentName: booking.parentName,
        parentEmail: booking.parentEmail || '',
        branchId: session?.branchId || booking.branchId || prev.branchId,
        discount: 5,
        discountType: 'percentage',
        promotionCode: 'TRIAL5',
        students: [{
          ...DEFAULT_STUDENT,
          name: bookingStudent?.name || session?.studentName || '',
          nickname: '',
          birthdate: bookingStudent?.birthdate
            ? new Date(bookingStudent.birthdate).toISOString().split('T')[0]
            : '',
          schoolName: bookingStudent?.schoolName || '',
          gradeLevel: bookingStudent?.gradeLevel || '',
        }],
      }));

      // Skip source selection step for trial
      setStep(1);
    } catch (error) {
      console.error('Error loading trial data:', error);
      toast.error('ไม่สามารถโหลดข้อมูลทดลองเรียนได้');
    }
  };

  const handleNext = () => {
    setStep(prev => Math.min(prev + 1, 3));
  };

  const handleBack = () => {
    // If from trial and at step 1, go back to trial page
    if (step === 1 && formData.source === 'trial') {
      router.back();
      return;
    }
    setStep(prev => Math.max(prev - 1, 0));
  };

  const handleSubmit = async () => {
    if (submitGuardRef.current) return;
    submitGuardRef.current = true;
    setSubmitting(true);

    try {
      const result = await processUnifiedEnrollment(
        {
          source: formData.source,
          bookingId: formData.bookingId,
          sessionId: formData.sessionId,
          parentMode: formData.parentMode,
          existingParentId: formData.existingParentId,
          parentName: formData.parentName,
          parentPhone: formData.parentPhone,
          parentEmail: formData.parentEmail || undefined,
          emergencyPhone: formData.emergencyPhone || undefined,
          address: formData.address.houseNumber ? formData.address : undefined,
          students: formData.students.map(s => ({
            mode: s.mode,
            existingStudentId: s.existingStudentId,
            name: s.name,
            nickname: s.nickname,
            birthdate: s.birthdate,
            gender: s.gender,
            schoolName: s.schoolName || undefined,
            gradeLevel: s.gradeLevel || undefined,
            allergies: s.allergies || undefined,
            specialNeeds: s.specialNeeds || undefined,
            emergencyContact: s.emergencyContact || undefined,
            emergencyContactPhone: s.emergencyContactPhone || undefined,
            classId: s.classId,
          })),
          branchId: formData.branchId,
          discount: formData.discount,
          discountType: formData.discountType,
          promotionCode: formData.promotionCode || undefined,
          paymentMethod: formData.paymentMethod,
          paymentType: formData.paymentType,
          initialPaymentAmount: formData.initialPaymentAmount || undefined,
          billingType: formData.billingType,
          billingName: formData.billingName || undefined,
          billingAddress: formData.billingAddress.houseNumber ? formData.billingAddress : undefined,
          billingTaxId: formData.taxId || undefined,
          billingCompanyBranch: formData.companyBranch || undefined,
          wantTaxInvoice: formData.wantTaxInvoice,
        },
        adminUser?.id
      );

      toast.success(
        `ลงทะเบียนสำเร็จ ${result.enrollments.length} รายการ`
      );

      // Store enrollment ID for navigation after closing receipt dialog
      const firstEnrollmentId = result.enrollments[0]?.enrollmentId;
      setSuccessEnrollmentId(firstEnrollmentId || '');

      // If invoice was created, show receipt dialog first
      if (result.invoiceId) {
        print.printReceipt(result.invoiceId);

        return; // Don't navigate yet - will navigate when dialog closes
      }

      // No invoice → navigate directly
      if (result.enrollments.length === 1) {
        router.push(`/enrollments/${firstEnrollmentId}`);
      } else {
        router.push('/enrollments');
      }
    } catch (error: any) {
      console.error('Error processing enrollment:', error);
      toast.error(error?.message || 'ไม่สามารถลงทะเบียนได้');
      submitGuardRef.current = false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleReceiptClose = () => {
    print.closeReceiptDialog();
    if (successEnrollmentId) {
      router.push(`/enrollments/${successEnrollmentId}`);
    } else {
      router.push('/enrollments');
    }
  };

  const stepProps = {
    formData,
    setFormData,
    onNext: handleNext,
    onBack: handleBack,
  };

  return (
    <div>
      {/* Step indicator */}
      <div className="mb-4">
        <div className="flex items-center justify-center gap-1">
          {STEP_LABELS.map((label, i) => (
            <div key={i} className="flex items-center">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                  i === step
                    ? 'bg-red-500 text-white'
                    : i < step
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {i < step ? '✓' : i + 1}
              </div>
              <span
                className={`ml-1 text-base hidden sm:inline ${
                  i === step ? 'text-red-600 font-medium' : 'text-gray-500'
                }`}
              >
                {label}
              </span>
              {i < STEP_LABELS.length - 1 && (
                <div className={`w-8 h-0.5 mx-1 ${i < step ? 'bg-green-500' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      {step === 0 && <SourceSelectionStep {...stepProps} />}
      {step === 1 && <ParentStudentStep {...stepProps} />}
      {step === 2 && <ClassSelectionStep {...stepProps} />}
      {step === 3 && (
        <PaymentReviewStep
          {...stepProps}
          onSubmit={handleSubmit}
          submitting={submitting}
        />
      )}
      {/* Print Dialogs (shared) */}
      <PrintDialogs print={print} onReceiptClose={handleReceiptClose} />
    </div>
  );
}
