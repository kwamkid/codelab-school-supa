'use client';

import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { AttendanceChecker } from '@/components/attendance/attendance-checker';

export default function AttendanceCheckPage() {
  const router = useRouter();
  const params = useParams();
  const classId = params.classId as string;
  const sessionId = params.sessionId as string;

  const back = () => router.push(`/attendance/${classId}`);

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={back} className="mb-2">
        ← กลับ
      </Button>
      <AttendanceChecker
        classId={classId}
        scheduleId={sessionId}
        onSaved={back}
        onCancel={back}
      />
    </div>
  );
}
