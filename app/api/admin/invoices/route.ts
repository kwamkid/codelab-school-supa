import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Direct PostgREST fetch — Supabase JS client .eq() has bug with untyped tables
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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const enrollmentId = searchParams.get('enrollmentId')

  if (!enrollmentId) {
    return NextResponse.json({ error: 'enrollmentId is required' }, { status: 400 })
  }

  try {
    // Query both receipts and tax_invoices
    const [receipts, taxInvoices] = await Promise.all([
      queryTable('receipts', {
        'select': '*',
        'enrollment_id': `eq.${enrollmentId}`,
        'order': 'created_at.desc',
      }),
      queryTable('tax_invoices', {
        'select': '*',
        'enrollment_id': `eq.${enrollmentId}`,
        'order': 'created_at.desc',
      }),
    ])

    // Add documentType to each row
    const receiptDocs = (receipts || []).map((r: any) => ({
      ...r,
      documentType: 'receipt',
      invoice_number: r.receipt_number, // backward compat
    }))
    const taxDocs = (taxInvoices || []).map((t: any) => ({
      ...t,
      documentType: t.receipt_id ? 'tax-invoice' : 'tax-invoice-receipt',
      invoice_number: t.tax_invoice_number, // backward compat
    }))

    // Merge and sort by created_at desc
    const merged = [...receiptDocs, ...taxDocs].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    return NextResponse.json(merged)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
