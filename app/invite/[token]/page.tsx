'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle, ShieldCheck, Building2 } from 'lucide-react';
import { getClient } from '@/lib/supabase/client';
import {
  verifyInvitation,
  acceptInvitation,
  roleLabel,
  type InvitationPreview,
} from '@/lib/services/invitations';

const REASON_MESSAGES: Record<string, string> = {
  not_found: 'ไม่พบคำเชิญนี้ในระบบ',
  revoked: 'คำเชิญนี้ถูกยกเลิกแล้ว',
  used: 'คำเชิญนี้ถูกใช้งานไปแล้ว',
  expired: 'คำเชิญนี้หมดอายุแล้ว กรุณาขอลิงก์ใหม่',
  missing_token: 'ลิงก์ไม่ถูกต้อง',
  error: 'เกิดข้อผิดพลาด กรุณาลองใหม่',
};

type Phase = 'verifying' | 'preview' | 'profile' | 'accepting' | 'error';

export default function InvitePage() {
  const params = useParams();
  const token = (Array.isArray(params.token) ? params.token[0] : params.token) || '';

  const [phase, setPhase] = useState<Phase>('verifying');
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [error, setError] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  // Profile fields the invitee fills in
  const [displayName, setDisplayName] = useState('');
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const prefilledRef = useRef(false);

  const isTeacher = preview?.role === 'teacher';

  // 1. Verify the invitation
  useEffect(() => {
    let mounted = true;
    verifyInvitation(token)
      .then((data) => {
        if (!mounted) return;
        if (!data.valid) {
          setError(REASON_MESSAGES[data.reason || 'error'] || 'คำเชิญไม่ถูกต้อง');
          setPhase('error');
        } else {
          setPreview(data);
          setPhase('preview');
        }
      })
      .catch(() => {
        if (!mounted) return;
        setError('เกิดข้อผิดพลาดในการตรวจสอบคำเชิญ');
        setPhase('error');
      });
    return () => { mounted = false; };
  }, [token]);

  // 2. When a Google session appears (returned from OAuth or already signed in),
  //    move to the profile step and prefill the name from the Google account.
  //    On OAuth return the PKCE code exchange is async, so getSession() can be
  //    null for a moment AND the SIGNED_IN event may fire before this effect's
  //    listener is attached. We therefore both listen AND poll for a short window
  //    so the page never gets stuck showing the sign-in button (or a spinner)
  //    after the teacher has actually signed in.
  useEffect(() => {
    if (phase !== 'preview' && phase !== 'profile') return;
    if (!preview?.valid) return;

    const supabase = getClient();
    let cancelled = false;

    const toProfile = (user: { user_metadata?: Record<string, any> }) => {
      if (cancelled) return;
      if (!prefilledRef.current) {
        prefilledRef.current = true;
        const googleName = user.user_metadata?.full_name || user.user_metadata?.name || '';
        setDisplayName((prev) => prev || googleName);
      }
      setPhase('profile');
    };

    // Poll getSession() for a few seconds to catch the async PKCE exchange.
    let tries = 0;
    const poll = async () => {
      if (cancelled) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        toProfile(session.user);
        return;
      }
      if (tries++ < 20) setTimeout(poll, 300); // ~6s max
    };
    poll();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) toProfile(session.user);
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [phase, preview]);

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    setError('');
    try {
      const supabase = getClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/invite/${token}`,
          queryParams: { prompt: 'select_account' },
        },
      });
      if (error) throw error;
    } catch (err: any) {
      console.error('Invite Google sign-in error:', err);
      setError('ไม่สามารถเข้าสู่ระบบด้วย Google ได้ กรุณาลองใหม่');
      setSigningIn(false);
    }
  };

  const handleAccept = async () => {
    setPhase('accepting');
    setError('');
    try {
      await acceptInvitation(token, {
        displayName: displayName.trim() || undefined,
        nickname: nickname.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      // Full reload so the auth provider re-initializes and picks up the new admin record
      window.location.href = '/dashboard';
    } catch (err: any) {
      setError(err.message || 'ไม่สามารถรับคำเชิญได้');
      setPhase('profile');
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-red-500 via-red-600 to-orange-500 p-6">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Image
            src="/logo.svg"
            alt="CodeLab School"
            width={180}
            height={45}
            className="object-contain brightness-0 invert"
            priority
          />
        </div>

        <Card className="border-0 shadow-2xl bg-white">
          <CardHeader className="text-center space-y-1">
            <CardTitle className="text-2xl font-bold text-gray-900">คำเชิญเข้าใช้งานระบบ</CardTitle>
            <CardDescription className="text-gray-500">
              CodeLab School Management System
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {phase === 'verifying' && (
              <div className="flex flex-col items-center py-8 text-gray-500">
                <Loader2 className="h-8 w-8 animate-spin mb-3" />
                กำลังตรวจสอบคำเชิญ...
              </div>
            )}

            {phase === 'accepting' && (
              <div className="flex flex-col items-center py-8 text-gray-600">
                <Loader2 className="h-8 w-8 animate-spin mb-3 text-red-500" />
                กำลังสร้างบัญชีและเข้าสู่ระบบ...
              </div>
            )}

            {phase === 'error' && (
              <Alert variant="destructive" className="border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Role/branch summary — shown on both preview and profile steps */}
            {(phase === 'preview' || phase === 'profile') && preview && (
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 space-y-3">
                <div className="flex items-center justify-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-red-500" />
                  <Badge variant="secondary" className="text-sm">{roleLabel(preview.role)}</Badge>
                </div>
                <div className="flex items-start justify-center gap-2 text-sm text-gray-600">
                  <Building2 className="h-4 w-4 mt-0.5 shrink-0" />
                  <span className="text-center">
                    {preview.allBranches
                      ? 'ทุกสาขา'
                      : (preview.branchNames && preview.branchNames.length > 0
                          ? preview.branchNames.join(', ')
                          : 'ทุกสาขา')}
                  </span>
                </div>
              </div>
            )}

            {error && (phase === 'preview' || phase === 'profile') && (
              <Alert variant="destructive" className="border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {phase === 'preview' && (
              <>
                <p className="text-center text-sm text-gray-500">
                  กดปุ่มด้านล่างเพื่อเข้าสู่ระบบด้วยบัญชี Google ของคุณ
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGoogleSignIn}
                  disabled={signingIn}
                  className="w-full h-12 border-gray-200 bg-white text-gray-700 font-medium hover:bg-gray-50 hover:text-gray-700"
                >
                  {signingIn ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                  )}
                  {signingIn ? 'กำลังเชื่อมต่อ Google...' : 'เข้าสู่ระบบด้วย Google'}
                </Button>
              </>
            )}

            {phase === 'profile' && (
              <>
                <p className="text-center text-sm text-gray-500">กรอกข้อมูลของคุณเพื่อเข้าใช้งาน</p>
                <div className="space-y-2">
                  <Label>ชื่อ-นามสกุล</Label>
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="เช่น สมชาย ใจดี"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label>ชื่อเล่น (ไม่บังคับ)</Label>
                  <Input
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="เช่น แนน"
                    className="h-11"
                  />
                </div>
                {isTeacher && (
                  <div className="space-y-2">
                    <Label>เบอร์โทร</Label>
                    <Input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="08x-xxx-xxxx"
                      className="h-11"
                    />
                  </div>
                )}
                <Button
                  type="button"
                  onClick={handleAccept}
                  className="w-full h-12 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-medium"
                >
                  เข้าใช้งานระบบ
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
