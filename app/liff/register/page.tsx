'use client';

import { CompactEnrollmentForm } from '@/components/shared/compact-enrollment-form';

export default function LiffRegisterPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <CompactEnrollmentForm context="liff" />
    </div>
  );
}
