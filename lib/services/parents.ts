import { Parent, Student } from '@/types/models';
import { getClient } from '@/lib/supabase/client';

const TABLE_NAME = 'parents';

// Type for database row - parents table (matching actual schema)
interface ParentRow {
  id: string;
  line_user_id: string | null;
  display_name: string;
  picture_url: string | null;
  phone: string;
  emergency_phone: string | null;
  email: string | null;
  address_house_number: string | null;
  address_street: string | null;
  address_sub_district: string | null;
  address_district: string | null;
  address_province: string | null;
  address_postal_code: string | null;
  preferred_branch_id: string | null;
  created_at: string;
  last_login_at: string;
}

// Map database row to Parent model
function mapToParent(row: ParentRow): Parent {
  return {
    id: row.id,
    displayName: row.display_name,
    phone: row.phone,
    lineUserId: row.line_user_id || undefined,
    email: row.email || undefined,
    createdAt: new Date(row.created_at),
    lastLoginAt: new Date(row.last_login_at),
  };
}

// Get all parents
export async function getParents(): Promise<Parent[]> {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(row => mapToParent(row as ParentRow));
  } catch (error) {
    console.error('Error getting parents:', error);
    throw error;
  }
}

// Get parents with enrollment info for specific branch
export async function getParentsWithBranchInfo(branchId?: string): Promise<(Parent & {
  enrolledInBranch?: boolean;
  studentCountInBranch?: number;
})[]> {
  try {
    const parents = await getParents();

    if (!branchId) {
      return parents;
    }

    const { getEnrollmentsByBranch } = await import('./enrollments');
    const enrollments = await getEnrollmentsByBranch(branchId);

    const parentStudentCount = new Map<string, Set<string>>();
    enrollments.forEach(enrollment => {
      if (!parentStudentCount.has(enrollment.parentId)) {
        parentStudentCount.set(enrollment.parentId, new Set());
      }
      parentStudentCount.get(enrollment.parentId)!.add(enrollment.studentId);
    });

    return parents.map(parent => ({
      ...parent,
      enrolledInBranch: parentStudentCount.has(parent.id),
      studentCountInBranch: parentStudentCount.get(parent.id)?.size || 0
    }));
  } catch (error) {
    console.error('Error getting parents with branch info:', error);
    throw error;
  }
}

// Get single parent
export async function getParent(id: string): Promise<Parent | null> {
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

    return mapToParent(data as ParentRow);
  } catch (error) {
    console.error('Error getting parent:', error);
    throw error;
  }
}

// Get parent by LINE User ID
export async function getParentByLineId(lineUserId: string): Promise<Parent | null> {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('line_user_id', lineUserId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    if (!data) return null;

    return mapToParent(data as ParentRow);
  } catch (error) {
    console.error('Error getting parent by LINE ID:', error);
    throw error;
  }
}

// Get parent by phone number
export async function getParentByPhone(phone: string): Promise<Parent | null> {
  try {
    const cleanPhone = phone.replace(/[-\s]/g, '');
    const supabase = getClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('phone', cleanPhone)
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    if (!data) return null;

    return mapToParent(data as ParentRow);
  } catch (error) {
    console.error('Error getting parent by phone:', error);
    return null;
  }
}

// Create new parent
export async function createParent(parentData: Omit<Parent, 'id' | 'createdAt' | 'lastLoginAt'>): Promise<string> {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert({
        display_name: parentData.displayName,
        phone: parentData.phone,
        line_user_id: parentData.lineUserId || null,
        email: parentData.email || null,
      })
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error('No data returned from insert');

    return data.id;
  } catch (error) {
    console.error('Error creating parent:', error);
    throw error;
  }
}

// Update parent
export async function updateParent(id: string, parentData: Partial<Parent>): Promise<void> {
  try {
    const supabase = getClient();

    const updateData: any = {};

    if (parentData.displayName !== undefined) updateData.display_name = parentData.displayName;
    if (parentData.phone !== undefined) updateData.phone = parentData.phone;
    if (parentData.email !== undefined) updateData.email = parentData.email;
    if (parentData.lineUserId !== undefined) updateData.line_user_id = parentData.lineUserId || null;

    if (Object.keys(updateData).length === 0) {
      return;
    }

    // Fetch old values before update (for FB re-send check)
    let oldPhone: string | undefined;
    let oldEmail: string | undefined;
    if (parentData.phone !== undefined || parentData.email !== undefined) {
      const { data: oldData } = await supabase
        .from(TABLE_NAME)
        .select('phone, email')
        .eq('id', id)
        .single();
      if (oldData) {
        oldPhone = (oldData as { phone: string; email: string | null }).phone;
        oldEmail = (oldData as { phone: string; email: string | null }).email || undefined;
      }
    }

    const { error } = await supabase
      .from(TABLE_NAME)
      .update(updateData)
      .eq('id', id);

    if (error) throw error;

    // Trigger FB re-send if phone or email changed
    const phoneChanged = parentData.phone !== undefined && parentData.phone !== oldPhone;
    const emailChanged = parentData.email !== undefined && parentData.email !== oldEmail;
    if (phoneChanged || emailChanged) {
      fetch('/api/fb/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: id,
          new_phone: parentData.phone || oldPhone,
          new_email: parentData.email || oldEmail,
          old_phone: oldPhone,
          old_email: oldEmail,
        }),
      }).catch((err) => console.error('[FB CAPI] Parent update resend error:', err));
    }
  } catch (error) {
    console.error('Error updating parent:', error);
    throw error;
  }
}

