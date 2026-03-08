import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function postgrestFetch(table: string, query: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`PostgREST error: ${await res.text()}`);
  return res.json();
}

async function postgrestInsert(table: string, data: Record<string, any>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Insert error: ${await res.text()}`);
  return res.json();
}

/**
 * POST /api/admin/invoices/reissue
 * Re-issues documents for all enrollments with positive payment transactions.
 * Should be called AFTER running the reset migration.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();

    // Parse optional month filter (e.g., "2026-03")
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month'); // e.g., "2026-03"

    // 1. Load payment_transactions (positive amounts only = payments, not refunds)
    let txQuery = 'amount=gt.0&order=transaction_date.asc';
    if (month) {
      // Filter by month: transaction_date >= month-01 AND < next-month-01
      const [y, m] = month.split('-').map(Number);
      const from = `${month}-01`;
      const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
      txQuery += `&transaction_date=gte.${from}&transaction_date=lt.${nextMonth}`;
    }

    const transactions = await postgrestFetch(
      'payment_transactions',
      txQuery
    );

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ message: 'No payment transactions found', issued: 0 });
    }

    // 2. Group transactions by enrollment_id
    const byEnrollment = new Map<string, any[]>();
    for (const tx of transactions) {
      const eid = tx.enrollment_id;
      if (!eid) continue;
      if (!byEnrollment.has(eid)) byEnrollment.set(eid, []);
      byEnrollment.get(eid)!.push(tx);
    }

    // 3. Load all enrollments + their branches
    const enrollmentIds = [...byEnrollment.keys()];
    const enrollments = await postgrestFetch(
      'enrollments',
      `id=in.(${enrollmentIds.join(',')})&select=id,branch_id,parent_id,student_id,class_id,status`
    );

    const enrollmentMap = new Map<string, any>();
    for (const e of enrollments) {
      enrollmentMap.set(e.id, e);
    }

    // 4. Load branches (for invoice_company_id)
    const branchIds = [...new Set(enrollments.map((e: any) => e.branch_id))];
    const branches = await postgrestFetch(
      'branches',
      `id=in.(${branchIds.join(',')})&select=id,invoice_company_id,name`
    );
    const branchMap = new Map<string, any>();
    for (const b of branches) branchMap.set(b.id, b);

    // 5. Load invoice companies
    const companyIds = [...new Set(branches.map((b: any) => b.invoice_company_id).filter(Boolean))];
    if (companyIds.length === 0) {
      return NextResponse.json({ message: 'No invoice companies configured', issued: 0 });
    }
    const companies = await postgrestFetch(
      'invoice_companies',
      `id=in.(${companyIds.join(',')})&select=id,is_vat_registered`
    );
    const companyMap = new Map<string, any>();
    for (const c of companies) companyMap.set(c.id, c);

    // 6. Load parents for customer names
    const parentIds = [...new Set(enrollments.map((e: any) => e.parent_id))];
    const parents = await postgrestFetch(
      'parents',
      `id=in.(${parentIds.join(',')})&select=id,display_name,phone,email`
    );
    const parentMap = new Map<string, any>();
    for (const p of parents) parentMap.set(p.id, p);

    // 7. Load students for item descriptions
    const studentIds = [...new Set(enrollments.map((e: any) => e.student_id))];
    const students = await postgrestFetch(
      'students',
      `id=in.(${studentIds.join(',')})&select=id,name,nickname`
    );
    const studentMap = new Map<string, any>();
    for (const s of students) studentMap.set(s.id, s);

    // 8. Load classes for item descriptions
    const classIds = [...new Set(enrollments.map((e: any) => e.class_id))];
    const classes = await postgrestFetch(
      'classes',
      `id=in.(${classIds.join(',')})&select=id,name`
    );
    const classMap = new Map<string, any>();
    for (const c of classes) classMap.set(c.id, c);

    // 9. Issue documents per enrollment per payment
    let issued = 0;
    const errors: string[] = [];

    for (const [enrollmentId, txs] of byEnrollment) {
      const enrollment = enrollmentMap.get(enrollmentId);
      if (!enrollment) continue;

      const branch = branchMap.get(enrollment.branch_id);
      if (!branch?.invoice_company_id) continue;

      const company = companyMap.get(branch.invoice_company_id);
      if (!company) continue;

      const parent = parentMap.get(enrollment.parent_id);
      const student = studentMap.get(enrollment.student_id);
      const cls = classMap.get(enrollment.class_id);
      const isVat = company.is_vat_registered;

      for (const tx of txs) {
        try {
          const amount = tx.amount;
          const vatAmount = isVat ? Math.round((amount - amount / 1.07) * 100) / 100 : 0;
          const subtotal = isVat ? Math.round((amount / 1.07) * 100) / 100 : amount;
          const studentName = student?.nickname || student?.name || '';
          const className = cls?.name || '';

          // Generate document number via RPC
          const docType = isVat ? 'tax-invoice' : 'receipt';
          const { data: docNumber, error: rpcError } = await (supabase as any).rpc(
            isVat ? 'generate_next_tax_invoice_number' : 'generate_next_receipt_number',
            { p_company_id: branch.invoice_company_id }
          );

          if (rpcError) {
            errors.push(`${enrollmentId}: RPC error - ${rpcError.message}`);
            continue;
          }

          const items = [{
            description: 'ชำระค่าเรียน',
            studentName,
            className,
            amount,
          }];

          if (isVat) {
            // Create tax invoice
            await postgrestInsert('tax_invoices', {
              tax_invoice_number: docNumber,
              invoice_company_id: branch.invoice_company_id,
              enrollment_id: enrollmentId,
              branch_id: enrollment.branch_id,
              customer_name: parent?.display_name || '-',
              customer_phone: parent?.phone || null,
              customer_email: parent?.email || null,
              items,
              subtotal,
              vat_amount: vatAmount,
              discount_amount: 0,
              discount_value: 0,
              total_amount: amount,
              payment_method: tx.method || 'cash',
              payment_type: 'deposit',
              paid_amount: amount,
              payment_date: tx.transaction_date,
              original_payment_date: tx.transaction_date,
              status: 'active',
              issued_at: tx.transaction_date,
            });
          } else {
            // Create receipt
            await postgrestInsert('receipts', {
              receipt_number: docNumber,
              invoice_company_id: branch.invoice_company_id,
              enrollment_id: enrollmentId,
              branch_id: enrollment.branch_id,
              customer_name: parent?.display_name || '-',
              customer_phone: parent?.phone || null,
              customer_email: parent?.email || null,
              items,
              subtotal,
              vat_amount: vatAmount,
              discount_amount: 0,
              discount_value: 0,
              total_amount: amount,
              payment_method: tx.method || 'cash',
              payment_type: 'deposit',
              paid_amount: amount,
              payment_date: tx.transaction_date,
              status: 'active',
              issued_at: tx.transaction_date,
            });
          }

          issued++;
        } catch (err: any) {
          errors.push(`${enrollmentId}: ${err.message}`);
        }
      }
    }

    return NextResponse.json({
      message: `Re-issued ${issued} documents from ${byEnrollment.size} enrollments`,
      issued,
      totalEnrollments: byEnrollment.size,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    console.error('Error re-issuing documents:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
