// app/api/admin/link-test/route.ts
//
// TEST-ONLY sandbox for the LINE parent-linking flow. Creates a throwaway parent
// + link token so the flow can be exercised end-to-end without touching real
// parent rows, then reports link status and cleans up afterwards.
//
// Every row it touches is scoped by the TEST_PREFIX display_name, so cleanup can
// never delete a real parent. Delete this file once linking is verified in prod.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { generateLinkToken } from '@/lib/supabase/services/link-tokens'

export const dynamic = 'force-dynamic'

// Test rows are identified solely by this prefix. Cleanup only ever deletes rows
// whose display_name starts with it.
const TEST_PREFIX = '[LINKTEST] '

export async function POST(request: NextRequest) {
  try {
    const { action, name, phone, parentId } = await request.json()
    const supabase = createServiceClient()

    // --- create a throwaway parent + token, return the LIFF deep link ---
    if (action === 'create') {
      if (!name || !phone) {
        return NextResponse.json({ error: 'ต้องใส่ชื่อและเบอร์โทร' }, { status: 400 })
      }

      const cleanPhone = String(phone).replace(/\D/g, '')
      if (cleanPhone.length < 9) {
        return NextResponse.json({ error: 'เบอร์โทรไม่ถูกต้อง' }, { status: 400 })
      }

      // Guard: never shadow a real parent's phone, or verifyLinkToken could match
      // the wrong row and the test would link a real account.
      const { data: existing } = await supabase
        .from('parents')
        .select('id, display_name')
        .eq('phone', cleanPhone)
        .maybeSingle()

      if (existing) {
        return NextResponse.json(
          {
            error: `เบอร์ ${cleanPhone} มีอยู่ในระบบแล้ว (${existing.display_name}) — กรุณาใช้เบอร์สมมติที่ไม่ซ้ำ เช่น 099-000-0001`,
          },
          { status: 400 }
        )
      }

      const { data: created, error } = await supabase
        .from('parents')
        .insert({
          display_name: `${TEST_PREFIX}${name}`,
          phone: cleanPhone,
        })
        .select('id, display_name, phone')
        .single()

      if (error || !created) {
        console.error('[link-test] insert failed:', error)
        return NextResponse.json({ error: 'สร้างผู้ปกครองทดสอบไม่สำเร็จ' }, { status: 500 })
      }

      const token = await generateLinkToken(created.id)
      const liffId = process.env.NEXT_PUBLIC_LIFF_ID || '2007575627-GmKBZJdo'

      return NextResponse.json({
        success: true,
        parent: created,
        token,
        // Same deep-link form the real QR uses.
        linkUrl: `https://liff.line.me/${liffId}/link-account?token=${token}`,
      })
    }

    // --- poll: did the scan actually write the LINE id onto the parent row? ---
    if (action === 'status') {
      if (!parentId) {
        return NextResponse.json({ error: 'Missing parentId' }, { status: 400 })
      }

      const { data: parent } = await supabase
        .from('parents')
        .select('id, display_name, phone, line_user_id, line_display_name, picture_url')
        .eq('id', parentId)
        .single()

      if (!parent) {
        return NextResponse.json({ error: 'ไม่พบผู้ปกครองทดสอบ' }, { status: 404 })
      }

      // Verify the chat_contacts side-effect too — linkParentToLine also adopts a
      // matching contact, which is easy to regress silently.
      let contactLinked = false
      if (parent.line_user_id) {
        const { data: contact } = await (supabase as any)
          .from('chat_contacts')
          .select('id, parent_id')
          .eq('platform_user_id', parent.line_user_id)
          .maybeSingle()
        contactLinked = !!contact && contact.parent_id === parent.id
      }

      return NextResponse.json({
        success: true,
        linked: !!parent.line_user_id,
        parent,
        contactLinked,
      })
    }

    // --- cleanup: remove every test parent (+ their tokens) ---
    if (action === 'cleanup') {
      const { data: testParents } = await supabase
        .from('parents')
        .select('id, display_name')
        .like('display_name', `${TEST_PREFIX}%`)

      const ids = (testParents || []).map((p) => p.id)
      if (ids.length === 0) {
        return NextResponse.json({ success: true, deleted: 0 })
      }

      // Tokens first — they FK to parents.
      await supabase.from('link_tokens').delete().in('parent_id', ids)
      // Detach any chat contacts so deleting the parent can't orphan/block them.
      await (supabase as any)
        .from('chat_contacts')
        .update({ parent_id: null })
        .in('parent_id', ids)

      const { error: delErr } = await supabase.from('parents').delete().in('id', ids)
      if (delErr) {
        console.error('[link-test] cleanup failed:', delErr)
        return NextResponse.json({ error: 'ลบข้อมูลทดสอบไม่สำเร็จ' }, { status: 500 })
      }

      return NextResponse.json({ success: true, deleted: ids.length })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('[link-test] error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}
