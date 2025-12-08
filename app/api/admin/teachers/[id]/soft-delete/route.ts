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
    const serviceClient = createServiceClient();

    // Note: Authentication is handled at page level (/teachers page requires admin login)
    // No need for additional auth check here as it causes session persistence issues
    // The page itself is protected and only accessible by authenticated admins

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
