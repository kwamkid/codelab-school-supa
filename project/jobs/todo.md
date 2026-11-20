# Todo
> Work not yet picked up by any chat, grouped by topic.

<!-- toc -->
**Contents** (1)
- 📊 Teacher attendance data — 2026-11-20
<!-- /toc -->

---

## 📊 Teacher attendance data — 2026-11-20
- [x] Teachers "เช็ค" and "แพรวรุ่ง": sessions checked (Sep–Nov) but 0 students marked present/late — check whether these classes have no enrolled students or were all marked absent (`get_teacher_monthly_report`, attendance rows)
  → they never checked: rows were auto-written by makeup requests / LIFF leave (checked_by NULL). RPCs now exclude them via `attendance_is_auto()` — 842c08c
