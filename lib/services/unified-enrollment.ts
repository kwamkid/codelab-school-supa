// lib/services/unified-enrollment.ts

import { createParent, createStudent } from './parents';
import { createEnrollment, checkDuplicateEnrollment, checkAvailableSeats } from './enrollments';
import { createPaymentTransaction } from './payment-transactions';
import { updateTrialSession } from './trial-bookings';
import { PaymentMethod, PaymentType } from '@/types/models';
import { getClass } from './classes';
import { getBranch } from './branches';
import { createReceipt } from './receipts';
import { createTaxInvoice } from './tax-invoices';
import { getInvoiceCompany } from './invoice-companies';

export interface UnifiedEnrollmentData {
  // Source
  source: 'trial' | 'new' | 'existing';
  bookingId?: string;
  sessionId?: string;

  // Parent
  parentMode: 'new' | 'existing';
  existingParentId?: string;
  parentName: string;
  parentPhone: string;
  parentEmail?: string;
  emergencyPhone?: string;
  address?: {
    houseNumber: string;
    street?: string;
    subDistrict: string;
    district: string;
    province: string;
    postalCode: string;
  };

  // Students (support multiple)
  students: {
    mode: 'new' | 'existing';
    existingStudentId?: string;
    name: string;
    nickname: string;
    birthdate: string; // ISO date
    gender: 'M' | 'F';
    schoolName?: string;
    gradeLevel?: string;
    allergies?: string;
    specialNeeds?: string;
    emergencyContact?: string;
    emergencyContactPhone?: string;
    // Class selection per student
    classId: string;
  }[];

  // Pricing (shared across all students)
  branchId: string;
  discount: number;
  discountType: 'percentage' | 'fixed';
  promotionCode?: string;

  // Payment
  paymentMethod: PaymentMethod;
  paymentType: PaymentType;
  initialPaymentAmount?: number;

  // Billing
  billingType?: 'personal' | 'company';
  billingName?: string;
  billingPhone?: string;
  billingAddress?: {
    houseNumber: string;
    street: string;
    subDistrict: string;
    district: string;
    province: string;
    postalCode: string;
  };
  billingTaxId?: string;
  billingCompanyName?: string;
  billingCompanyBranch?: string;
  wantTaxInvoice?: boolean;
}

export interface UnifiedEnrollmentResult {
  parentId: string;
  enrollments: {
    studentId: string;
    enrollmentId: string;
    className: string;
  }[];
  invoiceId?: string;
}

