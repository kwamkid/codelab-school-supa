'use client';

import { TrialBookingForm } from '@/components/shared/trial-booking-form';

export default function LiffTrialPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <TrialBookingForm context="liff" />
    </div>
  );
}
