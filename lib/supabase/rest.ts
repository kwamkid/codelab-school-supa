// Direct PostgREST helpers with the service role key.
// Used for tables not present in the generated Database types (e.g. admin_invitations),
// where the Supabase JS client's .eq() is unreliable. See CLAUDE.md.

const BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`

function serviceHeaders(extra?: Record<string, string>) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

async function parseError(res: Response): Promise<string> {
  try {
    const err = await res.json()
    return err.message || err.error || JSON.stringify(err)
  } catch {
    return `Request failed with status ${res.status}`
  }
}

/** SELECT rows. `params` are raw PostgREST query params, e.g. { token: 'eq.abc', select: '*' }. */
export async function restSelect<T = any>(
  table: string,
  params: Record<string, string>
): Promise<T[]> {
  const url = new URL(`${BASE}/${table}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: serviceHeaders(),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

/** INSERT one or more rows, returning the inserted representation. */
export async function restInsert<T = any>(
  table: string,
  rows: Record<string, any> | Record<string, any>[]
): Promise<T[]> {
  const res = await fetch(`${BASE}/${table}`, {
    method: 'POST',
    headers: serviceHeaders({ Prefer: 'return=representation' }),
    body: JSON.stringify(rows),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

/** DELETE rows matching `params` (raw PostgREST filters). */
export async function restDelete(
  table: string,
  params: Record<string, string>
): Promise<void> {
  const url = new URL(`${BASE}/${table}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    method: 'DELETE',
    headers: serviceHeaders(),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(await parseError(res))
}

/** PATCH rows matching `params` (raw PostgREST filters), returning the updated representation. */
export async function restPatch<T = any>(
  table: string,
  params: Record<string, string>,
  data: Record<string, any>
): Promise<T[]> {
  const url = new URL(`${BASE}/${table}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    method: 'PATCH',
    headers: serviceHeaders({ Prefer: 'return=representation' }),
    body: JSON.stringify(data),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}