export async function processUnifiedEnrollment(
  data: UnifiedEnrollmentData,
  adminUserId?: string
): Promise<UnifiedEnrollmentResult> {
  // 1. Handle parent
  let parentId: string;

  if (data.parentMode === 'existing' && data.existingParentId) {
    parentId = data.existingParentId;
  } else {
    // Create new parent
    parentId = await createParent({
      displayName: data.parentName,
      phone: data.parentPhone,
      email: data.parentEmail || '',
      emergencyPhone: data.emergencyPhone,
      address: data.address,
    });
  }

  const enrollments: UnifiedEnrollmentResult['enrollments'] = [];

  // 2. Process each student
  for (const studentData of data.students) {
    let studentId: string;

    if (studentData.mode === 'existing' && studentData.existingStudentId) {
      studentId = studentData.existingStudentId;
    } else {
      // Create new student
      studentId = await createStudent(parentId, {
        name: studentData.name,
        nickname: studentData.nickname,
        birthdate: new Date(studentData.birthdate),
        gender: studentData.gender,
        schoolName: studentData.schoolName,
        gradeLevel: studentData.gradeLevel,
        allergies: studentData.allergies,
        specialNeeds: studentData.specialNeeds,
        emergencyContact: studentData.emergencyContact,
        emergencyPhone: studentData.emergencyContactPhone,
        isActive: true,
      });
    }

    // 3. Validate
    const isDuplicate = await checkDuplicateEnrollment(studentId, studentData.classId);
    if (isDuplicate) {
      throw new Error(`นักเรียน ${studentData.nickname || studentData.name} ได้ลงทะเบียนในคลาสนี้แล้ว`);
    }

    const seats = await checkAvailableSeats(studentData.classId);
    if (!seats.available) {
      throw new Error(`คลาสเต็มแล้ว (${seats.currentEnrolled}/${seats.maxStudents})`);
    }

    // 4. Get class for pricing
    const classInfo = await getClass(studentData.classId);
    if (!classInfo) throw new Error('ไม่พบข้อมูลคลาส');

    const originalPrice = classInfo.pricing.totalPrice;
    let discountAmount = 0;
    if (data.discountType === 'percentage') {
      discountAmount = (originalPrice * data.discount) / 100;
    } else {
      discountAmount = data.discount;
    }
    const finalPrice = Math.max(0, originalPrice - discountAmount);

    // 5. Create enrollment
    const enrollmentId = await createEnrollment({
      studentId,
      classId: studentData.classId,
      parentId,
      branchId: data.branchId,
      status: 'active',
      pricing: {
        originalPrice,
        discount: data.discount,
        discountType: data.discountType,
        finalPrice,
        promotionCode: data.promotionCode,
      },
      payment: {
        method: data.paymentMethod,
        type: data.paymentType,
        status: 'pending',
        paidAmount: 0,
      },
    });

    // 6. Create initial payment transaction if amount > 0
    if (data.initialPaymentAmount && data.initialPaymentAmount > 0) {
      await createPaymentTransaction({
        enrollmentId,
        amount: data.initialPaymentAmount,
        method: data.paymentMethod,
        transactionDate: new Date(),
        recordedBy: adminUserId,
      });
    }

    enrollments.push({
      studentId,
      enrollmentId,
      className: classInfo.name,
    });
  }

  // 7. Create receipt or tax invoice if branch has invoice company
  let invoiceId: string | undefined;
  try {
    const branchData = await getBranch(data.branchId);
    if (branchData?.invoiceCompanyId) {
      const invoiceCompany = await getInvoiceCompany(branchData.invoiceCompanyId);
      const isVat = invoiceCompany?.isVatRegistered || false;

      const isFullPayment = data.paymentType === 'full';
      const paidAmount = data.initialPaymentAmount || 0;

      let invoiceItems: { description: string; studentName: string; className: string; amount: number }[];
      let subtotal: number;
      let discountAmount: number;
      let totalAmount: number;

      // Calculate full price for comparison
      let fullPrice = 0;
      if (isFullPayment) {
        const tempItems: number[] = [];
        for (const enrollment of enrollments) {
          const classInfo = await getClass(
            data.students.find(s =>
              (s.mode === 'existing' ? s.existingStudentId === enrollment.studentId : true)
            )?.classId || ''
          );
          tempItems.push(classInfo?.pricing.totalPrice || 0);
        }
        const tempSubtotal = tempItems.reduce((sum, a) => sum + a, 0);
        const tempDiscount = data.discountType === 'percentage'
          ? (tempSubtotal * data.discount) / 100
          : data.discount;
        fullPrice = Math.max(0, tempSubtotal - tempDiscount);
      }

      // Full payment AND actually paying the full amount → show full price with discount detail
      if (isFullPayment && paidAmount >= fullPrice && fullPrice > 0) {
        invoiceItems = [];
        for (const enrollment of enrollments) {
          const classInfo = await getClass(
            data.students.find(s =>
              (s.mode === 'existing' ? s.existingStudentId === enrollment.studentId : true)
            )?.classId || ''
          );
          invoiceItems.push({
            description: classInfo?.name || enrollment.className,
            studentName: data.students.find(s =>
              (s.mode === 'existing' ? s.existingStudentId === enrollment.studentId : true)
            )?.nickname || data.students[0]?.name || '',
            className: enrollment.className,
            amount: classInfo?.pricing.totalPrice || 0,
          });
        }
        subtotal = invoiceItems.reduce((sum, item) => sum + item.amount, 0);
        if (data.discountType === 'percentage') {
          discountAmount = (subtotal * data.discount) / 100;
        } else {
          discountAmount = data.discount;
        }
        totalAmount = Math.max(0, subtotal - discountAmount);
      } else {
        // Partial payment / Deposit / Installment → invoice = actual paid amount only
        const paymentLabel = isFullPayment
          ? 'ชำระค่าเรียน'
          : data.paymentType === 'deposit' ? 'มัดจำค่าเรียน' : 'ค่าเรียนงวดแรก';
        invoiceItems = [];
        for (const enrollment of enrollments) {
          const classInfo = await getClass(
            data.students.find(s =>
              (s.mode === 'existing' ? s.existingStudentId === enrollment.studentId : true)
            )?.classId || ''
          );
          invoiceItems.push({
            description: `${paymentLabel} - ${classInfo?.name || enrollment.className}`,
            studentName: data.students.find(s =>
              (s.mode === 'existing' ? s.existingStudentId === enrollment.studentId : true)
            )?.nickname || data.students[0]?.name || '',
            className: enrollment.className,
            amount: enrollments.length > 1
              ? Math.round(paidAmount / enrollments.length)
              : paidAmount,
          });
        }
        subtotal = paidAmount;
        discountAmount = 0;
        totalAmount = paidAmount;
      }

      // Compute VAT: vat_amount = total - (total / 1.07) for VAT companies
      const vatAmount = isVat ? Math.round((totalAmount - totalAmount / 1.07) * 100) / 100 : 0;
      const netSubtotal = isVat ? Math.round((totalAmount / 1.07) * 100) / 100 : totalAmount;

      const commonData = {
        invoiceCompanyId: branchData.invoiceCompanyId,
        enrollmentId: enrollments.length === 1 ? enrollments[0].enrollmentId : undefined,
        branchId: data.branchId,
        customerName: data.billingName || data.parentName,
        customerPhone: data.billingPhone || data.parentPhone,
        customerEmail: data.parentEmail,
        customerAddress: data.billingAddress as any,
        customerTaxId: data.billingTaxId,
        items: invoiceItems,
        subtotal: netSubtotal,
        vatAmount,
        discountType: isFullPayment ? data.discountType : undefined,
        discountValue: isFullPayment ? data.discount : 0,
        discountAmount,
        promotionCode: isFullPayment ? data.promotionCode : undefined,
        totalAmount,
        paymentMethod: data.paymentMethod,
        paymentType: data.paymentType,
        paidAmount,
        createdBy: adminUserId,
      };

      if (data.wantTaxInvoice) {
        // ขอใบกำกับภาษีตอนจ่าย → สร้าง tax_invoice เท่านั้น (ใบกำกับภาษี/ใบเสร็จ)
        invoiceId = await createTaxInvoice({
          ...commonData,
          billingType: data.billingType || 'personal',
          billingName: data.billingCompanyName || data.billingName || data.parentName,
          billingAddress: data.billingAddress as any,
          billingTaxId: data.billingTaxId,
          billingCompanyName: data.billingCompanyName,
          billingCompanyBranch: data.billingCompanyBranch,
        });
      } else {
        // ไม่ขอใบกำกับ → สร้าง receipt
        invoiceId = await createReceipt(commonData);
      }
    }
  } catch (error) {
    console.error('Error creating document:', error);
    // Non-blocking - enrollment was already created successfully
  }

  // 8. Update trial session if from trial
  // updateTrialSession auto-triggers checkAndUpdateBookingStatus when converted=true
  if (data.source === 'trial' && data.bookingId && data.sessionId) {
    try {
      const classInfo = await getClass(data.students[0].classId);
      await updateTrialSession(data.sessionId, {
        converted: true,
        convertedToClassId: data.students[0].classId,
        conversionNote: classInfo?.name || '',
      });
    } catch (error) {
      console.error('Error updating trial session:', error);
      // Non-blocking - enrollment was already created successfully
    }
  }

  // 9. Send FB Conversion event (Purchase) via API route
  try {
    fetch('/api/fb/send-conversion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: 'purchase',
        phone: data.parentPhone,
        email: data.parentEmail,
        member_id: parentId,
        entity_id: enrollments[0]?.enrollmentId || parentId,
        branch_id: data.branchId,
        custom_data: {
          value: data.initialPaymentAmount || 0,
          currency: 'THB',
          content_name: data.students.map(s => s.name).join(', '),
        },
      }),
    }).catch(err => console.error('Error sending FB conversion:', err));
  } catch (error) {
    console.error('Error sending FB conversion:', error);
  }

  return { parentId, enrollments, invoiceId };
}
