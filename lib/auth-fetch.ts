import { getClient } from '@/lib/supabase/client'

/**
 * fetch() wrapper that attaches the logged-in user's Supabase access token as a
 * Bearer Authorization header. Use for calls to protected /api/admin/* routes
 * that verify the caller via requireStaff()/requireSuperAdmin(). Browser-only.
 */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await getClient().auth.getSession()
  const headers = new Headers(init.headers)
  if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`)
  return fetch(input, { ...init, headers })
}
