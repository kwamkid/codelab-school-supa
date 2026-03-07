// app/api/admin/enrollments/[id]/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// DELETE - Delete an enrollment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createServiceClient()
  const { id } = await params

  try {
    console.log('Deleting enrollment:', id)

    // Check if enrollment exists
    const { data: enrollment, error: fetchError } = await supabase
      .from('enrollments')
      .select('id, class_id, status')
      .eq('id', id)
      .single()

    if (fetchError || !enrollment) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลการลงทะเบียน' }, { status: 404 })
    }

    // Delete related data first (before deleting enrollment)
    // 1. Delete payment transactions
    await supabase
      .from('payment_transactions' as any)
      .delete()
      .eq('enrollment_id', id)

    // 2. Delete credit notes linked to invoices of this enrollment
    const { data: relatedInvoices } = await supabase
      .from('invoices' as any)
      .select('id')
      .eq('enrollment_id', id)

    if (relatedInvoices && relatedInvoices.length > 0) {
      const invoiceIds = relatedInvoices.map((inv: any) => inv.id)
      await supabase
        .from('credit_notes' as any)
        .delete()
        .in('original_invoice_id', invoiceIds)
    }

    // 3. Delete credit notes linked directly to enrollment
    await supabase
      .from('credit_notes' as any)
      .delete()
      .eq('enrollment_id', id)

    // 4. Delete invoices
    await supabase
      .from('invoices' as any)
      .delete()
      .eq('enrollment_id', id)

    // Delete the enrollment
    const { error: deleteError } = await supabase
      .from('enrollments')
      .delete()
      .eq('id', id)

    if (deleteError) throw deleteError

    // Decrement enrolled_count on the class if enrollment was active
    if (enrollment.status === 'active') {
      const { data: classData } = await supabase
        .from('classes')
        .select('id, enrolled_count')
        .eq('id', (enrollment as any).class_id)
        .single()

      if (classData) {
        await supabase
          .from('classes')
          .update({ enrolled_count: Math.max(0, ((classData as any).enrolled_count || 0) - 1) })
          .eq('id', (enrollment as any).class_id)
      }
    }

    console.log('Enrollment deleted successfully:', id)

    return NextResponse.json({
      success: true,
      message: 'ลบการลงทะเบียนเรียบร้อย'
    })
  } catch (error: any) {
    console.error('Error deleting enrollment:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการลบข้อมูล', details: process.env.NODE_ENV === 'development' ? error.message : undefined },
      { status: 500 }
    )
  }
}
