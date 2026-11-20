# Customer source attribution & business stats

> How to measure where enrolling families came from, and how to pull year stats quickly.

<!-- toc -->
**Contents** (2)
- 2026-11-20 — "How many enrollers chatted with admin first?"
- Infographic with correct Thai text
<!-- /toc -->

---

## 2026-11-20 — "How many enrollers chatted with admin first?"
- Population: families whose first non-dropped enrollment (`enrollments.parent_id`, `enrolled_at`) is ≥ 2026-04-01 (chat system live from Mar 2026) → 139.
- LINE chat: `chat_contacts.parent_id` link (or phone match) with first inbound message ≤ first enrollment + 1 day → 87.
- Facebook chat: contacts were never linked to parents (0 of 1,412, no `phone`), so match only by phones typed in inbound messages (regex `0[689][\d\s-]{8,11}` → 10 digits) against `parents.phone` → 8, heavy undercount (only 36 FB contacts ever typed a phone).
- Trial booking by phone digits (`trial_bookings.parent_phone`) before enrollment: 72 (online 61, walk-in 11).
- Result: chatted first 93 (67%), trial only 26 (19%), unknown 20 (14%). Ad-level share needs `ad_referrals` (empty until 2026-11-20, see `.claude/rules/meta-ads-attribution.md`).
- Year stats source: `select get_business_dashboard('2026-01-01','2026-11-20')` (psql, jq to aggregate `monthly` by month). Teacher attendance-check rate (`checked/sessions`) fell to 34/32/20% in Sep/Oct/Nov 2026.

## Infographic with correct Thai text
- AI image generators garble Thai. Build an HTML page (IBM Plex Sans Thai) and render with headless Chrome: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --force-device-scale-factor=2 --window-size=1080,1900 --virtual-time-budget=5000 --screenshot=out.png file://…`. 2026 summary saved to `~/Desktop/codelab-สรุปผล-2569.png`.
