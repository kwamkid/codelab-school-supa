// app/api/admin/notifications/process/route.ts
// Best-effort immediate processing of the LINE queue, triggered right after a save.
// If this is missed/fails, the hourly cron (/api/cron/process-line-queue) catches up.

import { NextRequest, NextResponse } from 'next/server';
import { requireStaff, bearer } from '@/lib/server/admin-auth';
import { processLineQueue } from '@/lib/supabase/services/line-queue';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const auth = await requireStaff(bearer(request.headers.get('authorization')));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const result = await processLineQueue();
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('[notifications/process] Error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'failed' }, { status: 500 });
  }
}
