// lib/services/notification-logger.ts

import { createServiceClient } from '@/lib/supabase/server';

export interface NotificationLog {
  id?: string;
  type: 'class-reminder' | 'makeup-reminder' | 'makeup-scheduled' | 'trial-confirmation' | 'feedback' | 'schedule-change' | 'payment-reminder';
  recipientType: 'parent' | 'student' | 'teacher';
  recipientId?: string;
  recipientName?: string;
  lineUserId?: string;
  studentId?: string;
  studentName?: string;
  classId?: string;
  className?: string;
  scheduleId?: string;
  makeupId?: string;
  messagePreview?: string;
  status: 'success' | 'failed';
  errorMessage?: string;
  sentAt?: Date;
}

/**
 * บันทึก notification log
 */
export async function logNotification(log: NotificationLog): Promise<void> {
  try {
    const supabase = createServiceClient();

    const { error } = await supabase.from('notification_logs').insert({
      type: log.type,
      recipient_type: log.recipientType,
      recipient_id: log.recipientId,
      recipient_name: log.recipientName,
      line_user_id: log.lineUserId,
      student_id: log.studentId,
      student_name: log.studentName,
      class_id: log.classId,
      class_name: log.className,
      schedule_id: log.scheduleId,
      makeup_id: log.makeupId,
      message_preview: log.messagePreview,
      status: log.status,
      error_message: log.errorMessage,
      sent_at: log.sentAt || new Date()
    });

    if (error) {
      console.error('[logNotification] Error saving log:', error);
    }
  } catch (error) {
    console.error('[logNotification] Exception:', error);
  }
}

/**
 * ดึง notification logs
 */
export async function getNotificationLogs(filters?: {
  type?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}): Promise<{ data: any[]; total: number }> {
  try {
    const supabase = createServiceClient();

    let query = supabase
      .from('notification_logs')
      .select('*', { count: 'exact' })
      .order('sent_at', { ascending: false });

    if (filters?.type) {
      query = query.eq('type', filters.type);
    }

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.startDate) {
      query = query.gte('sent_at', filters.startDate.toISOString());
    }

    if (filters?.endDate) {
      query = query.lte('sent_at', filters.endDate.toISOString());
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      data: data || [],
      total: count || 0
    };
  } catch (error) {
    console.error('[getNotificationLogs] Error:', error);
    return { data: [], total: 0 };
  }
}

/**
 * ดึงสถิติ notification logs
 */
export async function getNotificationStats(filters?: {
  startDate?: Date;
  endDate?: Date;
}): Promise<{
  total: number;
  success: number;
  failed: number;
  byType: Record<string, { success: number; failed: number }>;
}> {
  try {
    const supabase = createServiceClient();

    let query = supabase
      .from('notification_logs')
      .select('type, status');

    if (filters?.startDate) {
      query = query.gte('sent_at', filters.startDate.toISOString());
    }

    if (filters?.endDate) {
      query = query.lte('sent_at', filters.endDate.toISOString());
    }

    const { data, error } = await query;

    if (error) throw error;

    const stats = {
      total: data?.length || 0,
      success: 0,
      failed: 0,
      byType: {} as Record<string, { success: number; failed: number }>
    };

    (data || []).forEach((log) => {
      if (log.status === 'success') {
        stats.success++;
      } else {
        stats.failed++;
      }

      if (!stats.byType[log.type]) {
        stats.byType[log.type] = { success: 0, failed: 0 };
      }

      if (log.status === 'success') {
        stats.byType[log.type].success++;
      } else {
        stats.byType[log.type].failed++;
      }
    });

    return stats;
  } catch (error) {
    console.error('[getNotificationStats] Error:', error);
    return {
      total: 0,
      success: 0,
      failed: 0,
      byType: {}
    };
  }
}
