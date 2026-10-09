// app/api/reports/notification-logs/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getNotificationLogs, getNotificationStats } from '@/lib/services/notification-logger';
import { requireReportScope } from '@/lib/server/report-scope';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Reports = super_admin + branch_admin (logs are not branch-scoped)
  const access = await requireReportScope(request.headers.get('authorization'), null);
  if (!access.ok) return NextResponse.json({ success: false, error: access.error }, { status: access.status });

  try {
    const { searchParams } = new URL(request.url);

    const type = searchParams.get('type') || undefined;
    const status = searchParams.get('status') || undefined;
    const startDate = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : undefined;
    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')!)
      : undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');

    const offset = (page - 1) * pageSize;

    // Get logs
    const { data: logs, total } = await getNotificationLogs({
      type,
      status,
      startDate,
      endDate,
      limit: pageSize,
      offset
    });

    // Get stats
    const stats = await getNotificationStats({
      startDate,
      endDate
    });

    return NextResponse.json({
      success: true,
      logs,
      total,
      stats,
      page,
      pageSize
    });
  } catch (error) {
    console.error('Error fetching notification logs:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'เกิดข้อผิดพลาด',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
