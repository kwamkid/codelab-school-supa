// lib/services/data-cleaning-client.ts
// Browser-safe wrapper for the data-cleaning admin page. Calls the server route
// /api/admin/data-cleaning (which uses the service-role service) instead of importing
// the server-only service directly (that pulls in next/headers and breaks the client build).

import type { Student } from '@/types/models'

export interface OrphanedStudent extends Student {
  parentName: string
  canDelete: boolean
  hasEnrollments: boolean
}

export interface DataCleaningStats {
  totalParents: number
  totalStudents: number
  validStudents: number
  orphanedStudents: number
  orphanedMakeups: number
}

async function handle<T>(res: Response): Promise<T> {
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error || 'เกิดข้อผิดพลาด')
  return data as T
}

export async function getDataCleaningStats(): Promise<DataCleaningStats> {
  return handle(await fetch('/api/admin/data-cleaning?action=stats'))
}

export async function getOrphanedStudents(): Promise<OrphanedStudent[]> {
  return handle(await fetch('/api/admin/data-cleaning?action=orphaned'))
}

export async function deleteOrphanedStudent(parentId: string, studentId: string): Promise<void> {
  await handle(
    await fetch('/api/admin/data-cleaning', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentId, studentId }),
    })
  )
}
