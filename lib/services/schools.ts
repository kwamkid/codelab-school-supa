import { getClient } from '@/lib/supabase/client'

export interface School {
  id: string
  name: string
  name_en: string | null
  abbreviation: string | null
  aliases: string[]
  province: string | null
  is_active: boolean
}

export interface SchoolInput {
  name: string
  nameEn?: string
  abbreviation?: string
  aliases?: string[]
  province?: string
}

async function authToken(): Promise<string> {
  const supabase = getClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('No auth session')
  return session.access_token
}

async function call(url: string, init: RequestInit = {}) {
  const token = await authToken()
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init.headers || {}) },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'Request failed')
  return json
}

export const getSchools = (): Promise<School[]> => call('/api/admin/schools')
export const createSchool = (data: SchoolInput) => call('/api/admin/schools', { method: 'POST', body: JSON.stringify(data) })
export const updateSchool = (id: string, data: Partial<SchoolInput> & { isActive?: boolean }) => call(`/api/admin/schools/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
export const deleteSchool = (id: string) => call(`/api/admin/schools/${id}`, { method: 'DELETE' })
