import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Helper function to generate random password
function generatePassword(length: number = 12): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%'
  let password = ''
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length))
  }
  return password
}

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

    // Check if user is super admin
    const supabase = createServiceClient()
    const { data: adminUser, error: adminError } = await supabase
      .from('admin_users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (adminError || !adminUser || adminUser.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get request body
    const { teacherIds } = await request.json()

    if (!teacherIds || !Array.isArray(teacherIds)) {
      return NextResponse.json({ error: 'Invalid teacher IDs' }, { status: 400 })
    }

    // Results tracking
    const results = {
      success: [] as string[],
      failed: [] as { id: string; error: string }[],
      skipped: [] as string[]
    }

    // Process each teacher
    for (const teacherId of teacherIds) {
      try {
        // Get teacher data
        const { data: teacherData, error: teacherError } = await supabase
          .from('teachers')
          .select('*')
          .eq('id', teacherId)
          .single()

        if (teacherError || !teacherData) {
          results.failed.push({ id: teacherId, error: 'Teacher not found' })
          continue
        }

        // Check if auth user already exists
        const { data: existingAuth } = await supabaseAdmin.auth.admin.getUserById(teacherId)
        if (existingAuth?.user) {
          // User already exists, skip
          results.skipped.push(teacherId)
          continue
        }

        // Generate temporary password
        const tempPassword = generatePassword()

        // Create Supabase Auth user
        const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: teacherData.email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            display_name: teacherData.name
          }
        })

        if (createError || !authData.user) {
          results.failed.push({
            id: teacherId,
            error: createError?.message || 'Failed to create auth user'
          })
          continue
        }

        // Update admin_users document with auth info
        await supabase
          .from('admin_users')
          .update({
            auth_created: true,
            auth_created_at: new Date().toISOString(),
            needs_password_reset: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', teacherId)

        // Log success
        console.log(`Teacher ${teacherData.name} (${teacherData.email}): Auth created`)

        results.success.push(teacherId)
      } catch (error: any) {
        console.error(`Error processing teacher ${teacherId}:`, error)
        results.failed.push({
          id: teacherId,
          error: error.message || 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      message: 'Migration completed',
      results: {
        total: teacherIds.length,
        success: results.success.length,
        failed: results.failed.length,
        skipped: results.skipped.length,
        details: results
      }
    })
  } catch (error: any) {
    console.error('Migration error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}