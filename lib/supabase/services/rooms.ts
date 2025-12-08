import { createServiceClient } from '../server'
import type { Room, InsertTables, UpdateTables } from '@/types/supabase'

// Get all rooms for a branch
export async function getRoomsByBranch(branchId: string): Promise<Room[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('branch_id', branchId)
    .order('name', { ascending: true })

  if (error) {
    console.error('Error getting rooms:', error)
    throw error
  }

  return data || []
}

// Get active rooms only
export async function getActiveRoomsByBranch(branchId: string): Promise<Room[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('branch_id', branchId)
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) {
    console.error('Error getting active rooms:', error)
    throw error
  }

  return data || []
}

// Get single room
export async function getRoom(branchId: string, roomId: string): Promise<Room | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .eq('branch_id', branchId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // Not found
    console.error('Error getting room:', error)
    throw error
  }

  return data
}

// Get room by ID only (without branch check)
export async function getRoomById(roomId: string): Promise<Room | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    console.error('Error getting room:', error)
    throw error
  }

  return data
}

// Create new room
export async function createRoom(
  branchId: string,
  roomData: Omit<InsertTables<'rooms'>, 'id' | 'branch_id'>
): Promise<string> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('rooms')
    .insert({
      ...roomData,
      branch_id: branchId
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error creating room:', error)
    throw error
  }

  return data.id
}

// Update room
export async function updateRoom(
  branchId: string,
  roomId: string,
  roomData: UpdateTables<'rooms'>
): Promise<void> {
  const supabase = createServiceClient()

  // Remove id and branch_id from update data
  const { id: _, branch_id: __, ...updateData } = roomData as Room

  const { error } = await supabase
    .from('rooms')
    .update(updateData)
    .eq('id', roomId)
    .eq('branch_id', branchId)

  if (error) {
    console.error('Error updating room:', error)
    throw error
  }
}

// Delete room (soft delete)
export async function deleteRoom(branchId: string, roomId: string): Promise<void> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('rooms')
    .update({ is_active: false })
    .eq('id', roomId)
    .eq('branch_id', branchId)

  if (error) {
    console.error('Error deleting room:', error)
    throw error
  }
}

// Check if room name exists in branch
export async function checkRoomNameExists(
  branchId: string,
  name: string,
  excludeId?: string
): Promise<boolean> {
  const supabase = createServiceClient()

  let query = supabase
    .from('rooms')
    .select('id')
    .eq('branch_id', branchId)
    .eq('name', name)

  if (excludeId) {
    query = query.neq('id', excludeId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error checking room name:', error)
    throw error
  }

  return (data?.length || 0) > 0
}

// Get room count for branch
export async function getRoomCount(branchId: string): Promise<number> {
  const supabase = createServiceClient()

  const { count, error } = await supabase
    .from('rooms')
    .select('*', { count: 'exact', head: true })
    .eq('branch_id', branchId)
    .eq('is_active', true)

  if (error) {
    console.error('Error getting room count:', error)
    return 0
  }

  return count || 0
}

// Get all rooms (across all branches)
export async function getAllRooms(): Promise<Room[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) {
    console.error('Error getting all rooms:', error)
    throw error
  }

  return data || []
}
