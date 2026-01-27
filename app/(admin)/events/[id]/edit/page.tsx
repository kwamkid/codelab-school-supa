'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Event } from '@/types/models';
import { getEvent } from '@/lib/services/events';
import EventForm from '@/components/events/event-form';
import { toast } from 'sonner';

export default function EditEventPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEvent();
  }, [eventId]);

  const loadEvent = async () => {
    try {
      const data = await getEvent(eventId);
      if (!data) {
        toast.error('ไม่พบข้อมูล Event');
        router.push('/events');
        return;
      }
      setEvent(data);
    } catch (error) {
      console.error('Error loading event:', error);
      toast.error('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-600">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  if (!event) {
    return null;
  }

  return (
    <div>
      <div className="mb-6">
        <Link 
          href={`/events/${eventId}`} 
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          กลับไปหน้ารายละเอียด Event
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-xl sm:text-3xl font-bold text-gray-900">แก้ไข Event</h1>
        <p className="text-gray-600 mt-2">แก้ไขข้อมูล {event.name}</p>
      </div>

      <EventForm event={event} isEdit />
    </div>
  );
}