// lib/services/lookup.ts
// Consolidated lookup data service - reduces multiple queries to a single RPC call

import { Branch, Subject, Teacher, Room } from '@/types/models';
import { getClient } from '@/lib/supabase/client';

export interface ClassLookupData {
  branches: Branch[];
  subjects: Subject[];
  teachers: Teacher[];
  rooms: Room[];
  classStats: Record<string, number>; // classId → completed sessions count
}

/**
 * Fetch all lookup data needed for class-related pages in a single RPC call.
 * Replaces 4 separate queries (branches, subjects, teachers, rooms).
 */
export async function getClassLookupData(branchId?: string | null): Promise<ClassLookupData> {
  try {
    const supabase = getClient();

    console.log('[Lookup] Calling RPC get_class_lookup_data, branchId:', branchId || 'ALL');
    const { data, error } = await (supabase.rpc as any)('get_class_lookup_data', {
      p_branch_id: branchId || null,
    });

    if (error) {
      console.error('[Lookup] RPC error:', error);
      throw error;
    }
    if (!data) {
      console.warn('[Lookup] RPC returned null data');
      return { branches: [], subjects: [], teachers: [], rooms: [], classStats: {} };
    }

    console.log('[Lookup] RPC success — branches:', (data.branches || []).length, 'subjects:', (data.subjects || []).length, 'teachers:', (data.teachers || []).length, 'rooms:', (data.rooms || []).length);

    const branches: Branch[] = (data.branches || []).map((b: any) => ({
      id: b.id,
      name: b.name,
      code: b.code,
      isActive: true,
    } as Branch));

    const subjects: Subject[] = (data.subjects || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      color: s.color,
      category: s.category,
      level: s.level,
      ageRange: { min: s.age_range_min || 0, max: s.age_range_max || 0 },
      icon: s.icon,
      isActive: s.is_active,
    } as Subject));

    const teachers: Teacher[] = (data.teachers || []).map((t: any) => ({
      id: t.id,
      name: t.name,
      nickname: t.nickname,
      specialties: t.specialties || [],
      availableBranches: t.available_branches || [],
      isActive: t.is_active,
    } as Teacher));

    const rooms: Room[] = (data.rooms || []).map((r: any) => ({
      id: r.id,
      branchId: r.branch_id,
      name: r.name,
      capacity: r.capacity,
      isActive: r.is_active,
    } as Room));

    // Build classStats map: classId → completed_sessions
    const classStats: Record<string, number> = {};
    for (const cs of (data.classStats || [])) {
      if (cs.class_id && cs.completed_sessions > 0) {
        classStats[cs.class_id] = cs.completed_sessions;
      }
    }

    return { branches, subjects, teachers, rooms, classStats };
  } catch (error) {
    console.error('Error getting class lookup data via RPC, falling back to direct queries:', error);

    // Fallback: load individually
    try {
      const { getActiveBranches } = await import('@/lib/services/branches');
      const { getSubjects } = await import('@/lib/services/subjects');
      const { getTeachers } = await import('@/lib/services/teachers');
      const { getRooms } = await import('@/lib/services/rooms');

      const [branches, subjects, teachers, rooms] = await Promise.all([
        getActiveBranches(),
        getSubjects(),
        getTeachers(),
        getRooms(),
      ]);
      return { branches, subjects, teachers, rooms, classStats: {} };
    } catch (fallbackError) {
      console.error('Fallback lookup also failed:', fallbackError);
      return { branches: [], subjects: [], teachers: [], rooms: [], classStats: {} };
    }
  }
}
