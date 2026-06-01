'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useSupabaseAuth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2, GraduationCap, Users, Calendar, BookOpen, Eye, EyeOff } from 'lucide-react';
import { getGeneralSettings } from '@/lib/services/settings';
import Image from 'next/image';
import { getClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const { signIn, signInWithGoogle, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  // Show message if the auth guard bounced the user back here (not a member / deactivated)
  useEffect(() => {
    try {
      const denied = sessionStorage.getItem('auth_denied');
      if (denied) {
        sessionStorage.removeItem('auth_denied');
        setError(
          denied === 'inactive'
            ? 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ'
            : 'บัญชีนี้ไม่มีสิทธิ์เข้าใช้งานระบบ กรุณาติดต่อผู้ดูแลระบบ'
        );
      }
    } catch { /* ignore */ }
  }, []);

  // Load settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await getGeneralSettings();
        setSettings(data);
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };
    loadSettings();
  }, []);

  const handleResetPassword = async () => {
    if (!resetEmail) {
      toast.error('กรุณากรอกอีเมล');
      return;
    }

    try {
      setIsResetting(true);
      const supabase = getClient();

      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        throw error;
      }

      toast.success('ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลแล้ว');
      setShowResetDialog(false);
      setResetEmail('');
    } catch (error: any) {
      console.error('Reset password error:', error);
      if (error.message?.includes('not found')) {
        toast.error('ไม่พบอีเมลนี้ในระบบ');
      } else if (error.message?.includes('invalid')) {
        toast.error('รูปแบบอีเมลไม่ถูกต้อง');
      } else {
        toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่');
      }
    } finally {
      setIsResetting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setIsGoogleLoading(true);
    try {
      await signInWithGoogle();
      // Browser redirects to Google — no further code runs here on success.
    } catch (err: any) {
      console.error('Google sign in error:', err);
      setError('ไม่สามารถเข้าสู่ระบบด้วย Google ได้ กรุณาลองใหม่อีกครั้ง');
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await signIn(email, password);
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.message?.includes('Invalid login credentials')) {
        setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      } else if (err.message?.includes('invalid_credentials')) {
        setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      } else if (err.message?.includes('Email not confirmed')) {
        setError('กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ');
      } else if (err.message === 'บัญชีถูกระงับการใช้งาน') {
        setError('บัญชีถูกระงับการใช้งาน');
      } else {
        setError('เกิดข้อผิดพลาดในการเข้าสู่ระบบ กรุณาลองใหม่อีกครั้ง');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const features = [
    { icon: GraduationCap, title: 'จัดการหลักสูตร', desc: 'ออกแบบและจัดการหลักสูตรได้อย่างยืดหยุ่น' },
    { icon: Users, title: 'ติดตามนักเรียน', desc: 'ดูแลและติดตามความก้าวหน้าของนักเรียน' },
    { icon: Calendar, title: 'จัดตารางเรียน', desc: 'วางแผนตารางเรียนและจัดการห้องเรียน' },
    { icon: BookOpen, title: 'สื่อการสอน', desc: 'จัดเก็บและแชร์สื่อการสอนได้ง่าย' },
  ];

  return (
    <div className="min-h-screen w-full flex">
      {/* Left Side - Branding/Hero Section (Hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 bg-gradient-to-br from-red-500 via-red-600 to-orange-500 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-white rounded-full translate-x-1/4 translate-y-1/4" />
          <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-white rounded-full -translate-x-1/2 -translate-y-1/2" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20 text-white">
          {/* Logo */}
          <div className="mb-8">
            {settings?.logoUrl ? (
              <Image
                src={settings.logoUrl}
                alt={settings.schoolName || 'School Logo'}
                width={180}
                height={45}
                className="object-contain brightness-0 invert"
                priority
                unoptimized
              />
            ) : (
              <Image
                src="/logo.svg"
                alt="CodeLab Logo"
                width={180}
                height={45}
                className="object-contain brightness-0 invert"
                priority
              />
            )}
          </div>

          {/* Headline */}
          <h1 className="text-4xl xl:text-5xl font-bold mb-4 leading-tight">
            ระบบจัดการ<br />โรงเรียนสอนพิเศษ
          </h1>
          <p className="text-lg xl:text-xl text-white/80 mb-12 max-w-md">
            จัดการทุกอย่างในที่เดียว ตั้งแต่นักเรียน ครูผู้สอน ตารางเรียน ไปจนถึงการเงิน
          </p>

          {/* Feature Grid */}
          <div className="grid grid-cols-2 gap-6 max-w-lg">
            {features.map((feature, index) => (
              <div key={index} className="flex items-start gap-3 group">
                <div className="p-2 bg-white/20 rounded-lg group-hover:bg-white/30 transition-colors">
                  <feature.icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{feature.title}</h3>
                  <p className="text-xs text-white/70">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 xl:w-2/5 flex items-center justify-center bg-gray-50 p-6 sm:p-8 lg:p-12">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="flex justify-center mb-8 lg:hidden">
            {settings?.logoUrl ? (
              <Image
                src={settings.logoUrl}
                alt={settings.schoolName || 'School Logo'}
                width={160}
                height={40}
                className="object-contain"
                priority
                unoptimized
              />
            ) : (
              <Image
                src="/logo.svg"
                alt="CodeLab Logo"
                width={160}
                height={40}
                className="object-contain"
                priority
              />
            )}
          </div>

          {/* Login Card */}
          <Card className="border-0 shadow-xl bg-white">
            <CardHeader className="space-y-1 pb-6">
              <CardTitle className="text-2xl font-bold text-center text-gray-900">
                ยินดีต้อนรับ
              </CardTitle>
              <CardDescription className="text-center text-gray-500">
                เข้าสู่ระบบเพื่อจัดการโรงเรียนของคุณ
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <Alert variant="destructive" className="border-red-200 bg-red-50">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-gray-700 font-medium">อีเมล</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="example@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    className="h-12 px-4 bg-gray-50 border-gray-200 focus:bg-white focus:border-red-500 focus:ring-red-500 transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-gray-700 font-medium">รหัสผ่าน</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      className="h-12 px-4 pr-12 bg-gray-50 border-gray-200 focus:bg-white focus:border-red-500 focus:ring-red-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowResetDialog(true)}
                    className="text-sm text-red-600 hover:text-red-700 hover:underline transition-colors"
                  >
                    ลืมรหัสผ่าน?
                  </button>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-medium shadow-lg shadow-red-500/25 transition-all duration-200"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      กำลังเข้าสู่ระบบ...
                    </>
                  ) : (
                    'เข้าสู่ระบบ'
                  )}
                </Button>
              </form>

              {/* Divider */}
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-white px-3 text-gray-400">หรือ</span>
                </div>
              </div>

              {/* Google Sign In */}
              <Button
                type="button"
                variant="outline"
                onClick={handleGoogleSignIn}
                disabled={isGoogleLoading || isLoading}
                className="w-full h-12 border-gray-200 bg-white text-gray-700 font-medium hover:bg-gray-50 hover:text-gray-700"
              >
                {isGoogleLoading ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                )}
                {isGoogleLoading ? 'กำลังเชื่อมต่อ Google...' : 'เข้าสู่ระบบด้วย Google'}
              </Button>
            </CardContent>
          </Card>

          {/* Footer */}
          <p className="text-center text-sm text-gray-400 mt-8">
            {settings?.schoolName || 'CodeLab School'} Management System
          </p>
        </div>
      </div>

      {/* Reset Password Dialog */}
      {showResetDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md border-0 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl">ลืมรหัสผ่าน</CardTitle>
              <CardDescription>
                กรอกอีเมลที่ใช้สมัคร เราจะส่งลิงก์รีเซ็ตรหัสผ่านไปให้
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">อีเมล</Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="example@email.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  disabled={isResetting}
                  className="h-12"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  onClick={handleResetPassword}
                  disabled={isResetting}
                  className="flex-1 h-11 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
                >
                  {isResetting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      กำลังส่ง...
                    </>
                  ) : (
                    'ส่งลิงก์รีเซ็ต'
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowResetDialog(false);
                    setResetEmail('');
                  }}
                  disabled={isResetting}
                  className="h-11"
                >
                  ยกเลิก
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
