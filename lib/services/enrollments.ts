import { Enrollment, Class } from '@/types/models';
import { getClient } from '@/lib/supabase/client';
import { getClassSchedules } from './classes';
import { createMakeupRequest } from './makeup';
import { getClass } from './classes';

const TABLE_NAME = 'enrollments';

// ============================================
// Database Row Interface (snake_case)
// ============================================
interface EnrollmentRow {
  id: string;
  student_id: string;
  class_id: string;
  parent_id: string;
  branch_id: string;
  enrolled_at: string;
  status: 'active' | 'completed' | 'dropped' | 'transferred';
  original_price: number;
  discount: number;
  discount_type: 'percentage' | 'fixed';
  final_price: number;
  promotion_code: string | null;
  payment_method: 'cash' | 'transfer' | 'credit';
  payment_status: 'pending' | 'partial' | 'paid';
  paid_amount: number;
  paid_date: string | null;
  receipt_number: string | null;
  transferred_from: string | null;
  dropped_reason: string | null;
}

// ============================================
// Mapping Functions
// ============================================
function mapToEnrollment(row: EnrollmentRow): Enrollment {
  return {
    id: row.id,
    studentId: row.student_id,
    classId: row.class_id,
    parentId: row.parent_id,
    branchId: row.branch_id,
    enrolledAt: new Date(row.enrolled_at),
    status: row.status,
    pricing: {
      originalPrice: row.original_price,
      discount: row.discount,
      discountType: row.discount_type,
      finalPrice: row.final_price,
      promotionCode: row.promotion_code || undefined,
    },
    payment: {
      method: row.payment_method,
      status: row.payment_status,
      paidAmount: row.paid_amount,
      paidDate: row.paid_date ? new Date(row.paid_date) : undefined,
      receiptNumber: row.receipt_number || undefined,
    },
    transferredFrom: row.transferred_from || undefined,
    droppedReason: row.dropped_reason || undefined,
  };
}

// ============================================
// Query Options Interface
// ============================================
export interface EnrollmentQueryOptions {
  branchId?: string | null;
  status?: string;
  paymentStatus?: string;
  limit?: number;
  offset?: number;
  orderByField?: 'enrolledAt' | 'createdAt';
  orderDirection?: 'asc' | 'desc';
}

export interface PaginatedEnrollments {
  enrollments: Enrollment[];
  hasMore: boolean;
  total?: number;
}

// ============================================
// Get Enrollments with Pagination
// ============================================
export async function getEnrollmentsPaginated(
  options: EnrollmentQueryOptions = {}
): Promise<PaginatedEnrollments> {
  try {
    const {
      branchId,
      status,
      paymentStatus,
      limit: pageSize = 20,
      offset = 0,
      orderByField = 'enrolledAt',
      orderDirection = 'desc'
    } = options;

    const supabase = getClient();

    // Build query
    let query = supabase
      .from(TABLE_NAME)
      .select('*', { count: 'exact' });

    // Branch filter
    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    // Status filter
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    // Payment status filter
    if (paymentStatus && paymentStatus !== 'all') {
      query = query.eq('payment_status', paymentStatus);
    }

    // Order by
    const orderField = orderByField === 'enrolledAt' ? 'enrolled_at' : 'created_at';
    query = query.order(orderField, { ascending: orderDirection === 'asc' });

    // Pagination - get limit + 1 to check if there's more
    query = query.range(offset, offset + pageSize);

    const { data, error, count } = await query;

    if (error) throw error;

    const enrollments = (data || []).map((row: any) => mapToEnrollment(row as EnrollmentRow));
    const hasMore = enrollments.length > pageSize;

    return {
      enrollments: hasMore ? enrollments.slice(0, pageSize) : enrollments,
      hasMore,
      total: count || 0
    };
  } catch (error) {
    console.error('Error getting enrollments paginated:', error);
    throw error;
  }
}

// ============================================
// Get Enrollment Stats
// ============================================
export interface EnrollmentStats {
  total: number;
  active: number;
  completed: number;
  dropped: number;
  totalRevenue: number;
  pendingPayments: number;
  pendingCount: number;
  partialCount: number;
  paidCount: number;
}

