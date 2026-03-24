/**
 * Generic admin mutation helper
 * Uses API route with service role client to bypass RLS
 */

interface MutationFilter {
  column: string
  op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'is'
  value: any
}

interface MutationOptions {
  select?: boolean | string
  single?: boolean
  onConflict?: string
  order?: string
}

interface MutationParams {
  table: string
  operation: 'insert' | 'update' | 'delete' | 'upsert' | 'select'
  data?: Record<string, any> | Record<string, any>[]
  match?: Record<string, any>
  filters?: MutationFilter[]
  options?: MutationOptions
}

export async function adminMutation<T = any>(params: MutationParams): Promise<T> {
  const response = await fetch('/api/admin/mutation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })

  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.error || 'Mutation failed')
  }

  return result.data as T
}
