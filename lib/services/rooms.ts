import { Room } from '@/types/models';
import { getClient } from '@/lib/supabase/client';

const TABLE_NAME = 'rooms';

// Get all rooms for a branch
export async function getRoomsByBranch(branchId: string): Promise<Room[]> {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('branch_id', branchId)
      .order('name', { ascending: true });

    if (error) throw error;

    return (data || []).map(item => ({
      id: item.id,
      branchId: item.branch_id,
      name: item.name,
      capacity: item.capacity,
      floor: item.floor,
      hasProjector: item.has_projector,
      hasWhiteboard: item.has_whiteboard,
      isActive: item.is_active,
    }));
  } catch (error) {
    console.error('Error getting rooms:', error);
    throw error;
  }
}

// Get active rooms only
export async function getActiveRoomsByBranch(branchId: string): Promise<Room[]> {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) throw error;

    return (data || []).map(item => ({
      id: item.id,
      branchId: item.branch_id,
      name: item.name,
      capacity: item.capacity,
      floor: item.floor,
      hasProjector: item.has_projector,
      hasWhiteboard: item.has_whiteboard,
      isActive: item.is_active,
    }));
  } catch (error) {
    console.error('Error getting active rooms:', error);
    throw error;
  }
}

// Get single room
export async function getRoom(branchId: string, roomId: string): Promise<Room | null> {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('id', roomId)
      .eq('branch_id', branchId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    if (!data) return null;

    return {
      id: data.id,
      branchId: data.branch_id,
      name: data.name,
      capacity: data.capacity,
      floor: data.floor,
      hasProjector: data.has_projector,
      hasWhiteboard: data.has_whiteboard,
      isActive: data.is_active,
    };
  } catch (error) {
    console.error('Error getting room:', error);
    throw error;
  }
}

// Create new room
export async function createRoom(
  branchId: string,
  roomData: Omit<Room, 'id' | 'branchId'>
): Promise<string> {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert({
        branch_id: branchId,
        name: roomData.name,
        capacity: roomData.capacity,
        floor: roomData.floor,
        has_projector: roomData.hasProjector,
        has_whiteboard: roomData.hasWhiteboard,
        is_active: roomData.isActive,
      })
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error('No data returned from insert');

    return data.id;
  } catch (error) {
    console.error('Error creating room:', error);
    throw error;
  }
}

// Update room
export async function updateRoom(
  branchId: string,
  roomId: string,
  roomData: Partial<Room>
): Promise<void> {
  try {
    const supabase = getClient();

    const updateData: any = {};

    if (roomData.name !== undefined) updateData.name = roomData.name;
    if (roomData.capacity !== undefined) updateData.capacity = roomData.capacity;
    if (roomData.floor !== undefined) updateData.floor = roomData.floor;
    if (roomData.hasProjector !== undefined) updateData.has_projector = roomData.hasProjector;
    if (roomData.hasWhiteboard !== undefined) updateData.has_whiteboard = roomData.hasWhiteboard;
    if (roomData.isActive !== undefined) updateData.is_active = roomData.isActive;

    if (Object.keys(updateData).length === 0) {
      return;
    }

    const { error } = await supabase
      .from(TABLE_NAME)
      .update(updateData)
      .eq('id', roomId)
      .eq('branch_id', branchId);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating room:', error);
    throw error;
  }
}

// Delete room (soft delete)
export async function deleteRoom(branchId: string, roomId: string): Promise<void> {
  try {
    const supabase = getClient();
    const { error } = await supabase
      .from(TABLE_NAME)
      .update({ is_active: false })
      .eq('id', roomId)
      .eq('branch_id', branchId);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting room:', error);
    throw error;
  }
}

// Check if room name exists in branch
export async function checkRoomNameExists(
  branchId: string,
  name: string,
  excludeId?: string
): Promise<boolean> {
  try {
    const supabase = getClient();
    let query = supabase
      .from(TABLE_NAME)
      .select('id')
      .eq('branch_id', branchId)
      .eq('name', name);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data || []).length > 0;
  } catch (error) {
    console.error('Error checking room name:', error);
    throw error;
  }
}

// Get room count for branch
export async function getRoomCount(branchId: string): Promise<number> {
  try {
    const supabase = getClient();
    const { count, error } = await supabase
      .from(TABLE_NAME)
      .select('*', { count: 'exact', head: true })
      .eq('branch_id', branchId)
      .eq('is_active', true);

    if (error) throw error;

    return count || 0;
  } catch (error) {
    console.error('Error getting room count:', error);
    return 0;
  }
}
