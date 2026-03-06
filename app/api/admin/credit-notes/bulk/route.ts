import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST - Get multiple credit notes with company, branch, and original invoice data (for bulk printing)
export async function POST(request: NextRequest) {
  const { ids } = await request.json()

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids array is required' }, { status: 400 })
  }

  if (ids.length > 100) {
    return NextResponse.json({ error: 'Maximum 100 credit notes at a time' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Get all credit notes
  const { data: creditNotes, error: cnError } = await (supabase as any)
    .from('credit_notes')
    .select('*')
    .in('id', ids)

  if (cnError) {
    return NextResponse.json({ error: cnError.message }, { status: 500 })
  }

  if (!creditNotes || creditNotes.length === 0) {
    return NextResponse.json({ results: [] })
  }

  // Get unique company IDs, branch IDs, and original invoice IDs
  const companyIds = [...new Set(creditNotes.map((cn: any) => cn.invoice_company_id))]
  const branchIds = [...new Set(creditNotes.map((cn: any) => cn.branch_id))]
  const invoiceIds = [...new Set(
    creditNotes
      .map((cn: any) => cn.original_invoice_id)
      .filter(Boolean)
  )]

  // Fetch companies, branches, and original invoices in parallel
  const promises: Promise<any>[] = [
    (supabase as any)
      .from('invoice_companies')
      .select('*')
      .in('id', companyIds),
    (supabase as any)
      .from('branches')
      .select('id, name, address, phone')
      .in('id', branchIds),
  ]

  if (invoiceIds.length > 0) {
    promises.push(
      (supabase as any)
        .from('invoices')
        .select('id, invoice_number, issued_at')
        .in('id', invoiceIds)
    )
  }

  const [companiesRes, branchesRes, invoicesRes] = await Promise.all(promises)

  const companiesMap = new Map(
    (companiesRes.data || []).map((c: any) => [c.id, c])
  )
  const branchesMap = new Map(
    (branchesRes.data || []).map((b: any) => [b.id, b])
  )
  const invoicesMap = new Map(
    (invoicesRes?.data || []).map((inv: any) => [inv.id, inv])
  )

  // Build results preserving input order
  const cnMap = new Map(creditNotes.map((cn: any) => [cn.id, cn]))
  const results = ids
    .map((id: string) => {
      const creditNote = cnMap.get(id) as any
      if (!creditNote) return null
      return {
        creditNote,
        company: companiesMap.get(creditNote.invoice_company_id) || null,
        branch: branchesMap.get(creditNote.branch_id) || null,
        originalInvoice: creditNote.original_invoice_id
          ? invoicesMap.get(creditNote.original_invoice_id) || null
          : null,
      }
    })
    .filter(Boolean)

  return NextResponse.json({ results })
}
