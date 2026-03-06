'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TestTube, UserPlus, Users } from 'lucide-react';
import { EnrollmentSource, StepProps, DEFAULT_STUDENT } from '../enrollment-types';

const SOURCE_OPTIONS: {
  value: EnrollmentSource;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    value: 'trial',
    label: 'จากทดลองเรียน',
    description: 'ลงทะเบียนจากการทดลองเรียน (มีข้อมูลบางส่วนจากการจอง)',
    icon: <TestTube className="h-8 w-8 text-cyan-600" />,
  },
  {
    value: 'new',
    label: 'ลูกค้าใหม่',
    description: 'สร้างข้อมูลผู้ปกครองและนักเรียนใหม่ทั้งหมด',
    icon: <UserPlus className="h-8 w-8 text-green-600" />,
  },
  {
    value: 'existing',
    label: 'ลูกค้าเดิม',
    description: 'ค้นหาผู้ปกครองเดิมจากเบอร์โทรศัพท์',
    icon: <Users className="h-8 w-8 text-blue-600" />,
  },
];

export default function SourceSelectionStep({ formData, setFormData, onNext }: StepProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSelect = (source: EnrollmentSource) => {
    // Update URL param
    const params = new URLSearchParams(searchParams.toString());
    params.set('type', source);
    router.replace(`?${params.toString()}`, { scroll: false });

    // Clear stale data when switching source
    setFormData(prev => ({
      ...prev,
      source,
      parentMode: source === 'existing' ? 'existing' : 'new',
      existingParentId: undefined,
      parentName: '',
      parentPhone: '',
      parentEmail: '',
      emergencyPhone: '',
      students: [{ ...DEFAULT_STUDENT }],
    }));
    onNext();
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">เลือกประเภทการลงทะเบียน</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {SOURCE_OPTIONS.map(option => (
          <Card
            key={option.value}
            className="cursor-pointer hover:border-red-300 hover:shadow-md transition-all"
            onClick={() => handleSelect(option.value)}
          >
            <CardContent className="p-6 text-center space-y-3">
              <div className="flex justify-center">{option.icon}</div>
              <h3 className="text-lg font-medium">{option.label}</h3>
              <p className="text-base text-gray-500">{option.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
