'use client'

// Edit-team dialog: change team_number / name / level (PATCH). Controlled open.

import { useState, useRef, useEffect } from 'react'
import { authFetch } from '@/lib/auth-fetch'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LEVELS, type Level } from '@/lib/vex/types'
import { LevelBadge } from '@/components/vex/level-badge'

interface EditableTeam {
  id: string
  team_number: string
  name: string | null
  level: Level
}

interface Props {
  team: EditableTeam
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

export function EditTeamForm({ team, open, onOpenChange, onSaved }: Props) {
  const [teamNumber, setTeamNumber] = useState(team.team_number)
  const [name, setName] = useState(team.name || '')
  const [level, setLevel] = useState<Level>(team.level)
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)

  // Re-seed when opening for a (possibly different) team.
  useEffect(() => {
    if (open) {
      setTeamNumber(team.team_number)
      setName(team.name || '')
      setLevel(team.level)
    }
  }, [open, team])

  const submit = async () => {
    if (submittingRef.current) return
    if (!teamNumber.trim()) return toast.error('กรุณากรอกหมายเลขทีม')
    submittingRef.current = true
    setSubmitting(true)
    try {
      const res = await authFetch(`/api/admin/vex/teams/${team.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_number: teamNumber.trim(), name: name.trim() || null, level }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'แก้ไขไม่สำเร็จ')
        return
      }
      toast.success('บันทึกการแก้ไขแล้ว')
      onOpenChange(false)
      onSaved()
    } catch {
      toast.error('เกิดข้อผิดพลาด')
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  const numberChanged = teamNumber.trim() !== team.team_number

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>แก้ไขทีม</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="edit_team_number">หมายเลขทีม (VEX code)</Label>
            <Input id="edit_team_number" value={teamNumber} onChange={(e) => setTeamNumber(e.target.value)} />
            {numberChanged && (
              <p className="text-xs text-amber-600">
                เปลี่ยนหมายเลขทีมจะทำให้ลิงก์เดิมที่แจกไปแล้วใช้ไม่ได้ ต้องส่งลิงก์ใหม่ให้ผู้ปกครอง
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit_team_name">ชื่อทีม (ไม่บังคับ)</Label>
            <Input id="edit_team_name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>ระดับ</Label>
            <Select value={level} onValueChange={(v) => setLevel(v as Level)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEVELS.map((lv) => (
                  <SelectItem key={lv} value={lv}>
                    <LevelBadge level={lv} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            ยกเลิก
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
