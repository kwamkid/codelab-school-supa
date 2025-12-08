import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Get auth token
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

    const requestingUserId = user.id

    // Get body
    const body = await request.json()
    const { email, password, teacherData } = body

    if (!email || !password || !teacherData) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check if requesting user is admin
    const supabase = createServiceClient()
    const { data: adminUser, error: adminError } = await supabase
      .from('admin_users')
      .select('role')
      .eq('id', requestingUserId)
      .single()

    if (adminError || !adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (!['super_admin', 'branch_admin'].includes(adminUser.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Check if email already exists
    const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers()
    const emailExists = existingUser?.users?.some(u => u.email?.toLowerCase() === email.toLowerCase())

    if (emailExists) {
      return NextResponse.json({ error: 'Email already exists in authentication system' }, { status: 400 })
    }

    // Create Supabase Auth user
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: teacherData.name
      }
    })

    if (createError || !authData.user) {
      throw new Error(createError?.message || 'Failed to create user')
    }

    const teacherId = authData.user.id

    try {
      // Create teacher document
      const { error: teacherError } = await supabase.from('teachers').insert({
        id: teacherId,
        name: teacherData.name,
        email: email.toLowerCase(),
        phone: teacherData.phone || null,
        nickname: teacherData.nickname || null,
        available_branches: teacherData.availableBranches || [],
        subjects: teacherData.subjects || [],
        is_active: teacherData.isActive !== false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })

      if (teacherError) throw teacherError

      // Create adminUser document
      const { error: adminInsertError } = await supabase.from('admin_users').insert({
        id: teacherId,
        email: email.toLowerCase(),
        display_name: teacherData.name,
        role: 'teacher',
        branch_ids: teacherData.availableBranches || [],
        permissions: {
          canManageUsers: false,
          canManageSettings: false,
          canViewReports: false,
          canManageAllBranches: false
        },
        is_active: teacherData.isActive !== false,
        auth_created: true,
        created_at: new Date().toISOString(),
        created_by: requestingUserId,
        updated_at: new Date().toISOString(),
        updated_by: requestingUserId
      })

      if (adminInsertError) throw adminInsertError

      return NextResponse.json({
        success: true,
        teacherId,
        message: 'Teacher created successfully'
      })
    } catch (dbError) {
      console.error('Database error:', dbError)

      // Rollback: Delete auth user if database operations failed
      try {
        await supabaseAdmin.auth.admin.deleteUser(teacherId)
      } catch (rollbackError) {
        console.error('Rollback error:', rollbackError)
      }

      throw dbError
    }
  } catch (error: any) {
    console.error('Create teacher error:', error)

    if (error.message?.includes('already')) {
      return NextResponse.json({ error: 'อีเมลนี้มีอยู่ในระบบแล้ว' }, { status: 400 })
    }

    if (error.message?.includes('email')) {
      return NextResponse.json({ error: 'รูปแบบอีเมลไม่ถูกต้อง' }, { status: 400 })
    }

    if (error.message?.includes('password')) {
      return NextResponse.json({ error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' }, { status: 400 })
    }

    return NextResponse.json({ error: error.message || 'Failed to create teacher' }, { status: 500 })
  }
}