'use client'

// Dialog ยืนยัน "ไม่อนุมัติ" คำขอซ้อม — บังคับกรอกเหตุผล (ไปกับ LINE noti ถึง
// ผู้ปกครอง และแสดงในลิสต์คำขอ/หน้า team). ใช้ร่วมกันทั้งหน้า คำขอซ้อม และ
// ตารางซ้อม (ปฏิทิน).

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, X } from 'lucide-react'

export function RejectPracticeDialog({
  open,
  summary,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean
  /** บรรทัดสรุปคำขอที่กำลังปฏิเสธ เช่น "หมาก — 26 ก.ค. 16:00-19:00" */
  summary: string | null
  busy?: boolean
  onCancel: () => void
  onConfirm: (reason: string) => void
}) {
  const [reason, setReason] = useState('')

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setReason('')
          onCancel()
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>ไม่อนุมัติคำขอซ้อม</DialogTitle>
          <DialogDescription>
            {summary}
            <br />
            เหตุผลจะถูกส่งแจ้งผู้ปกครองทาง LINE พร้อมผลการพิจารณา
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="reject_reason">เหตุผลที่ไม่อนุมัติ *</Label>
          <Textarea
            id="reject_reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="เช่น วันดังกล่าวห้องซ้อมไม่ว่าง / มีการแข่งขันอื่น"
            rows={3}
            maxLength={500}
          />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => { setReason(''); onCancel() }} disabled={busy}>
            ยกเลิก
          </Button>
          <Button
            variant="destructive"
            disabled={busy || !reason.trim()}
            onClick={() => onConfirm(reason.trim())}
          >
            {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <X className="h-4 w-4 mr-1" />}
            ยืนยันไม่อนุมัติ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
