import crypto from 'crypto'

/**
 * Normalize Thai phone number for Facebook CAPI.
 * 0812345678 → 66812345678
 * +66812345678 → 66812345678
 */
export function normalizeThaiPhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-\+\(\)]/g, '')
  if (cleaned.startsWith('0')) {
    cleaned = '66' + cleaned.substring(1)
  } else if (cleaned.startsWith('+66')) {
    cleaned = cleaned.substring(1) // remove +
  }
  if (!cleaned.startsWith('66')) {
    cleaned = '66' + cleaned
  }
  return cleaned
}

/**
 * SHA256 hash (Facebook requires lowercase hex).
 */
export function sha256(value: string): string {
  return crypto
    .createHash('sha256')
    .update(value.trim().toLowerCase())
    .digest('hex')
}

/**
 * Hash phone for Facebook (normalize then hash).
 */
export function hashPhone(phone: string): string {
  return sha256(normalizeThaiPhone(phone))
}

/**
 * Hash email for Facebook (lowercase trim then hash).
 */
export function hashEmail(email: string): string {
  return sha256(email.trim().toLowerCase())
}

/**
 * Map internal event type to Facebook standard event name.
 */
export function mapEventToFBEvent(eventType: string): string {
  const mapping: Record<string, string> = {
    register: 'CompleteRegistration',
    trial: 'Lead',
    event_join: 'Schedule',
    purchase: 'Purchase',
  }
  return mapping[eventType] || eventType
}

/**
 * Generate unique event ID for Facebook deduplication.
 * For re-sends, append suffix like _resend_1.
 */
export function generateEventId(
  eventType: string,
  entityId: string,
  suffix?: string
): string {
  const base = `${eventType}_${entityId}`
  return suffix ? `${base}_${suffix}` : base
}
