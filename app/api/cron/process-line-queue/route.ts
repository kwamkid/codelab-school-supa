// app/api/cron/process-line-queue/route.ts
// Hourly safety-net: drains any pending LINE notifications (retries failures).
// Schedule on cron-job.org:  GET /api/cron/process-line-queue?secret=<CRON_SECRET>

import { NextRequest, NextResponse } from 'next/server';
import { processLineQueue } from '@/lib/supabase/services/line-queue';

export const dynamic = 'force-dynamic';

function verifySecret(request: NextRequest): boolean {
  const querySecret = request.nextUrl.searchParams.get('secret');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[Cron] CRON_SECRET not configured');
    return false;
  }
  return !!querySecret && querySecret === cronSecret;
}

export async function GET(request: NextRequest) {
  if (!verifySecret(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await processLineQueue();
    console.log('[Cron] process-line-queue:', result);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('[Cron] process-line-queue error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'failed' }, { status: 500 });
  }
}
