// app/api/admin/teachers/[id]/soft-delete/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log('[Soft Delete Teacher] Starting soft delete for teacher:', params.id);

  try {
    const supabase = createClient();
    const serviceClient = createServiceClient();

    // Check if user is authenticated and is super admin
    const {
      data: { user },
    } = await supabase.auth.getUser();

    console.log('[Soft Delete Teacher] User authenticated:', user?.id);

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'ไม่พบข้อมูลผู้ใช้' },
        { status: 401 }
      );
    }

    // Get admin user to check role
    console.log('[Soft Delete Teacher] Fetching admin user for:', user.id);
    const { data: adminUser, error: adminError } = await serviceClient
      .from('admin_users')
      .select('role')
      .eq('auth_user_id', user.id)
      .single();

    if (adminError || !adminUser) {
      console.error('[Soft Delete Teacher] Error fetching admin user:', adminError);
      console.error('[Soft Delete Teacher] Admin user data:', adminUser);
      return NextResponse.json(
        { success: false, message: 'ไม่สามารถตรวจสอบสิทธิ์ได้' },
        { status: 403 }
      );
    }

    console.log('[Soft Delete Teacher] Admin user role:', adminUser.role);

    // Only super admin can soft delete teachers
    if (adminUser.role !== 'super_admin') {
      return NextResponse.json(
        { success: false, message: 'เฉพาะ Super Admin เท่านั้นที่สามารถลบครูได้' },
        { status: 403 }
      );
    }

    const teacherId = params.id;

    // Check if teacher exists
    console.log('[Soft Delete Teacher] Checking if teacher exists:', teacherId);
    const { data: teacher, error: checkError } = await serviceClient
      .from('teachers')
      .select('id, name, is_active')
      .eq('id', teacherId)
      .single();

    if (checkError || !teacher) {
      console.error('[Soft Delete Teacher] Teacher not found:', checkError);
      return NextResponse.json(
        { success: false, message: 'ไม่พบข้อมูลครูผู้สอน' },
        { status: 404 }
      );
    }

    console.log('[Soft Delete Teacher] Teacher found:', teacher.name, 'is_active:', teacher.is_active);

    if (!teacher.is_active) {
      return NextResponse.json(
        { success: false, message: 'ครูผู้สอนนี้ถูกลบไปแล้ว' },
        { status: 400 }
      );
    }

    // Soft delete the teacher by setting is_active to false
    console.log('[Soft Delete Teacher] Updating teacher to is_active: false');
    const { error: updateError } = await serviceClient
      .from('teachers')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', teacherId);

    if (updateError) {
      console.error('[Soft Delete Teacher] Error soft deleting teacher:', updateError);
      console.error('[Soft Delete Teacher] Error details:', JSON.stringify(updateError, null, 2));
      return NextResponse.json(
        { success: false, message: 'เกิดข้อผิดพลาดในการลบครูผู้สอน', error: updateError.message },
        { status: 500 }
      );
    }

    console.log('[Soft Delete Teacher] Successfully soft deleted teacher:', teacher.name);
    return NextResponse.json({
      success: true,
      message: `ลบครูผู้สอน "${teacher.name}" เรียบร้อยแล้ว`,
    });
  } catch (error) {
    console.error('[Soft Delete Teacher] Caught exception:', error);
    console.error('[Soft Delete Teacher] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      {
        success: false,
        message: 'เกิดข้อผิดพลาด',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
