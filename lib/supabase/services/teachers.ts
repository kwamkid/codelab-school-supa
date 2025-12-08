import { createServiceClient } from '../server'
import type { Teacher, InsertTables, UpdateTables } from '@/types/supabase'

// Get all teachers
export async function getTeachers(branchId?: string): Promise<Teacher[]> {
  const supabase = createServiceClient()

  let query = supabase
    .from('teachers')
    .select('*')
    .order('name', { ascending: true })

  const { data, error } = await query

  if (error) {
    console.error('Error getting teachers:', error)
    throw error
  }

  let teachers = data || []

  // Filter by branch if specified
  if (branchId) {
    teachers = teachers.filter(teacher =>
      teacher.available_branches.includes(branchId)
    )
  }

  return teachers
}

// Get active teachers only
export async function getActiveTeachers(branchId?: string): Promise<Teacher[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('teachers')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) {
    console.error('Error getting active teachers:', error)
    throw error
  }

  let teachers = data || []

  // Filter by branch if specified
  if (branchId) {
    teachers = teachers.filter(teacher =>
      teacher.available_branches.includes(branchId)
    )
  }

  return teachers
}

// Get teachers by branch
export async function getTeachersByBranch(branchId: string): Promise<Teacher[]> {
  return getActiveTeachers(branchId)
}

// Get teachers by specialty (subject)
export async function getTeachersBySpecialty(subjectId: string): Promise<Teacher[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('teachers')
    .select('*')
    .eq('is_active', true)
    .contains('specialties', [subjectId])
    .order('name', { ascending: true })

  if (error) {
    console.error('Error getting teachers by specialty:', error)
    throw error
  }

  return data || []
}

// Get single teacher
export async function getTeacher(id: string): Promise<Teacher | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('teachers')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    console.error('Error getting teacher:', error)
    throw error
  }

  return data
}

// Create new teacher
export async function createTeacher(
  teacherData: Omit<InsertTables<'teachers'>, 'id' | 'created_at' | 'updated_at'>
): Promise<string> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('teachers')
    .insert(teacherData)
    .select('id')
    .single()

  if (error) {
    console.error('Error creating teacher:', error)
    throw error
  }

  return data.id
}

// Update teacher
export async function updateTeacher(
  id: string,
  teacherData: UpdateTables<'teachers'>
): Promise<void> {
  const supabase = createServiceClient()

  // Remove id and timestamps from update data
  const { id: _, created_at: __, updated_at: ___, ...updateData } = teacherData as Teacher

  const { error } = await supabase
    .from('teachers')
    .update(updateData)
    .eq('id', id)

  if (error) {
    console.error('Error updating teacher:', error)
    throw error
  }

  // If updating relevant fields, also update admin_users
  if (
    teacherData.name ||
    teacherData.email ||
    teacherData.available_branches ||
    teacherData.is_active !== undefined
  ) {
    const adminUpdateData: Record<string, unknown> = {}
    if (teacherData.name) adminUpdateData.display_name = teacherData.name
    if (teacherData.email) adminUpdateData.email = teacherData.email
    if (teacherData.available_branches) adminUpdateData.branch_ids = teacherData.available_branches
    if (teacherData.is_active !== undefined) adminUpdateData.is_active = teacherData.is_active

    await supabase
      .from('admin_users')
      .update(adminUpdateData)
      .eq('teacher_id', id)
  }
}

// Delete teacher (soft delete)
export async function deleteTeacher(id: string): Promise<void> {
  const supabase = createServiceClient()

  // Soft delete teacher
  const { error: teacherError } = await supabase
    .from('teachers')
    .update({ is_active: false })
    .eq('id', id)

  if (teacherError) {
    console.error('Error deleting teacher:', teacherError)
    throw teacherError
  }

  // Soft delete admin_users linked to this teacher
  await supabase
    .from('admin_users')
    .update({ is_active: false })
    .eq('teacher_id', id)
}

// Check if email exists
export async function checkTeacherEmailExists(
  email: string,
  excludeId?: string
): Promise<boolean> {
  const supabase = createServiceClient()

  let query = supabase
    .from('teachers')
    .select('id')
    .eq('email', email.toLowerCase())

  if (excludeId) {
    query = query.neq('id', excludeId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error checking teacher email:', error)
    throw error
  }

  return (data?.length || 0) > 0
}

// Get teacher statistics
export async function getTeacherStats(teacherId: string): Promise<{
  totalClasses: number
  activeClasses: number
  totalStudents: number
}> {
  const supabase = createServiceClient()

  // Count total classes
  const { count: totalClasses } = await supabase
    .from('classes')
    .select('*', { count: 'exact', head: true })
    .eq('teacher_id', teacherId)

  // Count active classes
  const { count: activeClasses } = await supabase
    .from('classes')
    .select('*', { count: 'exact', head: true })
    .eq('teacher_id', teacherId)
    .in('status', ['published', 'started'])

  // Count unique students enrolled in teacher's classes
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('student_id, classes!inner(teacher_id)')
    .eq('classes.teacher_id', teacherId)
    .eq('status', 'active')

  const uniqueStudents = new Set(enrollments?.map(e => e.student_id) || [])

  return {
    totalClasses: totalClasses || 0,
    activeClasses: activeClasses || 0,
    totalStudents: uniqueStudents.size
  }
}

// Get teachers by IDs
export async function getTeachersByIds(ids: string[]): Promise<Teacher[]> {
  if (ids.length === 0) return []

  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('teachers')
    .select('*')
    .in('id', ids)

  if (error) {
    console.error('Error getting teachers by IDs:', error)
    throw error
  }

  return data || []
}
