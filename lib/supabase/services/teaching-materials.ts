import { createServiceClient } from '../server'
import { convertCanvaToEmbedUrl } from '@/lib/utils/canva'

export interface TeachingMaterial {
  id: string
  subject_id: string
  session_number: number
  title: string
  description: string | null
  canva_url: string
  embed_url: string | null
  is_active: boolean
  created_at: string
  created_by: string
  updated_at: string | null
  updated_by: string | null
}

// Mapped type for frontend compatibility
export interface TeachingMaterialMapped {
  id: string
  subjectId: string
  sessionNumber: number
  title: string
  description?: string
  canvaUrl: string
  embedUrl?: string
  isActive: boolean
  createdAt: Date
  createdBy: string
  updatedAt?: Date
  updatedBy?: string
}

function mapTeachingMaterial(data: TeachingMaterial): TeachingMaterialMapped {
  return {
    id: data.id,
    subjectId: data.subject_id,
    sessionNumber: data.session_number,
    title: data.title,
    description: data.description || undefined,
    canvaUrl: data.canva_url,
    embedUrl: data.embed_url || undefined,
    isActive: data.is_active,
    createdAt: new Date(data.created_at),
    createdBy: data.created_by,
    updatedAt: data.updated_at ? new Date(data.updated_at) : undefined,
    updatedBy: data.updated_by || undefined,
  }
}

// Get all teaching materials for a subject
export async function getTeachingMaterials(subjectId: string): Promise<TeachingMaterialMapped[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('teaching_materials')
    .select('*')
    .eq('subject_id', subjectId)
    .order('session_number', { ascending: true })

  if (error) {
    console.error('Error getting teaching materials:', error)
    throw error
  }

  return (data || []).map(mapTeachingMaterial)
}

// Get single teaching material
export async function getTeachingMaterial(id: string): Promise<TeachingMaterialMapped | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('teaching_materials')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    console.error('Error getting teaching material:', error)
    throw error
  }

  return mapTeachingMaterial(data)
}

// Check if session number already exists for a subject
export async function checkSessionNumberExists(
  subjectId: string,
  sessionNumber: number,
  excludeId?: string
): Promise<{ exists: boolean; existingTitle?: string }> {
  const supabase = createServiceClient()

  let query = supabase
    .from('teaching_materials')
    .select('id, title')
    .eq('subject_id', subjectId)
    .eq('session_number', sessionNumber)

  if (excludeId) {
    query = query.neq('id', excludeId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error checking session number:', error)
    throw error
  }

  if (data && data.length > 0) {
    return { exists: true, existingTitle: data[0].title }
  }

  return { exists: false }
}

// Create teaching material
export async function createTeachingMaterial(
  data: {
    subjectId: string
    sessionNumber: number
    title: string
    description?: string
    canvaUrl: string
    isActive?: boolean
  },
  createdBy: string
): Promise<string> {
  const supabase = createServiceClient()

  // Check if session number already exists
  const checkResult = await checkSessionNumberExists(data.subjectId, data.sessionNumber)
  if (checkResult.exists) {
    throw new Error(`ครั้งที่ ${data.sessionNumber} มีอยู่แล้ว (${checkResult.existingTitle}) กรุณาเลือกครั้งที่อื่น`)
  }

  // Auto-generate embed URL
  const embedUrl = convertCanvaToEmbedUrl(data.canvaUrl)

  const { data: result, error } = await supabase
    .from('teaching_materials')
    .insert({
      subject_id: data.subjectId,
      session_number: data.sessionNumber,
      title: data.title,
      description: data.description || null,
      canva_url: data.canvaUrl,
      embed_url: embedUrl,
      is_active: data.isActive ?? true,
      created_by: createdBy,
      updated_by: createdBy,
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error creating teaching material:', error)
    throw error
  }

  return result.id
}

// Update teaching material
export async function updateTeachingMaterial(
  id: string,
  data: Partial<{
    sessionNumber: number
    title: string
    description: string
    canvaUrl: string
    isActive: boolean
    subjectId: string
  }>,
  updatedBy: string
): Promise<void> {
  const supabase = createServiceClient()

  // If session number is being updated, check for duplicates
  if (data.sessionNumber !== undefined && data.subjectId) {
    const checkResult = await checkSessionNumberExists(
      data.subjectId,
      data.sessionNumber,
      id
    )
    if (checkResult.exists) {
      throw new Error(`ครั้งที่ ${data.sessionNumber} มีอยู่แล้ว (${checkResult.existingTitle}) กรุณาเลือกครั้งที่อื่น`)
    }
  }

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by: updatedBy,
  }

  if (data.sessionNumber !== undefined) updateData.session_number = data.sessionNumber
  if (data.title !== undefined) updateData.title = data.title
  if (data.description !== undefined) updateData.description = data.description
  if (data.isActive !== undefined) updateData.is_active = data.isActive

  // If Canva URL is updated, regenerate embed URL
  if (data.canvaUrl !== undefined) {
    updateData.canva_url = data.canvaUrl
    updateData.embed_url = convertCanvaToEmbedUrl(data.canvaUrl)
  }

  const { error } = await supabase
    .from('teaching_materials')
    .update(updateData)
    .eq('id', id)

  if (error) {
    console.error('Error updating teaching material:', error)
    throw error
  }
}

// Delete teaching material
export async function deleteTeachingMaterial(id: string): Promise<void> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('teaching_materials')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting teaching material:', error)
    throw error
  }
}

// Reorder teaching materials
export async function reorderTeachingMaterials(
  subjectId: string,
  materialIds: string[]
): Promise<void> {
  const supabase = createServiceClient()

  // Update each material's session number
  const promises = materialIds.map((materialId, index) =>
    supabase
      .from('teaching_materials')
      .update({
        session_number: index + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', materialId)
  )

  const results = await Promise.all(promises)
  const errors = results.filter(r => r.error)

  if (errors.length > 0) {
    console.error('Error reordering materials:', errors)
    throw new Error('Failed to reorder some materials')
  }
}

// Duplicate teaching material
export async function duplicateTeachingMaterial(
  materialId: string,
  createdBy: string
): Promise<string> {
  const original = await getTeachingMaterial(materialId)
  if (!original) {
    throw new Error('Material not found')
  }

  // Get all materials to find available session number
  const materials = await getTeachingMaterials(original.subjectId)
  const existingNumbers = materials.map(m => m.sessionNumber)

  // Find the next available session number
  let newSessionNumber = 1
  while (existingNumbers.includes(newSessionNumber)) {
    newSessionNumber++
  }

  // Create copy
  return await createTeachingMaterial(
    {
      subjectId: original.subjectId,
      sessionNumber: newSessionNumber,
      title: `${original.title} (Copy)`,
      description: original.description,
      canvaUrl: original.canvaUrl,
      isActive: original.isActive,
    },
    createdBy
  )
}

// Get active materials only
export async function getActiveTeachingMaterials(subjectId: string): Promise<TeachingMaterialMapped[]> {
  const materials = await getTeachingMaterials(subjectId)
  return materials.filter(m => m.isActive)
}

// Get next available session number
export async function getNextSessionNumber(subjectId: string): Promise<number> {
  const materials = await getTeachingMaterials(subjectId)
  if (materials.length === 0) return 1

  const maxNumber = Math.max(...materials.map(m => m.sessionNumber))
  return maxNumber + 1
}
