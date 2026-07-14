'use client'

// Team detail: show team + its public links, add/list kids, delete team.

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { authFetch } from '@/lib/auth-fetch'
import { toast } from 'sonner'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageLoading } from '@/components/ui/loading'
import { EmptyState } from '@/components/ui/empty-state'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Users, Copy, Trash2, Plus, ArrowLeft, Pencil } from 'lucide-react'
import { type Level } from '@/lib/vex/types'
import { LevelBadge } from '@/components/vex/level-badge'
import { EditTeamForm } from '../edit-team-form'

interface Team {
  id: string
  team_number: string
  name: string | null
  level: Level
  branch_id: string | null
  branchName?: string | null
  eventLink: string | null
  practiceLink: string | null
}
interface Kid {
  id: string
  nickname: string
  full_name: string | null
}

function publicUrl(kind: 'e' | 'p', slug: string) {
  if (typeof window === 'undefined') return `/team/${kind}/${slug}`
  return `${window.location.origin}/team/${kind}/${slug}`
}

export default function VexTeamDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [team, setTeam] = useState<Team | null>(null)
  const [kids, setKids] = useState<Kid[]>([])
  const [loading, setLoading] = useState(true)
  const [nickname, setNickname] = useState('')
  const [fullName, setFullName] = useState('')
  const [adding, setAdding] = useState(false)
  const addingRef = useRef(false)
  const [editOpen, setEditOpen] = useState(false)

  const load = useCallback(async () => {
    const res = await authFetch(`/api/admin/vex/teams/${id}`)
    const data = await res.json()
    if (res.ok) {
      setTeam(data.team)
      setKids(data.kids || [])
    } else {
      toast.error(data.error || 'โหลดข้อมูลไม่สำเร็จ')
    }
    setLoading(false)
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const addKid = async () => {
    if (addingRef.current) return
    if (!nickname.trim()) return toast.error('กรุณากรอกชื่อเล่น')
    addingRef.current = true
    setAdding(true)
    try {
      const res = await authFetch(`/api/admin/vex/teams/${id}/kids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: nickname.trim(), full_name: fullName.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) return toast.error(data.error || 'เพิ่มเด็กไม่สำเร็จ')
      toast.success('เพิ่มเด็กสำเร็จ')
      setNickname('')
      setFullName('')
      load()
    } catch {
      toast.error('เกิดข้อผิดพลาด')
    } finally {
      addingRef.current = false
      setAdding(false)
    }
  }

  const deleteTeam = async () => {
    const res = await authFetch(`/api/admin/vex/teams/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) return toast.error(data.error || 'ลบทีมไม่สำเร็จ')
    toast.success('ลบทีมแล้ว')
    router.push('/vexteam')
  }

  const copy = async (label: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success(`คัดลอกลิงก์${label}แล้ว`)
    } catch {
      toast.error('คัดลอกไม่สำเร็จ')
    }
  }

  if (loading) return <PageLoading />
  if (!team) return <div className="p-6">ไม่พบทีม</div>

  return (
    <div className="p-4 sm:p-6 text-base space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.push('/vexteam')} className="gap-1">
        <ArrowLeft className="h-4 w-4" /> กลับ
      </Button>

      <PageHeader
        title={team.team_number + (team.name ? ` — ${team.name}` : '')}
        icon={Users}
        iconColor="text-red-600"
        badge={<span className="ml-2"><LevelBadge level={team.level} /></span>}
        action={
          <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" /> แก้ไข
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="gap-1">
                <Trash2 className="h-4 w-4" /> ลบทีม
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>ลบทีม {team.team_number}?</AlertDialogTitle>
                <AlertDialogDescription>
                  จะลบเด็ก, การแจ้งเข้าร่วม และการซ้อมของทีมนี้ทั้งหมด ไม่สามารถกู้คืนได้
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                <AlertDialogAction onClick={deleteTeam} className="bg-red-600 hover:bg-red-700">
                  ลบทีม
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          </div>
        }
      />

      <EditTeamForm
        team={team}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={load}
      />

      {/* Public links */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="font-semibold">ลิงก์สำหรับผู้ปกครอง</h3>
          {team.eventLink && (
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-500">RSVP กิจกรรม</div>
                <div className="text-sm truncate">{publicUrl('e', team.eventLink)}</div>
              </div>
              <Button variant="outline" size="sm" onClick={() => copy('RSVP กิจกรรม', publicUrl('e', team.eventLink!))}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          {team.practiceLink && (
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-500">ซ้อม</div>
                <div className="text-sm truncate">{publicUrl('p', team.practiceLink)}</div>
              </div>
              <Button variant="outline" size="sm" onClick={() => copy('ซ้อม', publicUrl('p', team.practiceLink!))}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Kids */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <h3 className="font-semibold">เด็กในทีม ({kids.length})</h3>

          <div className="flex flex-col sm:flex-row gap-2 items-end">
            <div className="flex-1 space-y-1 w-full">
              <Label htmlFor="nickname">ชื่อเล่น</Label>
              <Input id="nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} />
            </div>
            <div className="flex-1 space-y-1 w-full">
              <Label htmlFor="fullname">ชื่อจริง (ไม่บังคับ)</Label>
              <Input id="fullname" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <Button onClick={addKid} disabled={adding} className="gap-1 w-full sm:w-auto">
              <Plus className="h-4 w-4" /> เพิ่ม
            </Button>
          </div>

          {kids.length === 0 ? (
            <EmptyState icon={Users} title="ยังไม่มีเด็กในทีม" />
          ) : (
            <div className="divide-y">
              {kids.map((k) => (
                <div key={k.id} className="py-2 flex items-center justify-between">
                  <span className="font-medium">{k.nickname}</span>
                  {k.full_name && <span className="text-sm text-gray-500">{k.full_name}</span>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
