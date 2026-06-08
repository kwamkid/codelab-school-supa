// lib/supabase/services/line-queue.ts
// Processes the LINE notification outbox queue: resolves each pending row,
// pushes the LINE message(s), and marks the row sent/failed (with retry).
// Shared by the immediate-process route and the hourly cron safety-net.

import { createServiceClient } from '../server';
import { getLineSettings } from './line-settings';
import { sendMakeupNotification } from './line-notifications';
import { logNotification } from '@/lib/services/notification-logger';

const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push';
const MAX_RETRY = 5;

interface ProcessResult {
  processed: number;
  sent: number;
  failed: number;
  skipped?: string;
}

export async function processLineQueue(limit = 100): Promise<ProcessResult> {
  const settings = await getLineSettings();
  const token = settings?.messagingChannelAccessToken;
  if (!settings?.enableNotifications || !token) {
    return { processed: 0, sent: 0, failed: 0, skipped: 'notifications disabled' };
  }

  const supabase = createServiceClient() as any;

  // Pending rows that still have retries left, oldest first
  const { data: rows } = await supabase
    .from('line_notification_queue')
    .select('*')
    .eq('status', 'pending')
    .lt('retry_count', MAX_RETRY)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (!rows || rows.length === 0) return { processed: 0, sent: 0, failed: 0 };

  // Small caches across rows
  const classCache = new Map<string, any>();
  const subjectCache = new Map<string, any>();
  const teacherCache = new Map<string, any>();

  let sent = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      // Dispatch by type → 'sent' (delivered), 'noop' (nothing to send), or { error }
      let outcome: 'sent' | 'noop' | { error: string };

      if (row.type === 'feedback') {
        if (settings.enableFeedbackNotifications === false) {
          outcome = 'noop'; // feedback notifications turned off in settings
        } else {
          const built = await buildFeedbackMessages(supabase, row, { classCache, subjectCache, teacherCache });
          if (!built) {
            outcome = 'noop';
          } else {
            outcome = await pushLine(token, built.to, built.messages);
            await logNotification({
              type: 'feedback',
              recipientType: 'parent',
              lineUserId: built.to,
              studentId: built.meta.studentId,
              studentName: built.meta.studentName,
              classId: built.meta.classId,
              className: built.meta.className,
              scheduleId: built.meta.scheduleId,
              messagePreview: built.meta.messagePreview,
              status: outcome === 'sent' ? 'success' : 'failed',
              errorMessage: outcome === 'sent' ? undefined : outcome.error,
            });
          }
        }
      } else if (row.type === 'makeup') {
        const ok = await sendMakeupNotification(row.ref_id, (row.payload?.kind as any) || 'scheduled');
        outcome = ok ? 'sent' : { error: 'sendMakeupNotification returned false' };
      } else if (row.type === 'custom') {
        const to = row.payload?.to;
        const messages = row.payload?.messages;
        outcome = to && Array.isArray(messages) && messages.length ? await pushLine(token, to, messages) : 'noop';
      } else {
        outcome = { error: `unknown type: ${row.type}` };
      }

      if (outcome === 'sent' || outcome === 'noop') {
        await supabase
          .from('line_notification_queue')
          .update({ status: 'sent', sent_at: new Date().toISOString(), last_error: null })
          .eq('id', row.id);
        if (outcome === 'sent') sent++;
      } else {
        await markFailed(supabase, row, outcome.error);
        failed++;
      }
    } catch (e: any) {
      await markFailed(supabase, row, e?.message || 'error');
      failed++;
    }
  }

  return { processed: rows.length, sent, failed };
}

// Push a LINE message payload; returns 'sent' or { error }
async function pushLine(token: string, to: string, messages: any[]): Promise<'sent' | { error: string }> {
  const res = await fetch(LINE_PUSH_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, messages }),
  });
  if (res.ok) return 'sent';
  const errText = await res.text();
  return { error: `LINE ${res.status}: ${errText.slice(0, 300)}` };
}

