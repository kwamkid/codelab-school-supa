import { NextRequest, NextResponse } from 'next/server';
import {
  detectSlideProvider,
  isValidSlideUrl,
  convertToEmbedUrl,
  needsServerResolution,
} from '@/lib/utils/canva';

const MAX_REDIRECTS = 5;
const FETCH_TIMEOUT_MS = 5000;

async function resolveRedirects(startUrl: string): Promise<string> {
  let currentUrl = startUrl;

  for (let i = 0; i < MAX_REDIRECTS; i++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(currentUrl, {
        method: 'HEAD',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CodelabSchoolBot/1.0)',
        },
      });
    } catch (err) {
      clearTimeout(timer);
      throw new Error('ไม่สามารถเข้าถึง URL ได้');
    }
    clearTimeout(timer);

    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get('location');
      if (!next) break;
      currentUrl = new URL(next, currentUrl).toString();
      continue;
    }

    // 2xx (or anything else) → this is the final URL
    return currentUrl;
  }

  return currentUrl;
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    if (!isValidSlideUrl(url)) {
      return NextResponse.json(
        { error: 'ไม่รองรับ URL นี้ กรุณาใช้ Canva, Google Slides หรือ PowerPoint Online' },
        { status: 400 }
      );
    }

    let finalUrl = url;
    if (needsServerResolution(url)) {
      finalUrl = await resolveRedirects(url);

      // After resolution the host must still be something we trust.
      if (!isValidSlideUrl(finalUrl)) {
        return NextResponse.json(
          { error: 'URL หลัง redirect ไม่ใช่ URL ที่รองรับ' },
          { status: 400 }
        );
      }
    }

    const { provider, embedUrl } = convertToEmbedUrl(finalUrl);

    return NextResponse.json({
      provider,
      resolvedUrl: finalUrl,
      embedUrl,
    });
  } catch (err: any) {
    console.error('resolve-slide-url error:', err);
    return NextResponse.json(
      { error: err.message || 'ไม่สามารถตรวจสอบ URL ได้' },
      { status: 400 }
    );
  }
}
