'use client';

import { useEffect, useState } from 'react';
import { getClasses } from '@/lib/services/classes';
import { getBranches } from '@/lib/services/branches';
import { getSubjects } from '@/lib/services/subjects';
import { Button } from '@/components/ui/button';

export default function CheckDataComponent() {
  const [data, setData] = useState<any>({
    classes: [],
    branches: [],
    subjects: []
  });
  const [loading, setLoading] = useState(false);

  const checkData = async () => {
    setLoading(true);
    try {
      const [classes, branches, subjects] = await Promise.all([
        getClasses(),
        getBranches(),
        getSubjects()
      ]);

      console.log('Classes:', classes);
      console.log('Branches:', branches);
      console.log('Subjects:', subjects);

      // ตรวจสอบ schedules ของแต่ละคลาส
      for (const cls of classes) {
        if (cls.status === 'published' || cls.status === 'started') {
          console.log(`Checking schedules for class: ${cls.name}`);
          const { getClassSchedules } = await import('@/lib/services/classes');
          const schedules = await getClassSchedules(cls.id);
          console.log(`- Schedules count: ${schedules.length}`);
          console.log(`- Start date: ${cls.startDate}`);
          console.log(`- End date: ${cls.endDate}`);
          console.log(`- Days of week: ${cls.daysOfWeek}`);
          console.log(`- Time: ${cls.startTime} - ${cls.endTime}`);
          if (schedules.length > 0) {
            console.log(`- First schedule: ${schedules[0].sessionDate}`);
          }
        }
      }

      setData({
        classes,
        branches,
        subjects
      });
    } catch (error) {
      console.error('Error checking data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 bg-gray-100 rounded-lg space-y-4">
      <h3 className="font-semibold">ตรวจสอบข้อมูลในระบบ</h3>
      
      <Button onClick={checkData} disabled={loading}>
        {loading ? 'กำลังตรวจสอบ...' : 'ตรวจสอบข้อมูล'}
      </Button>

      <div className="space-y-2 text-sm">
        <p>จำนวนสาขา: {data.branches.length}</p>
        <p>จำนวนวิชา: {data.subjects.length}</p>
        <p>จำนวนคลาส: {data.classes.length}</p>
        
        {data.classes.length > 0 && (
          <div className="mt-4">
            <p className="font-semibold">คลาสที่มีในระบบ:</p>
            {data.classes.map((cls: any) => (
              <div key={cls.id} className="ml-4 text-xs border-b pb-2 mb-2">
                <p>- {cls.name} (สถานะ: {cls.status})</p>
                <p className="ml-4 text-gray-600">
                  วันที่: {new Date(cls.startDate).toLocaleDateString('th-TH')} - {new Date(cls.endDate).toLocaleDateString('th-TH')}
                </p>
                <p className="ml-4 text-gray-600">
                  เวลา: {cls.startTime} - {cls.endTime}
                </p>
                <p className="ml-4 text-gray-600">
                  วันเรียน: {cls.daysOfWeek?.join(', ')}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}