// Delete parent - Uses API route to bypass RLS restrictions
export async function deleteParent(parentId: string): Promise<void> {
  try {
    const response = await fetch(`/api/admin/parents/${parentId}`, {
      method: 'DELETE',
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to delete parent');
    }

    console.log('Parent deleted successfully:', parentId);
  } catch (error) {
    console.error('Error deleting parent:', error);
    throw error;
  }
}

// Get students by parent
export async function getStudentsByParent(parentId: string): Promise<Student[]> {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('parent_id', parentId)
      .order('birthdate', { ascending: true });

    if (error) throw error;

    return (data || []).map((row: any) => ({
      id: row.id,
      parentId: row.parent_id,
      name: row.name,
      nickname: row.nickname,
      birthdate: new Date(row.birthdate),
      gender: row.gender,
      schoolName: row.school_name,
      gradeLevel: row.grade_level,
      profileImage: row.profile_image,
      allergies: row.allergies,
      specialNeeds: row.special_needs,
      emergencyContact: row.emergency_contact,
      emergencyPhone: row.emergency_phone,
      isActive: row.is_active ?? true,
    }));
  } catch (error) {
    console.error('Error getting students:', error);
    throw error;
  }
}

// Get single student
export async function getStudent(parentId: string, studentId: string): Promise<Student | null> {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('id', studentId)
      .eq('parent_id', parentId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    if (!data) return null;

    return {
      id: data.id,
      parentId: data.parent_id,
      name: data.name,
      nickname: data.nickname,
      birthdate: new Date(data.birthdate),
      gender: data.gender,
      schoolName: data.school_name,
      gradeLevel: data.grade_level,
      profileImage: data.profile_image,
      allergies: data.allergies,
      specialNeeds: data.special_needs,
      emergencyContact: data.emergency_contact,
      emergencyPhone: data.emergency_phone,
      isActive: data.is_active ?? true,
    };
  } catch (error) {
    console.error('Error getting student:', error);
    throw error;
  }
}

// Create new student
export async function createStudent(
  parentId: string,
  studentData: Omit<Student, 'id' | 'parentId'>
): Promise<string> {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('students')
      .insert({
        parent_id: parentId,
        name: studentData.name,
        nickname: studentData.nickname,
        birthdate: studentData.birthdate.toISOString(),
        gender: studentData.gender,
        school_name: studentData.schoolName || null,
        grade_level: studentData.gradeLevel || null,
        profile_image: studentData.profileImage || null,
        allergies: studentData.allergies || null,
        special_needs: studentData.specialNeeds || null,
        emergency_contact: studentData.emergencyContact || null,
        emergency_phone: studentData.emergencyPhone || null,
        is_active: studentData.isActive ?? true,
      })
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error('No data returned from insert');

    return data.id;
  } catch (error) {
    console.error('Error creating student:', error);
    throw error;
  }
}

// Update student
export async function updateStudent(
  parentId: string,
  studentId: string,
  data: Partial<Student>
): Promise<void> {
  try {
    const supabase = getClient();

    const updateData: any = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.nickname !== undefined) updateData.nickname = data.nickname;
    if (data.birthdate !== undefined) updateData.birthdate = data.birthdate.toISOString();
    if (data.gender !== undefined) updateData.gender = data.gender;
    if (data.schoolName !== undefined) updateData.school_name = data.schoolName;
    if (data.gradeLevel !== undefined) updateData.grade_level = data.gradeLevel;
    if (data.profileImage !== undefined) updateData.profile_image = data.profileImage;
    if (data.allergies !== undefined) updateData.allergies = data.allergies;
    if (data.specialNeeds !== undefined) updateData.special_needs = data.specialNeeds;
    if (data.emergencyContact !== undefined) updateData.emergency_contact = data.emergencyContact;
    if (data.emergencyPhone !== undefined) updateData.emergency_phone = data.emergencyPhone;
    if (data.isActive !== undefined) updateData.is_active = data.isActive;

    if (Object.keys(updateData).length === 0) {
      return;
    }

    const { error } = await supabase
      .from('students')
      .update(updateData)
      .eq('id', studentId)
      .eq('parent_id', parentId);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating student:', error);
    throw error;
  }
}

