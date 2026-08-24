// app/api/liff/team/route.ts
// แท็บ "ทีม" ในแอปผู้ปกครอง — action เดียวจบเหมือน /api/liff/recipients
//   data            → ข้อมูลทีมของลูกแต่ละคน + ตารางซ้อม + การแข่งขัน
//   has-team        → เช็คเบา ๆ ว่าจะโชว์แท็บทีมไหม (bottom nav)
//   practice.create → ขอวันซ้อม (หลายวันในครั้งเดียว) → status proposed
//   practice.update / practice.delete → เฉพาะคำขอของตัวเองที่ยังไม่ถูกตรวจ
//   rsvp            → ตอบรับ/ไม่ไปการแข่งขัน
//
// ตัวตนมาจาก verified LINE ID token (resolveLiffUser) เหมือน route LIFF อื่น

import { NextRequest, NextResponse } from 'next/server';
import { resolveLiffUser } from '@/lib/line/verify-liff-token';
import {
  getTeamData,
  familyHasTeam,
  proposePractice,
  updatePractice,
  deletePractice,
  setEventRsvp,
} from '@/lib/supabase/services/liff-team';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const user = await resolveLiffUser(request, body);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const action = (body.action as string) || 'data';

    if (action === 'has-team') {
      return NextResponse.json({ success: true, hasTeam: await familyHasTeam(user.lineUserId) });
    }

    if (action === 'data') {
      const data = await getTeamData(user.lineUserId);
      return NextResponse.json({ success: true, ...data });
    }

    if (action === 'practice.create') {
      const result = await proposePractice(user.lineUserId, {
        kidId: body.kidId,
        kidIds: body.kidIds,
        dates: body.dates,
        startTime: body.startTime,
        endTime: body.endTime,
        note: body.note,
      });
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'practice.update') {
      const result = await updatePractice(user.lineUserId, body.practiceId, {
        date: body.date,
        startTime: body.startTime,
        endTime: body.endTime,
        note: body.note,
      });
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'practice.delete') {
      await deletePractice(user.lineUserId, body.practiceId);
      return NextResponse.json({ success: true });
    }

    if (action === 'rsvp') {
      await setEventRsvp(user.lineUserId, {
        eventId: body.eventId,
        kidId: body.kidId,
        status: body.status,
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('[liff/team] Error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'failed' }, { status: 500 });
  }
}
