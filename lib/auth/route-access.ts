// lib/auth/route-access.ts
// ตารางกลาง "path ไหน role ไหนเข้าได้" — admin layout บังคับใช้ทุกหน้า (route guard)
// ก่อนหน้านี้การซ่อนเมนูเป็นแค่ menu-only: พิมพ์ URL ตรงก็เข้าได้ → ตารางนี้ปิดช่องนั้น
//
// กติกา: เลือก rule ที่ prefix ยาวที่สุดที่ตรงกับ path · ไม่มี rule = staff ทุก role เข้าได้
// ใส่เฉพาะส่วนที่ชัดว่า role อื่นไม่มีธุระ (หน้าที่ครูถูกลิงก์เข้าไปจากหน้าอื่น เช่น
// /classes/[id] ยังไม่บังคับ กันพังกลางทาง — เพิ่มทีหลังได้เมื่อแน่ใจ)
// ⚠️ นี่คือชั้นหน้าเว็บ — API ต้องเช็คสิทธิ์ของตัวเองเสมอ (requireSuperAdmin / requireStaffScope)

export type StaffRole = 'super_admin' | 'branch_admin' | 'teacher'

interface RouteRule {
  prefix: string
  roles: StaffRole[]
}

export const ROUTE_RULES: RouteRule[] = [
  // กลุ่มผู้บริหาร
  { prefix: '/reports/business', roles: ['super_admin'] },
  { prefix: '/reports/payment-gaps', roles: ['super_admin'] },
  { prefix: '/reports/usage', roles: ['super_admin'] },
  { prefix: '/users', roles: ['super_admin'] },
  // รายงาน / บัญชี / ติดตามเด็กเสี่ยง — แอดมินสาขาเข้าได้ ครูไม่ได้
  { prefix: '/followups', roles: ['super_admin', 'branch_admin'] },
  { prefix: '/reports', roles: ['super_admin', 'branch_admin'] },
  { prefix: '/accounting', roles: ['super_admin', 'branch_admin'] },
]

/** Rule that governs `pathname` (longest matching prefix), or null when unrestricted. */
export function routeRuleFor(pathname: string): RouteRule | null {
  let best: RouteRule | null = null
  for (const r of ROUTE_RULES) {
    if ((pathname === r.prefix || pathname.startsWith(r.prefix + '/')) && (!best || r.prefix.length > best.prefix.length)) {
      best = r
    }
  }
  return best
}

export function canAccessRoute(pathname: string, role: StaffRole | null | undefined): boolean {
  const rule = routeRuleFor(pathname)
  if (!rule) return true
  return !!role && rule.roles.includes(role)
}
