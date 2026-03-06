import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const branchId = searchParams.get('branchId')

  if (!branchId) {
    return NextResponse.json({ error: 'branchId is required' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data, error } = await (supabase as any)
    .from('branch_payment_settings')
    .select('*')
    .eq('branch_id', branchId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // No row found — return defaults
      return NextResponse.json({
        id: '',
        branchId,
        enabledMethods: ['cash', 'bank_transfer'],
        bankAccounts: [],
        promptpayNumber: null,
        promptpayName: null,
        onlinePaymentEnabled: false,
        onlinePaymentProvider: null,
        onlinePaymentConfig: null,
      })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    id: data.id,
    branchId: data.branch_id,
    enabledMethods: data.enabled_methods || ['cash', 'bank_transfer'],
    bankAccounts: data.bank_accounts || [],
    promptpayNumber: data.promptpay_number || null,
    promptpayName: data.promptpay_name || null,
    onlinePaymentEnabled: data.online_payment_enabled,
    onlinePaymentProvider: data.online_payment_provider || null,
    onlinePaymentConfig: data.online_payment_config || null,
  })
}
