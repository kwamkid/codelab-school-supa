// lib/services/data-cleaning.ts
import type { Student } from '@/types/models';

// ============================================
// 🔍 Types
// ============================================
export interface OrphanedStudent extends Student {
  parentName: string;
  canDelete: boolean;
  hasEnrollments: boolean;
}

export interface DataCleaningStats {
  totalParents: number;
  totalStudents: number;
  validStudents: number;
  orphanedStudents: number;
  orphanedMakeups: number;
}

// ============================================
// 🔍 Check Orphaned Students
// ============================================
export async function getOrphanedStudents(): Promise<OrphanedStudent[]> {
  try {
    console.time('getOrphanedStudents');
    
    // Step 1: Get all parent IDs
    const parentsSnapshot = await getDocs(collection(db, 'parents'));
    const validParentIds = new Set(parentsSnapshot.docs.map(doc => doc.id));
    
    // Step 2: Get all students
    const studentsSnapshot = await getDocs(collectionGroup(db, 'students'));
    
    // Step 3: Find orphaned students
    const orphanedStudents: OrphanedStudent[] = [];
    
    for (const studentDoc of studentsSnapshot.docs) {
      const parentId = studentDoc.ref.parent.parent?.id;
      
      if (!parentId || !validParentIds.has(parentId)) {
        const data = studentDoc.data();
        
        // Check if has enrollments
        const { getEnrollmentsByStudent } = await import('./enrollments');
        const enrollments = await getEnrollmentsByStudent(studentDoc.id);
        
        orphanedStudents.push({
          id: studentDoc.id,
          parentId: parentId || 'unknown',
          name: data.name || 'Unknown',
          nickname: data.nickname || '-',
          birthdate: data.birthdate?.toDate ? data.birthdate.toDate() : new Date(),
          gender: data.gender || 'M',
          schoolName: data.schoolName,
          gradeLevel: data.gradeLevel,
          profileImage: data.profileImage,
          allergies: data.allergies,
          specialNeeds: data.specialNeeds,
          emergencyContact: data.emergencyContact,
          emergencyPhone: data.emergencyPhone,
          isActive: data.isActive ?? true,
          parentName: 'ไม่พบผู้ปกครอง',
          canDelete: enrollments.length === 0,
          hasEnrollments: enrollments.length > 0
        });
      }
    }
    
    console.timeEnd('getOrphanedStudents');
    return orphanedStudents;
    
  } catch (error) {
    console.error('Error getting orphaned students:', error);
    throw error;
  }
}

// ============================================
// 📊 Get Data Cleaning Stats
// ============================================
export async function getDataCleaningStats(): Promise<DataCleaningStats> {
  try {
    console.time('getDataCleaningStats');
    
    // Get counts in parallel
    const [parentsSnapshot, studentsSnapshot] = await Promise.all([
      getDocs(collection(db, 'parents')),
      getDocs(collectionGroup(db, 'students'))
    ]);
    
    const validParentIds = new Set(parentsSnapshot.docs.map(doc => doc.id));
    
    let orphanedCount = 0;
    studentsSnapshot.docs.forEach(doc => {
      const parentId = doc.ref.parent.parent?.id;
      if (!parentId || !validParentIds.has(parentId)) {
        orphanedCount++;
      }
    });
    
    // Check orphaned makeups (optional - can be slow)
    const makeupsSnapshot = await getDocs(collection(db, 'makeupClasses'));
    let orphanedMakeupsCount = 0;
    
    for (const makeupDoc of makeupsSnapshot.docs) {
      const data = makeupDoc.data();
      if (data.originalClassId) {
        const classDoc = await getDocs(collection(db, 'classes'));
        const classExists = classDoc.docs.some(c => c.id === data.originalClassId);
        if (!classExists) {
          orphanedMakeupsCount++;
        }
      }
    }
    
    console.timeEnd('getDataCleaningStats');
    
    return {
      totalParents: parentsSnapshot.size,
      totalStudents: studentsSnapshot.size,
      validStudents: studentsSnapshot.size - orphanedCount,
      orphanedStudents: orphanedCount,
      orphanedMakeups: orphanedMakeupsCount
    };
    
  } catch (error) {
    console.error('Error getting data cleaning stats:', error);
    throw error;
  }
}

// ============================================
// 🗑️ Delete Orphaned Student
// ============================================
export async function deleteOrphanedStudent(
  parentId: string, 
  studentId: string
): Promise<void> {
  try {
    // Double check has no enrollments
    const { getEnrollmentsByStudent } = await import('./enrollments');
    const enrollments = await getEnrollmentsByStudent(studentId);
    
    if (enrollments.length > 0) {
      throw new Error('ไม่สามารถลบนักเรียนที่มีประวัติการลงทะเบียนได้');
    }
    
    // Delete student document
    const studentRef = doc(db, 'parents', parentId, 'students', studentId);
    await deleteDoc(studentRef);
    
    console.log('Orphaned student deleted:', studentId);
  } catch (error) {
    console.error('Error deleting orphaned student:', error);
    throw error;
  }
}