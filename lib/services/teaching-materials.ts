// lib/services/teaching-materials.ts

import { TeachingMaterial } from '@/types/models';
import { convertCanvaToEmbedUrl } from '@/lib/utils/canva';
import { getClient } from '@/lib/supabase/client';

// Database row interface
interface TeachingMaterialRow {
  id: string;
  subject_id: string;
  session_number: number;
  title: string;
  description: string | null;
  objectives: string[];
  materials: string[];
  preparation: string[];
  canva_url: string;
  embed_url: string;
  thumbnail_url: string | null;
  duration: number;
  teaching_notes: string | null;
  tags: string[] | null;
  is_active: boolean;
  created_at: string;
  created_by: string;
  updated_at: string | null;
  updated_by: string | null;
}

// Map database row to model
function mapToTeachingMaterial(row: TeachingMaterialRow): TeachingMaterial {
  return {
    id: row.id,
    subjectId: row.subject_id,
    sessionNumber: row.session_number,
    title: row.title,
    description: row.description || undefined,
    objectives: row.objectives || [],
    materials: row.materials || [],
    preparation: row.preparation || [],
    canvaUrl: row.canva_url,
    embedUrl: row.embed_url,
    thumbnailUrl: row.thumbnail_url || undefined,
    duration: row.duration,
    teachingNotes: row.teaching_notes || undefined,
    tags: row.tags || undefined,
    isActive: row.is_active,
    createdAt: new Date(row.created_at),
    createdBy: row.created_by,
    updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
    updatedBy: row.updated_by || undefined
  };
}

// Get all teaching materials for a subject
export async function getTeachingMaterials(subjectId: string): Promise<TeachingMaterial[]> {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('teaching_materials')
      .select('*')
      .eq('subject_id', subjectId)
      .order('session_number', { ascending: true });

    if (error) throw error;
    return (data || []).map(mapToTeachingMaterial);
  } catch (error) {
    console.error('Error getting teaching materials:', error);
    throw error;
  }
}

// Get single teaching material
export async function getTeachingMaterial(id: string): Promise<TeachingMaterial | null> {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('teaching_materials')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data ? mapToTeachingMaterial(data) : null;
  } catch (error) {
    console.error('Error getting teaching material:', error);
    throw error;
  }
}

// Check if session number already exists for a subject
export async function checkSessionNumberExists(
  subjectId: string,
  sessionNumber: number,
  excludeId?: string
): Promise<{ exists: boolean; existingTitle?: string }> {
  try {
    const supabase = getClient();
    let query = supabase
      .from('teaching_materials')
      .select('*')
      .eq('subject_id', subjectId)
      .eq('session_number', sessionNumber);

    const { data, error } = await query;

    if (error) throw error;

    // If we're updating, exclude the current material from the check
    if (excludeId) {
      const conflictingDoc = (data || []).find(row => row.id !== excludeId);
      if (conflictingDoc) {
        return {
          exists: true,
          existingTitle: conflictingDoc.title
        };
      }
      return { exists: false };
    }

    if (data && data.length > 0) {
      return {
        exists: true,
        existingTitle: data[0].title
      };
    }

    return { exists: false };
  } catch (error) {
    console.error('Error checking session number:', error);
    throw error;
  }
}

// Create teaching material
export async function createTeachingMaterial(
  data: Omit<TeachingMaterial, 'id' | 'embedUrl' | 'createdAt' | 'updatedAt'>,
  createdBy: string
): Promise<string> {
  try {
    // Check if session number already exists
    const checkResult = await checkSessionNumberExists(data.subjectId, data.sessionNumber);
    if (checkResult.exists) {
      throw new Error(`ครั้งที่ ${data.sessionNumber} มีอยู่แล้ว (${checkResult.existingTitle}) กรุณาเลือกครั้งที่อื่น`);
    }

    // Auto-generate embed URL
    const embedUrl = convertCanvaToEmbedUrl(data.canvaUrl);

    const supabase = getClient();
    const { data: insertData, error } = await supabase
      .from('teaching_materials')
      .insert({
        subject_id: data.subjectId,
        session_number: data.sessionNumber,
        title: data.title,
        description: data.description || null,
        objectives: data.objectives || [],
        materials: data.materials || [],
        preparation: data.preparation || [],
        canva_url: data.canvaUrl,
        embed_url: embedUrl,
        thumbnail_url: data.thumbnailUrl || null,
        duration: data.duration,
        teaching_notes: data.teachingNotes || null,
        tags: data.tags || null,
        is_active: data.isActive ?? true,
        created_by: createdBy
      })
      .select()
      .single();

    if (error) throw error;
    return insertData.id;
  } catch (error) {
    console.error('Error creating teaching material:', error);
    throw error;
  }
}

