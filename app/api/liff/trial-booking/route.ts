// app/api/liff/trial-booking/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendFBConversionInternal } from '@/lib/fb/handler'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

interface BookingRequest {
  source: 'online' | 'walkin' | 'phone'
  parentName: string
  parentPhone: string
  parentEmail?: string
  branchId: string
  students: Array<{
    name: string
    schoolName?: string
    gradeLevel?: string
    subjectInterests: string[]
  }>
  contactNote?: string
  status: string
}

export async function POST(request: NextRequest) {
  const supabase = createServiceClient()

  try {
    const body: BookingRequest = await request.json()

    // Log for debugging
    console.log('Received booking request:', body)

    // Validate required fields
    if (!body.parentName || !body.parentPhone || !body.branchId) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 })
    }

    // Validate phone format
    const phoneRegex = /^0[0-9]{8,9}$/
    const cleanPhone = body.parentPhone.replace(/[-\s]/g, '')
    if (!phoneRegex.test(cleanPhone)) {
      return NextResponse.json({ error: 'เบอร์โทรศัพท์ไม่ถูกต้อง' }, { status: 400 })
    }

    // Validate email if provided
    if (body.parentEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.parentEmail)) {
      return NextResponse.json({ error: 'รูปแบบอีเมลไม่ถูกต้อง' }, { status: 400 })
    }

    // Validate students
    if (!body.students || body.students.length === 0) {
      return NextResponse.json({ error: 'กรุณาเพิ่มข้อมูลนักเรียนอย่างน้อย 1 คน' }, { status: 400 })
    }

    for (let i = 0; i < body.students.length; i++) {
      const student = body.students[i]
      if (!student.name || !student.name.trim()) {
        return NextResponse.json({ error: `กรุณากรอกชื่อนักเรียนคนที่ ${i + 1}` }, { status: 400 })
      }
      if (!student.subjectInterests || student.subjectInterests.length === 0) {
        return NextResponse.json(
          { error: `กรุณาเลือกวิชาที่สนใจสำหรับนักเรียนคนที่ ${i + 1}` },
          { status: 400 }
        )
      }
    }

    // Verify branch exists
    const { data: branch, error: branchError } = await supabase
      .from('branches')
      .select('id, is_active')
      .eq('id', body.branchId)
      .single()

    if (branchError || !branch) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลสาขาที่เลือก' }, { status: 400 })
    }

    const branchData = branch as { id: string; is_active: boolean }
    if (!branchData.is_active) {
      return NextResponse.json({ error: 'สาขาที่เลือกไม่เปิดให้บริการ' }, { status: 400 })
    }

    // Create booking data (without students - they go in a separate table)
    const bookingData = {
      source: body.source || 'online',
      parent_name: body.parentName.trim(),
      parent_phone: cleanPhone,
      parent_email: body.parentEmail?.trim() || null,
      branch_id: body.branchId,
      status: 'new',
      contact_note: body.contactNote?.trim() || null
    }

    console.log('Creating booking with data:', bookingData)

    // Create booking
    const { data: booking, error: insertError } = await supabase
      .from('trial_bookings')
      .insert(bookingData as any)
      .select('id')
      .single()

    if (insertError || !booking) {
      console.error('Error creating booking:', insertError)
      throw insertError || new Error('Failed to create booking')
    }

    const bookingId = (booking as any).id
    console.log('Booking created successfully:', bookingId)

    // Create student records in separate table
    if (body.students && body.students.length > 0) {
      const studentsData = body.students.map(s => ({
        booking_id: bookingId,
        name: s.name.trim(),
        school_name: s.schoolName?.trim() || null,
        grade_level: s.gradeLevel || null,
        subject_interests: s.subjectInterests || []
      }))

      console.log('Creating students with data:', studentsData)

      const { error: studentsError } = await supabase
        .from('trial_booking_students')
        .insert(studentsData as any)

      if (studentsError) {
        console.error('Error creating students:', studentsError)
        // Rollback: delete the booking if students failed
        await supabase.from('trial_bookings').delete().eq('id', bookingId)
        throw studentsError
      }

      console.log('Students created successfully')
    }

    // Fire FB conversion event (await so Vercel doesn't kill the function early)
    try {
      const fbResult = await sendFBConversionInternal({
        event_type: 'trial',
        phone: cleanPhone,
        email: body.parentEmail || undefined,
        entity_id: bookingId,
        branch_id: body.branchId,
      })
      console.log('[FB CAPI] Trial booking result:', JSON.stringify(fbResult))
    } catch (fbErr) {
      console.error('[FB CAPI] Trial booking event error:', fbErr)
    }

    // Return success response
    return NextResponse.json({
      success: true,
      bookingId: bookingId,
      message: 'บันทึกการจองทดลองเรียนสำเร็จ'
    })
  } catch (error: any) {
    console.error('Error creating trial booking:', error)
    console.error('Error stack:', error.stack)

    // Handle specific errors
    if (error.message?.includes('already exists')) {
      return NextResponse.json({ error: 'มีการจองด้วยเบอร์โทรนี้แล้ว' }, { status: 400 })
    }

    return NextResponse.json(
      {
        error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    )
  }
}

// Handle other methods
export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
