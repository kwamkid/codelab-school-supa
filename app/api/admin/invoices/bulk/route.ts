import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST - Get multiple documents with company and branch data (for bulk printing)
export async function POST(request: NextRequest) {
  const { ids } = await request.json()

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids array is required' }, { status: 400 })
  }

  if (ids.length > 100) {
    return NextResponse.json({ error: 'Maximum 100 documents at a time' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Query both tables in parallel
  const [receiptsRes, taxInvoicesRes] = await Promise.all([
    (supabase as any).from('receipts').select('*').in('id', ids),
    (supabase as any).from('tax_invoices').select('*').in('id', ids),
  ])

  const receipts = (receiptsRes.data || []).map((r: any) => ({
    ...r,
    documentType: 'receipt',
    invoice_number: r.receipt_number,
  }))
  const taxInvoices = (taxInvoicesRes.data || []).map((t: any) => ({
    ...t,
    documentType: t.receipt_id ? 'tax-invoice' : 'tax-invoice-receipt',
    invoice_number: t.tax_invoice_number,
  }))

  const allDocs = [...receipts, ...taxInvoices]

  if (allDocs.length === 0) {
    return NextResponse.json({ results: [] })
  }

  // Get unique company IDs and branch IDs
  const companyIds = [...new Set(allDocs.map((d: any) => d.invoice_company_id))]
  const branchIds = [...new Set(allDocs.map((d: any) => d.branch_id))]

  const [companiesRes, branchesRes] = await Promise.all([
    (supabase as any).from('invoice_companies').select('*').in('id', companyIds),
    (supabase as any).from('branches').select('id, name, address, phone').in('id', branchIds),
  ])

  const companiesMap = new Map(
    (companiesRes.data || []).map((c: any) => [c.id, c])
  )
  const branchesMap = new Map(
    (branchesRes.data || []).map((b: any) => [b.id, b])
  )

  // Build results preserving input order
  const docMap = new Map(allDocs.map((d: any) => [d.id, d]))
  const results = ids
    .map((id: string) => {
      const invoice = docMap.get(id) as any
      if (!invoice) return null
      return {
        invoice,
        documentType: invoice.documentType,
        company: companiesMap.get(invoice.invoice_company_id) || null,
        branch: branchesMap.get(invoice.branch_id) || null,
      }
    })
    .filter(Boolean)

  return NextResponse.json({ results })
}
