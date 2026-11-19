// lib/fb/ad-referral.ts — remember which Meta ad a chat contact came from.
//
// Click-to-Messenger / Instagram ads attach a `referral` object to the webhook
// event (event.referral, event.message.referral or event.postback.referral) with
// source='ADS' and the ad_id. We keep one row per (contact, ad) in ad_referrals
// forever, so the ad source is still known long after Meta's 7-day attribution
// window has closed. Ad/ad set/campaign names are resolved once via the
// Marketing API with the token saved in Facebook Ads settings (best effort).
//
// Also: parents often type their phone number in chat. We store the first Thai
// mobile number we see on chat_contacts.phone so the contact can be matched to
// a parent by phone (FB/IG PSIDs never match anything on the parent row).

import { createServiceClient } from '@/lib/supabase/server'
import { getFacebookAdsSettings } from '@/lib/supabase/services/facebook-ads-settings'

const GRAPH = 'https://graph.facebook.com/v21.0'

export interface MetaReferral {
  source?: string
  type?: string
  ad_id?: string
  ref?: string
  ads_context_data?: { ad_title?: string; photo_url?: string; video_url?: string; post_id?: string }
}

/** Pick the referral object out of a Messenger/Instagram webhook messaging event. */
export function referralFromEvent(event: any): MetaReferral | null {
  const r = event?.referral || event?.message?.referral || event?.postback?.referral
  if (!r || typeof r !== 'object') return null
  return r as MetaReferral
}

async function resolveAdNames(adId: string): Promise<{
  ad_name?: string; adset_name?: string; campaign_id?: string; campaign_name?: string
}> {
  try {
    const settings = await getFacebookAdsSettings()
    if (!settings.fbAccessToken) return {}
    const url = `${GRAPH}/${encodeURIComponent(adId)}?fields=name,adset{name},campaign{id,name}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${settings.fbAccessToken}` } })
    if (!res.ok) return {}
    const j = await res.json()
    return {
      ad_name: j.name || undefined,
      adset_name: j.adset?.name || undefined,
      campaign_id: j.campaign?.id || undefined,
      campaign_name: j.campaign?.name || undefined,
    }
  } catch {
    return {}
  }
}

/** Upsert the ad referral for a contact. Never throws (webhook must not fail). */
export async function recordAdReferral(
  contactId: string,
  platform: 'facebook' | 'instagram',
  referral: MetaReferral
): Promise<void> {
  try {
    if (!referral.ad_id) return // only ads — m.me links / page shortlinks have no ad_id
    const supabase = createServiceClient() as any
    const now = new Date().toISOString()

    const { data: existing } = await supabase
      .from('ad_referrals')
      .select('id, hits, ad_name')
      .eq('contact_id', contactId)
      .eq('ad_id', referral.ad_id)
      .maybeSingle()

    if (existing) {
      const patch: Record<string, unknown> = { last_referred_at: now, hits: (existing.hits || 1) + 1 }
      if (!existing.ad_name) Object.assign(patch, await resolveAdNames(referral.ad_id))
      await supabase.from('ad_referrals').update(patch).eq('id', existing.id)
      return
    }

    const names = await resolveAdNames(referral.ad_id)
    await supabase.from('ad_referrals').insert({
      contact_id: contactId,
      platform,
      ad_id: referral.ad_id,
      ad_title: referral.ads_context_data?.ad_title || null,
      photo_url: referral.ads_context_data?.photo_url || null,
      ref: referral.ref || null,
      raw: referral,
      first_referred_at: now,
      last_referred_at: now,
      ...names,
    })
  } catch (err) {
    console.error('[ad-referral] record failed:', err)
  }
}

/** First Thai mobile number in a text (0XXXXXXXXX or +66XXXXXXXXX), as 10 digits. */
export function extractThaiMobile(text?: string): string | null {
  if (!text) return null
  const m = text.replace(/[\s\-.]/g, '').match(/(?:\+?66|0)([689]\d{8})(?!\d)/)
  return m ? `0${m[1]}` : null
}

/**
 * Save a phone number typed in chat onto the contact (only if it has none yet)
 * and link the contact to a parent with the same phone when it isn't linked.
 */
export async function rememberContactPhone(contactId: string, text?: string): Promise<void> {
  try {
    const phone = extractThaiMobile(text)
    if (!phone) return
    const supabase = createServiceClient() as any
    const { data: c } = await supabase
      .from('chat_contacts')
      .select('phone, parent_id')
      .eq('id', contactId)
      .maybeSingle()
    if (!c) return
    const patch: Record<string, unknown> = {}
    if (!c.phone) patch.phone = phone
    if (!c.parent_id) {
      const { data: parent } = await supabase
        .from('parents')
        .select('id')
        .eq('phone', phone)
        .limit(1)
        .maybeSingle()
      if (parent?.id) patch.parent_id = parent.id
    }
    if (Object.keys(patch).length) await supabase.from('chat_contacts').update(patch).eq('id', contactId)
  } catch (err) {
    console.error('[ad-referral] remember phone failed:', err)
  }
}
