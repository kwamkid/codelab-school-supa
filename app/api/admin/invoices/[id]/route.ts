import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Direct PostgREST fetch
async function queryTable(table: string, params: Record<string, string>) {
  const url = new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${table}`)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  const res = await fetch(url.toString(), {
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
    },
    cache: 'no-store',
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.message || 'Query failed')
  }
  return res.json()
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Try receipts first, then tax_invoices
  let document: any = null
  let documentType: string = 'receipt'

  const { data: receipt } = await (supabase as any)
    .from('receipts')
    .select('*')
    .eq('id', id)
    .single()

  if (receipt) {
    document = { ...receipt, invoice_number: receipt.receipt_number }
    documentType = 'receipt'
  } else {
    const { data: taxInvoice } = await (supabase as any)
      .from('tax_invoices')
      .select('*')
      .eq('id', id)
      .single()

    if (taxInvoice) {
      document = { ...taxInvoice, invoice_number: taxInvoice.tax_invoice_number }
      documentType = taxInvoice.receipt_id ? 'tax-invoice' : 'tax-invoice-receipt'
    }
  }

  if (!document) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  // Get invoice company
  const { data: company } = await (supabase as any)
    .from('invoice_companies')
    .select('*')
    .eq('id', document.invoice_company_id)
    .single()

  // Get branch info
  const { data: branch } = await (supabase as any)
    .from('branches')
    .select('id, name, address, phone')
    .eq('id', document.branch_id)
    .single()

  // Get enrollment pricing
  let enrollment = null
  let paymentSnapshot: { remainingBefore: number; remainingAfter: number } | null = null

  if (document.enrollment_id) {
    const { data: enrollmentData } = await (supabase as any)
      .from('enrollments')
      .select('id, final_price, paid_amount')
      .eq('id', document.enrollment_id)
      .single()
    enrollment = enrollmentData

    if (enrollmentData?.final_price) {
      try {
        const tableName = documentType === 'receipt' ? 'receipts' : 'tax_invoices'
        const allDocs = await queryTable(tableName, {
          'select': 'id,paid_amount,created_at',
          'enrollment_id': `eq.${document.enrollment_id}`,
          'order': 'created_at.asc',
        })

        let paidBefore = 0
        for (const doc of allDocs) {
          if (doc.id === document.id) break
          paidBefore += (doc.paid_amount || 0)
        }

        const finalPrice = enrollmentData.final_price
        const thisPaid = document.paid_amount || 0
        paymentSnapshot = {
          remainingBefore: finalPrice - paidBefore,
          remainingAfter: finalPrice - paidBefore - thisPaid,
        }
      } catch (e) {
        console.error('Error computing payment snapshot:', e)
      }
    }
  }

  // Get reference receipt (for standalone tax invoices issued later)
  let referenceInvoice = null
  if (documentType === 'tax-invoice' && document.receipt_id) {
    const { data: refRec } = await (supabase as any)
      .from('receipts')
      .select('id, receipt_number, issued_at, created_at')
      .eq('id', document.receipt_id)
      .single()
    if (refRec) {
      referenceInvoice = {
        id: refRec.id,
        invoice_number: refRec.receipt_number,
        issued_at: refRec.issued_at,
        created_at: refRec.created_at,
      }
    }
  }

  return NextResponse.json({
    invoice: document,
    documentType,
    company: company || null,
    branch: branch || null,
    enrollment: enrollment || null,
    paymentSnapshot: paymentSnapshot || null,
    referenceInvoice,
  })
}

// PATCH - Fix document amounts to match paid_amount
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createServiceClient()

  try {
    // Try receipts first
    let tableName = 'receipts'
    let { data: doc, error } = await (supabase as any)
      .from('receipts')
      .select('*')
      .eq('id', id)
      .single()

    if (!doc) {
      const res = await (supabase as any)
        .from('tax_invoices')
        .select('*')
        .eq('id', id)
        .single()
      doc = res.data
      error = res.error
      tableName = 'tax_invoices'
    }

    if (error || !doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const paidAmount = doc.paid_amount || 0
    if (paidAmount <= 0 || paidAmount >= doc.total_amount) {
      return NextResponse.json({ message: 'No fix needed' })
    }

    const items = (doc.items || []).map((item: any) => ({
      ...item,
      description: item.description?.includes('มัดจำ') || item.description?.includes('ชำระค่าเรียน')
        ? item.description
        : `ชำระค่าเรียน - ${item.description}`,
      amount: (doc.items || []).length > 1
        ? Math.round(paidAmount / (doc.items || []).length)
        : paidAmount,
    }))

    const { error: updateError } = await (supabase as any)
      .from(tableName)
      .update({
        items,
        subtotal: paidAmount,
        discount_amount: 0,
        discount_value: 0,
        total_amount: paidAmount,
      })
      .eq('id', id)

    if (updateError) throw updateError

    return NextResponse.json({ success: true, message: 'Document fixed' })
  } catch (err: any) {
    console.error('Error fixing document:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
