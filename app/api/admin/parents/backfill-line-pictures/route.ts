import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getLineSettings } from '@/lib/supabase/services/line-settings';

// One-off / re-runnable backfill: for parents linked to LINE but missing a
// picture_url, fetch their LINE profile picture via the Messaging API and store
// it. Covers people who registered through LIFF and never chatted (so they have
// no chat_contacts row to mirror from). Safe to re-run — only fills blanks.
// GET is allowed too so it can be triggered by just opening the URL once.
export async function GET() {
  return runBackfill();
}

export async function POST() {
  return runBackfill();
}

async function runBackfill() {
  try {
    const supabase = createServiceClient();
    const settings = await getLineSettings();
    const accessToken = settings.messagingChannelAccessToken;
    if (!accessToken) {
      return NextResponse.json({ error: 'No LINE messaging access token configured' }, { status: 400 });
    }

    const { data: parents, error } = await supabase
      .from('parents')
      .select('id, display_name, line_user_id')
      .not('line_user_id', 'is', null)
      .or('picture_url.is.null,picture_url.eq.')
      .returns<{ id: string; display_name: string; line_user_id: string }[]>();

    if (error) throw error;

    const results: { name: string; status: string }[] = [];
    let updated = 0;

    for (const p of parents || []) {
      try {
        const res = await fetch(`https://api.line.me/v2/bot/profile/${p.line_user_id}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) {
          results.push({ name: p.display_name, status: `LINE ${res.status}` });
          continue;
        }
        const profile = await res.json();
        if (!profile.pictureUrl) {
          results.push({ name: p.display_name, status: 'no picture on LINE' });
          continue;
        }
        const { error: upErr } = await (supabase.from('parents') as any)
          .update({ picture_url: profile.pictureUrl })
          .eq('id', p.id);
        if (upErr) {
          results.push({ name: p.display_name, status: `db error: ${upErr.message}` });
          continue;
        }
        updated++;
        results.push({ name: p.display_name, status: 'updated' });
      } catch (e: any) {
        results.push({ name: p.display_name, status: `error: ${e.message}` });
      }
    }

    return NextResponse.json({ scanned: parents?.length || 0, updated, results });
  } catch (e: any) {
    console.error('backfill-line-pictures error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
