// Shared types for unified enrollment form

import { PaymentMethod, PaymentType, Class, Subject, Branch, Student, Parent } from '@/types/models';

export type EnrollmentSource = 'trial' | 'new' | 'existing';

export interface StudentFormData {
  mode: 'new' | 'existing';
  existingStudentId?: string;
  name: string;
  nickname: string;
  birthdate: string;
  gender: 'M' | 'F';
  schoolName: string;
  gradeLevel: string;
  allergies: string;
  specialNeeds: string;
  emergencyContact: string;
  emergencyContactPhone: string;
  // Class selection
  classId: string;
}

export interface UnifiedFormData {
  // Step 0: Source
  source: EnrollmentSource;
  bookingId?: string;
  sessionId?: string;

  // Step 1: Parent
  parentMode: 'new' | 'existing';
  existingParentId?: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  emergencyPhone: string;
  address: {
    houseNumber: string;
    street: string;
    subDistrict: string;
    district: string;
    province: string;
    postalCode: string;
  };

  // Step 2: Students
  students: StudentFormData[];

  // Step 3: Class (branch-level)
  branchId: string;

  // Step 4: Payment
  discount: number;
  discountType: 'percentage' | 'fixed';
  promotionCode: string;
  paymentMethod: PaymentMethod;
  paymentType: PaymentType;
  initialPaymentAmount: number;

  // Billing info
  billingType: 'personal' | 'company';
  billingName: string;
  billingAddress: {
    houseNumber: string;
    street: string;
    subDistrict: string;
    district: string;
    province: string;
    postalCode: string;
  };
  wantTaxInvoice: boolean;
  taxId: string;
  companyBranch: string; // สาขาบริษัท เช่น "สำนักงานใหญ่"
}

export const DEFAULT_STUDENT: StudentFormData = {
  mode: 'new',
  name: '',
  nickname: '',
  birthdate: '',
  gender: 'M',
  schoolName: '',
  gradeLevel: '',
  allergies: '',
  specialNeeds: '',
  emergencyContact: '',
  emergencyContactPhone: '',
  classId: '',
};

export const DEFAULT_FORM_DATA: UnifiedFormData = {
  source: 'new',
  parentMode: 'new',
  parentName: '',
  parentPhone: '',
  parentEmail: '',
  emergencyPhone: '',
  address: {
    houseNumber: '',
    street: '',
    subDistrict: '',
    district: '',
    province: '',
    postalCode: '',
  },
  students: [{ ...DEFAULT_STUDENT }],
  branchId: '',
  discount: 0,
  discountType: 'percentage',
  promotionCode: '',
  paymentMethod: '' as PaymentMethod,
  paymentType: '' as PaymentType,
  initialPaymentAmount: 0,
  billingType: 'personal',
  billingName: '',
  billingAddress: {
    houseNumber: '',
    street: '',
    subDistrict: '',
    district: '',
    province: '',
    postalCode: '',
  },
  wantTaxInvoice: false,
  taxId: '',
  companyBranch: '',
};

export interface StepProps {
  formData: UnifiedFormData;
  setFormData: React.Dispatch<React.SetStateAction<UnifiedFormData>>;
  onNext: () => void;
  onBack: () => void;
}