// Delete student - Uses API route to bypass RLS restrictions
export async function deleteStudent(
  parentId: string,
  studentId: string
): Promise<void> {
  try {
    const response = await fetch(`/api/admin/students/${studentId}`, {
      method: 'DELETE',
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to delete student');
    }

    console.log('Student deleted successfully:', studentId);
  } catch (error) {
    console.error('Error deleting student:', error);
    throw error;
  }
}

// Check if phone exists
export async function checkParentPhoneExists(phone: string, excludeId?: string): Promise<boolean> {
  try {
    const supabase = getClient();
    let query = supabase
      .from(TABLE_NAME)
      .select('id')
      .eq('phone', phone);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data || []).length > 0;
  } catch (error) {
    console.error('Error checking phone:', error);
    throw error;
  }
}

// Check if LINE User ID already exists
export async function checkLineUserIdExists(lineUserId: string): Promise<{ exists: boolean; parentId?: string }> {
  try {
    if (!lineUserId || lineUserId.trim() === '') {
      return { exists: false };
    }

    const supabase = getClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('id')
      .eq('line_user_id', lineUserId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return { exists: false };
      throw error;
    }

    if (data) {
      return {
        exists: true,
        parentId: data.id
      };
    }

    return { exists: false };
  } catch (error) {
    console.error('Error checking LINE User ID:', error);
    throw error;
  }
}

// Search parents
export async function searchParents(searchTerm: string): Promise<Parent[]> {
  try {
    const parents = await getParents();
    const term = searchTerm.toLowerCase();

    return parents.filter(parent =>
      parent.displayName.toLowerCase().includes(term) ||
      parent.phone?.toLowerCase().includes(term) ||
      parent.email?.toLowerCase().includes(term)
    );
  } catch (error) {
    console.error('Error searching parents:', error);
    throw error;
  }
}

// Get parent with students
export async function getParentWithStudents(
  parentId: string
): Promise<{ parent: Parent | null; students: Student[] }> {
  try {
    const [parent, students] = await Promise.all([
      getParent(parentId),
      getStudentsByParent(parentId)
    ]);

    return { parent, students };
  } catch (error) {
    console.error('Error getting parent with students:', error);
    throw error;
  }
}

// Get all students with parent info
export async function getAllStudentsWithParents(): Promise<(Student & {
  parentName: string;
  parentPhone: string;
  lineDisplayName?: string;
})[]> {
  try {
    const supabase = getClient();

    // Join students with parents
    const { data, error } = await supabase
      .from('students')
      .select(`
        *,
        parents:parent_id (
          id,
          display_name,
          phone
        )
      `)
      .order('birthdate', { ascending: true });

    if (error) throw error;

    return (data || []).map((row: any) => ({
      id: row.id,
      parentId: row.parent_id,
      name: row.name,
      nickname: row.nickname,
      birthdate: new Date(row.birthdate),
      gender: row.gender,
      schoolName: row.school_name,
      gradeLevel: row.grade_level,
      profileImage: row.profile_image,
      allergies: row.allergies,
      specialNeeds: row.special_needs,
      emergencyContact: row.emergency_contact,
      emergencyPhone: row.emergency_phone,
      isActive: row.is_active ?? true,
      parentName: row.parents?.display_name || 'Unknown',
      parentPhone: row.parents?.phone || '',
      lineDisplayName: row.parents?.display_name,
    }));
  } catch (error) {
    console.error('Error getting students with parents:', error);
    return [];
  }
}

// Alias for compatibility
export async function getAllStudentsWithParentsFast(): Promise<(Student & {
  parentName: string;
  parentPhone: string;
  lineDisplayName?: string;
})[]> {
  return getAllStudentsWithParents();
}

// Alias for compatibility
export async function getAllStudentsWithParentsBatch(): Promise<(Student & {
  parentName: string;
  parentPhone: string;
  lineDisplayName?: string;
})[]> {
  return getAllStudentsWithParents();
}

// Get students with enrollment info for branch
export async function getAllStudentsWithBranchInfo(branchId?: string): Promise<(Student & {
  parentName: string;
  parentPhone: string;
  lineDisplayName?: string;
  enrolledInBranch?: boolean;
  classesInBranch?: string[];
})[]> {
  try {
    const students = await getAllStudentsWithParents();

    if (!branchId) {
      return students;
    }

    const { getEnrollmentsByBranch } = await import('./enrollments');
    const enrollments = await getEnrollmentsByBranch(branchId);

    const studentEnrollments = new Map<string, string[]>();
    enrollments.forEach(enrollment => {
      if (!studentEnrollments.has(enrollment.studentId)) {
        studentEnrollments.set(enrollment.studentId, []);
      }
      studentEnrollments.get(enrollment.studentId)!.push(enrollment.classId);
    });

    return students.map(student => ({
      ...student,
      enrolledInBranch: studentEnrollments.has(student.id),
      classesInBranch: studentEnrollments.get(student.id) || []
    }));
  } catch (error) {
    console.error('Error getting students with branch info:', error);
    return [];
  }
}

