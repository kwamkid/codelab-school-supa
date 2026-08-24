'use client'

// แท็บล่างของแอปผู้ปกครอง — หน้าตา/พฤติกรรมอยู่ใน <BottomTabBar> (ใช้ร่วมกับ /team)
// ไฟล์นี้เหลือแค่ "มีแท็บอะไรบ้าง" + ตรรกะว่าจะโชว์แท็บ "ทีม" ไหม
//
// แท็บทีมโผล่เฉพาะบ้านที่มีลูกอยู่ทีม VEX. คำตอบเก็บใน localStorage เพราะ
// ค่านี้แทบไม่เปลี่ยน — อ่านคืนใน useLayoutEffect (ก่อนเบราว์เซอร์วาด) เปิดแอป
// ครั้งต่อ ๆ ไปจึงเห็น 4 แท็บตั้งแต่เฟรมแรก ไม่ใช่ขึ้น 3 แท็บแล้วค่อยเด้งเพิ่ม
// (เฉพาะครั้งแรกสุดของเครื่องนั้นที่ยังต้องรอผลจากเซิร์ฟเวอร์)

import { useEffect, useLayoutEffect, useState } from 'react'
import { Home, Calendar, MessageSquare, Trophy } from 'lucide-react'
import { useLiff } from '@/components/liff/liff-provider'
import { liffFetch } from '@/lib/line/liff-fetch'
import { BottomTabBar, type BottomTab } from '@/components/liff/bottom-tab-bar'

const TABS: BottomTab[] = [
  { label: 'หน้าหลัก', icon: Home, path: '/liff', match: (p) => p === '/liff' },
  { label: 'ตารางเรียน', icon: Calendar, path: '/liff/schedule', match: (p) => p.startsWith('/liff/schedule') },
  { label: 'Feedback', icon: MessageSquare, path: '/liff/feedback', match: (p) => p.startsWith('/liff/feedback') },
]

const TEAM_TAB: BottomTab = {
  label: 'ทีม',
  icon: Trophy,
  path: '/liff/team',
  match: (p) => p.startsWith('/liff/team'),
}

const HAS_TEAM_KEY = 'liff:has-team'

// useLayoutEffect ฝั่ง server ไม่มี — กัน warning ตอน SSR
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

export function BottomNav() {
  const { profile } = useLiff()
  const [hasTeam, setHasTeam] = useState(false)

  // อ่านคำตอบเดิมก่อนเฟรมแรกถูกวาด → ไม่เห็นแท็บกระพริบ
  useIsomorphicLayoutEffect(() => {
    try {
      if (window.localStorage.getItem(HAS_TEAM_KEY) === '1') setHasTeam(true)
    } catch {
      // โหมดส่วนตัว/สตอเรจปิด — ถือว่ายังไม่รู้ เดี๋ยวรอผลจากเซิร์ฟเวอร์
    }
  }, [])

  // ยืนยันกับเซิร์ฟเวอร์เสมอ (เผื่อเพิ่ง/เลิกอยู่ทีม) แล้วจำไว้ใช้ครั้งหน้า
  useEffect(() => {
    if (!profile?.userId) return
    let active = true
    ;(async () => {
      try {
        const res = await liffFetch('/api/liff/team', {
          lineUserId: profile.userId,
          action: 'has-team',
        })
        if (!active) return
        const value = !!res?.hasTeam
        setHasTeam(value)
        try {
          window.localStorage.setItem(HAS_TEAM_KEY, value ? '1' : '0')
        } catch {
          /* ไม่มีสตอเรจก็ข้ามไป */
        }
      } catch {
        // เช็คไม่ได้ = คงค่าที่จำไว้ ไม่ทำให้แท็บหาย
      }
    })()
    return () => {
      active = false
    }
  }, [profile?.userId])

  return <BottomTabBar tabs={hasTeam ? [...TABS, TEAM_TAB] : TABS} />
}
