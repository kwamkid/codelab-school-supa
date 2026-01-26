import { Teacher } from '@/types/models';
import { getClient } from '@/lib/supabase/client';
import { createAdminUserSimple } from './admin-users';

const TABLE_NAME = 'teachers';

// Type for database row
interface TeacherRow {
  id: string;
  name: string;
  nickname: string | null;
  email: string | null;
  phone: string | null;
  line_id: string | null;
  specialties: string[];
  available_branches: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Map database row to Teacher model
function mapToTeacher(row: TeacherRow): Teacher {
  return {
    id: row.id,
    name: row.name,
    nickname: row.nickname || undefined,
    email: row.email || undefined,
    phone: row.phone || undefined,
    lineUserId: row.line_id || undefined,
    specialties: row.specialties || [],
    availableBranches: row.available_branches || [],
    isActive: row.is_active,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// Get all teachers (only active ones - excluding soft deleted)
export async function getTeachers(branchId?: string): Promise<Teacher[]> {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('is_active', true) // Only get active teachers (exclude soft deleted)
      .order('name', { ascending: true });

    if (error) throw error;

    let teachers = (data || []).map(row => mapToTeacher(row as TeacherRow));

    // Filter by branch if specified
    if (branchId) {
      teachers = teachers.filter(teacher =>
        teacher.availableBranches.includes(branchId)
      );
    }

    return teachers;
  } catch (error) {
    console.error('Error getting teachers:', error);
    throw error;
  }
}

// Get active teachers only
export async function getActiveTeachers(branchId?: string): Promise<Teacher[]> {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) throw error;

    let teachers = (data || []).map(row => mapToTeacher(row as TeacherRow));

    // Filter by branch if specified
    if (branchId) {
      teachers = teachers.filter(teacher =>
        teacher.availableBranches.includes(branchId)
      );
    }

    return teachers;
  } catch (error) {
    console.error('Error getting active teachers:', error);
    throw error;
  }
}

// Get teachers by branch
export async function getTeachersByBranch(branchId: string): Promise<Teacher[]> {
  try {
    const allTeachers = await getActiveTeachers();
    return allTeachers.filter(teacher =>
      teacher.availableBranches.includes(branchId)
    );
  } catch (error) {
    console.error('Error getting teachers by branch:', error);
    throw error;
  }
}

// Get teachers by specialty
export async function getTeachersBySpecialty(subjectId: string): Promise<Teacher[]> {
  try {
    const allTeachers = await getActiveTeachers();
    return allTeachers.filter(teacher =>
      teacher.specialties.includes(subjectId)
    );
  } catch (error) {
    console.error('Error getting teachers by specialty:', error);
    throw error;
  }
}

// Get single teacher
export async function getTeacher(id: string): Promise<Teacher | null> {
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

    return mapToTeacher(data as TeacherRow);
  } catch (error) {
    console.error('Error getting teacher:', error);
    throw error;
  }
}

// Create new teacher WITH dual creation (teachers + adminUsers)
export async function createTeacher(
  teacherData: Omit<Teacher, 'id'>,
  password?: string
): Promise<string> {
  try {
    // ถ้ามี password ให้สร้าง Auth ผ่าน API
    if (password) {
      try {
        // Get token from Supabase session
        const supabase = getClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.access_token) {
          throw new Error('No auth token available');
        }

        const response = await fetch('/api/admin/create-teacher', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            email: teacherData.email,
            password,
            teacherData
          })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to create teacher with auth');
        }

        const result = await response.json();
        return result.teacherId;
      } catch (error) {
        console.error('Error creating teacher with auth:', error);
        throw error;
      }
    }

    // ถ้าไม่มี password ให้สร้างแบบเดิม (สำหรับ backward compatibility)
    // 1. สร้าง Teacher ใน teachers table ก่อน
    const supabase = getClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert({
        name: teacherData.name,
        nickname: teacherData.nickname || null,
        email: teacherData.email || null,
        phone: teacherData.phone || null,
        line_id: teacherData.lineUserId || null,
        specialties: teacherData.specialties || [],
        available_branches: teacherData.availableBranches || [],
        is_active: teacherData.isActive,
      })
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error('No data returned from insert');

    const teacherId = data.id;

    // 2. สร้าง AdminUser ด้วย ID เดียวกัน (Dual Creation)
    try {
      await createAdminUserSimple(
        teacherId, // ใช้ teacher ID เป็น user ID
        {
          email: teacherData.email || '',
          displayName: teacherData.name,
          role: 'teacher',
          branchIds: teacherData.availableBranches || [],
          permissions: {
            canManageUsers: false,
            canManageSettings: false,
            canViewReports: false,
            canManageAllBranches: false
          },
          isActive: teacherData.isActive
        },
        'system' // created by system during teacher creation
      );
    } catch (adminError) {
      console.error('Error creating admin user for teacher:', adminError);
      // ไม่ต้อง throw error - teacher ถูกสร้างแล้ว แต่ login ไม่ได้
      // Admin สามารถเพิ่มสิทธิ์ทีหลังได้
    }

    return teacherId;
  } catch (error) {
    console.error('Error creating teacher:', error);
    throw error;
  }
}