// Get single student with parent info
export async function getStudentWithParent(studentId: string): Promise<(Student & {
  parentName: string;
  parentPhone: string;
  lineDisplayName?: string;
}) | null> {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('students')
      .select(`
        *,
        parents:parent_id (
          id,
          display_name,
          phone
        )
      `)
      .eq('id', studentId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    if (!data) return null;

    return {
      id: data.id,
      parentId: data.parent_id,
      name: data.name,
      nickname: data.nickname,
      birthdate: new Date(data.birthdate),
      gender: data.gender,
      schoolName: data.school_name,
      gradeLevel: data.grade_level,
      profileImage: data.profile_image,
      allergies: data.allergies,
      specialNeeds: data.special_needs,
      emergencyContact: data.emergency_contact,
      emergencyPhone: data.emergency_phone,
      isActive: data.is_active ?? true,
      parentName: data.parents?.display_name || 'Unknown',
      parentPhone: data.parents?.phone || '',
      lineDisplayName: data.parents?.display_name,
    };
  } catch (error) {
    console.error('Error getting student with parent:', error);
    return null;
  }
}

// Check if student can be deleted
export async function canDeleteStudent(studentId: string): Promise<{
  canDelete: boolean;
  reason?: string;
  enrollmentCount?: number;
}> {
  try {
    const { getEnrollmentsByStudent } = await import('./enrollments');
    const enrollments = await getEnrollmentsByStudent(studentId);

    if (enrollments.length > 0) {
      return {
        canDelete: false,
        reason: `นักเรียนมีประวัติการลงทะเบียน ${enrollments.length} คลาส`,
        enrollmentCount: enrollments.length
      };
    }

    return { canDelete: true };
  } catch (error) {
    console.error('Error checking if student can be deleted:', error);
    return {
      canDelete: false,
      reason: 'เกิดข้อผิดพลาดในการตรวจสอบ'
    };
  }
}

// Check if parent can be deleted
export async function canDeleteParent(parentId: string): Promise<{
  canDelete: boolean;
  reason?: string;
  studentCount?: number;
}> {
  try {
    const students = await getStudentsByParent(parentId);

    if (students.length > 0) {
      return {
        canDelete: false,
        reason: `ผู้ปกครองยังมีข้อมูลนักเรียน ${students.length} คน`,
        studentCount: students.length
      };
    }

    return { canDelete: true };
  } catch (error) {
    console.error('Error checking if parent can be deleted:', error);
    return {
      canDelete: false,
      reason: 'เกิดข้อผิดพลาดในการตรวจสอบ'
    };
  }
}

// Get all parents with students and enrollments in one query (optimized for list page)
export async function getParentsWithStudentsAndEnrollments(): Promise<(Parent & {
  students: (Student & {
    enrollments: { id: string; classId: string; branchId: string; status: string }[];
  })[];
})[]> {
  try {
    const supabase = getClient();

    // Get all parents with students in one query
    const { data: parentsData, error: parentsError } = await supabase
      .from('parents')
      .select(`
        *,
        students (
          *,
          enrollments (
            id,
            class_id,
            branch_id,
            status
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (parentsError) throw parentsError;

    return (parentsData || []).map((row: any) => ({
      id: row.id,
      displayName: row.display_name,
      phone: row.phone,
      lineUserId: row.line_user_id || undefined,
      email: row.email || undefined,
      pictureUrl: row.picture_url || undefined,
      preferredBranchId: row.preferred_branch_id || undefined,
      createdAt: new Date(row.created_at),
      lastLoginAt: new Date(row.last_login_at),
      students: (row.students || []).map((student: any) => ({
        id: student.id,
        parentId: student.parent_id,
        name: student.name,
        nickname: student.nickname,
        birthdate: new Date(student.birthdate),
        gender: student.gender,
        schoolName: student.school_name,
        gradeLevel: student.grade_level,
        profileImage: student.profile_image,
        allergies: student.allergies,
        specialNeeds: student.special_needs,
        emergencyContact: student.emergency_contact,
        emergencyPhone: student.emergency_phone,
        isActive: student.is_active ?? true,
        enrollments: (student.enrollments || []).map((e: any) => ({
          id: e.id,
          classId: e.class_id,
          branchId: e.branch_id,
          status: e.status,
        })),
      })),
    }));
  } catch (error) {
    console.error('Error getting parents with students and enrollments:', error);
    throw error;
  }
}
