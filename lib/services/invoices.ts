// lib/services/invoices.ts

import { Invoice } from '@/types/models';
import { getClient } from '@/lib/supabase/client';
import { adminMutation } from '@/lib/admin-mutation';
import { getInvoiceCompany } from './invoice-companies';

interface InvoiceRow {
  id: string;
  invoice_number: string;
  invoice_company_id: string;
  enrollment_id: string | null;
  branch_id: string;
  billing_type: string;
  billing_name: string;
  billing_address: any;
  billing_tax_id: string | null;
  billing_company_branch: string | null;
  want_tax_invoice: boolean;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  customer_address: any;
  customer_tax_id: string | null;
  items: any;
  subtotal: number;
  discount_type: string | null;
  discount_value: number;
  discount_amount: number;
  promotion_code: string | null;
  total_amount: number;
  payment_method: string | null;
  payment_type: string | null;
  paid_amount: number;
  status: string;
  issued_at: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

function mapToInvoice(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    invoiceCompanyId: row.invoice_company_id,
    enrollmentId: row.enrollment_id || undefined,
    branchId: row.branch_id,
    billingType: row.billing_type as 'personal' | 'company',
    billingName: row.billing_name,
    billingAddress: row.billing_address || undefined,
    billingTaxId: row.billing_tax_id || undefined,
    billingCompanyBranch: row.billing_company_branch || undefined,
    wantTaxInvoice: row.want_tax_invoice,
    customerName: row.customer_name,
    customerPhone: row.customer_phone || undefined,
    customerEmail: row.customer_email || undefined,
    customerAddress: row.customer_address || undefined,
    customerTaxId: row.customer_tax_id || undefined,
    items: row.items || [],
    subtotal: row.subtotal,
    discountType: row.discount_type || undefined,
    discountValue: row.discount_value,
    discountAmount: row.discount_amount,
    promotionCode: row.promotion_code || undefined,
    totalAmount: row.total_amount,
    paymentMethod: row.payment_method || undefined,
    paymentType: row.payment_type || undefined,
    paidAmount: row.paid_amount,
    status: row.status as Invoice['status'],
    issuedAt: row.issued_at ? new Date(row.issued_at) : undefined,
    note: row.note || undefined,
    createdBy: row.created_by || undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Get current YYMM string (CE year) in Asia/Bangkok timezone.
 */
function getCurrentYYMM(): string {
  const now = new Date();
  const bkkTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
  const yy = bkkTime.getFullYear().toString().slice(-2);
  const mm = (bkkTime.getMonth() + 1).toString().padStart(2, '0');
  return `${yy}${mm}`;
}

/**
 * Generate next invoice number for a company.
 * Format: PREFIX-YYMM-0001 (resets monthly)
 */
async function getNextInvoiceNumber(companyId: string): Promise<string> {
  const company = await getInvoiceCompany(companyId);
  if (!company) throw new Error('Invoice company not found');

  const prefix = company.invoicePrefix;
  const currentYYMM = getCurrentYYMM();

  let nextNumber: number;
  if (company.currentInvoiceMonth !== currentYYMM) {
    // เดือนใหม่ → reset counter
    nextNumber = 1;
  } else {
    nextNumber = company.nextInvoiceNumber;
  }

  const formatted = `${prefix}-${currentYYMM}-${nextNumber.toString().padStart(4, '0')}`;

  await adminMutation({
    table: 'invoice_companies',
    operation: 'update',
    data: {
      current_invoice_month: currentYYMM,
      next_invoice_number: nextNumber + 1,
      updated_at: new Date().toISOString(),
    },
    match: { id: companyId },
  });

  return formatted;
}

export async function createInvoice(data: {
  invoiceCompanyId: string;
  enrollmentId?: string;
  branchId: string;
  billingType: 'personal' | 'company';
  billingName: string;
  billingAddress?: Record<string, string>;
  billingTaxId?: string;
  billingCompanyBranch?: string;
  wantTaxInvoice?: boolean;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: Record<string, string>;
  customerTaxId?: string;
  items: { description: string; studentName: string; className: string; amount: number }[];
  subtotal: number;
  discountType?: string;
  discountValue?: number;
  discountAmount?: number;
  promotionCode?: string;
  totalAmount: number;
  paymentMethod?: string;
  paymentType?: string;
  paidAmount?: number;
  createdBy?: string;
}): Promise<string> {
  // Generate invoice number
  const invoiceNumber = await getNextInvoiceNumber(data.invoiceCompanyId);

  const result = await adminMutation<{ id: string }[]>({
    table: 'invoices',
    operation: 'insert',
    data: {
      invoice_number: invoiceNumber,
      invoice_company_id: data.invoiceCompanyId,
      enrollment_id: data.enrollmentId || null,
      branch_id: data.branchId,
      billing_type: data.billingType,
      billing_name: data.billingName,
      billing_address: data.billingAddress || {},
      billing_tax_id: data.billingTaxId || null,
      billing_company_branch: data.billingCompanyBranch || null,
      want_tax_invoice: data.wantTaxInvoice || false,
      customer_name: data.customerName,
      customer_phone: data.customerPhone || null,
      customer_email: data.customerEmail || null,
      customer_address: data.customerAddress || {},
      customer_tax_id: data.customerTaxId || null,
      items: data.items,
      subtotal: data.subtotal,
      discount_type: data.discountType || null,
      discount_value: data.discountValue || 0,
      discount_amount: data.discountAmount || 0,
      promotion_code: data.promotionCode || null,
      total_amount: data.totalAmount,
      payment_method: data.paymentMethod || null,
      payment_type: data.paymentType || null,
      paid_amount: data.paidAmount || 0,
      status: 'issued',
      issued_at: new Date().toISOString(),
      created_by: data.createdBy || null,
    },
    options: { select: 'id', single: true },
  });

  return (result as any).id;
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  const supabase = getClient();
  const { data, error } = await (supabase as any)
    .from('invoices')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data ? mapToInvoice(data) : null;
}

export async function getInvoices(branchId?: string, companyId?: string): Promise<Invoice[]> {
  const supabase = getClient();
  let query = (supabase as any)
    .from('invoices')
    .select('*')
    .order('created_at', { ascending: false });

  if (branchId) {
    query = query.eq('branch_id', branchId);
  }
  if (companyId) {
    query = query.eq('invoice_company_id', companyId);
  }

  const { data, error } = await query;
  if (error) throw error;
  const invoices = (data || []).map(mapToInvoice);

  // Batch-load linked credit notes
  const invoiceIds = invoices.map((inv: Invoice) => inv.id);
  if (invoiceIds.length > 0) {
    const { data: cnData } = await (supabase as any)
      .from('credit_notes')
      .select('id, credit_note_number, original_invoice_id, refund_type, refund_amount, status')
      .in('original_invoice_id', invoiceIds);

    if (cnData && cnData.length > 0) {
      const cnByInvoice = new Map<string, Invoice['linkedCreditNotes']>();
      for (const cn of cnData) {
        const key = cn.original_invoice_id;
        if (!cnByInvoice.has(key)) cnByInvoice.set(key, []);
        cnByInvoice.get(key)!.push({
          id: cn.id,
          creditNoteNumber: cn.credit_note_number,
          refundType: cn.refund_type,
          refundAmount: cn.refund_amount,
          status: cn.status,
        });
      }
      for (const inv of invoices) {
        inv.linkedCreditNotes = cnByInvoice.get(inv.id);
      }
    }
  }

  return invoices;
}

export async function getInvoicesByEnrollment(enrollmentId: string): Promise<Invoice[]> {
  const supabase = getClient();
  const { data, error } = await (supabase as any)
    .from('invoices')
    .select('*')
    .eq('enrollment_id', enrollmentId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapToInvoice);
}
