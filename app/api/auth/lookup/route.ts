import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

// Resolve the caller from their Supabase access token (Bearer). The lookup is
// always for the caller's OWN email/auth id — never for an arbitrary email
// (this used to return any admin_users row to anonymous callers).
async function callerFromToken(req: NextRequest) {
  const h = req.headers.get('authorization');
  const token = h?.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

// Lookup admin user by email (bypasses RLS via service role)
export async function GET(req: NextRequest) {
  const user = await callerFromToken(req);
  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const requested = req.nextUrl.searchParams.get('email');
  const email = user.email.toLowerCase();
  if (requested && requested.toLowerCase() !== email) {
    return NextResponse.json([]);
  }

  const { data, error } = await supabaseAdmin
    .from('admin_users')
    .select('*')
    .ilike('email', email)
    .limit(1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

// Check if admin user is active by auth_user_id or email
export async function POST(req: NextRequest) {
  const user = await callerFromToken(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Only the caller's own identity — body values are ignored
  const authUserId = user.id;
  const email = user.email || null;

  let adminData = null;

  if (authUserId) {
    const { data } = await supabaseAdmin
      .from('admin_users')
      .select('is_active')
      .eq('auth_user_id', authUserId)
      .single();
    adminData = data;
  }

  // Fallback: try by email
  if (!adminData && email) {
    const { data } = await supabaseAdmin
      .from('admin_users')
      .select('is_active')
      .eq('email', email.toLowerCase())
      .single();
    adminData = data;
  }

  return NextResponse.json(adminData || { is_active: null });
}