// retry_count++ ; flip to 'failed' once it reaches MAX_RETRY
async function markFailed(supabase: any, row: any, error: string) {
  const nextRetry = (row.retry_count || 0) + 1;
  await supabase
    .from('line_notification_queue')
    .update({
      status: nextRetry >= MAX_RETRY ? 'failed' : 'pending',
      retry_count: nextRetry,
      last_error: error,
    })
    .eq('id', row.id);
}

// Resolve a feedback row into a LINE push payload. Returns null when there's
// nothing to send (no feedback/photos, or parent has no LINE id).
async function buildFeedbackMessages(
  supabase: any,
  row: any,
  caches: { classCache: Map<string, any>; subjectCache: Map<string, any>; teacherCache: Map<string, any> }
): Promise<{
  to: string;
  messages: any[];
  meta: { studentId: string; studentName: string; classId: string; className: string; scheduleId: string; messagePreview: string };
} | null> {
  // Current feedback + photos for this attendance record
  const { data: att } = await supabase
    .from('attendance')
    .select('feedback, photos')
    .eq('schedule_id', row.schedule_id)
    .eq('student_id', row.student_id)
    .single();

  const feedback: string = (att?.feedback || '').trim();
  const photos: string[] = Array.isArray(att?.photos) ? att.photos : [];
  if (!feedback && photos.length === 0) return null;

  // Schedule → class
  const { data: sched } = await supabase
    .from('class_schedules')
    .select('class_id, session_number, actual_teacher_id')
    .eq('id', row.schedule_id)
    .single();
  if (!sched) return null;

  let cls = caches.classCache.get(sched.class_id);
  if (!cls) {
    const { data } = await supabase
      .from('classes')
      .select('name, subject_id, teacher_id')
      .eq('id', sched.class_id)
      .single();
    cls = data;
    caches.classCache.set(sched.class_id, cls);
  }
  if (!cls) return null;

  let subject = caches.subjectCache.get(cls.subject_id);
  if (subject === undefined) {
    const { data } = await supabase.from('subjects').select('name').eq('id', cls.subject_id).single();
    subject = data;
    caches.subjectCache.set(cls.subject_id, subject);
  }

  const teacherId = sched.actual_teacher_id || cls.teacher_id;
  let teacher = caches.teacherCache.get(teacherId);
  if (teacher === undefined) {
    const { data } = await supabase.from('teachers').select('name, nickname').eq('id', teacherId).single();
    teacher = data;
    caches.teacherCache.set(teacherId, teacher);
  }
  const teacherName = teacher?.nickname || teacher?.name || '';

  // Student → parent LINE id
  const { data: student } = await supabase
    .from('students')
    .select('name, nickname, parent_id')
    .eq('id', row.student_id)
    .single();
  if (!student?.parent_id) return null;

  const { data: parent } = await supabase
    .from('parents')
    .select('line_user_id')
    .eq('id', student.parent_id)
    .single();
  const lineUserId = parent?.line_user_id;
  if (!lineUserId) return null;

  const studentName = student.nickname || student.name || '';
  const sessionLabel = sched.session_number ? ` (ครั้งที่ ${sched.session_number})` : '';

  const header =
    `📝 Feedback จากครู\n\n` +
    `นักเรียน: ${studentName}\n` +
    `คลาส: ${cls.name}${sessionLabel}\n` +
    `จากครู: ครู${teacherName}` +
    (feedback ? `\n\n"${feedback}"` : '') +
    `\n\nดูทั้งหมดได้ที่เมนู Teacher Feedback`;

  const messages: any[] = [{ type: 'text', text: header }];
  for (const url of photos.slice(0, 4)) {
    messages.push({ type: 'image', originalContentUrl: url, previewImageUrl: url });
  }

  const messagePreview = feedback
    ? feedback.slice(0, 100)
    : `แนบรูป ${photos.length} รูป`;

  return {
    to: lineUserId,
    messages,
    meta: {
      studentId: row.student_id,
      studentName,
      classId: sched.class_id,
      className: cls.name,
      scheduleId: row.schedule_id,
      messagePreview,
    },
  };
}
