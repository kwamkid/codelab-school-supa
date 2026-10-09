// app/api/liff/phone-lookup/route.ts
// Public "is this phone already registered?" check for the event-registration
// form. No auth (guests use the form outside LINE), so it returns ONLY
// { found } — never another family's name/address/students. Autofill of the
// caller's own data goes through /api/liff/profile (verified LINE identity).

import { NextRequest, NextResponse } from 'next/server';
import { parentPhoneExists } from '@/lib/supabase/services/liff-data';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const found = await parentPhoneExists(String(body?.phone || ''));
    return NextResponse.json({ success: true, found });
  } catch (error: any) {
    console.error('[liff/phone-lookup] Error:', error);
    return NextResponse.json({ success: true, found: false });
  }
}
