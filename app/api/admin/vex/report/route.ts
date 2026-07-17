// app/api/admin/vex/report/route.ts
// GET → aggregate report over kids registered in VEX teams: which schools they
// come from, their ages, and which CodeLab courses they have taken. Optional
// ?branchId= scopes to one branch's teams (matches the vexteam pages).

import { NextResponse } from 'next/server'
import { vexDb } from '@/lib/vex/supabase'
import { requireAdmin } from '@/lib/vex/api'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status })

  try {
    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get('branchId') || null

    // Teams (branch-scoped like the rest of /vexteam)
    let teamQuery = vexDb().from('teams').select('id, team_number, name, level, branch_id')
    if (branchId) teamQuery = teamQuery.eq('branch_id', branchId)
    const { data: teams, error: teamsError } = await teamQuery
    if (teamsError) throw teamsError

    const teamIds = (teams || []).map((t: any) => t.id)
    if (teamIds.length === 0) {
      return NextResponse.json({
        totalTeams: 0, totalKids: 0, byLevel: [], byBranch: [], schools: [], ages: [], courses: [],
      })
    }

    const { data: kids, error: kidsError } = await vexDb()
      .from('kids')
      .select('id, team_id, student_id, nickname')
      .in('team_id', teamIds)
    if (kidsError) throw kidsError

    const studentIds = [...new Set((kids || []).map((k: any) => k.student_id).filter(Boolean))] as string[]

    const levelByTeam = new Map<string, string>((teams || []).map((t: any) => [t.id as string, t.level as string]))
    const byLevelMap = new Map<string, { teams: number; kids: number }>()
    for (const t of (teams || []) as any[]) {
      const e = byLevelMap.get(t.level) || { teams: 0, kids: 0 }
      e.teams++
      byLevelMap.set(t.level, e)
    }
    for (const k of (kids || []) as any[]) {
      const lv = levelByTeam.get(k.team_id)
      if (!lv) continue
      const e = byLevelMap.get(lv) || { teams: 0, kids: 0 }
      e.kids++
      byLevelMap.set(lv, e)
    }

    // Per-branch breakdown (branch names live in public.branches)
    const supabase = createServiceClient()
    const branchIds = [...new Set((teams || []).map((t: any) => t.branch_id).filter(Boolean))] as string[]
    const branchName = new Map<string, string>()
    if (branchIds.length > 0) {
      const { data } = await supabase.from('branches').select('id, name').in('id', branchIds)
      for (const b of data || []) branchName.set(b.id, b.name)
    }
    const byBranchMap = new Map<string, { teams: number; kids: number }>()
    const branchByTeam = new Map<string, string>((teams || []).map((t: any) => [t.id as string, (t.branch_id || '') as string]))
    for (const t of (teams || []) as any[]) {
      const key = branchName.get(t.branch_id) || 'ไม่ระบุสาขา'
      const e = byBranchMap.get(key) || { teams: 0, kids: 0 }
      e.teams++
      byBranchMap.set(key, e)
    }
    for (const k of (kids || []) as any[]) {
      const key = branchName.get(branchByTeam.get(k.team_id) || '') || 'ไม่ระบุสาขา'
      const e = byBranchMap.get(key) || { teams: 0, kids: 0 }
      e.kids++
      byBranchMap.set(key, e)
    }

    // Students → school + age (kids link real students; see rules.md)
    let students: any[] = []
    if (studentIds.length > 0) {
      const { data, error } = await supabase
        .from('students')
        .select('id, name, nickname, birthdate, school_name, grade_level')
        .in('id', studentIds)
      if (error) throw error
      students = data || []
    }

    // Display name per student (nickname first) — reused by every hover list
    const nameById = new Map<string, string>(
      students.map((s: any) => [s.id as string, (s.nickname || s.name || '') as string])
    )

    const schoolMap = new Map<string, { count: number; names: string[] }>()
    const ageMap = new Map<number, { count: number; names: string[] }>()
    for (const s of students) {
      const display = nameById.get(s.id) || ''
      const school = (s.school_name || '').trim() || 'ไม่ระบุ'
      const sc = schoolMap.get(school) || { count: 0, names: [] }
      sc.count++
      sc.names.push(display)
      schoolMap.set(school, sc)
      if (s.birthdate) {
        const b = new Date(s.birthdate)
        const now = new Date()
        let age = now.getFullYear() - b.getFullYear()
        const m = now.getMonth() - b.getMonth()
        if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--
        if (age >= 0 && age < 30) {
          const ac = ageMap.get(age) || { count: 0, names: [] }
          ac.count++
          ac.names.push(display)
          ageMap.set(age, ac)
        }
      }
    }

    // Courses the kids have taken (any enrollment, ever)
    const courseMap = new Map<string, { name: string; color: string | null; students: Set<string> }>()
    if (studentIds.length > 0) {
      // "ever taken" = any enrollment row; statuses are active/completed/
      // paused/transferred/dropped (no 'cancelled' in this enum) and even a
      // dropped kid did attend, so no status filter. Same-subject transfers
      // dedupe via the per-subject student Set below.
      const { data: enrollments, error: enrollError } = await supabase
        .from('enrollments')
        .select('student_id, status, class_id')
        .in('student_id', studentIds)
      if (enrollError) throw enrollError

      const classIds = [...new Set((enrollments || []).map((e: any) => e.class_id).filter(Boolean))] as string[]
      let classes: any[] = []
      if (classIds.length > 0) {
        const { data, error } = await supabase.from('classes').select('id, subject_id').in('id', classIds)
        if (error) throw error
        classes = data || []
      }
      const subjectByClass = new Map(classes.map((c: any) => [c.id, c.subject_id]))
      const subjectIds = [...new Set(classes.map((c: any) => c.subject_id).filter(Boolean))]
      let subjects: any[] = []
      if (subjectIds.length > 0) {
        const { data, error } = await supabase.from('subjects').select('id, name, color').in('id', subjectIds)
        if (error) throw error
        subjects = data || []
      }
      const subjectMeta = new Map(subjects.map((s: any) => [s.id, s]))

      for (const e of enrollments || []) {
        const subjectId = subjectByClass.get(e.class_id)
        const meta = subjectId ? subjectMeta.get(subjectId) : null
        if (!meta) continue
        const entry = courseMap.get(subjectId) || { name: meta.name, color: meta.color || null, students: new Set<string>() }
        entry.students.add(e.student_id)
        courseMap.set(subjectId, entry)
      }
    }

    return NextResponse.json({
      totalTeams: teams?.length || 0,
      totalKids: kids?.length || 0,
      byLevel: [...byLevelMap.entries()].map(([level, v]) => ({ level, ...v })),
      byBranch: [...byBranchMap.entries()]
        .map(([branch, v]) => ({ branch, ...v }))
        .sort((a, b) => b.kids - a.kids),
      schools: [...schoolMap.entries()]
        .map(([school, v]) => ({ school, count: v.count, names: v.names.sort() }))
        .sort((a, b) => b.count - a.count),
      ages: [...ageMap.entries()]
        .map(([age, v]) => ({ age, count: v.count, names: v.names.sort() }))
        .sort((a, b) => a.age - b.age),
      courses: [...courseMap.values()]
        .map((c) => ({
          name: c.name,
          color: c.color,
          students: c.students.size,
          names: [...c.students].map((id) => nameById.get(id) || '').filter(Boolean).sort(),
        }))
        .sort((a, b) => b.students - a.students),
    })
  } catch (e) {
    console.error('[vex report] error:', e)
    return NextResponse.json({ error: 'โหลดรายงานไม่สำเร็จ' }, { status: 500 })
  }
}