// Update teacher WITH dual update AND Supabase Auth update
export async function updateTeacher(id: string, teacherData: Partial<Teacher>): Promise<void> {
  try {
    const supabase = getClient();

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (teacherData.name !== undefined) updateData.name = teacherData.name;
    if (teacherData.nickname !== undefined) updateData.nickname = teacherData.nickname || null;
    if (teacherData.email !== undefined) updateData.email = teacherData.email || null;
    if (teacherData.phone !== undefined) updateData.phone = teacherData.phone || null;
    if (teacherData.lineUserId !== undefined) updateData.line_id = teacherData.lineUserId || null;
    if (teacherData.specialties !== undefined) updateData.specialties = teacherData.specialties;
    if (teacherData.availableBranches !== undefined) updateData.available_branches = teacherData.availableBranches;
    if (teacherData.isActive !== undefined) updateData.is_active = teacherData.isActive;

    if (Object.keys(updateData).length === 1) {
      // Only updated_at, nothing to update
      return;
    }

    // 1. Update teacher document
    const { error } = await supabase
      .from(TABLE_NAME)
      .update(updateData)
      .eq('id', id);

    if (error) throw error;

    // 2. Update adminUser ถ้ามีการเปลี่ยนแปลงข้อมูลที่เกี่ยวข้อง
    try {
      const adminUpdateData: any = {
        updated_at: new Date().toISOString(),
        updated_by: 'system',
      };

      // Update fields ที่มีผลกับ adminUser
      if (teacherData.name !== undefined) {
        adminUpdateData.display_name = teacherData.name;
      }
      if (teacherData.email !== undefined) {
        adminUpdateData.email = teacherData.email;
      }
      if (teacherData.availableBranches !== undefined) {
        adminUpdateData.branch_ids = teacherData.availableBranches;
      }
      if (teacherData.isActive !== undefined) {
        adminUpdateData.is_active = teacherData.isActive;
      }

      if (Object.keys(adminUpdateData).length > 2) {
        const { error: adminError } = await supabase
          .from('admin_users')
          .update(adminUpdateData)
          .eq('id', id);

        if (adminError) {
          console.error('Error updating admin user:', adminError);
          // Don't throw - teacher update succeeded
        }
      }
    } catch (adminError) {
      console.error('Error updating admin user for teacher:', adminError);
      // Don't throw - teacher update succeeded
    }
  } catch (error) {
    console.error('Error updating teacher:', error);
    throw error;
  }
}

// Delete teacher (soft delete) - Uses API route to bypass RLS restrictions
export async function deleteTeacher(id: string): Promise<void> {
  try {
    const response = await fetch(`/api/admin/teachers/${id}`, {
      method: 'DELETE',
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to delete teacher');
    }
  } catch (error) {
    console.error('Error deleting teacher:', error);
    throw error;
  }
}

// Check if email exists
export async function checkTeacherEmailExists(email: string, excludeId?: string): Promise<boolean> {
  try {
    const supabase = getClient();
    let query = supabase
      .from(TABLE_NAME)
      .select('id')
      .eq('email', email.toLowerCase());

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data || []).length > 0;
  } catch (error) {
    console.error('Error checking teacher email:', error);
    throw error;
  }
}

// Get teacher statistics
export async function getTeacherStats(teacherId: string): Promise<{
  totalClasses: number;
  activeClasses: number;
  totalStudents: number;
}> {
  // This will be implemented when we have the classes system
  return {
    totalClasses: 0,
    activeClasses: 0,
    totalStudents: 0,
  };
}

// Sync existing teachers to adminUsers AND create Supabase Auth users
export async function syncTeachersToAdminUsers(): Promise<{
  success: number;
  failed: number;
  errors: string[];
  needsAuthCreation: string[]; // Teacher IDs that need Supabase Auth creation
}> {
  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[],
    needsAuthCreation: [] as string[]
  };

  try {
    const teachers = await getTeachers();
    const teachersNeedingAuth: string[] = [];
    const supabase = getClient();

    // Phase 1: Create adminUsers documents
    for (const teacher of teachers) {
      try {
        // Check if adminUser already exists
        const { data: adminUserDoc, error: checkError } = await supabase
          .from('admin_users')
          .select('*')
          .eq('id', teacher.id)
          .single();

        if (checkError && checkError.code !== 'PGRST116') {
          throw checkError;
        }

        if (!adminUserDoc) {
          // Create adminUser for existing teacher
          await createAdminUserSimple(
            teacher.id,
            {
              email: teacher.email || '',
              displayName: teacher.name,
              role: 'teacher',
              branchIds: teacher.availableBranches || [],
              permissions: {
                canManageUsers: false,
                canManageSettings: false,
                canViewReports: false,
                canManageAllBranches: false
              },
              isActive: teacher.isActive
            },
            'migration'
          );
          teachersNeedingAuth.push(teacher.id);
          results.success++;
        } else {
          // Check if needs auth creation
          if (!adminUserDoc.auth_user_id) {
            teachersNeedingAuth.push(teacher.id);
          }
          results.success++;
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`Failed to sync teacher ${teacher.name}: ${error}`);
      }
    }

    // Phase 2: Create Supabase Auth users (if any)
    if (teachersNeedingAuth.length > 0) {
      try {
        // Get token from Supabase session
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.access_token) {
          throw new Error('No auth token available');
        }

        // Call API to create auth users
        const response = await fetch('/api/admin/migrate-teachers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            teacherIds: teachersNeedingAuth
          })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to create auth users');
        }

        const authResult = await response.json();
        console.log('Auth creation result:', authResult);

        // Update needsAuthCreation list based on results
        results.needsAuthCreation = authResult.results.failed.map((f: any) => f.id);

      } catch (error) {
        console.error('Error creating auth users:', error);
        results.errors.push(`Failed to create Supabase Auth users: ${error}`);
        results.needsAuthCreation = teachersNeedingAuth;
      }
    }

    return results;
  } catch (error) {
    console.error('Error syncing teachers:', error);
    throw error;
  }
}