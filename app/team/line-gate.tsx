'use client'

// Shown when the LINE user is not logged in, or is logged in but not a registered
// codelab parent. Points them to the existing registration flow.

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertCircle, UserPlus } from 'lucide-react'

export function LineGate({
  title = 'ยังไม่ได้ลงทะเบียน',
  message = 'บัญชี LINE นี้ยังไม่ได้ลงทะเบียนกับ CodeLab กรุณาลงทะเบียนก่อนใช้งาน',
}: {
  title?: string
  message?: string
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-amber-600" />
            </div>
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="text-sm text-gray-600">{message}</p>
            <Button asChild className="gap-2">
              <a href="/liff/register">
                <UserPlus className="h-4 w-4" /> ลงทะเบียน
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
