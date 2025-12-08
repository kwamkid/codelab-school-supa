'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Save, 
  Loader2, 
  Repeat,
  Clock,
  AlertCircle,
  Calendar,
  MessageSquare,
  Info
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  getMakeupSettings, 
  updateMakeupSettings,
  MakeupSettings
} from '@/lib/services/settings';
import { useAuth } from '@/hooks/useAuth';

export default function MakeupSettingsComponent() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<MakeupSettings | null>(null);
  
  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);
  
  const loadSettings = async () => {
    try {
      const data = await getMakeupSettings();
      setSettings(data);
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('ไม่สามารถโหลดการตั้งค่าได้');
    } finally {
      setLoading(false);
    }
  };
  
  const handleSave = async () => {
    if (!settings || !user) return;

    setSaving(true);

    try {
      await updateMakeupSettings(settings, user.uid);
      toast.success('บันทึกการตั้งค่าเรียบร้อยแล้ว');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setSaving(false);
    }
  };
  
  const handleStatusToggle = (status: 'absent' | 'sick' | 'leave') => {
    if (!settings) return;
    
    const newStatuses = settings.allowMakeupForStatuses.includes(status)
      ? settings.allowMakeupForStatuses.filter(s => s !== status)
      : [...settings.allowMakeupForStatuses, status];
    
    setSettings({
      ...settings,
      allowMakeupForStatuses: newStatuses
    });
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }
  
  if (!settings) {
    return (
      <div className="text-center p-12 text-gray-500">
        ไม่สามารถโหลดข้อมูลได้
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Auto Create Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Repeat className="h-5 w-5" />
            การสร้าง Makeup Class อัตโนมัติ
          </CardTitle>
          <CardDescription>
            ตั้งค่าการสร้าง Makeup Class เมื่อนักเรียนขาดเรียน
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable Auto Create */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label className="text-base">เปิดใช้งานการสร้างอัตโนมัติ</Label>
              <p className="text-sm text-gray-500">
                สร้าง Makeup Class อัตโนมัติเมื่อบันทึกว่านักเรียนขาดเรียน
              </p>
            </div>
            <Switch
              checked={settings.autoCreateMakeup}
              onCheckedChange={(checked) => 
                setSettings({...settings, autoCreateMakeup: checked})
              }
            />
          </div>
          
          {settings.autoCreateMakeup && (
            <>
              {/* Makeup Limit */}
              <div className="space-y-2">
                <Label htmlFor="makeupLimit">
                  จำนวนครั้งที่ให้ Makeup ต่อคอร์ส
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="makeupLimit"
                    type="number"
                    min="0"
                    max="20"
                    value={settings.makeupLimitPerCourse}
                    onChange={(e) => setSettings({
                      ...settings, 
                      makeupLimitPerCourse: parseInt(e.target.value) || 0
                    })}
                    className="w-24"
                  />
                  <span className="text-sm text-gray-500">
                    ครั้ง (0 = ไม่จำกัด)
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  เมื่อเกินจำนวนนี้ ระบบจะไม่สร้าง Makeup อัตโนมัติ แต่ Admin ยังสร้างเองได้
                </p>
              </div>
              
              {/* Status Selection */}
              <div className="space-y-2">
                <Label>สถานะที่จะสร้าง Makeup Class ให้</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="absent"
                      checked={settings.allowMakeupForStatuses.includes('absent')}
                      onCheckedChange={() => handleStatusToggle('absent')}
                    />
                    <label
                      htmlFor="absent"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      ขาดเรียน (Absent)
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="sick"
                      checked={settings.allowMakeupForStatuses.includes('sick')}
                      onCheckedChange={() => handleStatusToggle('sick')}
                    />
                    <label
                      htmlFor="sick"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      ป่วย (Sick)
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="leave"
                      checked={settings.allowMakeupForStatuses.includes('leave')}
                      onCheckedChange={() => handleStatusToggle('leave')}
                    />
                    <label
                      htmlFor="leave"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      ลา (Leave)
                    </label>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Makeup Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            กฎการขอ Makeup
          </CardTitle>
          <CardDescription>
            กำหนดระยะเวลาในการขอและใช้สิทธิ์ Makeup
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Request Deadline */}
            <div className="space-y-2">
              <Label htmlFor="requestDeadline">
                <Clock className="h-4 w-4 inline mr-1" />
                ระยะเวลาที่ขอ Makeup ได้
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="requestDeadline"
                  type="number"
                  min="1"
                  max="30"
                  value={settings.makeupRequestDeadlineDays}
                  onChange={(e) => setSettings({
                    ...settings, 
                    makeupRequestDeadlineDays: parseInt(e.target.value) || 7
                  })}
                  className="w-24"
                />
                <span className="text-sm text-gray-500">
                  วัน หลังจากขาดเรียน
                </span>
              </div>
            </div>
            
            {/* Validity Period */}
            <div className="space-y-2">
              <Label htmlFor="validity">
                <Calendar className="h-4 w-4 inline mr-1" />
                ระยะเวลาที่ต้องมา Makeup
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="validity"
                  type="number"
                  min="7"
                  max="90"
                  value={settings.makeupValidityDays}
                  onChange={(e) => setSettings({
                    ...settings, 
                    makeupValidityDays: parseInt(e.target.value) || 30
                  })}
                  className="w-24"
                />
                <span className="text-sm text-gray-500">
                  วัน หลังจากคอร์สจบ
                </span>
              </div>
            </div>
          </div>
          
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li>นักเรียนต้องขอ Makeup ภายในระยะเวลาที่กำหนด</li>
                <li>Makeup Class ต้องเรียนให้เสร็จภายในระยะเวลาที่กำหนดหลังคอร์สจบ</li>
                <li>Admin สามารถสร้าง Makeup นอกเหนือจากกฎเหล่านี้ได้</li>
              </ul>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            การแจ้งเตือน
          </CardTitle>
          <CardDescription>
            ตั้งค่าการแจ้งเตือนผู้ปกครองเกี่ยวกับ Makeup Class
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label className="text-base">แจ้งเตือนผ่าน LINE</Label>
              <p className="text-sm text-gray-500">
                ส่งข้อความแจ้งเตือนเมื่อมีการสร้างหรือนัด Makeup Class
              </p>
            </div>
            <Switch
              checked={settings.sendLineNotification}
              onCheckedChange={(checked) => 
                setSettings({...settings, sendLineNotification: checked})
              }
            />
          </div>
          
          {settings.sendLineNotification && (
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label className="text-base">แจ้งเมื่อสร้างอัตโนมัติ</Label>
                <p className="text-sm text-gray-500">
                  แจ้งผู้ปกครองทันทีเมื่อระบบสร้าง Makeup Class อัตโนมัติ
                </p>
              </div>
              <Switch
                checked={settings.notifyParentOnAutoCreate}
                onCheckedChange={(checked) => 
                  setSettings({...settings, notifyParentOnAutoCreate: checked})
                }
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button 
          onClick={handleSave}
          disabled={saving}
          className="bg-red-500 hover:bg-red-600"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              กำลังบันทึก...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              บันทึกการตั้งค่า
            </>
          )}
        </Button>
      </div>
    </div>
  );
}