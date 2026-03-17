import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Lookup admin user by email (bypasses RLS via service role)
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email');
  if (!email) {
    return NextResponse.json({ error: 'Missing email' }, { status: 400 });
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
  const { authUserId, email } = await req.json();

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
