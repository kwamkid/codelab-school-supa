'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  AlertCircle, 
  CheckCircle, 
  Loader2, 
  User,
  Phone,
  Users,
  Link as LinkIcon
} from 'lucide-react';
import { useLiff } from '@/components/liff/liff-provider';
import { toast } from 'sonner';
import TechLoadingAnimation from '@/components/liff/tech-loading-animation'

function LinkAccountContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile, isLoggedIn, liff } = useLiff();
  
  const token = searchParams.get('token');
  
  const [phone, setPhone] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [linking, setLinking] = useState(false);
  const [parentData, setParentData] = useState<any>(null);
  const [error, setError] = useState('');
  const [tokenId, setTokenId] = useState('');

  // Auto-redirect if not logged in
  useEffect(() => {
    if (!isLoggedIn && liff) {
      // Redirect to LINE login
      liff.login();
    }
  }, [isLoggedIn, liff]);

  // Check if no token provided
  useEffect(() => {
    if (!token) {
      setError('ไม่พบลิงก์สำหรับเชื่อมต่อ');
    }
  }, [token]);

  const formatPhoneNumber = (value: string) => {
    // Remove all non-digits
    const cleaned = value.replace(/\D/g, '');
    
    // Format as XXX-XXX-XXXX
    if (cleaned.length <= 3) {
      return cleaned;
    } else if (cleaned.length <= 6) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
    } else {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhone(formatted);
  };

  const handleVerifyPhone = async () => {
    if (!token || !phone) return;

    try {
      setVerifying(true);
      setError('');

      const response = await fetch('/api/liff/verify-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          token, 
          phone: phone.replace(/-/g, '') // Remove formatting
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'เกิดข้อผิดพลาด');
        return;
      }

      if (data.valid) {
        setParentData(data.parent);
        setTokenId(data.tokenId);
      }
    } catch (error) {
      console.error('Error verifying phone:', error);
      setError('ไม่สามารถตรวจสอบข้อมูลได้');
    } finally {
      setVerifying(false);
    }
  };

  const handleConfirmLink = async () => {
    if (!token || !phone || !profile?.userId || !tokenId) return;

    try {
      setLinking(true);
      setError('');

      const response = await fetch('/api/liff/link-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          phone: phone.replace(/-/g, ''),
          lineUserId: profile.userId,
          lineDisplayName: profile.displayName,
          linePictureUrl: profile.pictureUrl
        })
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle specific error cases
        if (data.errorCode === 'line_already_used') {
          setError('LINE account นี้ถูกใช้งานแล้ว กรุณาใช้ LINE account อื่น');
          
          // Optional: Show which parent is using this LINE
          if (data.existingParentId) {
            console.log('LINE already used by parent:', data.existingParentId);
          }
        } else {
          setError(data.error || 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
        }
        return;
      }

      // Success
      toast.success('เชื่อมต่อ LINE สำเร็จ!');
      
      // Close LIFF window or redirect
      if (liff?.isInClient()) {
        setTimeout(() => {
          liff.closeWindow();
        }, 2000);
      } else {
        setTimeout(() => {
          // Redirect to profile page instead of reloading
          window.location.href = '/liff/profile';
        }, 2000);
      }
    } catch (error) {
      console.error('Error linking account:', error);
      setError('ไม่สามารถเชื่อมต่อได้');
    } finally {
      setLinking(false);
    }
  };

  // Error state for invalid token
  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
              <h2 className="text-lg font-semibold">ลิงก์ไม่ถูกต้อง</h2>
              <p className="text-sm text-muted-foreground">
                กรุณาใช้ลิงก์ที่ได้รับจากเจ้าหน้าที่
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading state while checking login
  if (!isLoggedIn || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">
                กำลังตรวจสอบการเข้าสู่ระบบ...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto space-y-4">
        {/* Header */}
        <div className="text-center py-4">
          <LinkIcon className="h-12 w-12 text-primary mx-auto mb-4" />
          <h1 className="text-2xl font-bold">เชื่อมต่อบัญชี LINE</h1>
          <p className="text-sm text-muted-foreground mt-2">
            เชื่อมต่อ LINE เพื่อรับการแจ้งเตือนและใช้งานระบบ
          </p>
        </div>

        {!parentData ? (
          // Step 1: Verify phone
          <Card>
            <CardHeader>
              <CardTitle>ยืนยันตัวตน</CardTitle>
              <CardDescription>
                กรุณากรอกเบอร์โทรที่ลงทะเบียนไว้กับโรงเรียน
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">
                    <Phone className="h-4 w-4 inline mr-2" />
                    เบอร์โทรศัพท์
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="08X-XXX-XXXX"
                    value={phone}
                    onChange={handlePhoneChange}
                    maxLength={12}
                    className="text-lg"
                  />
                  <p className="text-xs text-muted-foreground">
                    กรอกเบอร์โทรที่แจ้งไว้กับทางโรงเรียน
                  </p>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  onClick={handleVerifyPhone}
                  disabled={!phone || phone.length < 12 || verifying}
                  className="w-full"
                  size="lg"
                >
                  {verifying ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      กำลังตรวจสอบ...
                    </>
                  ) : (
                    'ตรวจสอบ'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          // Step 2: Confirm link
          <Card>
            <CardHeader>
              <CardTitle>ยืนยันการเชื่อมต่อ</CardTitle>
              <CardDescription>
                ตรวจสอบข้อมูลและยืนยันการเชื่อมต่อกับ LINE
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Parent Info */}
              <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{parentData.displayName}</p>
                    <p className="text-sm text-muted-foreground">{parentData.phone}</p>
                  </div>
                </div>

                {parentData.students?.length > 0 && (
                  <div className="border-t pt-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium">นักเรียน:</p>
                    </div>
                    <div className="space-y-1">
                      {parentData.students.map((student: any) => (
                        <div key={student.id} className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {student.nickname || student.name}
                          </Badge>
                          {student.nickname && (
                            <span className="text-xs text-muted-foreground">
                              ({student.name})
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* LINE Info */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm font-medium mb-2">LINE Account ที่จะเชื่อมต่อ:</p>
                <div className="flex items-center gap-3">
                  {profile.pictureUrl && (
                    <img
                      src={profile.pictureUrl}
                      alt={profile.displayName}
                      className="w-10 h-10 rounded-full"
                    />
                  )}
                  <div>
                    <p className="font-medium">{profile.displayName}</p>
                    <p className="text-xs text-muted-foreground">LINE ID: {profile.userId}</p>
                  </div>
                </div>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  หลังจากเชื่อมต่อแล้ว คุณจะสามารถ:
                  <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                    <li>ดูตารางเรียนของบุตรหลาน</li>
                    <li>รับการแจ้งเตือนผ่าน LINE</li>
                    <li>ติดต่อสื่อสารกับโรงเรียน</li>
                  </ul>
                </AlertDescription>
              </Alert>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setParentData(null);
                    setError('');
                  }}
                  disabled={linking}
                  className="flex-1"
                >
                  ย้อนกลับ
                </Button>
                <Button
                  onClick={handleConfirmLink}
                  disabled={linking}
                  className="flex-1"
                >
                  {linking ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      กำลังเชื่อมต่อ...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      ยืนยันเชื่อมต่อ
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Success Message (shown after linking) */}
        {linking && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-sm mx-4">
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <CheckCircle className="h-12 w-12 text-green-600 mx-auto" />
                  <h3 className="text-lg font-semibold">เชื่อมต่อสำเร็จ!</h3>
                  <p className="text-sm text-muted-foreground">
                    กำลังนำคุณไปยังหน้าหลัก...
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LinkAccountPage() {
  return (
    <Suspense fallback={<TechLoadingAnimation />}>
      <LinkAccountContent />
    </Suspense>
  );
}