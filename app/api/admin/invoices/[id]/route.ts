import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Get invoice
  const { data: invoice, error: invoiceError } = await (supabase as any)
    .from('invoices')
    .select('*')
    .eq('id', id)
    .single()

  if (invoiceError) {
    if (invoiceError.code === 'PGRST116') {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }
    return NextResponse.json({ error: invoiceError.message }, { status: 500 })
  }

  // Get invoice company
  const { data: company, error: companyError } = await (supabase as any)
    .from('invoice_companies')
    .select('*')
    .eq('id', invoice.invoice_company_id)
    .single()

  if (companyError && companyError.code !== 'PGRST116') {
    return NextResponse.json({ error: companyError.message }, { status: 500 })
  }

  // Get branch info
  const { data: branch, error: branchError } = await (supabase as any)
    .from('branches')
    .select('id, name, address, phone')
    .eq('id', invoice.branch_id)
    .single()

  // Get enrollment pricing (for deposit receipts)
  let enrollment = null
  if (invoice.enrollment_id) {
    const { data: enrollmentData } = await (supabase as any)
      .from('enrollments')
      .select('id, final_price')
      .eq('id', invoice.enrollment_id)
      .single()
    enrollment = enrollmentData
  }

  return NextResponse.json({
    invoice,
    company: company || null,
    branch: branch || null,
    enrollment: enrollment || null,
  })
}
