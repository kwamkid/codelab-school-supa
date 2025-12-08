'use client';

import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import EventForm from '@/components/events/event-form';

export default function NewEventPage() {
  return (
    <div>
      <div className="mb-6">
        <Link 
          href="/events" 
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          กลับไปหน้ารายการ Events
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">สร้าง Event ใหม่</h1>
        <p className="text-gray-600 mt-2">กรอกข้อมูลเพื่อสร้างงานหรือกิจกรรมใหม่</p>
      </div>

      <EventForm />
    </div>
  );
}