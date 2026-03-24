// lib/services/lookup.ts
// Consolidated lookup data service - reduces multiple queries to a single RPC call

import { Branch, Subject, Teacher, Room } from '@/types/models';
import { getClient } from '@/lib/supabase/client';

export interface ClassLookupData {
  branches: Branch[];
  subjects: Subject[];
  teachers: Teacher[];
  rooms: Room[];
}

/**
 * Fetch all lookup data needed for class-related pages in a single RPC call.
 * Replaces 4 separate queries (branches, subjects, teachers, rooms).
 */
export async function getClassLookupData(branchId?: string | null): Promise<ClassLookupData> {
  try {
    const supabase = getClient();

    const { data, error } = await (supabase.rpc as any)('get_class_lookup_data', {
      p_branch_id: branchId || null,
    });

    if (error) throw error;
    if (!data) return { branches: [], subjects: [], teachers: [], rooms: [] };

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

    return { branches, subjects, teachers, rooms };
  } catch (error) {
    console.error('Error getting class lookup data:', error);
    return { branches: [], subjects: [], teachers: [], rooms: [] };
  }
}