// Update teaching material
export async function updateTeachingMaterial(
  id: string,
  data: Partial<TeachingMaterial>,
  updatedBy: string
): Promise<void> {
  try {
    const updateData: any = {
      updated_by: updatedBy,
      updated_at: new Date().toISOString()
    };

    // If session number is being updated, check for duplicates
    if (data.sessionNumber !== undefined && data.subjectId) {
      const checkResult = await checkSessionNumberExists(
        data.subjectId,
        data.sessionNumber,
        id // exclude current material
      );
      if (checkResult.exists) {
        throw new Error(`ครั้งที่ ${data.sessionNumber} มีอยู่แล้ว (${checkResult.existingTitle}) กรุณาเลือกครั้งที่อื่น`);
      }
    }

    // Map fields
    if (data.subjectId !== undefined) updateData.subject_id = data.subjectId;
    if (data.sessionNumber !== undefined) updateData.session_number = data.sessionNumber;
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.objectives !== undefined) updateData.objectives = data.objectives;
    if (data.materials !== undefined) updateData.materials = data.materials;
    if (data.preparation !== undefined) updateData.preparation = data.preparation;
    if (data.thumbnailUrl !== undefined) updateData.thumbnail_url = data.thumbnailUrl;
    if (data.duration !== undefined) updateData.duration = data.duration;
    if (data.teachingNotes !== undefined) updateData.teaching_notes = data.teachingNotes;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.isActive !== undefined) updateData.is_active = data.isActive;

    // If Canva URL is updated, regenerate embed URL
    if (data.canvaUrl) {
      updateData.canva_url = data.canvaUrl;
      updateData.embed_url = convertCanvaToEmbedUrl(data.canvaUrl);
    }

    const supabase = getClient();
    const { error } = await supabase
      .from('teaching_materials')
      .update(updateData)
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating teaching material:', error);
    throw error;
  }
}

// Delete teaching material
export async function deleteTeachingMaterial(id: string): Promise<void> {
  try {
    const supabase = getClient();
    const { error } = await supabase
      .from('teaching_materials')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting teaching material:', error);
    throw error;
  }
}

// Reorder teaching materials
export async function reorderTeachingMaterials(
  subjectId: string,
  materialIds: string[]
): Promise<void> {
  try {
    const supabase = getClient();

    // Supabase doesn't have batch writes like Firebase
    // Use Promise.all for better performance
    const updates = materialIds.map((materialId, index) => {
      return supabase
        .from('teaching_materials')
        .update({
          session_number: index + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', materialId);
    });

    const results = await Promise.all(updates);

    // Check for errors
    const errors = results.filter(r => r.error);
    if (errors.length > 0) {
      console.error('Errors reordering materials:', errors);
      throw new Error('Failed to reorder some materials');
    }
  } catch (error) {
    console.error('Error reordering materials:', error);
    throw error;
  }
}

// Duplicate teaching material
export async function duplicateTeachingMaterial(
  materialId: string,
  createdBy: string
): Promise<string> {
  try {
    const original = await getTeachingMaterial(materialId);
    if (!original) {
      throw new Error('Material not found');
    }

    // Get all materials to find available session number
    const materials = await getTeachingMaterials(original.subjectId);
    const existingNumbers = materials.map(m => m.sessionNumber);

    // Find the next available session number
    let newSessionNumber = 1;
    while (existingNumbers.includes(newSessionNumber)) {
      newSessionNumber++;
    }

    // Create copy
    const newData = {
      subjectId: original.subjectId,
      title: `${original.title} (Copy)`,
      sessionNumber: newSessionNumber,
      description: original.description,
      objectives: original.objectives,
      materials: original.materials,
      preparation: original.preparation,
      canvaUrl: original.canvaUrl,
      thumbnailUrl: original.thumbnailUrl,
      duration: original.duration,
      teachingNotes: original.teachingNotes,
      tags: original.tags,
      isActive: original.isActive
    };

    return await createTeachingMaterial(newData, createdBy);
  } catch (error) {
    console.error('Error duplicating material:', error);
    throw error;
  }
}

// Get active materials only
export async function getActiveTeachingMaterials(subjectId: string): Promise<TeachingMaterial[]> {
  try {
    const materials = await getTeachingMaterials(subjectId);
    return materials.filter(m => m.isActive);
  } catch (error) {
    console.error('Error getting active materials:', error);
    return [];
  }
}

// Get next available session number
export async function getNextSessionNumber(subjectId: string): Promise<number> {
  try {
    const materials = await getTeachingMaterials(subjectId);
    if (materials.length === 0) return 1;

    const maxNumber = Math.max(...materials.map(m => m.sessionNumber));
    return maxNumber + 1;
  } catch (error) {
    console.error('Error getting next session number:', error);
    return 1;
  }
}
