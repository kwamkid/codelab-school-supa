// app/api/admin/reset-all-passwords/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const DEFAULT_PASSWORD = 'codel@b1432';

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();

    // Get all admin users
    const { data: adminUsers, error: fetchError } = await supabase
      .from('admin_users')
      .select('auth_user_id, email, display_name, role')
      .not('auth_user_id', 'is', null);

    if (fetchError) {
      console.error('Error fetching admin users:', fetchError);
      return NextResponse.json(
        { success: false, message: 'ไม่สามารถดึงข้อมูล admin users ได้' },
        { status: 500 }
      );
    }

    if (!adminUsers || adminUsers.length === 0) {
      return NextResponse.json(
        { success: false, message: 'ไม่พบ admin users ในระบบ' },
        { status: 404 }
      );
    }

    const results = {
      success: [] as string[],
      failed: [] as { email: string; error: string }[],
    };

    // Reset password for each user
    for (const user of adminUsers) {
      try {
        const { error: updateError } = await supabase.auth.admin.updateUserById(
          user.auth_user_id,
          {
            password: DEFAULT_PASSWORD,
          }
        );

        if (updateError) {
          console.error(`Failed to reset password for ${user.email}:`, updateError);
          results.failed.push({
            email: user.email,
            error: updateError.message,
          });
        } else {
          console.log(`Successfully reset password for ${user.email}`);
          results.success.push(user.email);
        }
      } catch (error) {
        console.error(`Exception resetting password for ${user.email}:`, error);
        results.failed.push({
          email: user.email,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `รีเซ็ตรหัสผ่านเรียบร้อย`,
      results: {
        total: adminUsers.length,
        successCount: results.success.length,
        failedCount: results.failed.length,
        successList: results.success,
        failedList: results.failed,
      },
    });
  } catch (error) {
    console.error('Error in reset-all-passwords:', error);
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
