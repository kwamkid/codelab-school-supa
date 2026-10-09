// app/api/admin/holidays/[id]/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server'
import { requireStaff, bearer } from '@/lib/server/admin-auth'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// DELETE - Delete a holiday
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaff(bearer(request.headers.get('authorization')))
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (auth.role === 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const supabase = createServiceClient()
  const { id } = await params

  try {
    console.log('Deleting holiday:', id)

    // Check if holiday exists
    const { data: holiday, error: fetchError } = await supabase
      .from('holidays')
      .select('id, name')
      .eq('id', id)
      .single()

    if (fetchError || !holiday) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลวันหยุด' }, { status: 404 })
    }

    // Delete the holiday
    const { error: deleteError } = await supabase
      .from('holidays')
      .delete()
      .eq('id', id)

    if (deleteError) throw deleteError

    console.log('Holiday deleted successfully:', id)

    return NextResponse.json({
      success: true,
      message: 'ลบวันหยุดเรียบร้อย'
    })
  } catch (error: any) {
    console.error('Error deleting holiday:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการลบข้อมูล', details: process.env.NODE_ENV === 'development' ? error.message : undefined },
      { status: 500 }
    )
  }
}
