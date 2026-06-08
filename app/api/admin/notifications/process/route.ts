// app/api/admin/notifications/process/route.ts
// Best-effort immediate processing of the LINE queue, triggered right after a save.
// If this is missed/fails, the hourly cron (/api/cron/process-line-queue) catches up.

import { NextResponse } from 'next/server';
import { processLineQueue } from '@/lib/supabase/services/line-queue';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const result = await processLineQueue();
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('[notifications/process] Error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'failed' }, { status: 500 });
  }
}
