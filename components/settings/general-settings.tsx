'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Save, 
  Loader2, 
  Building,
  Phone,
  Mail,
  Globe,
  Link2,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';
import { 
  getGeneralSettings, 
  updateGeneralSettings,
  validateSettings,
  GeneralSettings
} from '@/lib/services/settings';
import { useAuth } from '@/hooks/useAuth';
import FactoryResetDialog from './factory-reset-dialog';

export default function GeneralSettingsComponent() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<GeneralSettings | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showResetDialog, setShowResetDialog] = useState(false);
  
  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);
  
  const loadSettings = async () => {
    try {
      const data = await getGeneralSettings();
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

    // Validate
    const validation = validateSettings(settings);
    if (!validation.isValid) {
      setErrors(validation.errors);
      toast.error('กรุณาตรวจสอบข้อมูลให้ถูกต้อง');
      return;
    }

    setSaving(true);
    setErrors({});

    try {
      await updateGeneralSettings(settings, user.uid);
      toast.success('บันทึกการตั้งค่าเรียบร้อยแล้ว');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setSaving(false);
    }
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
      {/* School Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            ข้อมูลโรงเรียน
          </CardTitle>
          <CardDescription>ข้อมูลพื้นฐานและโลโก้ของโรงเรียน</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Logo URL */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="logoUrl">
                <Link2 className="h-4 w-4 inline mr-1" />
                URL โลโก้โรงเรียน (แนะนำขนาด 230x60px)
              </Label>
              <Input
                id="logoUrl"
                value={settings.logoUrl || ''}
                onChange={(e) => setSettings({...settings, logoUrl: e.target.value})}
                placeholder="https://example.com/logo.png"
              />
              <p className="text-sm text-gray-500">
                ใส่ URL รูปโลโก้ (รองรับ JPG, PNG, SVG)
              </p>
            </div>
            
            {/* Logo Preview */}
            {settings.logoUrl && (
              <div className="space-y-2">
                <Label>ตัวอย่างโลโก้</Label>
                <div className="p-4 border rounded-lg bg-gray-50">
                  <div className="relative w-[230px] h-[60px]">
                    <Image
                      src={settings.logoUrl}
                      alt="School Logo Preview"
                      width={230}
                      height={60}
                      className="object-contain"
                      unoptimized // สำหรับ external URL
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const errorDiv = document.getElementById('logo-error');
                        if (errorDiv) errorDiv.style.display = 'block';
                      }}
                      onLoad={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'block';
                        const errorDiv = document.getElementById('logo-error');
                        if (errorDiv) errorDiv.style.display = 'none';
                      }}
                    />
                    <div id="logo-error" className="hidden text-red-500 text-sm">
                      ไม่สามารถโหลดรูปภาพได้ กรุณาตรวจสอบ URL
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* School Name */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="schoolName">
                ชื่อโรงเรียน (ภาษาไทย) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="schoolName"
                value={settings.schoolName}
                onChange={(e) => setSettings({...settings, schoolName: e.target.value})}
                className={errors.schoolName ? 'border-red-500' : ''}
              />
              {errors.schoolName && (
                <p className="text-sm text-red-500">{errors.schoolName}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="schoolNameEn">ชื่อโรงเรียน (English)</Label>
              <Input
                id="schoolNameEn"
                value={settings.schoolNameEn || ''}
                onChange={(e) => setSettings({...settings, schoolNameEn: e.target.value})}
              />
            </div>
          </div>
          
          {/* Address */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <Building className="h-4 w-4" />
              ที่อยู่
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="houseNumber">บ้านเลขที่</Label>
                <Input
                  id="houseNumber"
                  value={settings.address.houseNumber}
                  onChange={(e) => setSettings({
                    ...settings,
                    address: {...settings.address, houseNumber: e.target.value}
                  })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="street">ถนน</Label>
                <Input
                  id="street"
                  value={settings.address.street || ''}
                  onChange={(e) => setSettings({
                    ...settings,
                    address: {...settings.address, street: e.target.value}
                  })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="subDistrict">
                  แขวง/ตำบล <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="subDistrict"
                  value={settings.address.subDistrict}
                  onChange={(e) => setSettings({
                    ...settings,
                    address: {...settings.address, subDistrict: e.target.value}
                  })}
                  className={errors.subDistrict ? 'border-red-500' : ''}
                />
                {errors.subDistrict && (
                  <p className="text-sm text-red-500">{errors.subDistrict}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="district">
                  เขต/อำเภอ <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="district"
                  value={settings.address.district}
                  onChange={(e) => setSettings({
                    ...settings,
                    address: {...settings.address, district: e.target.value}
                  })}
                  className={errors.district ? 'border-red-500' : ''}
                />
                {errors.district && (
                  <p className="text-sm text-red-500">{errors.district}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="province">
                  จังหวัด <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="province"
                  value={settings.address.province}
                  onChange={(e) => setSettings({
                    ...settings,
                    address: {...settings.address, province: e.target.value}
                  })}
                  className={errors.province ? 'border-red-500' : ''}
                />
                {errors.province && (
                  <p className="text-sm text-red-500">{errors.province}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="postalCode">รหัสไปรษณีย์</Label>
                <Input
                  id="postalCode"
                  value={settings.address.postalCode}
                  onChange={(e) => setSettings({
                    ...settings,
                    address: {...settings.address, postalCode: e.target.value}
                  })}
                  maxLength={5}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            ข้อมูลติดต่อ
          </CardTitle>
          <CardDescription>ช่องทางการติดต่อและโซเชียลมีเดีย</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contactPhone">
                <Phone className="h-4 w-4 inline mr-1" />
                เบอร์โทรศัพท์ <span className="text-red-500">*</span>
              </Label>
              <Input
                id="contactPhone"
                value={settings.contactPhone}
                onChange={(e) => setSettings({...settings, contactPhone: e.target.value})}
                placeholder="02-123-4567"
                className={errors.contactPhone ? 'border-red-500' : ''}
              />
              {errors.contactPhone && (
                <p className="text-sm text-red-500">{errors.contactPhone}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="contactEmail">
                <Mail className="h-4 w-4 inline mr-1" />
                อีเมล <span className="text-red-500">*</span>
              </Label>
              <Input
                id="contactEmail"
                type="email"
                value={settings.contactEmail}
                onChange={(e) => setSettings({...settings, contactEmail: e.target.value})}
                placeholder="info@school.com"
                className={errors.contactEmail ? 'border-red-500' : ''}
              />
              {errors.contactEmail && (
                <p className="text-sm text-red-500">{errors.contactEmail}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="lineOfficial">LINE Official Account</Label>
              <Input
                id="lineOfficial"
                value={settings.lineOfficialId || ''}
                onChange={(e) => setSettings({...settings, lineOfficialId: e.target.value})}
                placeholder="@codelabschool"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="website">
                <Globe className="h-4 w-4 inline mr-1" />
                เว็บไซต์
              </Label>
              <Input
                id="website"
                value={settings.website || ''}
                onChange={(e) => setSettings({...settings, website: e.target.value})}
                placeholder="https://www.school.com"
              />
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* System Maintenance Card */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            การบำรุงรักษาระบบ
          </CardTitle>
          <CardDescription>
            เครื่องมือสำหรับจัดการและล้างข้อมูลระบบ
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-red-50 rounded-lg">
              <h4 className="font-medium mb-2">ล้างข้อมูลทั้งหมด</h4>
              <p className="text-sm text-gray-600 mb-4">
                ลบข้อมูลทั้งหมดในระบบ เช่น นักเรียน ครู ผู้ปกครอง คลาส วิชา และอื่นๆ
                <br />
                <span className="text-red-600 font-medium">
                  (การตั้งค่าและบัญชี Admin จะไม่ถูกลบ)
                </span>
              </p>
              <Button
                variant="destructive"
                onClick={() => setShowResetDialog(true)}
                className="w-full sm:w-auto"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                ล้างข้อมูลทั้งหมด
              </Button>
            </div>
          </div>
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
      
      {/* Factory Reset Dialog */}
      <FactoryResetDialog
        open={showResetDialog}
        onOpenChange={setShowResetDialog}
      />
    </div>
  );
}