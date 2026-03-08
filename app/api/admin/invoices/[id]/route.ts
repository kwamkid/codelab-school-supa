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

  // Get voided-by or replaces reference (for void+reissue chain)
  let replacedDocument = null
  if (document.replaces_id) {
    const { data: replaced } = await (supabase as any)
      .from('tax_invoices')
      .select('id, tax_invoice_number, issued_at')
      .eq('id', document.replaces_id)
      .single()
    if (replaced) {
      replacedDocument = {
        id: replaced.id,
        invoice_number: replaced.tax_invoice_number,
        issued_at: replaced.issued_at,
      }
    }
  }

  let replacementDocument = null
  if (document.voided_by_id) {
    const { data: replacement } = await (supabase as any)
      .from('tax_invoices')
      .select('id, tax_invoice_number, issued_at')
      .eq('id', document.voided_by_id)
      .single()
    if (replacement) {
      replacementDocument = {
        id: replacement.id,
        invoice_number: replacement.tax_invoice_number,
        issued_at: replacement.issued_at,
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
    replacedDocument,
    replacementDocument,
  })
}

// PUT - Void + Reissue with billing info
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createServiceClient()

  try {
    const body = await request.json()
    const { billingType, billingName, billingAddress, billingTaxId, billingCompanyBranch, createdBy } = body

    if (!billingName) {
      return NextResponse.json({ error: 'billingName is required' }, { status: 400 })
    }

    // Get original tax invoice
    const { data: original } = await (supabase as any)
      .from('tax_invoices')
      .select('*')
      .eq('id', id)
      .single()

    if (!original) {
      return NextResponse.json({ error: 'Tax invoice not found' }, { status: 404 })
    }

    if (original.status !== 'active') {
      return NextResponse.json({ error: 'Can only void active documents' }, { status: 400 })
    }

    // Generate new number
    const { data: newNumber, error: rpcError } = await (supabase as any)
      .rpc('generate_next_tax_invoice_number', { p_company_id: original.invoice_company_id })

    if (rpcError) {
      return NextResponse.json({ error: rpcError.message }, { status: 500 })
    }

    const now = new Date().toISOString()
    const lockedDate = original.original_payment_date || original.payment_date || now

    // Create replacement document
    const { data: newDoc, error: insertError } = await (supabase as any)
      .from('tax_invoices')
      .insert({
        tax_invoice_number: newNumber,
        invoice_company_id: original.invoice_company_id,
        enrollment_id: original.enrollment_id,
        branch_id: original.branch_id,
        receipt_id: null,
        billing_type: billingType || 'personal',
        billing_name: billingName,
        billing_address: billingAddress || {},
        billing_tax_id: billingTaxId || null,
        billing_company_branch: billingCompanyBranch || null,
        customer_name: original.customer_name,
        customer_phone: original.customer_phone,
        customer_email: original.customer_email,
        customer_address: original.customer_address,
        customer_tax_id: billingTaxId || null,
        items: original.items,
        subtotal: original.subtotal,
        vat_amount: original.vat_amount,
        discount_type: original.discount_type,
        discount_value: original.discount_value,
        discount_amount: original.discount_amount,
        promotion_code: original.promotion_code,
        total_amount: original.total_amount,
        payment_method: original.payment_method,
        payment_type: original.payment_type,
        paid_amount: original.paid_amount,
        payment_date: lockedDate,
        original_payment_date: lockedDate,
        replaces_id: id,
        status: 'active',
        issued_at: now,
        created_by: createdBy || null,
      })
      .select('id')
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Void the original
    await (supabase as any)
      .from('tax_invoices')
      .update({
        status: 'void',
        voided_by_id: newDoc.id,
        void_reason: 'เพิ่มข้อมูลใบกำกับภาษี',
        updated_at: now,
      })
      .eq('id', id)

    return NextResponse.json({
      success: true,
      newId: newDoc.id,
      newNumber,
      voidedId: id,
    })
  } catch (err: any) {
    console.error('Error void+reissue:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
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
