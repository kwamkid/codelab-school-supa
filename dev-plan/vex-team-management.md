# VEX Team Management — Build Spec (for this repo)

> Handoff spec. A working version of this feature was prototyped in a separate repo
> (`vex-scout`, Next 16) and is being **rebuilt here** in `codelab-school-supa`
> (Next 14.2.21) so it reuses this app's existing admin auth + LINE(LIFF) parent
> login. The database already exists (see Phase 1). Build the code per this spec.
>
> **Golden rule: never write to any `public.*` table.** This feature is fully
> isolated in the Postgres **`vex`** schema. The only `public.*` access is
> READ-ONLY: admin identity (`admin_users`), parent identity (`parents`),
> LINE settings (`settings`).

## What the feature does

A second product area at **`/team`** for managing VEX robotics teams and collecting
parent RSVPs. Two audiences:

- **Admins** (existing codelab staff) create teams, add kids, create competition
  events, and (later) review practice proposals.
- **Parents** (existing codelab parents, via LINE) open a per-team public link to:
  1. **Event RSVP** — tick each kid go / no / pending for each event (immediate).
  2. **Practice** — propose a date/time their kid will come practice (→ admin approves later).

Each team gets **two public links** of the form `<team_number>-<6char token>`
(e.g. `2999A-a7k2m9`): one for event RSVP (`/team/e/<slug>`), one for practice
(`/team/p/<slug>`). team_number is the real VEX code (admin-entered); the token is
the unguessable part. Both must match; event and practice tokens are not
interchangeable. Every mutation writes an audit row.

---

## Database — schema `vex` (ALREADY CREATED in project codelab-school-supa)

The `vex` schema already exists, is RLS-locked (no policies → only the secret key
reaches it), and is exposed in the Data API. Do NOT recreate it. Current tables
(all `vex.*`):

- **teams** — `id uuid pk`, `team_number text` (real VEX code, e.g. 2999A), `name text`,
  `level vex.vex_level`, `slug text`, `event_token text`, `practice_token text`,
  `created_at`. Unique **(team_number, level)** — same number may repeat across levels.
- **kids** — `id`, `team_id → teams`, `nickname text`, `full_name text?`, `created_at`.
- **events** — `id`, `name`, `date_start date?`, `date_end date?`, `place text?`,
  `has_world_spot bool`, `sort_order int`, `created_at`. (NO level column here.)
- **event_levels** — `event_id → events`, `level vex.vex_level`, PK(event_id, level).
  One event carries MANY levels (m2m).
- **attendance** — `id`, `event_id → events`, `kid_id → kids`, `status vex.rsvp_status`
  (`pend|go|no`), `parent_id uuid` (= `public.parents.id`, no cross-schema FK),
  `updated_by text`, `updated_at`. Unique(event_id, kid_id).
- **practices** — `id`, `team_id → teams`, `kid_id → kids`, `parent_id uuid`
  (= public.parents.id), `practice_date date`, `start_time time?`, `end_time time?`,
  `note text?`, `status vex.practice_status` (`proposed|approved|rejected`),
  `edited_by_admin bool`, `reviewed_by uuid` (= public.admin_users.id), `reviewed_at`, `created_at`.
- **audit_log** — `id bigint`, `actor_type vex.actor_type` (`admin|parent|system`),
  `actor_id uuid?`, `actor_name text?`, `action text`, `entity text`, `entity_id uuid?`,
  `before jsonb?`, `after jsonb?`, `at`.

Enums: `vex.vex_level` = `iq_elem|iq_ms|v5_ms|v5_hs|v5_uni`; `vex.rsvp_status`;
`vex.practice_status`; `vex.actor_type`.

**Level display labels (frontend only):** iq_elem="VEX IQ — Elementary",
iq_ms="VEX IQ — Middle School", v5_ms="VEX V5 — Middle School",
v5_hs="VEX V5 — High School", v5_uni="VEX V5 — University".

> Phase-1 DB cleanup (drop of standalone `vex.admins`/`vex.parents`, FK re-point to
> plain uuids) is **already applied** — `parent_id`/`reviewed_by` are plain uuids
> holding `public.*` ids. If `vex.attendance/practices/audit_log` hold leftover test
> rows, truncate them before go-live.

---

## How to reach the `vex` schema from server code

Use this repo's existing service client, scoped to `vex`:

```ts
// lib/vex/supabase.ts
import { createServiceClient } from "@/lib/supabase/server"; // env SUPABASE_SECRET_KEY, bypasses RLS
export function vexDb() {
  return createServiceClient().schema("vex") as any; // types/supabase.ts has no vex → cast
}
```

