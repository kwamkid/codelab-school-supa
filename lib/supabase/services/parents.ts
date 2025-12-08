import { createServiceClient } from '../server'
import type {
  Parent,
  Student,
  InsertTables,
  UpdateTables,
  StudentWithParent
} from '@/types/supabase'

// ============================================
// PARENTS
// ============================================

// Get all parents
export async function getParents(): Promise<Parent[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('parents')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error getting parents:', error)
    throw error
  }

  return data || []
}

// Get single parent
export async function getParent(id: string): Promise<Parent | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('parents')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    console.error('Error getting parent:', error)
    throw error
  }

  return data
}

// Get parent by LINE User ID
export async function getParentByLineId(lineUserId: string): Promise<Parent | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('parents')
    .select('*')
    .eq('line_user_id', lineUserId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    console.error('Error getting parent by LINE ID:', error)
    throw error
  }

  return data
}

// Get parent by phone number
export async function getParentByPhone(phone: string): Promise<Parent | null> {
  const supabase = createServiceClient()
  const cleanPhone = phone.replace(/[-\s]/g, '')

  const { data, error } = await supabase
    .from('parents')
    .select('*')
    .eq('phone', cleanPhone)
    .limit(1)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    console.error('Error getting parent by phone:', error)
    return null
  }

  return data
}

// Create new parent
export async function createParent(
  parentData: Omit<InsertTables<'parents'>, 'id' | 'created_at' | 'last_login_at'>
): Promise<string> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('parents')
    .insert(parentData)
    .select('id')
    .single()

  if (error) {
    console.error('Error creating parent:', error)
    throw error
  }

  return data.id
}

// Update parent
export async function updateParent(
  id: string,
  parentData: UpdateTables<'parents'>
): Promise<void> {
  const supabase = createServiceClient()

  // Remove id and timestamps from update data
  const { id: _, created_at: __, last_login_at: ___, ...updateData } = parentData as Parent

  const { error } = await supabase
    .from('parents')
    .update(updateData)
    .eq('id', id)

  if (error) {
    console.error('Error updating parent:', error)
    throw error
  }
}

// Delete parent
export async function deleteParent(parentId: string): Promise<void> {
  const supabase = createServiceClient()

  // Check if parent has students
  const { count } = await supabase
    .from('students')
    .select('*', { count: 'exact', head: true })
    .eq('parent_id', parentId)

  if (count && count > 0) {
    throw new Error('ไม่สามารถลบผู้ปกครองที่ยังมีข้อมูลนักเรียนได้ กรุณาลบข้อมูลนักเรียนทั้งหมดก่อน')
  }

  const { error } = await supabase
    .from('parents')
    .delete()
    .eq('id', parentId)

  if (error) {
    console.error('Error deleting parent:', error)
    throw error
  }
}

// Check if phone exists
export async function checkParentPhoneExists(
  phone: string,
  excludeId?: string
): Promise<boolean> {
  const supabase = createServiceClient()

  // Check main phone
  let query = supabase
    .from('parents')
    .select('id')
    .or(`phone.eq.${phone},emergency_phone.eq.${phone}`)

  if (excludeId) {
    query = query.neq('id', excludeId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error checking phone:', error)
    throw error
  }

  return (data?.length || 0) > 0
}

// Check if LINE User ID exists
export async function checkLineUserIdExists(
  lineUserId: string
): Promise<{ exists: boolean; parentId?: string }> {
  if (!lineUserId || lineUserId.trim() === '') {
    return { exists: false }
  }

  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('parents')
    .select('id')
    .eq('line_user_id', lineUserId)
    .limit(1)

  if (error) {
    console.error('Error checking LINE User ID:', error)
    throw error
  }

  if (data && data.length > 0) {
    return { exists: true, parentId: data[0].id }
  }

  return { exists: false }
}

// Search parents
export async function searchParents(searchTerm: string): Promise<Parent[]> {
  const supabase = createServiceClient()
  const term = `%${searchTerm}%`

  const { data, error } = await supabase
    .from('parents')
    .select('*')
    .or(`display_name.ilike.${term},phone.ilike.${term},email.ilike.${term}`)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error searching parents:', error)
    throw error
  }

  return data || []
}

// Check if parent can be deleted
export async function canDeleteParent(parentId: string): Promise<{
  canDelete: boolean
  reason?: string
  studentCount?: number
}> {
  const supabase = createServiceClient()

  const { count, error } = await supabase
    .from('students')
    .select('*', { count: 'exact', head: true })
    .eq('parent_id', parentId)

  if (error) {
    return { canDelete: false, reason: 'เกิดข้อผิดพลาดในการตรวจสอบ' }
  }

  if (count && count > 0) {
    return {
      canDelete: false,
      reason: `ผู้ปกครองยังมีข้อมูลนักเรียน ${count} คน`,
      studentCount: count
    }
  }

  return { canDelete: true }
}

