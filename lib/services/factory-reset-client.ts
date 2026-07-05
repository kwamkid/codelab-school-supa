// lib/services/factory-reset-client.ts
// Browser-safe wrapper for the factory-reset dialog. Calls the server route
// /api/admin/factory-reset (service-role) instead of importing the server-only service
// directly (which pulls in next/headers and breaks the client build).

export interface ResetProgress {
  total: number
  current: number
  currentTable: string
  status: 'preparing' | 'deleting' | 'completed' | 'error'
  error?: string
}

export async function getDataStatistics(): Promise<Record<string, number>> {
  const res = await fetch('/api/admin/factory-reset')
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error || 'ไม่สามารถโหลดข้อมูลสถิติได้')
  return data
}

// Runs the reset via the server route. Progress can't be streamed over one HTTP
// response, so we emit a coarse indeterminate sequence (preparing → deleting → completed).
export async function factoryReset(
  onProgress?: (progress: ResetProgress) => void
): Promise<void> {
  onProgress?.({ total: 1, current: 0, currentTable: '', status: 'preparing' })

  const res = await fetch('/api/admin/factory-reset', { method: 'POST' })
  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    onProgress?.({ total: 1, current: 0, currentTable: '', status: 'error', error: data?.error })
    throw new Error(data?.error || 'เกิดข้อผิดพลาดในการล้างข้อมูล')
  }

  onProgress?.({ total: 1, current: 1, currentTable: '', status: 'completed' })
}
