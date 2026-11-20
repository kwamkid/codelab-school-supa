# Meta ads attribution
> Topic work list.

<!-- toc -->
**Contents** (2)
- 📣 Meta ads attribution — 2026-11-20, commits bec7585
- Resume note
<!-- /toc -->

---

## 📣 Meta ads attribution — 2026-11-20, commits bec7585
- [x] Ad source kept per chat contact (`ad_referrals`) + cards in chat panel / parent page — bec7585
- [x] CAPI: business_messaging + PSID, fbc/fbp, fn/ln/external_id, Purchase value = full price, chat trial sends Lead — bec7585
- [x] Summary page `/reports/summary` (sales + teacher check-in/feedback) — 18bcd48
- [ ] รอคุณแอม: approve subscribing the FB page webhook to `messaging_referrals` (Meta app → page subscription; now only `messages, messaging_postbacks`) so ad clicks on existing threads without a new message are recorded

## Resume note
Resume at: once approved, add `messaging_referrals` to the page subscription (Graph `POST /{page-id}/subscribed_apps` with subscribed_fields incl. existing ones), then confirm webhook still receives messages.
### State
All code pushed and deployed (Vercel success on 18bcd48). Migration `20261120_ad_attribution` applied to prod.
### Gotchas
Details in `.claude/rules/meta-ads-attribution.md` (gitignored, local only). Webhook handler already reads `event.referral`, so no code change needed.
### Read first
`app/api/webhooks/facebook/route.ts`, `lib/fb/ad-referral.ts`
