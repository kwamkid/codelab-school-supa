// lib/services/receipts.ts

import { Receipt } from '@/types/models';
import { getClient } from '@/lib/supabase/client';
import { adminMutation } from '@/lib/admin-mutation';

interface ReceiptRow {
  id: string;
  receipt_number: string;
  invoice_company_id: string;
  enrollment_id: string | null;
  branch_id: string;
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
  created_at: string;
  updated_at: string;
}

function mapToReceipt(row: ReceiptRow): Receipt {
  return {
    id: row.id,
    receiptNumber: row.receipt_number,
    invoiceCompanyId: row.invoice_company_id,
    enrollmentId: row.enrollment_id || undefined,
    branchId: row.branch_id,
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
    status: row.status as Receipt['status'],
    issuedAt: row.issued_at ? new Date(row.issued_at) : undefined,
    note: row.note || undefined,
    createdBy: row.created_by || undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

async function generateDocumentNumber(companyId: string, type: 'receipt' | 'tax-invoice' | 'credit-note'): Promise<string> {
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

export async function createReceipt(data: {
  invoiceCompanyId: string;
  enrollmentId?: string;
  branchId: string;
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
  const receiptNumber = await generateDocumentNumber(data.invoiceCompanyId, 'receipt');

  const result = await adminMutation<{ id: string }[]>({
    table: 'receipts',
    operation: 'insert',
    data: {
      receipt_number: receiptNumber,
      invoice_company_id: data.invoiceCompanyId,
      enrollment_id: data.enrollmentId || null,
      branch_id: data.branchId,
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

export async function getReceipt(id: string): Promise<Receipt | null> {
  const supabase = getClient();
  const { data, error } = await (supabase as any)
    .from('receipts')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data ? mapToReceipt(data) : null;
}

export async function getReceipts(branchId?: string, companyId?: string): Promise<Receipt[]> {
  const supabase = getClient();
  let query = (supabase as any)
    .from('receipts')
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
  const receipts = (data || []).map(mapToReceipt);

  // Batch-load linked tax invoices
  const receiptIds = receipts.map((r: Receipt) => r.id);
  if (receiptIds.length > 0) {
    const { data: tiData } = await (supabase as any)
      .from('tax_invoices')
      .select('id, tax_invoice_number, receipt_id')
      .in('receipt_id', receiptIds);

    if (tiData && tiData.length > 0) {
      const tiByReceipt = new Map<string, Receipt['linkedTaxInvoices']>();
      for (const ti of tiData) {
        const key = ti.receipt_id;
        if (!tiByReceipt.has(key)) tiByReceipt.set(key, []);
        tiByReceipt.get(key)!.push({
          id: ti.id,
          taxInvoiceNumber: ti.tax_invoice_number,
        });
      }
      for (const r of receipts) {
        r.linkedTaxInvoices = tiByReceipt.get(r.id);
      }
    }
  }

  return receipts;
}

export async function getReceiptsByEnrollment(enrollmentId: string): Promise<Receipt[]> {
  const supabase = getClient();
  const { data, error } = await (supabase as any)
    .from('receipts')
    .select('*')
    .eq('enrollment_id', enrollmentId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapToReceipt);
}
