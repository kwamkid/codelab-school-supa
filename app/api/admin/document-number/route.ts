import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/document-number
 * Generates next document number atomically via PostgreSQL RPC.
 * Body: { companyId: string, type: 'receipt' | 'tax-invoice' | 'credit-note' }
 */
export async function POST(request: NextRequest) {
  try {
    const { companyId, type } = await request.json()

    if (!companyId || !type) {
      return NextResponse.json({ error: 'companyId and type are required' }, { status: 400 })
    }

    const rpcName = {
      'receipt': 'generate_next_receipt_number',
      'tax-invoice': 'generate_next_tax_invoice_number',
      'credit-note': 'generate_next_credit_note_number',
    }[type]

    if (!rpcName) {
      return NextResponse.json({ error: `Invalid type: ${type}` }, { status: 400 })
    }

    const supabase = createServiceClient()
    const { data, error } = await (supabase as any).rpc(rpcName, { p_company_id: companyId })

    if (error) {
      console.error('RPC error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ number: data })
  } catch (err: any) {
    console.error('Error generating document number:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
