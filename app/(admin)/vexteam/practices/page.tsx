'use client'

// VEX Team → ตารางซ้อม (month calendar, view-first).
// ครู (role teacher) เข้าดูได้ — อนุมัติ/เพิ่มซ้อม/ไปหน้าคำขอ เป็นของแอดมินเท่านั้น
// (หน้าอนุมัติแยกอยู่ที่ /vexteam/practices/requests)

import { useEffect, useState, useCallback, useMemo } from 'react'
import { authFetch } from '@/lib/auth-fetch'
import { toast } from 'sonner'
import { PageHeader } from '@/components/ui/page-header'
import { FormSelect, type FormSelectOption } from '@/components/ui/form-select'
import { SectionLoading } from '@/components/ui/loading'
import { CalendarDays } from 'lucide-react'
import { useBranch } from '@/contexts/BranchContext'
import { useAuth } from '@/hooks/useAuth'
import { AddPracticeDialog } from '../add-practice-dialog'
import { PracticeMonthView, type CalendarPractice } from '../practice-month-view'
import { RejectPracticeDialog } from '../reject-practice-dialog'
import type { PracticeStatus } from '@/lib/vex/types'

interface PracticeRow extends CalendarPractice {
  team_id: string
  branch_id: string | null
}

export default function VexPracticeSchedulePage() {
  const { selectedBranchId } = useBranch()
  const { adminUser } = useAuth()
  // ครูดูได้อย่างเดียว — ปุ่มอนุมัติ/เพิ่มซ้อม/หน้าคำขอ เป็นของแอดมิน
  const canManage = adminUser?.role === 'super_admin' || adminUser?.role === 'branch_admin'

  const [all, setAll] = useState<PracticeRow[]>([])
  const [teams, setTeams] = useState<{ id: string; team_number: string; name: string | null; branch_id: string | null }[]>([])
  const [loading, setLoading] = useState(true)
  const [teamFilter, setTeamFilter] = useState<string>('all')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejectTarget, setRejectTarget] = useState<PracticeRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [pRes, tRes] = await Promise.all([
        authFetch('/api/admin/vex/practices?status=all'),
        authFetch('/api/admin/vex/teams'),
      ])
      const pData = await pRes.json()
      const tData = await tRes.json()
      if (!pRes.ok) {
        toast.error(pData.error || 'โหลดตารางซ้อมไม่สำเร็จ')
        return
      }
      setAll(pData.practices || [])
      if (tRes.ok) {
        setTeams(
          (tData.teams || []).map((t: any) => ({ id: t.id, team_number: t.team_number, name: t.name, branch_id: t.branch_id }))
        )
      }
    } catch {
      toast.error('เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const onChanged = () => load()
    window.addEventListener('vex-practices-changed', onChanged)
    return () => window.removeEventListener('vex-practices-changed', onChanged)
  }, [load])

  // Scope: top-bar branch → team filter
  const visible = useMemo(() => {
    let list = selectedBranchId ? all.filter((r) => r.branch_id === selectedBranchId) : all
    if (teamFilter !== 'all') list = list.filter((r) => r.team_id === teamFilter)
    return list
  }, [all, selectedBranchId, teamFilter])

  const teamOptions = useMemo<FormSelectOption[]>(() => {
    const scoped = selectedBranchId ? teams.filter((t) => t.branch_id === selectedBranchId) : teams
    return [
      { value: 'all', label: 'ทุกทีม' },
      ...scoped.map((t) => ({ value: t.id, label: `${t.team_number}${t.name ? ` — ${t.name}` : ''}` })),
    ]
  }, [teams, selectedBranchId])

  // Admin approve/reject inline from the day list (teacher gets no onReview)
  // ไม่อนุมัติ → เปิด dialog กรอกเหตุผลก่อน (บังคับ)
  const review = async (id: string, status: PracticeStatus, rejectReason?: string) => {
    if (status === 'rejected' && !rejectReason) {
      const row = all.find((r) => r.id === id)
      if (row) setRejectTarget(row)
      return
    }
    if (busyId) return
    setBusyId(id)
    try {
      const res = await authFetch(`/api/admin/vex/practices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          status === 'rejected' ? { status, reject_reason: rejectReason } : { status }
        ),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'บันทึกไม่สำเร็จ')
        return
      }
      toast.success(status === 'approved' ? 'อนุมัติแล้ว' : 'ปฏิเสธแล้ว (แจ้งเหตุผลให้ผู้ปกครองแล้ว)')
      setAll((prev) => prev.map((r) => (r.id === id ? { ...r, ...data.practice } : r)))
      setRejectTarget(null)
      window.dispatchEvent(new Event('vex-practices-changed'))
    } catch {
      toast.error('เกิดข้อผิดพลาด')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="p-4 sm:p-6 text-base">
      <PageHeader
        title="ตารางซ้อม"
        icon={CalendarDays}
        iconColor="text-red-600"
        description="ปฏิทินการซ้อมของทุกทีม — เลือกทีมเพื่อดูเฉพาะทีม"
        action={
          canManage ? (
            <AddPracticeDialog
              branchId={selectedBranchId}
              onCreated={() => window.dispatchEvent(new Event('vex-practices-changed'))}
            />
          ) : undefined
        }
      />

      <div className="space-y-4">
        <div className="w-full sm:w-80">
          <FormSelect
            options={teamOptions}
            value={teamFilter}
            onValueChange={setTeamFilter}
            placeholder="เลือกทีม"
          />
        </div>

        {loading ? (
          <SectionLoading />
        ) : (
          <PracticeMonthView
            practices={visible}
            // กรองทีมเดียวแล้ว → chip โชว์แค่ชื่อเด็ก; ดูรวมทุกทีม → group ตามทีม
            groupByTeam={teamFilter === 'all'}
            onReview={canManage ? (id, status) => review(id, status) : undefined}
            busyId={busyId}
          />
        )}
      </div>

      <RejectPracticeDialog
        open={!!rejectTarget}
        summary={
          rejectTarget
            ? `${rejectTarget.kidNickname || '-'} (${rejectTarget.teamNumber || '-'}) — ${rejectTarget.practice_date}`
            : null
        }
        busy={!!rejectTarget && busyId === rejectTarget.id}
        onCancel={() => setRejectTarget(null)}
        onConfirm={(reason) => {
          if (rejectTarget) review(rejectTarget.id, 'rejected', reason)
        }}
      />
    </div>
  )
}
