import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // ตรวจสอบ authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.split('Bearer ')[1]

    // Verify token with Supabase Admin
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    const {
      data: { user },
      error: authError
    } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ตรวจสอบว่าเป็น super admin
    const supabase = createServiceClient()
    const { data: adminDoc, error: adminError } = await supabase
      .from('admin_users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (adminError || !adminDoc || adminDoc.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // รับข้อมูลจาก request
    const { email, password, userData, createdBy } = await request.json()

    // สร้าง user ใน Supabase Auth
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: userData.displayName
      }
    })

    if (createError || !authData.user) {
      throw new Error(createError?.message || 'Failed to create user')
    }

    // สร้าง document ใน adminUsers
    const { error: insertError } = await supabase.from('admin_users').insert({
      id: authData.user.id,
      email: email.toLowerCase(),
      display_name: userData.displayName,
      role: userData.role || 'branch_admin',
      branch_ids: userData.branchIds || [],
      permissions: userData.permissions || {},
      is_active: userData.isActive !== false,
      created_at: new Date().toISOString(),
      created_by: createdBy,
      updated_at: new Date().toISOString(),
      updated_by: createdBy
    })

    if (insertError) {
      // Rollback: delete auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      throw insertError
    }

    return NextResponse.json({
      success: true,
      userId: authData.user.id
    })
  } catch (error: any) {
    console.error('Error creating user:', error)

    if (error.message?.includes('already')) {
      return NextResponse.json({ error: 'อีเมลนี้มีผู้ใช้งานแล้ว' }, { status: 400 })
    }

    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}