export async function getEnrollmentStats(branchId?: string | null): Promise<EnrollmentStats> {
  try {
    const supabase = getClient();

    let query = supabase.from(TABLE_NAME).select('*');

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query;

    if (error) throw error;

    const stats: EnrollmentStats = {
      total: data?.length || 0,
      active: 0,
      completed: 0,
      dropped: 0,
      totalRevenue: 0,
      pendingPayments: 0,
      pendingCount: 0,
      partialCount: 0,
      paidCount: 0
    };

    (data || []).forEach((row: any) => {
      // Count by status
      if (row.status === 'active') stats.active++;
      else if (row.status === 'completed') stats.completed++;
      else if (row.status === 'dropped') stats.dropped++;

      // Count by payment status
      if (row.payment_status === 'pending') {
        stats.pendingCount++;
        stats.pendingPayments += row.final_price || 0;
      } else if (row.payment_status === 'partial') {
        stats.partialCount++;
        stats.pendingPayments += (row.final_price || 0) - (row.paid_amount || 0);
      } else if (row.payment_status === 'paid') {
        stats.paidCount++;
        stats.totalRevenue += row.paid_amount || 0;
      }
    });

    return stats;
  } catch (error) {
    console.error('Error getting enrollment stats:', error);
    return {
      total: 0,
      active: 0,
      completed: 0,
      dropped: 0,
      totalRevenue: 0,
      pendingPayments: 0,
      pendingCount: 0,
      partialCount: 0,
      paidCount: 0
    };
  }
}

// ============================================
// Get all enrollments (Legacy - for search fallback)
// ============================================
export async function getEnrollments(branchId?: string | null): Promise<Enrollment[]> {
  try {
    const supabase = getClient();

    let query = supabase
      .from(TABLE_NAME)
      .select('*')
      .order('enrolled_at', { ascending: false });

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data || []).map((row: any) => mapToEnrollment(row as EnrollmentRow));
  } catch (error) {
    console.error('Error getting enrollments:', error);
    throw error;
  }
}

// ============================================
// Get enrollments by class
// ============================================
export async function getEnrollmentsByClass(classId: string): Promise<Enrollment[]> {
  try {
    const supabase = getClient();

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('class_id', classId)
      .in('status', ['active', 'completed'])
      .order('enrolled_at', { ascending: true });

    if (error) throw error;

    return (data || []).map((row: any) => mapToEnrollment(row as EnrollmentRow));
  } catch (error) {
    console.error('Error getting enrollments by class:', error);
    throw error;
  }
}

// ============================================
// Get enrollments by student
// ============================================
export async function getEnrollmentsByStudent(studentId: string): Promise<Enrollment[]> {
  try {
    const supabase = getClient();

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('student_id', studentId)
      .in('status', ['active', 'completed'])
      .order('enrolled_at', { ascending: false });

    if (error) throw error;

    // Get transfer history for each enrollment
    const enrollments = await Promise.all(
      (data || []).map(async (row: any) => {
        const enrollment = mapToEnrollment(row as EnrollmentRow);

        // Fetch transfer history
        const transferHistory = await getEnrollmentTransferHistory(enrollment.id);
        if (transferHistory.length > 0) {
          enrollment.transferHistory = transferHistory;
        }

        return enrollment;
      })
    );

    return enrollments;
  } catch (error) {
    console.error('Error getting enrollments by student:', error);
    return [];
  }
}

