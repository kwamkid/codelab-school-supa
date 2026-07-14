'use client'

// Create-team dialog form: team_number + optional name + level → POST authFetch.
// On success, refreshes the parent list.

import { useState, useRef, useEffect } from 'react'
import { authFetch } from '@/lib/auth-fetch'
import { toast } from 'sonner'
import { getBranches } from '@/lib/services/branches'
import { useBranch } from '@/contexts/BranchContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus } from 'lucide-react'
import { LEVELS, type Level } from '@/lib/vex/types'
import { LevelBadge } from '@/components/vex/level-badge'

export function CreateTeamForm({ onCreated }: { onCreated: () => void }) {
  const { selectedBranchId } = useBranch()
  const [open, setOpen] = useState(false)
  const [teamNumber, setTeamNumber] = useState('')
  const [name, setName] = useState('')
  const [level, setLevel] = useState<Level>('iq_elem')
  const [branchId, setBranchId] = useState<string>('')
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)

  // Load branches once the dialog opens; default to the top-bar branch.
  useEffect(() => {
    if (!open) return
    getBranches()
      .then((list) => {
        setBranches(list.map((b: any) => ({ id: b.id, name: b.name })))
        if (!branchId) setBranchId(selectedBranchId || list[0]?.id || '')
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const reset = () => {
    setTeamNumber('')
    setName('')
    setLevel('iq_elem')
    setBranchId(selectedBranchId || '')
  }

  const submit = async () => {
    if (submittingRef.current) return
    if (!teamNumber.trim()) {
      toast.error('กรุณากรอกหมายเลขทีม')
      return
    }
    if (!branchId) {
      toast.error('กรุณาเลือกสาขา')
      return
    }
    submittingRef.current = true
    setSubmitting(true)
    try {
      const res = await authFetch('/api/admin/vex/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_number: teamNumber.trim(), name: name.trim() || undefined, level, branch_id: branchId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'สร้างทีมไม่สำเร็จ')
        return
      }
      toast.success('สร้างทีมสำเร็จ')
      reset()
      setOpen(false)
      onCreated()
    } catch (e) {
      toast.error('เกิดข้อผิดพลาด')
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" /> สร้างทีม
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>สร้างทีม VEX</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="team_number">หมายเลขทีม (VEX code)</Label>
            <Input
              id="team_number"
              placeholder="เช่น 2999A"
              value={teamNumber}
              onChange={(e) => setTeamNumber(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="team_name">ชื่อทีม (ไม่บังคับ)</Label>
            <Input id="team_name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>สาขา</Label>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger>
                <SelectValue placeholder="เลือกสาขา" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            ยกเลิก
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? 'กำลังสร้าง...' : 'สร้างทีม'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
