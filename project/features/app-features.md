# App features
> What the app can do, in customer wording: what it does · what it uses/connects · limits · date.

<!-- toc -->
**Contents** (3)
- Ad source on customers ("มาจากโฆษณา") — 2026-11-20
- Meta Conversions API match keys — 2026-11-20
- Summary page `/reports/summary` — 2026-11-20
<!-- /toc -->

---

## Ad source on customers ("มาจากโฆษณา") — 2026-11-20
- Chat side panel and parent page show which Meta ad (campaign / ad name, Messenger/IG, first + latest date) the family opened the chat from; kept forever, so it is known after Meta's 7-day window.
- Uses the FB/IG webhook referral + Marketing API names; chats are linked to parents by a phone typed in chat or by booking/enrolling from the chat.
- Limits: only chats from 2026-11-20 on (no backfill). `messaging_referrals` subscribed, so ad clicks on an existing thread are recorded too.

## Meta Conversions API match keys — 2026-11-20
- Purchase/Lead events now carry business_messaging (page + Messenger id), fbc/fbp from the online trial form, name and parent id; Purchase value = full course price. Chat trial bookings send Lead.

## Summary page `/reports/summary` — 2026-11-20
- Direct link only (not in menu), super_admin only. Sales per month × branch, attendance-check and Teacher Feedback per month and per teacher ("ต้องคุย" / "เขียนประจำ" flags), range 3/6/12 months + current month. Same numbers as /reports/business and /reports/teacher-monthly.