(Alternatively use `lib/supabase/rest.ts` with `Accept-Profile: vex` / `Content-Profile: vex`
headers — the repo's preferred pattern for untyped tables. Either is fine; pick one.)

No new env vars. `SUPABASE_SECRET_KEY` already exists here.

---

## Auth — reuse this repo's existing systems (do NOT build new OAuth)

### Admin (staff)
- **Server (API routes):** `requireStaff(bearer(request.headers.get("authorization")))`
  from `@/lib/server/admin-auth` → `{ ok, adminId, authUserId, role }`. Return 401/403
  on `!ok`. Client attaches the Bearer token via this repo's `authFetch` (`lib/auth-fetch.ts`).
- **UI gate:** put admin pages under the `(admin)` route group so the existing
  `app/(admin)/layout.tsx` client gate (`useAuth()`) handles login redirect + non-admin block.
  Add a sidebar nav item for `/team/admin`.
- **Do NOT add a middleware gate.** Admin sessions live in **localStorage**
  (`sb-auth-token`), not cookies — a cookie-based middleware/`getUser()` sees null and
  would bounce every admin. Leave `middleware.ts` untouched.
- **Open decision:** which roles may manage VEX teams — any staff, or restrict to
  `super_admin|branch_admin` (exclude `teacher`). Apply in the guard + sidebar `requiredRole`.

### Parent (LINE via LIFF)
- Public pages are **client components** wrapped in `LiffProvider` (this repo's LIFF flow);
  data is fetched with `liffFetch(...)` which attaches the LINE **ID token**.
- **Server identity:** `resolveLiffUser(request, body)` from `@/lib/line/verify-liff-token`
  → `{ lineUserId, verified }`. Then map to a codelab parent.
- **Parent lookup (server-side!):** `getParentByLineId` in `lib/supabase/services/parents.ts`
  uses the **browser** client and will throw server-side. Use `restSelect('parents',
  { line_user_id: 'eq.<id>' })` from `lib/supabase/rest.ts` (or a server helper in
  `lib/supabase/services/liff-data.ts` if one exists — check first).
- **Unregistered LINE user** → 403 with a Thai message pointing to the existing
  registration flow (`/liff/register` / link-account). Do NOT auto-create `public.parents`
  rows (that writes live data).
- LINE creds already come from `public.settings['line']` via `lib/services/line-settings.ts`
  — the ported code needs nothing here.

---

## Target file layout in this repo

```
lib/vex/
  supabase.ts        # vexDb() — createServiceClient().schema('vex')
  types.ts           # Level + labels, RsvpStatus, PracticeStatus, Team/Kid/Event/... (NO Admin/Parent)
  tokens.ts          # newTeamToken() 6-char, linkSlug(teamNumber, token), parseLinkSlug() (split on LAST '-')
  audit.ts           # logAudit() → vex.audit_log
  public-team.ts     # resolveTeamBySlug(slug, 'event'|'practice') — matches team_number + token + kind
  api.ts             # requireAdmin(request) → wraps requireStaff(bearer(...))

app/(admin)/team/admin/
  page.tsx           # 'use client' — list teams (+ 2 links each) via authFetch('/api/admin/vex/teams')
  create-team-form.tsx  # fields: team_number, name(optional), level → POST authFetch

app/team/e/[slug]/
  page.tsx           # 'use client' — useParams(), LiffProvider, liffFetch summary, render <EventRsvp>
  event-rsvp.tsx     # per-kid summary + timeline + go/no/pend chips → liffFetch attendance
app/team/p/[slug]/
  page.tsx           # 'use client' — LiffProvider, liffFetch summary, render <ProposePractice>
  propose-practice.tsx  # kid + date + start/end + note → liffFetch practices; list my proposals + status
app/team/line-gate.tsx   # shown when not LINE-logged-in / parent not registered

app/api/admin/vex/teams/route.ts           # GET list / POST create (2 tokens) — requireStaff
app/api/admin/vex/teams/[id]/route.ts      # GET team+kids / DELETE
app/api/admin/vex/teams/[id]/kids/route.ts # POST add kid
app/api/admin/vex/events/route.ts          # GET (?level=) / POST create (+ event_levels)
app/api/liff/vex/[slug]/summary/route.ts   # POST {kind} → team+kids+events+attendance | myPractices (resolveLiffUser)
app/api/liff/vex/[slug]/attendance/route.ts# POST set RSVP (resolveLiffUser + parent lookup)
app/api/liff/vex/[slug]/practices/route.ts # POST propose practice
```

Route-handler param convention here: `{ params }: { params: Promise<{ slug: string }> }`
then `const { slug } = await params` (this repo already uses async params).

---

## Endpoint contracts

**Admin (Bearer token required, `requireStaff`):**
- `POST /api/admin/vex/teams` `{ team_number, name?, level }` → creates team + 2 random
  6-char tokens; 409 if (team_number, level) exists. Audit `team.create`.
- `GET /api/admin/vex/teams` → all teams.
- `GET /api/admin/vex/teams/[id]` → team + kids. `DELETE` → cascade. Audit.
- `POST /api/admin/vex/teams/[id]/kids` `{ nickname, full_name? }`. Audit `kid.add`.
- `GET /api/admin/vex/events?level=` → events + levels. `POST` `{ name, date_start?,
  date_end?, place?, has_world_spot?, levels[] }` (≥1 level) → event + event_levels. Audit.

**Public (LIFF ID token required, `resolveLiffUser` + parent lookup):**
- `POST /api/liff/vex/[slug]/summary` `{ kind: 'event'|'practice' }` → resolve team by
  slug+kind; return `{ team, kids, parentDisplayName }` plus, for event: `events`
  (filtered to team.level via event_levels) + `attendance`; for practice: this parent's
  `practices`.
- `POST /api/liff/vex/[slug]/attendance` `{ event_id, kid_id, status }` → upsert
  attendance (kid must be on this team). `parent_id = public.parents.id`. Audit `attendance.set`.
- `POST /api/liff/vex/[slug]/practices` `{ kid_id, practice_date, start_time?, end_time?, note? }`
  → insert `status='proposed'`. Audit `practice.propose`.

---

## Business rules (must preserve)

- Event RSVP is a 3-state chip cycle pend→go→no, saved immediately, no approval.
- Practice is proposed by the parent (free date/time), starts `proposed` (yellow),
  admin later approves (green) / rejects; admin edits set `edited_by_admin`.
- Event list on a team's RSVP page = events whose `event_levels` include the team's level
  (so a combined MS+HS event shows to both). Any parent on the team may tick any kid on that team.
- Links: `parseLinkSlug` splits on the LAST hyphen (team_number may contain letters);
  resolve requires team_number + token + correct kind.
- Every mutation writes `vex.audit_log` with the acting admin/parent id + name.

---

## Reference implementation (prototype to port from)

Working prototype (Next 16, standalone auth — port the LOGIC, replace the AUTH):
`/Users/ampstark/vex-scout/src/lib/team/*` and `/Users/ampstark/vex-scout/src/app/team/*`.

- **Port nearly unchanged:** `tokens.ts`, `types.ts` (drop Admin/Parent types),
  `audit.ts`, `public-team.ts`, and all the zod schemas + query bodies in the API routes,
  and the RSVP/practice UI components (`event-rsvp.tsx`, `propose-practice.tsx`).
- **Rewrite:** `supabase.ts` (use `createServiceClient().schema('vex')`),
  `api.ts` (`requireAdmin` → `requireStaff(bearer(request...))`).
- **Delete / do not port:** `auth-server.ts`, `auth-browser.ts`, `line-oauth.ts`,
  `line-settings.ts`, `parent-session.ts`, `login/`, `auth/callback/`, `api/line/*`,
  `api/auth/signout`, `proxy.ts`. All replaced by this repo's admin auth + LIFF.
- Pages in the prototype are **server** components; here they become **client**
  components that fetch a `summary` endpoint (no cookie session for SSR).

---

## Dependencies / config

- `package.json`: add `nanoid` explicitly (currently only transitive). If nanoid v5 ESM
  breaks the Next 14 webpack build, pin `nanoid@^3` or swap `tokens.ts` to a
  `crypto.randomBytes`-based picker (~10 lines).
- `server-only` is not installed — either `npm i server-only` or drop those imports.
- zod stays v3 (`.enum`, `.string().date()`, `.uuid()`, `.optional().default()` all valid).
- No new env vars.
- LIFF: confirm the LIFF endpoint domain covers `app.codelabthailand.com`; links opened
  from LINE chat use the in-app browser (LIFF works); forwarded links in Safari/Chrome
  do a `liff.login()` redirect round-trip — verify manually.

---

## Build order (checkpoint after each)

1. **DB** — already applied; just confirm no dangling FKs in `vex` and truncate test rows if any.
2. **lib/vex/** — port + rewrite supabase.ts/api.ts; scratch-test `vexDb().from('teams').select()`.
3. **Admin API routes** — curl with a staff Bearer token → 200; no token → 401.
4. **Public LIFF API routes** — resolveLiffUser + parent lookup; test with a registered parent.
5. **Admin pages** (client, under `(admin)`) + sidebar item — create team → row in vex.teams + audit.
6. **Public pages** (client + LiffProvider) — RSVP tick + practice propose end-to-end.
7. **Verify** — confirm ZERO writes to `public.*`; regression-smoke `/dashboard`, `/liff`, `/login`.

## Open decisions to confirm before/while building

1. VEX-admin role scope: any staff vs `super_admin|branch_admin` only.
2. Server-side parent lookup helper: `restSelect('parents', {line_user_id})` vs an existing
   `lib/supabase/services/liff-data` helper — check what's there.
3. Unregistered parent → block + point to registration (recommended) vs auto-create (writes
   live data — not recommended).
4. Route-group URL sharing `(admin)/team/admin` + `app/team/e|p` builds cleanly — verify;
   fallback: admin at `/team-admin`.
5. nanoid v5 ESM under Next 14 — verify; fallback nanoid@3 or crypto.
