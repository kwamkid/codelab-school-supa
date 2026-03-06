import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST - Get multiple invoices with company and branch data (for bulk printing)
export async function POST(request: NextRequest) {
  const { ids } = await request.json()

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids array is required' }, { status: 400 })
  }

  if (ids.length > 100) {
    return NextResponse.json({ error: 'Maximum 100 invoices at a time' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Get all invoices
  const { data: invoices, error: invoicesError } = await (supabase as any)
    .from('invoices')
    .select('*')
    .in('id', ids)

  if (invoicesError) {
    return NextResponse.json({ error: invoicesError.message }, { status: 500 })
  }

  if (!invoices || invoices.length === 0) {
    return NextResponse.json({ results: [] })
  }

  // Get unique company IDs and branch IDs
  const companyIds = [...new Set(invoices.map((inv: any) => inv.invoice_company_id))]
  const branchIds = [...new Set(invoices.map((inv: any) => inv.branch_id))]

  // Fetch companies and branches in parallel
  const [companiesRes, branchesRes] = await Promise.all([
    (supabase as any)
      .from('invoice_companies')
      .select('*')
      .in('id', companyIds),
    (supabase as any)
      .from('branches')
      .select('id, name, address, phone')
      .in('id', branchIds),
  ])

  const companiesMap = new Map(
    (companiesRes.data || []).map((c: any) => [c.id, c])
  )
  const branchesMap = new Map(
    (branchesRes.data || []).map((b: any) => [b.id, b])
  )

  // Build results preserving the order of input ids
  const invoiceMap = new Map(invoices.map((inv: any) => [inv.id, inv]))
  const results = ids
    .map((id: string) => {
      const invoice = invoiceMap.get(id) as any
      if (!invoice) return null
      return {
        invoice,
        company: companiesMap.get(invoice.invoice_company_id) || null,
        branch: branchesMap.get(invoice.branch_id) || null,
      }
    })
    .filter(Boolean)

  return NextResponse.json({ results })
}
