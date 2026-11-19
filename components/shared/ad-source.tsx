'use client';

// "มาจากโฆษณา" — which Meta ad(s) a customer opened the chat from.
// Recorded by the FB/IG webhook into ad_referrals and kept forever, so the ad
// source is known even when the purchase happens after Meta's 7-day window.
//   <AdSourceList contactId>  → chat side panel (one chat contact)
//   <AdSourceCard parentId>   → parent page (all chats linked by parent or phone)

import { useEffect, useState } from 'react';
import { Megaphone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getClient } from '@/lib/supabase/client';

export interface AdSourceRow {
  ad_id: string;
  ad_title: string | null;
  ad_name: string | null;
  adset_name: string | null;
  campaign_name: string | null;
  platform: string;
  first_referred_at: string;
  last_referred_at: string;
}

const thDate = (iso: string) =>
  new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });

function AdRows({ rows }: { rows: AdSourceRow[] }) {
  return (
    <ul className="space-y-3">
      {rows.map((r, i) => (
        <li key={r.ad_id + i} className="flex gap-3">
          <Megaphone className="h-5 w-5 shrink-0 text-primary mt-0.5" />
          <div className="min-w-0 text-base">
            <div className="font-medium break-words">
              {r.campaign_name || r.ad_title || `โฆษณา ${r.ad_id}`}
            </div>
            {(r.ad_name || r.ad_title) && (
              <div className="text-muted-foreground break-words">{r.ad_name || r.ad_title}</div>
            )}
            <div className="text-muted-foreground">
              {r.platform === 'instagram' ? 'Instagram' : 'Messenger'} · ทักครั้งแรก {thDate(r.first_referred_at)}
              {r.last_referred_at !== r.first_referred_at && ` · ล่าสุด ${thDate(r.last_referred_at)}`}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function AdSourceList({ contactId }: { contactId?: string }) {
  const [rows, setRows] = useState<AdSourceRow[]>([]);
  useEffect(() => {
    setRows([]);
    if (!contactId) return;
    let alive = true;
    (getClient() as any)
      .from('ad_referrals')
      .select('ad_id, ad_title, ad_name, adset_name, campaign_name, platform, first_referred_at, last_referred_at')
      .eq('contact_id', contactId)
      .order('first_referred_at')
      .then(({ data }: { data: AdSourceRow[] | null }) => { if (alive) setRows(data || []); });
    return () => { alive = false; };
  }, [contactId]);

  if (!rows.length) return null;
  return (
    <div className="px-6 py-4 border-b dark:border-slate-700">
      <div className="text-base font-medium mb-2">มาจากโฆษณา</div>
      <AdRows rows={rows} />
    </div>
  );
}

export function AdSourceCard({ parentId }: { parentId: string }) {
  const [rows, setRows] = useState<AdSourceRow[] | null>(null);
  useEffect(() => {
    let alive = true;
    (getClient() as any)
      .rpc('get_parent_ad_sources', { p_parent_id: parentId })
      .then(({ data }: { data: AdSourceRow[] | null }) => { if (alive) setRows(data || []); });
    return () => { alive = false; };
  }, [parentId]);

  if (!rows?.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>มาจากโฆษณา</CardTitle>
      </CardHeader>
      <CardContent>
        <AdRows rows={rows} />
      </CardContent>
    </Card>
  );
}
