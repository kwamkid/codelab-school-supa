// app/api/liff/pending-makeup/route.ts
// Returns the number of makeup sessions still owed (status 'pending' = not yet
// scheduled) across a parent's active students, for the LIFF home alert/badge.
// Service role — LIFF users aren't Supabase-authed so makeup_classes is RLS-blocked
// for the browser anon client.

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { lineUserId } = await request.json();
    if (!lineUserId) {
      return NextResponse.json({ success: false, error: 'Missing lineUserId' }, { status: 400 });
    }

    const supabase = createServiceClient() as any;

    const { data: parent } = await supabase
      .from('parents')
      .select('id')
      .eq('line_user_id', lineUserId)
      .single();
    if (!parent) {
      return NextResponse.json({ success: true, count: 0 });
    }

    const { data: students } = await supabase
      .from('students')
      .select('id')
      .eq('parent_id', parent.id)
      .eq('is_active', true);
    const studentIds = (students || []).map((s: any) => s.id);
    if (studentIds.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }

    const { count } = await supabase
      .from('makeup_classes')
      .select('id', { count: 'exact', head: true })
      .in('student_id', studentIds)
      .eq('status', 'pending');

    return NextResponse.json({ success: true, count: count || 0 });
  } catch (error: any) {
    console.error('[liff/pending-makeup] Error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'failed', count: 0 }, { status: 500 });
  }
}
