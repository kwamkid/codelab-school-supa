// lib/services/invoice-companies.ts

import { InvoiceCompany } from '@/types/models';
import { getClient } from '@/lib/supabase/client';
import { adminMutation } from '@/lib/admin-mutation';

interface InvoiceCompanyRow {
  id: string;
  name: string;
  tax_id: string | null;
  address: any;
  branch_label: string | null;
  phone: string | null;
  email: string | null;
  invoice_prefix: string;
  next_invoice_number: number;
  tax_invoice_prefix: string;
  next_tax_invoice_number: number;
  current_tax_invoice_month: string;
  credit_note_prefix: string;
  next_credit_note_number: number;
  current_invoice_month: string;
  current_credit_note_month: string;
  is_vat_registered: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function mapToCompany(row: InvoiceCompanyRow): InvoiceCompany {
  return {
    id: row.id,
    name: row.name,
    taxId: row.tax_id || undefined,
    address: row.address || undefined,
    branchLabel: row.branch_label || 'สำนักงานใหญ่',
    phone: row.phone || undefined,
    email: row.email || undefined,
    invoicePrefix: row.invoice_prefix,
    nextInvoiceNumber: row.next_invoice_number,
    taxInvoicePrefix: row.tax_invoice_prefix || 'TAX',
    nextTaxInvoiceNumber: row.next_tax_invoice_number || 1,
    currentTaxInvoiceMonth: row.current_tax_invoice_month || '',
    creditNotePrefix: row.credit_note_prefix || 'CN',
    nextCreditNoteNumber: row.next_credit_note_number || 1,
    currentInvoiceMonth: row.current_invoice_month || '',
    currentCreditNoteMonth: row.current_credit_note_month || '',
    isVatRegistered: row.is_vat_registered,
    isActive: row.is_active,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export async function getInvoiceCompanies(): Promise<InvoiceCompany[]> {
  const supabase = getClient();
  const { data, error } = await (supabase as any)
    .from('invoice_companies')
    .select('*')
    .order('name');

  if (error) throw error;
  return (data || []).map(mapToCompany);
}

export async function getInvoiceCompany(id: string): Promise<InvoiceCompany | null> {
  const supabase = getClient();
  const { data, error } = await (supabase as any)
    .from('invoice_companies')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data ? mapToCompany(data) : null;
}

export async function createInvoiceCompany(data: {
  name: string;
  taxId?: string;
  address?: Record<string, string>;
  branchLabel?: string;
  phone?: string;
  email?: string;
  invoicePrefix?: string;
  taxInvoicePrefix?: string;
  isVatRegistered?: boolean;
}): Promise<string> {
  const result = await adminMutation<{ id: string }[]>({
    table: 'invoice_companies',
    operation: 'insert',
    data: {
      name: data.name,
      tax_id: data.taxId || null,
      address: data.address || {},
      branch_label: data.branchLabel || 'สำนักงานใหญ่',
      phone: data.phone || null,
      email: data.email || null,
      invoice_prefix: data.invoicePrefix || 'INV',
      tax_invoice_prefix: data.taxInvoicePrefix || 'TAX',
      is_vat_registered: data.isVatRegistered || false,
    },
    options: { select: 'id', single: true },
  });

  return (result as any).id;
}

export async function updateInvoiceCompany(
  id: string,
  data: Partial<Omit<InvoiceCompany, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  const updateData: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.taxId !== undefined) updateData.tax_id = data.taxId || null;
  if (data.address !== undefined) updateData.address = data.address || {};
  if (data.branchLabel !== undefined) updateData.branch_label = data.branchLabel;
  if (data.phone !== undefined) updateData.phone = data.phone || null;
  if (data.email !== undefined) updateData.email = data.email || null;
  if (data.invoicePrefix !== undefined) updateData.invoice_prefix = data.invoicePrefix;
  if (data.taxInvoicePrefix !== undefined) updateData.tax_invoice_prefix = data.taxInvoicePrefix;
  if (data.isVatRegistered !== undefined) updateData.is_vat_registered = data.isVatRegistered;
  if (data.isActive !== undefined) updateData.is_active = data.isActive;

  await adminMutation({
    table: 'invoice_companies',
    operation: 'update',
    data: updateData,
    match: { id },
  });
}
