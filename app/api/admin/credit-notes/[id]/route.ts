import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET - Get credit note with company and branch data (for printing)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Get credit note
  const { data: creditNote, error: cnError } = await (supabase as any)
    .from('credit_notes')
    .select('*')
    .eq('id', id)
    .single()

  if (cnError) {
    if (cnError.code === 'PGRST116') {
      return NextResponse.json({ error: 'Credit note not found' }, { status: 404 })
    }
    return NextResponse.json({ error: cnError.message }, { status: 500 })
  }

  // Get invoice company
  const { data: company } = await (supabase as any)
    .from('invoice_companies')
    .select('*')
    .eq('id', creditNote.invoice_company_id)
    .single()

  // Get branch
  const { data: branch } = await (supabase as any)
    .from('branches')
    .select('id, name, address, phone')
    .eq('id', creditNote.branch_id)
    .single()

  // Get original invoice (if referenced)
  let originalInvoice = null
  if (creditNote.original_invoice_id) {
    const { data: inv } = await (supabase as any)
      .from('invoices')
      .select('invoice_number, issued_at')
      .eq('id', creditNote.original_invoice_id)
      .single()
    originalInvoice = inv
  }

  return NextResponse.json({
    creditNote,
    company: company || null,
    branch: branch || null,
    originalInvoice: originalInvoice || null,
  })
}
