// lib/services/credit-notes.ts

import { CreditNote } from '@/types/models';
import { getClient } from '@/lib/supabase/client';
import { adminMutation } from '@/lib/admin-mutation';

interface CreditNoteRow {
  id: string;
  credit_note_number: string;
  invoice_company_id: string;
  tax_invoice_id: string | null;
  enrollment_id: string | null;
  branch_id: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  customer_address: any;
  customer_tax_id: string | null;
  billing_type: string;
  billing_name: string | null;
  billing_address: any;
  billing_tax_id: string | null;
  billing_company_branch: string | null;
  items: any;
  refund_amount: number;
  vat_amount: number;
  reason: string;
  refund_type: string;
  status: string;
  issued_date: string | null;
  payment_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

function mapToCreditNote(row: CreditNoteRow): CreditNote {
  return {
    id: row.id,
    creditNoteNumber: row.credit_note_number,
    invoiceCompanyId: row.invoice_company_id,
    taxInvoiceId: row.tax_invoice_id || undefined,
    enrollmentId: row.enrollment_id || undefined,
    branchId: row.branch_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone || undefined,
    customerEmail: row.customer_email || undefined,
    customerAddress: row.customer_address || undefined,
    customerTaxId: row.customer_tax_id || undefined,
    billingType: row.billing_type as 'personal' | 'company',
    billingName: row.billing_name || undefined,
    billingAddress: row.billing_address || undefined,
    billingTaxId: row.billing_tax_id || undefined,
    billingCompanyBranch: row.billing_company_branch || undefined,
    items: row.items || [],
    refundAmount: row.refund_amount,
    vatAmount: row.vat_amount,
    reason: row.reason,
    refundType: row.refund_type as 'full' | 'partial',
    status: row.status as CreditNote['status'],
    issuedDate: row.issued_date || undefined,
    paymentDate: row.payment_date ? new Date(row.payment_date) : undefined,
    createdBy: row.created_by || undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

async function getNextCreditNoteNumber(companyId: string): Promise<string> {
  const res = await fetch('/api/admin/document-number', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ companyId, type: 'credit-note' }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to generate credit note number');
  }
  const { number } = await res.json();
  return number;
}

export async function createCreditNote(data: {
  invoiceCompanyId: string;
  taxInvoiceId: string;
  enrollmentId?: string;
  branchId: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: Record<string, string>;
  customerTaxId?: string;
  billingType?: 'personal' | 'company';
  billingName?: string;
  billingAddress?: Record<string, string>;
  billingTaxId?: string;
  billingCompanyBranch?: string;
  items: { description: string; amount: number }[];
  refundAmount: number;
  vatAmount: number;
  reason: string;
  refundType: 'full' | 'partial';
  createdBy?: string;
}): Promise<string> {
  const creditNoteNumber = await getNextCreditNoteNumber(data.invoiceCompanyId);

  const result = await adminMutation<{ id: string }[]>({
    table: 'credit_notes',
    operation: 'insert',
    data: {
      credit_note_number: creditNoteNumber,
      invoice_company_id: data.invoiceCompanyId,
      tax_invoice_id: data.taxInvoiceId,
      enrollment_id: data.enrollmentId || null,
      branch_id: data.branchId,
      customer_name: data.customerName,
      customer_phone: data.customerPhone || null,
      customer_email: data.customerEmail || null,
      customer_address: data.customerAddress || {},
      customer_tax_id: data.customerTaxId || null,
      billing_type: data.billingType || 'personal',
      billing_name: data.billingName || null,
      billing_address: data.billingAddress || {},
      billing_tax_id: data.billingTaxId || null,
      billing_company_branch: data.billingCompanyBranch || null,
      items: data.items,
      refund_amount: data.refundAmount,
      vat_amount: data.vatAmount,
      reason: data.reason,
      refund_type: data.refundType,
      status: 'active',
      issued_date: new Date().toISOString().split('T')[0],
      payment_date: new Date().toISOString(),
      created_by: data.createdBy || null,
    },
    options: { select: 'id', single: true },
  });

  return (result as any).id;
}

export async function getCreditNote(id: string): Promise<CreditNote | null> {
  const supabase = getClient();
  const { data, error } = await (supabase as any)
    .from('credit_notes')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data ? mapToCreditNote(data) : null;
}

export async function getCreditNotes(branchId?: string, companyId?: string): Promise<CreditNote[]> {
  const supabase = getClient();
  let query = (supabase as any)
    .from('credit_notes')
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
  return (data || []).map(mapToCreditNote);
}

export async function getCreditNotesByEnrollment(enrollmentId: string): Promise<CreditNote[]> {
  const supabase = getClient();
  const { data, error } = await (supabase as any)
    .from('credit_notes')
    .select('*')
    .eq('enrollment_id', enrollmentId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapToCreditNote);
}

export async function getCreditNotesByTaxInvoice(taxInvoiceId: string): Promise<CreditNote[]> {
  const supabase = getClient();
  const { data, error } = await (supabase as any)
    .from('credit_notes')
    .select('*')
    .eq('tax_invoice_id', taxInvoiceId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapToCreditNote);
}
