// app/api/admin/teachers/[id]/soft-delete/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const serviceClient = createServiceClient();

    // Check if user is authenticated and is super admin
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'ไม่พบข้อมูลผู้ใช้' },
        { status: 401 }
      );
    }

    // Get admin user to check role
    const { data: adminUser, error: adminError } = await serviceClient
      .from('admin_users')
      .select('role')
      .eq('auth_user_id', user.id)
      .single();

    if (adminError || !adminUser) {
      console.error('Error fetching admin user:', adminError);
      return NextResponse.json(
        { success: false, message: 'ไม่สามารถตรวจสอบสิทธิ์ได้' },
        { status: 403 }
      );
    }

    // Only super admin can soft delete teachers
    if (adminUser.role !== 'super_admin') {
      return NextResponse.json(
        { success: false, message: 'เฉพาะ Super Admin เท่านั้นที่สามารถลบครูได้' },
        { status: 403 }
      );
    }

    const teacherId = params.id;

    // Check if teacher exists
    const { data: teacher, error: checkError } = await serviceClient
      .from('teachers')
      .select('id, name, is_active')
      .eq('id', teacherId)
      .single();

    if (checkError || !teacher) {
      return NextResponse.json(
        { success: false, message: 'ไม่พบข้อมูลครูผู้สอน' },
        { status: 404 }
      );
    }

    if (!teacher.is_active) {
      return NextResponse.json(
        { success: false, message: 'ครูผู้สอนนี้ถูกลบไปแล้ว' },
        { status: 400 }
      );
    }

    // Soft delete the teacher by setting is_active to false
    const { error: updateError } = await serviceClient
      .from('teachers')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', teacherId);

    if (updateError) {
      console.error('Error soft deleting teacher:', updateError);
      return NextResponse.json(
        { success: false, message: 'เกิดข้อผิดพลาดในการลบครูผู้สอน' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `ลบครูผู้สอน "${teacher.name}" เรียบร้อยแล้ว`,
    });
  } catch (error) {
    console.error('Error in soft-delete teacher:', error);
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
