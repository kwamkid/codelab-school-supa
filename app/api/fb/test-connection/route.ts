import { NextRequest, NextResponse } from 'next/server'
import { requireSettingsManager, bearer } from '@/lib/server/admin-auth'
import { testFBConnection } from '@/lib/fb/api'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = await requireSettingsManager(bearer(request.headers.get('authorization')))
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  try {
    const { accessToken, pixelId } = await request.json()

    if (!accessToken || !pixelId) {
      return NextResponse.json(
        { success: false, message: 'กรุณาระบุ Pixel ID และ Access Token' },
        { status: 400 }
      )
    }

    const result = await testFBConnection(accessToken, pixelId)

    return NextResponse.json(result)
  } catch (error) {
    console.error('[FB] test-connection error:', error)
    return NextResponse.json(
      { success: false, message: 'เกิดข้อผิดพลาดในการทดสอบ' },
      { status: 500 }
    )
  }
}
