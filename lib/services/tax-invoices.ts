// lib/services/tax-invoices.ts

import { TaxInvoice } from '@/types/models';
import { getClient } from '@/lib/supabase/client';
import { adminMutation } from '@/lib/admin-mutation';

interface TaxInvoiceRow {
  id: string;
  tax_invoice_number: string;
  invoice_company_id: string;
  enrollment_id: string | null;
  branch_id: string;
  receipt_id: string | null;
  billing_type: string;
  billing_name: string;
  billing_address: any;
  billing_tax_id: string | null;
  billing_company_branch: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  customer_address: any;
  customer_tax_id: string | null;
  items: any;
  subtotal: number;
  vat_amount: number;
  discount_type: string | null;
  discount_value: number;
  discount_amount: number;
  promotion_code: string | null;
  total_amount: number;
  payment_method: string | null;
  payment_type: string | null;
  paid_amount: number;
  payment_date: string | null;
  status: string;
  issued_at: string | null;
  note: string | null;
  created_by: string | null;
  voided_by_id: string | null;
  replaces_id: string | null;
  original_payment_date: string | null;
  void_reason: string | null;
  created_at: string;
  updated_at: string;
}

function mapToTaxInvoice(row: TaxInvoiceRow): TaxInvoice {
  return {
    id: row.id,
    taxInvoiceNumber: row.tax_invoice_number,
    invoiceCompanyId: row.invoice_company_id,
    enrollmentId: row.enrollment_id || undefined,
    branchId: row.branch_id,
    receiptId: row.receipt_id || undefined,
    billingType: row.billing_type as 'personal' | 'company',
    billingName: row.billing_name,
    billingAddress: row.billing_address || undefined,
    billingTaxId: row.billing_tax_id || undefined,
    billingCompanyBranch: row.billing_company_branch || undefined,
    customerName: row.customer_name,
    customerPhone: row.customer_phone || undefined,
    customerEmail: row.customer_email || undefined,
    customerAddress: row.customer_address || undefined,
    customerTaxId: row.customer_tax_id || undefined,
    items: row.items || [],
    subtotal: row.subtotal,
    vatAmount: row.vat_amount,
    discountType: row.discount_type || undefined,
    discountValue: row.discount_value,
    discountAmount: row.discount_amount,
    promotionCode: row.promotion_code || undefined,
    totalAmount: row.total_amount,
    paymentMethod: row.payment_method || undefined,
    paymentType: row.payment_type || undefined,
    paidAmount: row.paid_amount,
    paymentDate: row.payment_date ? new Date(row.payment_date) : undefined,
    status: row.status as TaxInvoice['status'],
    issuedAt: row.issued_at ? new Date(row.issued_at) : undefined,
    note: row.note || undefined,
    createdBy: row.created_by || undefined,
    voidedById: row.voided_by_id || undefined,
    replacesId: row.replaces_id || undefined,
    originalPaymentDate: row.original_payment_date ? new Date(row.original_payment_date) : undefined,
    voidReason: row.void_reason || undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

async function generateDocumentNumber(companyId: string, type: 'receipt' | 'tax-invoice' | 'credit-note' | 'refund-note'): Promise<string> {
  const res = await fetch('/api/admin/document-number', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ companyId, type }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to generate document number');
  }
  const { number } = await res.json();
  return number;
}

export async function createTaxInvoice(data: {
  invoiceCompanyId: string;
  enrollmentId?: string;
  branchId: string;
  receiptId?: string;
  billingType: 'personal' | 'company';
  billingName: string;
  billingAddress?: Record<string, string>;
  billingTaxId?: string;
  billingCompanyBranch?: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: Record<string, string>;
  customerTaxId?: string;
  items: { description: string; studentName: string; className: string; amount: number }[];
  subtotal: number;
  vatAmount: number;
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
  const taxInvoiceNumber = await generateDocumentNumber(data.invoiceCompanyId, 'tax-invoice');

  const result = await adminMutation<{ id: string }[]>({
    table: 'tax_invoices',
    operation: 'insert',
    data: {
      tax_invoice_number: taxInvoiceNumber,
      invoice_company_id: data.invoiceCompanyId,
      enrollment_id: data.enrollmentId || null,
      branch_id: data.branchId,
      receipt_id: data.receiptId || null,
      billing_type: data.billingType,
      billing_name: data.billingName,
      billing_address: data.billingAddress || {},
      billing_tax_id: data.billingTaxId || null,
      billing_company_branch: data.billingCompanyBranch || null,
      customer_name: data.customerName,
      customer_phone: data.customerPhone || null,
      customer_email: data.customerEmail || null,
      customer_address: data.customerAddress || {},
      customer_tax_id: data.customerTaxId || null,
      items: data.items,
      subtotal: data.subtotal,
      vat_amount: data.vatAmount,
      discount_type: data.discountType || null,
      discount_value: data.discountValue || 0,
      discount_amount: data.discountAmount || 0,
      promotion_code: data.promotionCode || null,
      total_amount: data.totalAmount,
      payment_method: data.paymentMethod || null,
      payment_type: data.paymentType || null,
      paid_amount: data.paidAmount || 0,
      payment_date: new Date().toISOString(),
      status: 'active',
      issued_at: new Date().toISOString(),
      created_by: data.createdBy || null,
    },
    options: { select: 'id', single: true },
  });

  return (result as any).id;
}

export async function getTaxInvoice(id: string): Promise<TaxInvoice | null> {
  const supabase = getClient();
  const { data, error } = await (supabase as any)
    .from('tax_invoices')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data ? mapToTaxInvoice(data) : null;
}

export async function getTaxInvoices(branchId?: string, companyId?: string): Promise<TaxInvoice[]> {
  const supabase = getClient();
  let query = (supabase as any)
    .from('tax_invoices')
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
  const taxInvoices = (data || []).map(mapToTaxInvoice);

  // Batch-load linked credit notes
  const tiIds = taxInvoices.map((ti: TaxInvoice) => ti.id);
  if (tiIds.length > 0) {
    const { data: cnData } = await (supabase as any)
      .from('credit_notes')
      .select('id, credit_note_number, tax_invoice_id, refund_type, refund_amount, status')
      .in('tax_invoice_id', tiIds);

    if (cnData && cnData.length > 0) {
      const cnByTi = new Map<string, TaxInvoice['linkedCreditNotes']>();
      for (const cn of cnData) {
        const key = cn.tax_invoice_id;
        if (!cnByTi.has(key)) cnByTi.set(key, []);
        cnByTi.get(key)!.push({
          id: cn.id,
          creditNoteNumber: cn.credit_note_number,
          refundType: cn.refund_type,
          refundAmount: cn.refund_amount,
          status: cn.status,
        });
      }
      for (const ti of taxInvoices) {
        ti.linkedCreditNotes = cnByTi.get(ti.id);
      }
    }
  }

  return taxInvoices;
}

export async function getTaxInvoicesByEnrollment(enrollmentId: string): Promise<TaxInvoice[]> {
  const supabase = getClient();
  const { data, error } = await (supabase as any)
    .from('tax_invoices')
    .select('*')
    .eq('enrollment_id', enrollmentId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapToTaxInvoice);
}

export async function getTaxInvoicesByReceipt(receiptId: string): Promise<TaxInvoice[]> {
  const supabase = getClient();
  const { data, error } = await (supabase as any)
    .from('tax_invoices')
    .select('*')
    .eq('receipt_id', receiptId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapToTaxInvoice);
}

/**
 * Auto-create a combined "ใบกำกับภาษี/ใบเสร็จรับเงิน" for VAT-registered companies.
 * Billing fields are optional — customer can add them later via voidAndReissue.
 */
export async function createTaxInvoiceReceipt(data: {
  invoiceCompanyId: string;
  enrollmentId?: string;
  branchId: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: Record<string, string>;
  billingName?: string;
  billingAddress?: Record<string, string>;
  billingTaxId?: string;
  items: { description: string; studentName: string; className: string; amount: number }[];
  subtotal: number;
  vatAmount: number;
  discountType?: string;
  discountValue?: number;
  discountAmount?: number;
  totalAmount: number;
  paymentMethod?: string;
  paymentType?: string;
  paidAmount?: number;
  createdBy?: string;
}): Promise<string> {
  const taxInvoiceNumber = await generateDocumentNumber(data.invoiceCompanyId, 'tax-invoice');
  const now = new Date().toISOString();

  const result = await adminMutation<{ id: string }[]>({
    table: 'tax_invoices',
    operation: 'insert',
    data: {
      tax_invoice_number: taxInvoiceNumber,
      invoice_company_id: data.invoiceCompanyId,
      enrollment_id: data.enrollmentId || null,
      branch_id: data.branchId,
      receipt_id: null, // combined doc, not linked to a receipt
      billing_type: 'personal',
      billing_name: data.billingName || data.customerName,
      billing_address: data.billingAddress || {},
      billing_tax_id: data.billingTaxId || null,
      billing_company_branch: null,
      customer_name: data.customerName,
      customer_phone: data.customerPhone || null,
      customer_email: data.customerEmail || null,
      customer_address: data.customerAddress || {},
      customer_tax_id: null,
      items: data.items,
      subtotal: data.subtotal,
      vat_amount: data.vatAmount,
      discount_type: data.discountType || null,
      discount_value: data.discountValue || 0,
      discount_amount: data.discountAmount || 0,
      promotion_code: null,
      total_amount: data.totalAmount,
      payment_method: data.paymentMethod || null,
      payment_type: data.paymentType || null,
      paid_amount: data.paidAmount || 0,
      payment_date: now,
      original_payment_date: now, // lock the original payment date
      status: 'active',
      issued_at: now,
      created_by: data.createdBy || null,
    },
    options: { select: 'id', single: true },
  });

  return (result as any).id;
}

/**
 * Void an existing tax invoice and reissue with updated billing info.
 * The new document keeps the original payment date (locked).
 */
export async function voidAndReissueTaxInvoice(
  originalId: string,
  billingData: {
    billingType: 'personal' | 'company';
    billingName: string;
    billingAddress?: Record<string, string>;
    billingTaxId?: string;
    billingCompanyBranch?: string;
    createdBy?: string;
  }
): Promise<string> {
  // 1. Get the original document
  const original = await getTaxInvoice(originalId);
  if (!original) throw new Error('Tax invoice not found');
  if (original.status !== 'active') throw new Error('Can only void active documents');

  // 2. Generate new document number
  const newNumber = await generateDocumentNumber(original.invoiceCompanyId, 'tax-invoice');
  const now = new Date().toISOString();

  // Use the locked original payment date
  const lockedPaymentDate = original.originalPaymentDate?.toISOString() || original.paymentDate?.toISOString() || now;

  // 3. Create the new replacement document
  const result = await adminMutation<{ id: string }[]>({
    table: 'tax_invoices',
    operation: 'insert',
    data: {
      tax_invoice_number: newNumber,
      invoice_company_id: original.invoiceCompanyId,
      enrollment_id: original.enrollmentId || null,
      branch_id: original.branchId,
      receipt_id: null,
      billing_type: billingData.billingType,
      billing_name: billingData.billingName,
      billing_address: billingData.billingAddress || {},
      billing_tax_id: billingData.billingTaxId || null,
      billing_company_branch: billingData.billingCompanyBranch || null,
      customer_name: original.customerName,
      customer_phone: original.customerPhone || null,
      customer_email: original.customerEmail || null,
      customer_address: original.customerAddress || {},
      customer_tax_id: billingData.billingTaxId || null,
      items: original.items,
      subtotal: original.subtotal,
      vat_amount: original.vatAmount,
      discount_type: original.discountType || null,
      discount_value: original.discountValue || 0,
      discount_amount: original.discountAmount || 0,
      promotion_code: original.promotionCode || null,
      total_amount: original.totalAmount,
      payment_method: original.paymentMethod || null,
      payment_type: original.paymentType || null,
      paid_amount: original.paidAmount,
      payment_date: lockedPaymentDate, // locked to original
      original_payment_date: lockedPaymentDate,
      replaces_id: originalId,
      status: 'active',
      issued_at: now,
      created_by: billingData.createdBy || null,
    },
    options: { select: 'id', single: true },
  });

  const newId = (result as any).id;

  // 4. Void the original document
  await adminMutation({
    table: 'tax_invoices',
    operation: 'update',
    data: {
      status: 'void',
      voided_by_id: newId,
      void_reason: 'เพิ่มข้อมูลใบกำกับภาษี',
      updated_at: now,
    },
    match: { id: originalId },
  });

  return newId;
}
