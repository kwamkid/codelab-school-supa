import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { restSelect, restInsert, restPatch } from '@/lib/supabase/rest'

export const dynamic = 'force-dynamic'

// POST { token, accessToken }
// Called by the /invite landing page AFTER the invitee has signed in with Google.
// Verifies the Supabase session, then creates (or links) their admin_users record
// from the invitation and marks the invitation used.
export async function POST(request: NextRequest) {
  try {
    const { token, accessToken, displayName, nickname, phone } = await request.json()
    if (!token || !accessToken) {
      return NextResponse.json({ error: 'token และ session จำเป็นต้องระบุ' }, { status: 400 })
    }

    // 1. Verify the authenticated Google user from their access token
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(accessToken)
    if (authError || !user || !user.email) {
      return NextResponse.json({ error: 'ไม่พบเซสชันที่ถูกต้อง' }, { status: 401 })
    }
    const authUserId = user.id
    const emailLower = user.email.toLowerCase()
    const googleName =
      user.user_metadata?.full_name || user.user_metadata?.name || user.email

    // 2. Load + validate the invitation
    const invRows = await restSelect('admin_invitations', {
      token: `eq.${token}`,
      select: '*',
      limit: '1',
    })
    const inv = invRows?.[0]
    if (!inv) return NextResponse.json({ error: 'ไม่พบคำเชิญนี้' }, { status: 404 })
    if (inv.revoked_at) return NextResponse.json({ error: 'คำเชิญนี้ถูกยกเลิกแล้ว' }, { status: 400 })
    if (inv.used_at) return NextResponse.json({ error: 'คำเชิญนี้ถูกใช้งานไปแล้ว' }, { status: 400 })
    if (new Date(inv.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'คำเชิญนี้หมดอายุแล้ว' }, { status: 400 })
    }

    // Name/nickname/phone come from what the invitee typed on the /invite page,
    // falling back to their Google account name.
    const finalName = (displayName && String(displayName).trim()) || googleName
    const finalNickname = (nickname && String(nickname).trim()) || null
    const finalPhone = (phone && String(phone).trim()) || ''
    const permissionCols = {
      can_manage_users: inv.can_manage_users ?? false,
      can_manage_settings: inv.can_manage_settings ?? false,
      can_view_reports: inv.can_view_reports ?? false,
      can_manage_all_branches: inv.can_manage_all_branches ?? false,
    }

    // 3. If an admin_users record already exists for this email → link + activate it
    const existing = await restSelect<{ id: string }>('admin_users', {
      email: `ilike.${emailLower}`,
      select: 'id',
      limit: '1',
    })

    if (existing?.[0]) {
      await restPatch('admin_users', { id: `eq.${existing[0].id}` }, {
        auth_user_id: authUserId,
        is_active: true,
        updated_at: new Date().toISOString(),
        updated_by: inv.created_by,
      })
    } else {
      // 4. Create teacher record first when role = teacher
      let teacherId: string | null = null
      if (inv.role === 'teacher') {
        const [teacher] = await restInsert<{ id: string }>('teachers', {
          name: finalName,
          nickname: finalNickname || finalName,
          email: emailLower,
          phone: finalPhone,
          specialties: [],
          available_branches: inv.branch_ids || [],
          is_active: true,
          has_login: true,
        })
        teacherId = teacher.id
      }

      // 5. Create the admin_users record
      await restInsert('admin_users', {
        auth_user_id: authUserId,
        email: emailLower,
        display_name: finalName,
        nickname: finalNickname,
        role: inv.role,
        branch_ids: inv.branch_ids || [],
        ...permissionCols,
        teacher_id: teacherId,
        is_active: true,
        created_by: inv.created_by,
        updated_by: inv.created_by,
      })
    }

    // 6. Mark the invitation used
    await restPatch('admin_invitations', { id: `eq.${inv.id}` }, {
      used_at: new Date().toISOString(),
      used_by_email: emailLower,
      used_by_auth_id: authUserId,
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[invitations] accept error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
