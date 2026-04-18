// lib/utils/canva.ts
//
// Slide deck URL utilities.
// Supports: Canva (full + short canva.link), Google Slides, Microsoft PowerPoint Online / OneDrive,
// and generic slide hosts via an allowlist.

export type SlideProvider = 'canva' | 'google-slides' | 'office' | 'generic';

export interface SlideUrlInfo {
  provider: SlideProvider;
  embedUrl: string;
}

// Hosts we are willing to embed in an iframe. Anything else is rejected.
const ALLOWED_HOSTS = [
  'canva.com',
  'www.canva.com',
  'canva.link',
  'docs.google.com',
  'drive.google.com',
  'slides.google.com',
  'onedrive.live.com',
  '1drv.ms',
  'office.com',
  'www.office.com',
  'sway.office.com',
  'sway.com',
  'view.officeapps.live.com',
  'onedrive.office.com',
];

function getHost(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isAllowedHost(url: string): boolean {
  const host = getHost(url);
  return !!host && ALLOWED_HOSTS.includes(host);
}

/**
 * Detect which slide provider a URL belongs to.
 * Returns null if the host is not in the allowlist.
 */
export function detectSlideProvider(url: string): SlideProvider | null {
  const host = getHost(url);
  if (!host) return null;

  if (host === 'canva.com' || host === 'www.canva.com' || host === 'canva.link') {
    return 'canva';
  }
  if (host === 'docs.google.com' || host === 'slides.google.com' || host === 'drive.google.com') {
    return 'google-slides';
  }
  if (
    host === 'onedrive.live.com' ||
    host === '1drv.ms' ||
    host === 'office.com' ||
    host === 'www.office.com' ||
    host === 'sway.office.com' ||
    host === 'sway.com' ||
    host === 'view.officeapps.live.com' ||
    host === 'onedrive.office.com'
  ) {
    return 'office';
  }
  return null;
}

/**
 * Validate that the URL is something we're willing to embed.
 * Shape-level only — for canva.link short URLs we can't know the final
 * design ID until we resolve the redirect server-side.
 */
export function isValidSlideUrl(url: string): boolean {
  if (!/^https:\/\//i.test(url)) return false;
  return isAllowedHost(url);
}

/**
 * Legacy name kept for backward compatibility with existing imports.
 * Now accepts any supported slide provider URL (shape-level check).
 */
export function isValidCanvaUrl(url: string): boolean {
  return isValidSlideUrl(url);
}

function convertCanvaToEmbed(shareUrl: string): string {
  const cleanUrl = shareUrl.split('?')[0].split('#')[0];
  const match = cleanUrl.match(/\/design\/([^\/]+)\/([^\/]+)\//);
  if (!match) {
    throw new Error('Invalid Canva URL format');
  }
  const [, designId, token] = match;
  // ui param hides Canva UI chrome in embed mode
  return `https://www.canva.com/design/${designId}/${token}/view?embed&ui=eyJBIjp7IkIiOmZhbHNlLCJDIjpmYWxzZX19`;
}

function convertGoogleSlidesToEmbed(shareUrl: string): string {
  // Already an embed/preview URL — leave alone.
  if (/\/(embed|preview)(\?|$)/.test(shareUrl)) return shareUrl;

  const match = shareUrl.match(/\/presentation\/d\/([^\/]+)/);
  if (!match) {
    throw new Error('Invalid Google Slides URL format');
  }
  const id = match[1];
  return `https://docs.google.com/presentation/d/${id}/embed?start=false&loop=false&delayms=3000`;
}

function convertOfficeToEmbed(shareUrl: string): string {
  // Office Online / OneDrive / Sway don't have a clean URL → embed transform
  // that works for every variant. The safest default is to pass the URL through
  // unchanged and rely on the user pasting a public share / embed link.
  // If it's an office.com "edit" URL, try flipping to "embed".
  if (/office\.com\//i.test(shareUrl)) {
    return shareUrl.replace(/\/edit(\?|$)/, '/embed$1');
  }
  return shareUrl;
}

/**
 * Convert a share URL to an iframe-embeddable URL.
 * Caller is responsible for resolving canva.link short URLs first.
 */
export function convertToEmbedUrl(shareUrl: string): SlideUrlInfo {
  const provider = detectSlideProvider(shareUrl);
  if (!provider) {
    throw new Error('ไม่รองรับ URL นี้ กรุณาใช้ Canva, Google Slides หรือ PowerPoint Online');
  }

  try {
    if (provider === 'canva') {
      return { provider, embedUrl: convertCanvaToEmbed(shareUrl) };
    }
    if (provider === 'google-slides') {
      return { provider, embedUrl: convertGoogleSlidesToEmbed(shareUrl) };
    }
    if (provider === 'office') {
      return { provider, embedUrl: convertOfficeToEmbed(shareUrl) };
    }
    return { provider: 'generic', embedUrl: shareUrl };
  } catch (error) {
    console.error('Error converting slide URL:', error);
    throw new Error('ไม่สามารถแปลง URL ได้ กรุณาตรวจสอบ URL ให้ถูกต้อง');
  }
}

/**
 * Legacy wrapper: returns only the embed URL string.
 * Keep for existing callers in `lib/services/teaching-materials.ts`.
 */
export function convertCanvaToEmbedUrl(shareUrl: string): string {
  return convertToEmbedUrl(shareUrl).embedUrl;
}

/**
 * True if this URL needs server-side redirect resolution before we can
 * derive the embed URL (currently only Canva short links).
 */
export function needsServerResolution(url: string): boolean {
  const host = getHost(url);
  return host === 'canva.link';
}

export function extractCanvaDesignId(url: string): string | null {
  const match = url.match(/\/design\/([^\/]+)\//);
  return match ? match[1] : null;
}

export function getCanvaPreviewUrl(_designId: string): string {
  return `/api/placeholder/400/225`;
}
