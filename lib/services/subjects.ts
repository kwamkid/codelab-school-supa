import { Subject } from '@/types/models';
import { getClient } from '@/lib/supabase/client';
import { Database } from '@/types/supabase';

const TABLE_NAME = 'subjects';

type SubjectRow = Database['public']['Tables']['subjects']['Row'];
type SubjectInsert = Database['public']['Tables']['subjects']['Insert'];
type SubjectUpdate = Database['public']['Tables']['subjects']['Update'];

// Map database item to Subject model
function mapToSubject(item: any): Subject {
  console.log('mapToSubject - raw item:', item);
  console.log('mapToSubject - age_range_min:', item.age_range_min);
  console.log('mapToSubject - age_range_max:', item.age_range_max);

  const mapped = {
    id: item.id,
    code: item.code,
    name: item.name,
    category: item.category,
    description: item.description || '',
    color: item.color,
    level: item.level,
    ageRange: {
      min: item.age_range_min || 0,
      max: item.age_range_max || 0,
    },
    prerequisites: item.prerequisites || [],
    icon: item.icon,
    isActive: item.is_active,
  };

  console.log('mapToSubject - mapped ageRange:', mapped.ageRange);
  return mapped;
}

// Get all subjects
export async function getSubjects(): Promise<Subject[]> {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;

    return (data || []).map(mapToSubject);
  } catch (error) {
    console.error('Error getting subjects:', error);
    throw error;
  }
}

// Get active subjects only
export async function getActiveSubjects(): Promise<Subject[]> {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) throw error;

    return (data || []).map(mapToSubject);
  } catch (error) {
    console.error('Error getting active subjects:', error);
    throw error;
  }
}

// Get subjects by category
export async function getSubjectsByCategory(category: string): Promise<Subject[]> {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('category', category)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) throw error;

    return (data || []).map(mapToSubject);
  } catch (error) {
    console.error('Error getting subjects by category:', error);
    throw error;
  }
}

// Get single subject
export async function getSubject(id: string): Promise<Subject | null> {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    if (!data) return null;

    return mapToSubject(data);
  } catch (error) {
    console.error('Error getting subject:', error);
    throw error;
  }
}

// Create new subject
export async function createSubject(subjectData: Omit<Subject, 'id'>): Promise<string> {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert({
        code: subjectData.code,
        name: subjectData.name,
        category: subjectData.category,
        description: subjectData.description,
        color: subjectData.color,
        level: subjectData.level,
        age_range_min: subjectData.ageRange.min,
        age_range_max: subjectData.ageRange.max,
        prerequisites: subjectData.prerequisites || [],
        icon: subjectData.icon,
        is_active: subjectData.isActive,
      })
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error('No data returned from insert');

    return data.id;
  } catch (error) {
    console.error('Error creating subject:', error);
    throw error;
  }
}

// Update subject
export async function updateSubject(id: string, subjectData: Partial<Subject>): Promise<void> {
  try {
    const supabase = getClient();

    const updateData: any = {};

    if (subjectData.code !== undefined) updateData.code = subjectData.code;
    if (subjectData.name !== undefined) updateData.name = subjectData.name;
    if (subjectData.category !== undefined) updateData.category = subjectData.category;
    if (subjectData.description !== undefined) updateData.description = subjectData.description;
    if (subjectData.color !== undefined) updateData.color = subjectData.color;
    if (subjectData.level !== undefined) updateData.level = subjectData.level;
    if (subjectData.ageRange !== undefined) {
      updateData.age_range_min = subjectData.ageRange.min;
      updateData.age_range_max = subjectData.ageRange.max;
    }
    if (subjectData.prerequisites !== undefined) updateData.prerequisites = subjectData.prerequisites;
    if (subjectData.icon !== undefined) updateData.icon = subjectData.icon;
    if (subjectData.isActive !== undefined) updateData.is_active = subjectData.isActive;

    if (Object.keys(updateData).length === 0) {
      return;
    }

    const { error } = await supabase
      .from(TABLE_NAME)
      .update(updateData)
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating subject:', error);
    throw error;
  }
}

// Delete subject (soft delete)
export async function deleteSubject(id: string): Promise<void> {
  try {
    const supabase = getClient();
    const { error } = await supabase
      .from(TABLE_NAME)
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting subject:', error);
    throw error;
  }
}

// Check if subject code exists
export async function checkSubjectCodeExists(code: string, excludeId?: string): Promise<boolean> {
  try {
    const supabase = getClient();
    let query = supabase
      .from(TABLE_NAME)
      .select('id')
      .eq('code', code.toUpperCase());

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data || []).length > 0;
  } catch (error) {
    console.error('Error checking subject code:', error);
    throw error;
  }
}

// Get subject count by category
export async function getSubjectCountByCategory(): Promise<Record<string, number>> {
  try {
    const subjects = await getActiveSubjects();
    const counts: Record<string, number> = {};

    subjects.forEach(subject => {
      counts[subject.category] = (counts[subject.category] || 0) + 1;
    });

    return counts;
  } catch (error) {
    console.error('Error getting subject count by category:', error);
    return {};
  }
}
