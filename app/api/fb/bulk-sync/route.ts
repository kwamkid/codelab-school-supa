import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getFacebookAdsSettings } from '@/lib/supabase/services/facebook-ads-settings'
import { addToCustomAudience } from '@/lib/fb/api'
import { hashPhone, hashEmail } from '@/lib/fb/utils'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes for bulk operations

type AudienceType =
  | 'all_members'
  | 'current_students'
  | 'trial_not_enrolled'
  | 'event_attendees'

interface SyncResult {
  success: boolean
  audienceType: AudienceType
  total: number
  synced: number
  failed: number
  skipped: number
  errors: string[]
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { audienceType } = body as { audienceType: AudienceType }

    if (!audienceType) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุ audienceType' },
        { status: 400 }
      )
    }

    const settings = await getFacebookAdsSettings()

    if (!settings.fbAccessToken) {
      return NextResponse.json(
        { success: false, error: 'Access Token ยังไม่ได้ตั้งค่า' },
        { status: 400 }
      )
    }

    // Get the target audience ID
    const audienceIdMap: Record<AudienceType, string> = {
      all_members: settings.audienceAllMembers,
      current_students: settings.audienceCurrentStudents,
      trial_not_enrolled: settings.audienceTrialNotEnrolled,
      event_attendees: settings.audienceEventAttendees,
    }

    const audienceId = audienceIdMap[audienceType]
    if (!audienceId) {
      return NextResponse.json(
        { success: false, error: `Audience ID สำหรับ "${audienceType}" ยังไม่ได้ตั้งค่า` },
        { status: 400 }
      )
    }

    // Query contacts based on audience type
    const contacts = await getContactsForAudienceType(audienceType)

    if (contacts.length === 0) {
      return NextResponse.json({
        success: true,
        total: 0,
        synced: 0,
        failed: 0,
        skipped: 0,
        errors: [],
        audienceType,
      } satisfies SyncResult)
    }

    // Bulk add to audience
    let synced = 0
    let failed = 0
    let skipped = 0
    const errors: string[] = []

    for (const contact of contacts) {
      if (!contact.phone) {
        skipped++
        continue
      }

      try {
        const phoneHash = hashPhone(contact.phone)
        const emailHash = contact.email ? hashEmail(contact.email) : undefined

        const result = await addToCustomAudience(
          settings.fbAccessToken,
          audienceId,
          phoneHash,
          emailHash
        )

        if (result.success) {
          synced++
        } else {
          failed++
          if (errors.length < 5) {
            errors.push(result.error || 'Unknown error')
          }
        }
      } catch {
        failed++
        if (errors.length < 5) {
          errors.push('Unexpected error')
        }
      }
    }

    return NextResponse.json({
      success: true,
      audienceType,
      total: contacts.length,
      synced,
      failed,
      skipped,
      errors,
    } satisfies SyncResult)
  } catch (error) {
    console.error('[FB] bulk-sync error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to bulk sync audience' },
      { status: 500 }
    )
  }
}

/**
 * Query contacts from DB based on audience type.
 */
