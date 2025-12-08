'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Calendar, Home, MessageCircle } from 'lucide-react';
import Image from 'next/image';

export default function EventRegistrationSuccessPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="py-4">
          <div className="flex justify-center mb-2 pt-4">
            <Image
              src="/logo.svg"
              alt="CodeLab School"
              width={200}
              height={60}
              className="object-contain"
              priority
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        </div>
      </div>

      {/* Success Content */}
      <div className="flex items-center justify-center p-4 mt-8">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              {/* Success Icon */}
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto animate-bounce-once">
                <CheckCircle className="h-10 w-10 text-green-600" />
              </div>
              
              {/* Success Message */}
              <div>
                <h2 className="text-2xl font-bold text-green-800 mb-2">
                  ลงทะเบียนสำเร็จ!
                </h2>
                <p className="text-gray-600">
                  ข้อมูลของคุณได้ถูกบันทึกเรียบร้อยแล้ว
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  เจ้าหน้าที่จะติดต่อกลับเพื่อยืนยันการเข้าร่วมงาน
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-6 space-y-3">
                <Button
                  onClick={() => router.push('/liff/events')}
                  className="w-full bg-primary hover:bg-primary/90"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  ดู Events อื่นๆ
                </Button>
                
                <Button
                  onClick={() => router.push('/liff')}
                  variant="outline"
                  className="w-full"
                >
                  <Home className="h-4 w-4 mr-2" />
                  กลับหน้าหลัก
                </Button>
              </div>

              {/* Login Suggestion */}
              <div className="pt-4 border-t">
                <p className="text-xs text-gray-500 mb-2">
                  หากต้องการติดตามสถานะการลงทะเบียน
                </p>
                <Button
                  onClick={() => {
                    // Close LIFF if in LINE app
                    if (typeof window !== 'undefined' && (window as any).liff?.isInClient()) {
                      (window as any).liff.closeWindow();
                    } else {
                      router.push('/liff');
                    }
                  }}
                  variant="ghost"
                  size="sm"
                  className="text-green-600"
                >
                  <MessageCircle className="h-4 w-4 mr-1" />
                  เข้าสู่ระบบด้วย LINE
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <style jsx>{`
        @keyframes bounce-once {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        
        .animate-bounce-once {
          animation: bounce-once 0.6s ease-in-out;
        }
      `}</style>
    </div>
  );
}