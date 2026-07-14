'use client'

// Add real students to a VEX team. Search public.students (nickname/name/school/
// code), multi-select, and add them all at once. Each becomes a vex.kids row that
// links student_id and snapshots the nickname/full name.

import { useState, useEffect, useCallback, useRef } from 'react'
import { authFetch } from '@/lib/auth-fetch'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { SearchInput } from '@/components/ui/search-input'
import { Checkbox } from '@/components/ui/checkbox'
import { SectionLoading } from '@/components/ui/loading'
import { UserPlus, School, GraduationCap, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StudentRow {
  id: string
  name: string | null
  nickname: string | null
  school_name: string | null
  grade_level: string | null
  student_code: string | null
  courses?: string[]
}

export function AddStudentsDialog({
  teamId,
  open,
  onOpenChange,
  onAdded,
}: {
  teamId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdded: () => void
}) {
  const [search, setSearch] = useState('')
  const [students, setStudents] = useState<StudentRow[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Record<string, StudentRow>>({})
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)

  // Debounced student search — only fires once the admin actually types.
  const load = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const res = await authFetch(`/api/admin/vex/students?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      if (res.ok) setStudents(data.students || [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const q = search.trim()
    if (!q) {
      setStudents([]) // don't preload — wait for a search term
      setLoading(false)
      return
    }
    // Show the loading state immediately, then search 450ms after typing stops
    // (so it doesn't fire on every keystroke).
    setLoading(true)
    const t = setTimeout(() => load(q), 450)
    return () => clearTimeout(t)
  }, [open, search, load])

  // Reset when opening.
  useEffect(() => {
    if (open) {
      setSearch('')
      setSelected({})
    }
  }, [open])

  const toggle = (s: StudentRow) => {
    setSelected((prev) => {
      const next = { ...prev }
      if (next[s.id]) delete next[s.id]
      else next[s.id] = s
      return next
    })
  }

  const selectedList = Object.values(selected)

  const submit = async () => {
    if (submittingRef.current) return
    if (selectedList.length === 0) return toast.error('เลือกนักเรียนอย่างน้อย 1 คน')
    submittingRef.current = true
    setSubmitting(true)
    try {
      const res = await authFetch(`/api/admin/vex/teams/${teamId}/kids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          students: selectedList.map((s) => ({
            student_id: s.id,
            nickname: s.nickname || s.name || 'นักเรียน',
            full_name: s.name || null,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'เพิ่มนักเรียนไม่สำเร็จ')
        return
      }
      const added = (data.kids || []).length
      const skipped = data.skipped || 0
      toast.success(
        skipped > 0 ? `เพิ่ม ${added} คน (มีอยู่แล้ว ${skipped} คน)` : `เพิ่มนักเรียน ${added} คนแล้ว`
      )
      onOpenChange(false)
      onAdded()
    } catch {
      toast.error('เกิดข้อผิดพลาด')
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>เพิ่มนักเรียนเข้าทีม</DialogTitle>
        </DialogHeader>

        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="ค้นหาชื่อเล่น / ชื่อจริง / โรงเรียน / รหัส"
        />

        {/* Selected chips */}
        {selectedList.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selectedList.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => toggle(s)}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs px-2 py-1 hover:bg-primary/20"
              >
                {s.nickname || s.name} ✕
              </button>
            ))}
          </div>
        )}

        {/* Results */}
        <div className="flex-1 overflow-y-auto -mx-1 px-1 min-h-[200px]">
          {loading ? (
            <SectionLoading />
          ) : students.length === 0 ? (
            <p className="text-center text-gray-500 py-8 text-sm">
              {search ? 'ไม่พบนักเรียน' : 'พิมพ์เพื่อค้นหานักเรียน'}
            </p>
          ) : (
            <div className="space-y-1">
              {students.map((s) => {
                const isSel = !!selected[s.id]
                return (
                  <label
                    key={s.id}
                    className={cn(
                      'flex items-start gap-3 rounded-lg border p-2.5 cursor-pointer transition',
                      isSel ? 'border-primary bg-primary/5' : 'border-input hover:bg-gray-50'
                    )}
                  >
                    <Checkbox checked={isSel} onCheckedChange={() => toggle(s)} className="mt-0.5" />
                    <div className="min-w-0">
                      <div className="font-medium">
                        {s.nickname || s.name}
                        {s.name && s.nickname && <span className="text-gray-400 font-normal"> — {s.name}</span>}
                      </div>
                      <div className="flex items-center gap-x-3 gap-y-0.5 flex-wrap text-xs text-gray-500 mt-0.5">
                        {s.school_name && (
                          <span className="flex items-center gap-1">
                            <School className="h-3 w-3" /> {s.school_name}
                          </span>
                        )}
                        {s.grade_level && (
                          <span className="flex items-center gap-1">
                            <GraduationCap className="h-3 w-3" /> {s.grade_level}
                          </span>
                        )}
                        {s.student_code && <span className="text-gray-400">{s.student_code}</span>}
                      </div>
                      {/* Courses the student is enrolled in (one per line) */}
                      {s.courses && s.courses.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {s.courses.map((c, i) => (
                            <div key={i} className="flex items-center gap-1 text-xs text-primary/80">
                              <BookOpen className="h-3 w-3 shrink-0" /> {c}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </label>
                )
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            ยกเลิก
          </Button>
          <Button onClick={submit} disabled={submitting || selectedList.length === 0} className="gap-1">
            <UserPlus className="h-4 w-4" />
            {submitting ? 'กำลังเพิ่ม...' : `เพิ่ม ${selectedList.length || ''} คน`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
