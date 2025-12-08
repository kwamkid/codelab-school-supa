import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Verify request is from admin
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

    // Check if user is admin (super_admin or branch_admin)
    const supabase = createServiceClient()
    const { data: adminUser, error: adminError } = await supabase
      .from('admin_users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (adminError || !adminUser || !['super_admin', 'branch_admin'].includes(adminUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get request body
    const { teacherId, newEmail } = await request.json()

    if (!teacherId || !newEmail) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newEmail)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    try {
      // Check if new email is already used by another user
      const { data: allUsers } = await supabaseAdmin.auth.admin.listUsers()
      const existingUser = allUsers?.users?.find(
        u => u.email?.toLowerCase() === newEmail.toLowerCase() && u.id !== teacherId
      )

      if (existingUser) {
        return NextResponse.json(
          {
            error: 'Email already exists',
            message: 'อีเมลนี้ถูกใช้งานแล้ว'
          },
          { status: 400 }
        )
      }

      // Check if teacher has auth account
      const { data: teacherAuth, error: teacherAuthError } = await supabaseAdmin.auth.admin.getUserById(teacherId)

      if (teacherAuthError || !teacherAuth?.user) {
        // User doesn't exist in Supabase Auth yet
        return NextResponse.json({
          success: false,
          needsAuthCreation: true,
          message: 'ครูยังไม่มี Supabase Auth account'
        })
      }

      // Update Supabase Auth email
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(teacherId, {
        email: newEmail,
        email_confirm: false // Reset email verification
      })

      if (updateError) {
        throw updateError
      }

      // Update teacher table email
      await supabase
        .from('teachers')
        .update({
          email: newEmail.toLowerCase(),
          updated_at: new Date().toISOString()
        })
        .eq('id', teacherId)

      // Update admin_users table email
      await supabase
        .from('admin_users')
        .update({
          email: newEmail.toLowerCase(),
          updated_at: new Date().toISOString()
        })
        .eq('id', teacherId)

      return NextResponse.json({
        success: true,
        message: 'Email updated successfully'
      })
    } catch (error: any) {
      console.error('Error updating auth:', error)

      return NextResponse.json(
        {
          error: error.message || 'Failed to update email',
          message: error.message
        },
        { status: 400 }
      )
    }
  } catch (error: any) {
    console.error('Update email error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}