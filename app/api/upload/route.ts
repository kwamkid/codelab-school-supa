import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const BUCKET_CONFIG: Record<string, { maxSize: number; allowedTypes: string[]; folder: string }> = {
  'event-images': {
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    folder: 'events',
  },
  'chat-media': {
    maxSize: 25 * 1024 * 1024, // 25MB for video
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm'],
    folder: 'messages',
  },
}

export async function POST(request: NextRequest) {
  const supabase = createServiceClient()

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const bucketName = (formData.get('bucket') as string) || 'event-images'

    const config = BUCKET_CONFIG[bucketName]
    if (!config) {
      return NextResponse.json({ error: 'Invalid bucket' }, { status: 400 })
    }

    if (!file) {
      return NextResponse.json({ error: 'ไม่พบไฟล์' }, { status: 400 })
    }

    if (!config.allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: `ไม่รองรับไฟล์ประเภท ${file.type}` }, { status: 400 })
    }

    if (file.size > config.maxSize) {
      return NextResponse.json({ error: `ไฟล์ต้องไม่เกิน ${Math.round(config.maxSize / 1024 / 1024)}MB` }, { status: 400 })
    }

    // Generate unique filename
    const ext = file.name.split('.').pop() || 'bin'
    const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`
    const path = `${config.folder}/${filename}`

    // Upload to Supabase Storage
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(path, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('[Upload] Error:', uploadError)
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucketName)
      .getPublicUrl(path)

    // Determine media type
    const mediaType = file.type.startsWith('video/') ? 'video' : 'image'

    return NextResponse.json({ url: publicUrl, mediaType, fileName: file.name, fileSize: file.size })
  } catch (error: any) {
    console.error('[Upload] Error:', error)
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 })
  }
}