async function getContactsForAudienceType(
  audienceType: AudienceType
): Promise<Array<{ phone: string; email: string | null }>> {
  const supabase = createServiceClient()

  switch (audienceType) {
    case 'all_members': {
      // ลูกค้าทั้งหมด: ผู้ปกครองที่เคยสมัครเรียน (ทุกสถานะ)
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('parent_id')

      const enrollmentRows = (enrollments || []) as Array<{ parent_id: string }>
      if (enrollmentRows.length === 0) return []

      const parentIds = [...new Set(enrollmentRows.map((e) => e.parent_id))]
      const { data: parents } = await supabase
        .from('parents')
        .select('phone, email')
        .in('id', parentIds)
        .not('phone', 'is', null)
        .neq('phone', '')

      return (parents || []) as Array<{ phone: string; email: string | null }>
    }

    case 'current_students': {
      // ลูกค้าปัจจุบัน: เฉพาะ enrollment active ทุกสาขา
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('parent_id')
        .eq('status', 'active')

      const enrollmentRows = (enrollments || []) as Array<{ parent_id: string }>
      if (enrollmentRows.length === 0) return []

      const parentIds = [...new Set(enrollmentRows.map((e) => e.parent_id))]
      const { data: parents } = await supabase
        .from('parents')
        .select('phone, email')
        .in('id', parentIds)
        .not('phone', 'is', null)
        .neq('phone', '')

      return (parents || []) as Array<{ phone: string; email: string | null }>
    }

    case 'trial_not_enrolled': {
      // สนใจแต่ยังไม่สมัคร: trial bookings + event attendees + สมาชิกที่ไม่มี enrollment
      // หา parent_id ที่มี enrollment อยู่แล้ว เพื่อ exclude
      const { data: enrolledData } = await supabase
        .from('enrollments')
        .select('parent_id')

      const enrolledParentIds = new Set(
        ((enrolledData || []) as Array<{ parent_id: string }>).map((e) => e.parent_id)
      )

      const seen = new Set<string>()
      const contacts: Array<{ phone: string; email: string | null }> = []

      // 1) Trial bookings ที่ยังไม่ convert
      const { data: trials } = await supabase
        .from('trial_bookings')
        .select('parent_phone, parent_email')
        .in('status', ['new', 'contacted', 'scheduled', 'completed'])

      const trialRows = (trials || []) as Array<{ parent_phone: string; parent_email: string | null }>
      for (const t of trialRows) {
        if (t.parent_phone && !seen.has(t.parent_phone)) {
          seen.add(t.parent_phone)
          contacts.push({ phone: t.parent_phone, email: t.parent_email })
        }
      }

      // 2) Event attendees ที่ยังไม่มี enrollment
      const { data: eventRegs } = await supabase
        .from('event_registrations')
        .select('parent_id, parent_phone, parent_email')
        .in('status', ['confirmed', 'attended'])

      const eventRows = (eventRegs || []) as Array<{ parent_id: string | null; parent_phone: string; parent_email: string | null }>
      for (const r of eventRows) {
        // ข้าม event attendee ที่มี enrollment แล้ว
        if (r.parent_id && enrolledParentIds.has(r.parent_id)) continue
        if (r.parent_phone && !seen.has(r.parent_phone)) {
          seen.add(r.parent_phone)
          contacts.push({ phone: r.parent_phone, email: r.parent_email })
        }
      }

      // 3) สมาชิกที่สมัครแล้วแต่ไม่มี enrollment เลย
      const { data: allParents } = await supabase
        .from('parents')
        .select('id, phone, email')
        .not('phone', 'is', null)
        .neq('phone', '')

      const parentRows = (allParents || []) as Array<{ id: string; phone: string; email: string | null }>
      for (const p of parentRows) {
        if (!enrolledParentIds.has(p.id) && !seen.has(p.phone)) {
          seen.add(p.phone)
          contacts.push({ phone: p.phone, email: p.email })
        }
      }

      return contacts
    }

    case 'event_attendees': {
      // Event registrations with confirmed/attended status
      const { data: registrations } = await supabase
        .from('event_registrations')
        .select('parent_phone, parent_email')
        .in('status', ['confirmed', 'attended'])

      const regRows = (registrations || []) as Array<{ parent_phone: string; parent_email: string | null }>
      if (regRows.length === 0) return []

      // Deduplicate by phone
      const seen = new Set<string>()
      const contacts: Array<{ phone: string; email: string | null }> = []
      for (const r of regRows) {
        if (r.parent_phone && !seen.has(r.parent_phone)) {
          seen.add(r.parent_phone)
          contacts.push({ phone: r.parent_phone, email: r.parent_email })
        }
      }
      return contacts
    }

    default:
      return []
  }
}
