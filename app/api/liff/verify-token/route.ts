// app/api/liff/verify-token/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { verifyLinkToken } from '@/lib/supabase/services/link-tokens'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, phone } = body

    if (!token || !phone) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify token and phone
    const result = await verifyLinkToken(token, phone)

    if (!result.valid) {
      const errorMessages: Record<string, string> = {
        token_not_found: 'ลิงก์ไม่ถูกต้อง',
        token_used: 'ลิงก์นี้ถูกใช้แล้ว',
        token_expired: 'ลิงก์หมดอายุ กรุณาขอใหม่',
        parent_not_found: 'ไม่พบข้อมูลผู้ปกครอง',
        already_linked: 'บัญชีนี้เชื่อมต่อ LINE แล้ว',
        phone_not_match: 'เบอร์โทรไม่ตรงกับที่ลงทะเบียนไว้',
        system_error: 'เกิดข้อผิดพลาดในระบบ'
      }

      return NextResponse.json(
        {
          error: errorMessages[result.error || 'system_error'],
          errorCode: result.error
        },
        { status: 400 }
      )
    }

    // Return parent data without sensitive info
    return NextResponse.json({
      valid: true,
      parent: {
        id: result.parent.id,
        displayName: result.parent.display_name,
        phone: result.parent.phone,
        students: result.parent.students?.map((s: any) => ({
          id: s.id,
          name: s.name,
          nickname: s.nickname
        }))
      },
      tokenId: result.tokenDoc?.id
    })
  } catch (error) {
    console.error('Error verifying token:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
