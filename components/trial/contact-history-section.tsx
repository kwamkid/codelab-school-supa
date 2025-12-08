// components/trial/contact-history-section.tsx

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  MessageSquare,
  PhoneCall,
  Plus,
  Clock,
  User,
  Save
} from 'lucide-react';
import { TrialBooking } from '@/types/models';
import { updateTrialBooking, updateBookingStatus } from '@/lib/services/trial-bookings';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';

interface ContactHistoryEntry {
  date: Date;
  type: 'contacted' | 'note';
  note: string;
  by?: string;
}

interface ContactHistorySectionProps {
  booking: TrialBooking;
  onUpdate: () => void;
}

export default function ContactHistorySection({ booking, onUpdate }: ContactHistorySectionProps) {
  const [showAddNote, setShowAddNote] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [saving, setSaving] = useState(false);

  // Build contact history from booking data
  const getContactHistory = (): ContactHistoryEntry[] => {
    // If no contact note, return empty
    if (!booking.contactNote) return [];
    
    // Return single entry with the full note
    return [{
      date: booking.contactedAt || booking.createdAt,
      type: 'contacted',
      note: booking.contactNote,
    }];
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) {
      toast.error('กรุณากรอกบันทึก');
      return;
    }

    setSaving(true);
    
    try {
      // If this is the first contact, update status to contacted
      if (booking.status === 'new') {
        await updateBookingStatus(booking.id, 'contacted', newNote);
      } else {
        // Otherwise, just add to existing notes
        const existingNote = booking.contactNote || '';
        const updatedNote = existingNote 
          ? `${existingNote}\n\n[${formatDate(new Date(), 'short')}] ${newNote}`
          : newNote;
          
        await updateTrialBooking(booking.id, {
          contactNote: updatedNote
        });
      }
      
      toast.success('บันทึกข้อมูลสำเร็จ');
      setNewNote('');
      setShowAddNote(false);
      onUpdate();
    } catch (error) {
      console.error('Error saving note:', error);
      toast.error('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setSaving(false);
    }
  };

  const contactHistory = getContactHistory();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            ประวัติการติดต่อ
          </CardTitle>
          {!showAddNote && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowAddNote(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              เพิ่มบันทึก
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Add Note Form */}
        {showAddNote && (
          <div className="space-y-3 mb-4 p-4 bg-gray-50 rounded-lg">
            <Textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="บันทึกการติดต่อ..."
              rows={3}
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleAddNote}
                disabled={saving}
                className="bg-red-500 hover:bg-red-600"
              >
                {saving ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                    กำลังบันทึก...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-1" />
                    บันทึก
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowAddNote(false);
                  setNewNote('');
                }}
                disabled={saving}
              >
                ยกเลิก
              </Button>
            </div>
          </div>
        )}

        {/* Contact History */}
        {contactHistory.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">ยังไม่มีประวัติการติดต่อ</p>
            {booking.status === 'new' && (
              <p className="text-xs mt-1">คลิก &quot;เพิ่มบันทึก&quot; เพื่อบันทึกการติดต่อครั้งแรก</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <PhoneCall className="h-4 w-4 text-yellow-600" />
                <span className="text-sm font-medium text-gray-700">บันทึกการติดต่อ</span>
                <span className="text-xs text-gray-500">
                  ({formatDate(contactHistory[0].date, 'long')})
                </span>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {contactHistory[0].note}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}