import { createServiceClient } from '../server'
import type { Branch, InsertTables, UpdateTables } from '@/types/supabase'

// Get all branches
export async function getBranches(): Promise<Branch[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('branches')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    console.error('Error getting branches:', error)
    throw error
  }

  return data || []
}

// Get active branches only
export async function getActiveBranches(): Promise<Branch[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('branches')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) {
    console.error('Error getting active branches:', error)
    return []
  }

  return data || []
}

// Get single branch
export async function getBranch(id: string): Promise<Branch | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('branches')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // Not found
    console.error('Error getting branch:', error)
    throw error
  }

  return data
}

// Create new branch
export async function createBranch(
  branchData: Omit<InsertTables<'branches'>, 'id' | 'created_at'>
): Promise<string> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('branches')
    .insert(branchData)
    .select('id')
    .single()

  if (error) {
    console.error('Error creating branch:', error)
    throw error
  }

  return data.id
}

// Update branch
export async function updateBranch(
  id: string,
  branchData: UpdateTables<'branches'>
): Promise<void> {
  const supabase = createServiceClient()

  // Remove id and created_at from update data
  const { id: _, created_at: __, ...updateData } = branchData as Branch

  if (Object.keys(updateData).length === 0) {
    return // Nothing to update
  }

  const { error } = await supabase
    .from('branches')
    .update(updateData)
    .eq('id', id)

  if (error) {
    console.error('Error updating branch:', error)
    throw error
  }
}

// Toggle branch active status
export async function toggleBranchStatus(id: string, isActive: boolean): Promise<void> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('branches')
    .update({ is_active: isActive })
    .eq('id', id)

  if (error) {
    console.error('Error toggling branch status:', error)
    throw error
  }
}

// Check if branch code already exists
export async function checkBranchCodeExists(
  code: string,
  excludeId?: string
): Promise<boolean> {
  const supabase = createServiceClient()

  let query = supabase
    .from('branches')
    .select('id')
    .eq('code', code)

  if (excludeId) {
    query = query.neq('id', excludeId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error checking branch code:', error)
    throw error
  }

  return (data?.length || 0) > 0
}

// Get branches by IDs
export async function getBranchesByIds(ids: string[]): Promise<Branch[]> {
  if (ids.length === 0) return []

  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('branches')
    .select('*')
    .in('id', ids)

  if (error) {
    console.error('Error getting branches by IDs:', error)
    throw error
  }

  return data || []
}
