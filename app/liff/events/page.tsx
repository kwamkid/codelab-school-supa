'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Event, EventSchedule } from '@/types/models';
import { getEvents, getAvailableSchedules, isRegistrationOpen } from '@/lib/services/events';
import { useLiff } from '@/components/liff/liff-provider';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, 
  MapPin, 
  Users, 
  Clock,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  Sparkles,
  CalendarX,
  Loader2
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import Image from 'next/image';

export default function LiffEventsPage() {
  const router = useRouter();
  const { profile, isLoggedIn } = useLiff();
  const [loading, setLoading] = useState(true);
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [eventSchedules, setEventSchedules] = useState<Record<string, EventSchedule[]>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load upcoming events
      const events = await getEvents();
      const upcoming = events.filter(event => 
        event.status === 'published' && 
        new Date(event.registrationEndDate) >= new Date()
      );
      setUpcomingEvents(upcoming);

      // Load schedules for each event
      const schedulesMap: Record<string, EventSchedule[]> = {};
      for (const event of upcoming) {
        const schedules = await getAvailableSchedules(event.id);
        schedulesMap[event.id] = schedules;
      }
      setEventSchedules(schedulesMap);
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEventTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'open-house': 'bg-blue-100 text-blue-700',
      'parent-meeting': 'bg-green-100 text-green-700',
      'showcase': 'bg-purple-100 text-purple-700',
      'workshop': 'bg-orange-100 text-orange-700',
      'other': 'bg-gray-100 text-gray-700'
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

  const getEventTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      'open-house': 'Open House',
      'parent-meeting': 'Parent Meeting',
      'showcase': 'Showcase',
      'workshop': 'Workshop',
      'other': 'อื่นๆ'
    };
    return types[type] || type;
  };

  const handleRegister = (eventId: string) => {
    router.push(`/liff/events/register/${eventId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-600">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      {isLoggedIn ? (
        // Header with back button for logged in users
        <div className="bg-primary text-white p-4 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/liff')}
              className="text-white hover:text-white/80 -ml-2"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Events & กิจกรรม</h1>
          </div>
        </div>
      ) : (
        // Simple header for guest users
        <div className="bg-white shadow-sm sticky top-0 z-10">
          <div className="p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-purple-600" />
              <h1 className="text-xl font-bold">Events & กิจกรรม</h1>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        <div className="space-y-4">
          {upcomingEvents.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <CalendarX className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  ไม่มีงานที่กำลังจะมาถึง
                </h3>
                <p className="text-gray-600">
                  เราจะแจ้งให้คุณทราบเมื่อมีงานใหม่
                </p>
              </CardContent>
            </Card>
          ) : (
            upcomingEvents.map(event => {
              const schedules = eventSchedules[event.id] || [];
              const isOpen = isRegistrationOpen(event);
              
              return (
                <Card key={event.id} className="overflow-hidden">
                  {event.imageUrl && (
                    <div className="relative w-full flex justify-center bg-gray-50 p-4">
                      <div className="relative" style={{ maxHeight: '200px' }}>
                        <img
                          src={event.imageUrl}
                          alt={event.name}
                          className="object-contain max-h-[200px] max-w-full rounded-lg"
                          onError={(e) => {
                            console.error('Image load error:', event.imageUrl);
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                      <div className="absolute top-2 right-2">
                        <Badge className={getEventTypeColor(event.eventType)}>
                          {getEventTypeLabel(event.eventType)}
                        </Badge>
                      </div>
                    </div>
                  )}
                  
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <h3 className="font-semibold text-lg">{event.name}</h3>
                      {!event.imageUrl && (
                        <Badge className={getEventTypeColor(event.eventType)}>
                          {getEventTypeLabel(event.eventType)}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{event.description}</p>
                  </CardHeader>
                  
                  <CardContent className="space-y-3">
                    {/* Location */}
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                      <div>
                        <p className="font-medium">{event.location}</p>
                        {event.locationUrl && (
                          <a 
                            href={event.locationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 text-xs"
                          >
                            ดูแผนที่
                          </a>
                        )}
                      </div>
                    </div>
                    
                    {/* Schedules */}
                    {schedules.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          รอบเวลา ({schedules.length} รอบ)
                        </p>
                        <div className="grid gap-2">
                          {schedules.slice(0, 3).map((schedule, idx) => {
                            const available = schedule.maxAttendees - 
                              Object.values(schedule.attendeesByBranch).reduce((sum, count) => sum + count, 0);
                            
                            return (
                              <div key={schedule.id} className="text-xs bg-gray-50 p-2 rounded">
                                <div className="flex justify-between items-center">
                                  <span>
                                    {formatDate(schedule.date, 'short')} • {schedule.startTime}-{schedule.endTime}
                                  </span>
                                  <Badge 
                                    variant={available > 0 ? "outline" : "secondary"}
                                    className="text-xs"
                                  >
                                    {available > 0 ? `${available} ที่ว่าง` : 'เต็ม'}
                                  </Badge>
                                </div>
                              </div>
                            );
                          })}
                          {schedules.length > 3 && (
                            <p className="text-xs text-gray-500 text-center">
                              และอีก {schedules.length - 3} รอบ
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Registration Status */}
                    <div className="pt-2 border-t">
                      <div className="flex justify-between items-center text-sm">
                        <div>
                          <p className="text-gray-500">รับลงทะเบียน</p>
                          <p className="font-medium">
                            {formatDate(event.registrationStartDate, 'short')} - {formatDate(event.registrationEndDate, 'short')}
                          </p>
                        </div>
                        {isOpen ? (
                          <Badge className="bg-green-100 text-green-700">
                            เปิดรับสมัคร
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            ปิดรับสมัคร
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    {/* Action Button */}
                    {isOpen && (
                      <Button 
                        className="w-full bg-red-500 hover:bg-red-600"
                        onClick={() => handleRegister(event.id)}
                      >
                        ลงทะเบียน
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}