// ============================================
// STUDENTS
// ============================================

// Get students by parent
export async function getStudentsByParent(parentId: string): Promise<Student[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('parent_id', parentId)
    .order('birthdate', { ascending: true })

  if (error) {
    console.error('Error getting students:', error)
    throw error
  }

  return data || []
}

// Get single student
export async function getStudent(
  parentId: string,
  studentId: string
): Promise<Student | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('id', studentId)
    .eq('parent_id', parentId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    console.error('Error getting student:', error)
    throw error
  }

  return data
}

// Get student by ID (without parent check)
export async function getStudentById(studentId: string): Promise<Student | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('id', studentId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    console.error('Error getting student:', error)
    throw error
  }

  return data
}

// Create new student
export async function createStudent(
  parentId: string,
  studentData: Omit<InsertTables<'students'>, 'id' | 'parent_id'>
): Promise<string> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('students')
    .insert({
      ...studentData,
      parent_id: parentId
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error creating student:', error)
    throw error
  }

  return data.id
}

// Update student
export async function updateStudent(
  parentId: string,
  studentId: string,
  studentData: UpdateTables<'students'>
): Promise<void> {
  const supabase = createServiceClient()

  // Remove id and parent_id from update data
  const { id: _, parent_id: __, ...updateData } = studentData as Student

  const { error } = await supabase
    .from('students')
    .update(updateData)
    .eq('id', studentId)
    .eq('parent_id', parentId)

  if (error) {
    console.error('Error updating student:', error)
    throw error
  }
}

// Delete student
export async function deleteStudent(
  parentId: string,
  studentId: string
): Promise<void> {
  const supabase = createServiceClient()

  // Check if student has enrollments
  const { count } = await supabase
    .from('enrollments')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', studentId)

  if (count && count > 0) {
    throw new Error('ไม่สามารถลบนักเรียนที่มีประวัติการลงทะเบียนเรียนได้')
  }

  const { error } = await supabase
    .from('students')
    .delete()
    .eq('id', studentId)
    .eq('parent_id', parentId)

  if (error) {
    console.error('Error deleting student:', error)
    throw error
  }
}

// Check if student can be deleted
export async function canDeleteStudent(studentId: string): Promise<{
  canDelete: boolean
  reason?: string
  enrollmentCount?: number
}> {
  const supabase = createServiceClient()

  const { count, error } = await supabase
    .from('enrollments')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', studentId)

  if (error) {
    return { canDelete: false, reason: 'เกิดข้อผิดพลาดในการตรวจสอบ' }
  }

  if (count && count > 0) {
    return {
      canDelete: false,
      reason: `นักเรียนมีประวัติการลงทะเบียน ${count} คลาส`,
      enrollmentCount: count
    }
  }

  return { canDelete: true }
}

// ============================================
// COMBINED QUERIES
// ============================================

// Get all students with parent info (using view)
export async function getAllStudentsWithParents(): Promise<StudentWithParent[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('v_students_with_parents')
    .select('*')
    .order('birthdate', { ascending: true })

  if (error) {
    console.error('Error getting students with parents:', error)
    throw error
  }

  return data || []
}

// Get parent with students
export async function getParentWithStudents(
  parentId: string
): Promise<{ parent: Parent | null; students: Student[] }> {
  const supabase = createServiceClient()

  const [parentResult, studentsResult] = await Promise.all([
    supabase.from('parents').select('*').eq('id', parentId).single(),
    supabase.from('students').select('*').eq('parent_id', parentId).order('birthdate', { ascending: true })
  ])

  if (parentResult.error && parentResult.error.code !== 'PGRST116') {
    throw parentResult.error
  }

  if (studentsResult.error) {
    throw studentsResult.error
  }

  return {
    parent: parentResult.data,
    students: studentsResult.data || []
  }
}

// Get single student with parent info
export async function getStudentWithParent(
  studentId: string
): Promise<StudentWithParent | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('v_students_with_parents')
    .select('*')
    .eq('id', studentId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    console.error('Error getting student with parent:', error)
    return null
  }

  return data
}

// Get students by IDs with parent info
export async function getStudentsByIds(ids: string[]): Promise<StudentWithParent[]> {
  if (ids.length === 0) return []

  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('v_students_with_parents')
    .select('*')
    .in('id', ids)

  if (error) {
    console.error('Error getting students by IDs:', error)
    throw error
  }

  return data || []
}

// Get active students only
export async function getActiveStudents(): Promise<StudentWithParent[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('v_students_with_parents')
    .select('*')
    .eq('is_active', true)
    .order('birthdate', { ascending: true })

  if (error) {
    console.error('Error getting active students:', error)
    throw error
  }

  return data || []
}