// ============================================
// Get enrollments by parent
// ============================================
export async function getEnrollmentsByParent(parentId: string): Promise<Enrollment[]> {
  try {
    const supabase = getClient();

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('parent_id', parentId)
      .order('enrolled_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((row: any) => mapToEnrollment(row as EnrollmentRow));
  } catch (error) {
    console.error('Error getting enrollments by parent:', error);
    throw error;
  }
}

// ============================================
// Get enrollments by branch
// ============================================
export async function getEnrollmentsByBranch(branchId: string): Promise<Enrollment[]> {
  try {
    const supabase = getClient();

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('branch_id', branchId)
      .order('enrolled_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((row: any) => mapToEnrollment(row as EnrollmentRow));
  } catch (error) {
    console.error('Error getting enrollments by branch:', error);
    return [];
  }
}

// ============================================
// Get single enrollment
// ============================================
export async function getEnrollment(id: string): Promise<Enrollment | null> {
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

    return mapToEnrollment(data as EnrollmentRow);
  } catch (error) {
    console.error('Error getting enrollment:', error);
    throw error;
  }
}

// ============================================
// Check if student is already enrolled in class
// ============================================
export async function checkDuplicateEnrollment(
  studentId: string,
  classId: string
): Promise<boolean> {
  try {
    const supabase = getClient();

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('id, status')
      .eq('student_id', studentId)
      .eq('class_id', classId)
      .in('status', ['active', 'completed']);

    if (error) throw error;

    return (data || []).length > 0;
  } catch (error) {
    console.error('Error checking duplicate enrollment:', error);
    throw error;
  }
}

// ============================================
// Create new enrollment with atomic update
// ============================================
export async function createEnrollment(
  enrollmentData: Omit<Enrollment, 'id' | 'enrolledAt'>
): Promise<string> {
  try {
    const supabase = getClient();

    // Prepare enrollment data
    const insertData: any = {
      student_id: enrollmentData.studentId,
      class_id: enrollmentData.classId,
      parent_id: enrollmentData.parentId,
      branch_id: enrollmentData.branchId,
      status: enrollmentData.status,
      original_price: enrollmentData.pricing.originalPrice,
      discount: enrollmentData.pricing.discount,
      discount_type: enrollmentData.pricing.discountType,
      final_price: enrollmentData.pricing.finalPrice,
      payment_method: enrollmentData.payment.method,
      payment_status: enrollmentData.payment.status,
      paid_amount: enrollmentData.payment.paidAmount,
    };

    // Optional fields
    if (enrollmentData.pricing.promotionCode) {
      insertData.promotion_code = enrollmentData.pricing.promotionCode;
    }
    if (enrollmentData.payment.paidDate) {
      insertData.paid_date = enrollmentData.payment.paidDate.toISOString();
    }
    if (enrollmentData.payment.receiptNumber) {
      insertData.receipt_number = enrollmentData.payment.receiptNumber;
    }
    if (enrollmentData.transferredFrom) {
      insertData.transferred_from = enrollmentData.transferredFrom;
    }

    // Insert enrollment
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error('No data returned from insert');

    const enrollmentId = data.id;

    // Update class enrolled count
    const { error: classError } = await supabase.rpc('increment_enrolled_count', {
      class_id: enrollmentData.classId
    });

    if (classError) {
      // Fallback: manual update
      const classData = await getClass(enrollmentData.classId);
      if (classData) {
        await supabase
          .from('classes')
          .update({ enrolled_count: classData.enrolledCount + 1 })
          .eq('id', enrollmentData.classId);
      }
    }

    // Create makeup requests for missed sessions
    await createMakeupForMissedSessions(
      enrollmentId,
      enrollmentData.classId,
      enrollmentData.studentId,
      enrollmentData.parentId
    );

    return enrollmentId;
  } catch (error) {
    console.error('Error creating enrollment:', error);
    throw error;
  }
}

async function createMakeupForMissedSessions(
  enrollmentId: string,
  classId: string,
  studentId: string,
  parentId: string
): Promise<void> {
  try {
    const classData = await getClass(classId);
    if (!classData) return;

    const schedules = await getClassSchedules(classId);

    const now = new Date();
    const missedSchedules = schedules.filter(schedule => {
      const sessionDate = new Date(schedule.sessionDate);
      const [hours, minutes] = classData.endTime.split(':').map(Number);
      sessionDate.setHours(hours, minutes, 0, 0);

      return sessionDate < now &&
             schedule.status !== 'cancelled' &&
             schedule.status !== 'rescheduled';
    });

    for (const schedule of missedSchedules) {
      try {
        await createMakeupRequest({
          type: 'ad-hoc',
          originalClassId: classId,
          originalScheduleId: schedule.id,
          studentId: studentId,
          parentId: parentId,
          requestDate: new Date(),
          requestedBy: parentId, // Use parent ID for auto-generated requests
          reason: 'สมัครเรียนหลังจากคลาสเริ่มแล้ว (Auto-generated)',
          status: 'pending',
          originalSessionNumber: schedule.sessionNumber,
          originalSessionDate: schedule.sessionDate
        });

        console.log(`Created makeup request for session ${schedule.sessionNumber}`);
      } catch (error) {
        console.error(`Error creating makeup for session ${schedule.sessionNumber}:`, error);
      }
    }

    if (missedSchedules.length > 0) {
      console.log(`Created ${missedSchedules.length} makeup requests for enrollment ${enrollmentId}`);

      const { getStudent } = await import('./parents');
      const studentInfo = await getStudent(parentId, studentId);

      if (studentInfo && classData) {
        const { notifyAdminNewMakeup } = await import('./notifications');
        await notifyAdminNewMakeup(
          studentInfo.nickname || studentInfo.name,
          classData.name,
          missedSchedules.length
        );
      }
    }
  } catch (error) {
    console.error('Error creating makeup for missed sessions:', error);
  }
}

// ============================================
// Update enrollment
// ============================================
export async function updateEnrollment(
  id: string,
  enrollmentData: Partial<Enrollment>
): Promise<void> {
  try {
    const supabase = getClient();

    const updateData: any = {};

    // Status
    if (enrollmentData.status !== undefined) {
      updateData.status = enrollmentData.status;
    }

    // Pricing fields
    if (enrollmentData.pricing) {
      if (enrollmentData.pricing.originalPrice !== undefined) {
        updateData.original_price = enrollmentData.pricing.originalPrice;
      }
      if (enrollmentData.pricing.discount !== undefined) {
        updateData.discount = enrollmentData.pricing.discount;
      }
      if (enrollmentData.pricing.discountType !== undefined) {
        updateData.discount_type = enrollmentData.pricing.discountType;
      }
      if (enrollmentData.pricing.finalPrice !== undefined) {
        updateData.final_price = enrollmentData.pricing.finalPrice;
      }
      if (enrollmentData.pricing.promotionCode !== undefined) {
        updateData.promotion_code = enrollmentData.pricing.promotionCode || null;
      }
    }

    // Payment fields
    if (enrollmentData.payment) {
      if (enrollmentData.payment.method !== undefined) {
        updateData.payment_method = enrollmentData.payment.method;
      }
      if (enrollmentData.payment.status !== undefined) {
        updateData.payment_status = enrollmentData.payment.status;
      }
      if (enrollmentData.payment.paidAmount !== undefined) {
        updateData.paid_amount = enrollmentData.payment.paidAmount;
      }
      if (enrollmentData.payment.paidDate !== undefined) {
        updateData.paid_date = enrollmentData.payment.paidDate
          ? enrollmentData.payment.paidDate.toISOString()
          : null;
      }
      if (enrollmentData.payment.receiptNumber !== undefined) {
        updateData.receipt_number = enrollmentData.payment.receiptNumber || null;
      }
    }

    // Other fields
    if (enrollmentData.droppedReason !== undefined) {
      updateData.dropped_reason = enrollmentData.droppedReason || null;
    }

    if (Object.keys(updateData).length === 0) {
      return;
    }

    const { error } = await supabase
      .from(TABLE_NAME)
      .update(updateData)
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating enrollment:', error);
    throw error;
  }
}

// ============================================
// Cancel enrollment
// ============================================
export async function cancelEnrollment(
  id: string,
  reason: string
): Promise<void> {
  try {
    const enrollment = await getEnrollment(id);
    if (!enrollment) throw new Error('Enrollment not found');

    const supabase = getClient();

    // Update enrollment status
    const { error: enrollmentError } = await supabase
      .from(TABLE_NAME)
      .update({
        status: 'dropped',
        dropped_reason: reason
      })
      .eq('id', id);

    if (enrollmentError) throw enrollmentError;

    // Decrement class enrolled count
    const { error: classError } = await supabase.rpc('decrement_enrolled_count', {
      class_id: enrollment.classId
    });

    if (classError) {
      // Fallback: manual update
      const classData = await getClass(enrollment.classId);
      if (classData) {
        await supabase
          .from('classes')
          .update({ enrolled_count: Math.max(0, classData.enrolledCount - 1) })
          .eq('id', enrollment.classId);
      }
    }
  } catch (error) {
    console.error('Error canceling enrollment:', error);
    throw error;
  }
}

// ============================================
// Check available seats in class
// ============================================
export async function checkAvailableSeats(classId: string): Promise<{
  available: boolean;
  currentEnrolled: number;
  maxStudents: number;
  availableSeats: number;
}> {
  try {
    const classData = await getClass(classId);
    if (!classData) throw new Error('Class not found');

    const availableSeats = classData.maxStudents - classData.enrolledCount;

    return {
      available: availableSeats > 0,
      currentEnrolled: classData.enrolledCount,
      maxStudents: classData.maxStudents,
      availableSeats: Math.max(0, availableSeats)
    };
  } catch (error) {
    console.error('Error checking available seats:', error);
    return {
      available: false,
      currentEnrolled: 0,
      maxStudents: 0,
      availableSeats: 0
    };
  }
}

// ============================================
// Transfer enrollment to another class
// ============================================
export async function transferEnrollment(
  enrollmentId: string,
  newClassId: string,
  reason?: string
): Promise<void> {
  try {
    const enrollment = await getEnrollment(enrollmentId);
    if (!enrollment) throw new Error('Enrollment not found');

    const supabase = getClient();

    // Create transfer history record
    const { error: historyError } = await supabase
      .from('enrollment_transfer_history')
      .insert({
        enrollment_id: enrollmentId,
        from_class_id: enrollment.classId,
        to_class_id: newClassId,
        reason: reason || 'Admin transfer'
      });

    if (historyError) throw historyError;

    // Update enrollment
    const { error: enrollmentError } = await supabase
      .from(TABLE_NAME)
      .update({
        class_id: newClassId,
        status: 'active'
      })
      .eq('id', enrollmentId);

    if (enrollmentError) throw enrollmentError;

    // Update old class count
    const oldClass = await getClass(enrollment.classId);
    if (oldClass) {
      await supabase
        .from('classes')
        .update({ enrolled_count: Math.max(0, oldClass.enrolledCount - 1) })
        .eq('id', enrollment.classId);
    }

    // Update new class count
    const newClass = await getClass(newClassId);
    if (newClass) {
      await supabase
        .from('classes')
        .update({ enrolled_count: newClass.enrolledCount + 1 })
        .eq('id', newClassId);
    }
  } catch (error) {
    console.error('Error transferring enrollment:', error);
    throw error;
  }
}

// ============================================
// Get classes available for transfer
// ============================================
export async function getAvailableClassesForTransfer(
  studentId: string,
  currentClassId: string,
  studentAge: number
): Promise<{
  eligibleClasses: Class[];
  allClasses: Class[];
}> {
  try {
    const { getClasses } = await import('./classes');
    const { getSubjects } = await import('./subjects');

    const [allClasses, subjects] = await Promise.all([
      getClasses(),
      getSubjects()
    ]);

    const subjectMap = new Map(subjects.map(s => [s.id, s]));

    const availableClasses = allClasses.filter(cls => {
      if (cls.id === currentClassId) return false;
      return true;
    });

    const eligibleClasses = availableClasses.filter(cls => {
      const subject = subjectMap.get(cls.subjectId);
      if (!subject) return false;

      return studentAge >= subject.ageRange.min &&
             studentAge <= subject.ageRange.max;
    });

    const enrichClasses = (classes: Class[]) =>
      classes.map(cls => ({
        ...cls,
        subject: subjectMap.get(cls.subjectId)
      }));

    return {
      eligibleClasses: enrichClasses(eligibleClasses),
      allClasses: enrichClasses(availableClasses)
    };
  } catch (error) {
    console.error('Error getting available classes:', error);
    return {
      eligibleClasses: [],
      allClasses: []
    };
  }
}

// ============================================
// Get transfer history for enrollment
// ============================================
export async function getEnrollmentTransferHistory(
  enrollmentId: string
): Promise<Array<{
  fromClassId: string;
  toClassId: string;
  transferredAt: Date;
  reason: string;
}>> {
  try {
    const supabase = getClient();

    const { data, error } = await supabase
      .from('enrollment_transfer_history')
      .select('*')
      .eq('enrollment_id', enrollmentId)
      .order('transferred_at', { ascending: true });

    if (error) throw error;

    return (data || []).map((row: any) => ({
      fromClassId: row.from_class_id,
      toClassId: row.to_class_id,
      transferredAt: new Date(row.transferred_at),
      reason: row.reason || ''
    }));
  } catch (error) {
    console.error('Error getting transfer history:', error);
    return [];
  }
}

// ============================================
// Delete enrollment completely - Uses API route to bypass RLS restrictions
// ============================================
export async function deleteEnrollment(
  enrollmentId: string
): Promise<void> {
  try {
    const response = await fetch(`/api/admin/enrollments/${enrollmentId}`, {
      method: 'DELETE',
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to delete enrollment');
    }
  } catch (error) {
    console.error('Error deleting enrollment:', error);
    throw error;
  }
}
