import { cn } from '@/lib/utils'

// โครงหน้าจอระหว่างรอข้อมูล (skeleton) — ใช้แทนสปินเนอร์เต็มจอเวลาสลับแท็บ
// ผู้ใช้จะเห็น "หน้าตาแบบเดิม" ทันทีแล้วค่อยมีข้อมูลมาแทน ไม่กระโดดไปจอโหลด
//
// วิธีใช้: ประกอบให้ใกล้เคียงหน้าจริง (จำนวนแถว/ความสูงพอ ๆ กัน)
//   <Skeleton className="h-5 w-32" />
//   <SkeletonText lines={2} />
//   <SkeletonRows count={4} />

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-gray-200/80 dark:bg-gray-700/50', className)} />
}

/** ย่อหน้าหลอก ๆ — บรรทัดสุดท้ายสั้นกว่าเพื่อนให้ดูเป็นข้อความจริง */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-4', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  )
}

/** รายการแถวเต็มความกว้าง (แบบเดียวกับลิสต์ในแอปผู้ปกครอง) */
export function SkeletonRows({
  count = 3,
  className,
}: {
  count?: number
  className?: string
}) {
  return (
    <div className={cn('bg-white divide-y divide-gray-100', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="px-4 py-3 space-y-2">
          <Skeleton className="h-5 w-2/5" />
          <Skeleton className="h-4 w-3/5" />
        </div>
      ))}
    </div>
  )
}

/** แถบเลือกลูก (ชิปกลม ๆ) */
export function SkeletonChips({ count = 2 }: { count?: number }) {
  return (
    <div className="flex gap-2 px-4 py-3 bg-white border-b border-gray-100">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-24 rounded-full" />
      ))}
    </div>
  )
}

/**
 * หัวสีของหน้าในแอปผู้ปกครอง — วาดจริงไปเลย (ไม่ต้องเป็น skeleton)
 * เพราะรู้ชื่อหน้าอยู่แล้ว ทำให้สลับแท็บแล้วเห็นชื่อหน้าทันที
 */
export function LiffPageHeader({ title }: { title: string }) {
  return (
    <div className="bg-primary text-white p-4 pt-6">
      <h1 className="text-xl font-bold">{title}</h1>
    </div>
  )
}
