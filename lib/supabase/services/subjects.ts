import { createServiceClient } from '../server'
import type { Subject, InsertTables, UpdateTables, SubjectCategory } from '@/types/supabase'

// Get all subjects
export async function getSubjects(): Promise<Subject[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('subjects')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    console.error('Error getting subjects:', error)
    throw error
  }

  return data || []
}

// Get active subjects only
export async function getActiveSubjects(): Promise<Subject[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('subjects')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) {
    console.error('Error getting active subjects:', error)
    throw error
  }

  return data || []
}

// Get subjects by category
export async function getSubjectsByCategory(category: SubjectCategory): Promise<Subject[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('subjects')
    .select('*')
    .eq('category', category)
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) {
    console.error('Error getting subjects by category:', error)
    throw error
  }

  return data || []
}

// Get single subject
export async function getSubject(id: string): Promise<Subject | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('subjects')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // Not found
    console.error('Error getting subject:', error)
    throw error
  }

  return data
}

// Create new subject
export async function createSubject(
  subjectData: Omit<InsertTables<'subjects'>, 'id'>
): Promise<string> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('subjects')
    .insert(subjectData)
    .select('id')
    .single()

  if (error) {
    console.error('Error creating subject:', error)
    throw error
  }

  return data.id
}

// Update subject
export async function updateSubject(
  id: string,
  subjectData: UpdateTables<'subjects'>
): Promise<void> {
  const supabase = createServiceClient()

  // Remove id from update data
  const { id: _, ...updateData } = subjectData as Subject

  const { error } = await supabase
    .from('subjects')
    .update(updateData)
    .eq('id', id)

  if (error) {
    console.error('Error updating subject:', error)
    throw error
  }
}

// Delete subject (soft delete)
export async function deleteSubject(id: string): Promise<void> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('subjects')
    .update({ is_active: false })
    .eq('id', id)

  if (error) {
    console.error('Error deleting subject:', error)
    throw error
  }
}

// Check if subject code exists
export async function checkSubjectCodeExists(
  code: string,
  excludeId?: string
): Promise<boolean> {
  const supabase = createServiceClient()

  let query = supabase
    .from('subjects')
    .select('id')
    .eq('code', code.toUpperCase())

  if (excludeId) {
    query = query.neq('id', excludeId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error checking subject code:', error)
    throw error
  }

  return (data?.length || 0) > 0
}

// Get subject count by category
export async function getSubjectCountByCategory(): Promise<Record<string, number>> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('subjects')
    .select('category')
    .eq('is_active', true)

  if (error) {
    console.error('Error getting subject count by category:', error)
    return {}
  }

  const counts: Record<string, number> = {}
  data?.forEach(subject => {
    counts[subject.category] = (counts[subject.category] || 0) + 1
  })

  return counts
}

// Get subjects by IDs
export async function getSubjectsByIds(ids: string[]): Promise<Subject[]> {
  if (ids.length === 0) return []

  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('subjects')
    .select('*')
    .in('id', ids)

  if (error) {
    console.error('Error getting subjects by IDs:', error)
    throw error
  }

  return data || []
}
