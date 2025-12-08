'use client';

import { useState } from 'react';
import { EventSchedule } from '@/types/models';
import { 
  createEventSchedule, 
  updateEventSchedule, 
  deleteEventSchedule 
} from '@/lib/services/events';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Plus, 
  Edit, 
  Trash2, 
  Calendar,
  Clock,
  Users,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDate, formatTime } from '@/lib/utils';

interface ScheduleManagerProps {
  eventId: string;
  schedules: EventSchedule[];
  onUpdate: () => void;
}

export default function ScheduleManager({ eventId, schedules, onUpdate }: ScheduleManagerProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<EventSchedule | null>(null);
  const [deleteScheduleId, setDeleteScheduleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    date: '',
    startTime: '',
    endTime: '',
    maxAttendees: ''
  });

  const handleCreate = () => {
    setEditingSchedule(null);
    setFormData({
      date: '',
      startTime: '',
      endTime: '',
      maxAttendees: ''
    });
    setShowDialog(true);
  };

  const handleEdit = (schedule: EventSchedule) => {
    setEditingSchedule(schedule);
    setFormData({
      date: new Date(schedule.date).toISOString().split('T')[0],
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      maxAttendees: schedule.maxAttendees.toString()
    });
    setShowDialog(true);
  };

  const handleSubmit = async () => {
    // Validate
    if (!formData.date || !formData.startTime || !formData.endTime || !formData.maxAttendees) {
      toast.error('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    const maxAttendees = parseInt(formData.maxAttendees);
    if (isNaN(maxAttendees) || maxAttendees <= 0) {
      toast.error('จำนวนที่รับต้องเป็นตัวเลขมากกว่า 0');
      return;
    }

    if (formData.startTime >= formData.endTime) {
      toast.error('เวลาเริ่มต้องมาก่อนเวลาจบ');
      return;
    }

    setLoading(true);

    try {
      const scheduleData = {
        eventId,
        date: new Date(formData.date),
        startTime: formData.startTime,
        endTime: formData.endTime,
        maxAttendees
      };

      if (editingSchedule) {
        await updateEventSchedule(editingSchedule.id, scheduleData);
        toast.success('แก้ไขรอบเวลาเรียบร้อยแล้ว');
      } else {
        await createEventSchedule(scheduleData);
        toast.success('เพิ่มรอบเวลาเรียบร้อยแล้ว');
      }

      setShowDialog(false);
      onUpdate();
    } catch (error) {
      console.error('Error saving schedule:', error);
      toast.error(editingSchedule ? 'ไม่สามารถแก้ไขรอบเวลาได้' : 'ไม่สามารถเพิ่มรอบเวลาได้');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteScheduleId) return;

    try {
      await deleteEventSchedule(deleteScheduleId);
      toast.success('ลบรอบเวลาเรียบร้อยแล้ว');
      setDeleteScheduleId(null);
      onUpdate();
    } catch (error: any) {
      console.error('Error deleting schedule:', error);
      toast.error(error.message || 'ไม่สามารถลบรอบเวลาได้');
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'available': 'bg-green-100 text-green-700',
      'full': 'bg-red-100 text-red-700',
      'cancelled': 'bg-gray-100 text-gray-700'
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const getStatusText = (status: string) => {
    const texts: Record<string, string> = {
      'available': 'ว่าง',
      'full': 'เต็ม',
      'cancelled': 'ยกเลิก'
    };
    return texts[status] || status;
  };

  const getTotalAttendees = (schedule: EventSchedule) => {
    return Object.values(schedule.attendeesByBranch || {}).reduce((sum, count) => sum + count, 0);
  };

  return (
    <div className="space-y-6">
      {/* Add Schedule Button */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">จัดการรอบเวลา</h2>
        <Button onClick={handleCreate} className="bg-red-500 hover:bg-red-600">
          <Plus className="h-4 w-4 mr-2" />
          เพิ่มรอบเวลา
        </Button>
      </div>

      {/* Schedules Table */}
      <Card>
        <CardContent className="p-0">
          {schedules.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                ยังไม่มีรอบเวลา
              </h3>
              <p className="text-gray-600 mb-4">
                เริ่มต้นด้วยการเพิ่มรอบเวลาแรก
              </p>
              <Button onClick={handleCreate} className="bg-red-500 hover:bg-red-600">
                <Plus className="h-4 w-4 mr-2" />
                เพิ่มรอบเวลา
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>วันที่</TableHead>
                    <TableHead>เวลา</TableHead>
                    <TableHead className="text-center">จำนวนที่รับ</TableHead>
                    <TableHead className="text-center">ลงทะเบียนแล้ว</TableHead>
                    <TableHead className="text-center">คงเหลือ</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead className="text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                    {schedules
                        .sort((a, b) => {
                        // เรียงตามวันที่ก่อน
                        const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
                        if (dateCompare !== 0) return dateCompare;
                        
                        // ถ้าวันเดียวกัน เรียงตามเวลาเริ่ม
                        return a.startTime.localeCompare(b.startTime);
                        })
                        .map((schedule) => {
                        const totalAttendees = getTotalAttendees(schedule);
                        const remaining = schedule.maxAttendees - totalAttendees;
                        
                        return (
                            <TableRow key={schedule.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            {formatDate(schedule.date, 'long')}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-gray-400" />
                            {formatTime(schedule.startTime)} - {formatTime(schedule.endTime)}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {schedule.maxAttendees}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Users className="h-4 w-4 text-gray-400" />
                            {totalAttendees}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge 
                            variant={remaining > 0 ? "outline" : "secondary"}
                            className={remaining === 0 ? "text-red-600" : ""}
                          >
                            {remaining}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(schedule.status)}>
                            {getStatusText(schedule.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(schedule)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteScheduleId(schedule.id)}
                              className="text-red-600 hover:text-red-700"
                              disabled={totalAttendees > 0}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSchedule ? 'แก้ไขรอบเวลา' : 'เพิ่มรอบเวลาใหม่'}
            </DialogTitle>
            <DialogDescription>
              กำหนดวันและเวลาสำหรับจัด Event
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="date">วันที่ *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">เวลาเริ่ม *</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="endTime">เวลาจบ *</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="maxAttendees">จำนวนที่รับ *</Label>
              <Input
                id="maxAttendees"
                type="number"
                min="1"
                value={formData.maxAttendees}
                onChange={(e) => setFormData({ ...formData, maxAttendees: e.target.value })}
                placeholder="50"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              ยกเลิก
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={loading}
              className="bg-red-500 hover:bg-red-600"
            >
              {loading ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteScheduleId} onOpenChange={() => setDeleteScheduleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบรอบเวลา</AlertDialogTitle>
            <AlertDialogDescription>
              คุณแน่ใจหรือไม่ที่จะลบรอบเวลานี้? การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}