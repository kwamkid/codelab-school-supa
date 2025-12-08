# Supabase Database Schema

> **สำคัญ:** ก่อนเขียน code ที่เกี่ยวกับ database ให้เช็คไฟล์นี้ก่อนทุกครั้ง!
> - TypeScript types: `types/supabase.ts`
> - SQL migrations: `supabase/migrations/`

## Quick Reference

```
Database: PostgreSQL (Supabase)
Project: yzgvmyyuthfarytrszfe
Region: Singapore
URL: https://yzgvmyyuthfarytrszfe.supabase.co
```

---

## ⚠️ การใช้งาน Schema นี้

**CRITICAL:** Schema นี้เป็น reference เท่านั้น **ห้ามรันโดยตรง** เพราะ:
- ลำดับการสร้างตาราง และ constraints อาจไม่ถูกต้อง
- บาง enum types ต้องสร้างก่อน
- Foreign keys ต้องสร้างหลังจากตารางที่ reference ถูกสร้างแล้ว

**แนะนำ:** ใช้ Supabase Dashboard หรือ migrations แทน

---

## Tables Overview

| Table | คำอธิบาย | FK References |
|-------|----------|---------------|
| `branches` | สาขา | - |
| `rooms` | ห้องเรียน | → branches |
| `parents` | ผู้ปกครอง | → branches (preferred_branch_id) |
| `students` | นักเรียน | → parents |
| `teachers` | ครู | - |
| `admin_users` | ผู้ดูแลระบบ | → teachers, auth.users |
| `subjects` | วิชา | - |
| `classes` | คลาสเรียน | → subjects, teachers, branches, rooms |
| `class_schedules` | ตารางเรียน | → classes, teachers |
| `attendance` | เช็คชื่อ | → class_schedules, students |
| `enrollments` | ลงทะเบียน | → students, classes, parents, branches |
| `enrollment_transfer_history` | ประวัติโอนย้าย | → enrollments, classes |
| `trial_bookings` | จองทดลองเรียน | → branches, admin_users |
| `trial_booking_students` | นักเรียนทดลอง | → trial_bookings |
| `trial_sessions` | คลาสทดลอง | → trial_bookings, subjects, teachers, branches, rooms, classes |
| `trial_reschedule_history` | ประวัติเลื่อนทดลอง | → trial_sessions |
| `makeup_classes` | คลาสชดเชย | → classes, class_schedules, subjects, students, parents, branches, teachers, rooms |
| `notifications` | แจ้งเตือน | - |
| `promotions` | โปรโมชั่น | - |
| `holidays` | วันหยุด | - |
| `teaching_materials` | สื่อการสอน | → subjects |
| `events` | อีเว้นท์ | - |
| `event_schedules` | ตารางอีเว้นท์ | → events |
| `event_registrations` | ลงทะเบียนอีเว้นท์ | → events, event_schedules, branches, parents |
| `event_registration_parents` | ผู้ปกครองที่ลงทะเบียน | → event_registrations |
| `event_registration_students` | นักเรียนที่ลงทะเบียน | → event_registrations, students |
| `link_tokens` | Token เชื่อม LINE | → parents |
| `student_feedback` | ฟีดแบ็ค | → students, parents, classes, subjects, class_schedules, teachers |
| `settings` | ตั้งค่าระบบ | - |

---

## Complete Schema (Reference Only)

```sql
-- ==========================================
-- ADMIN USERS
-- ==========================================
CREATE TABLE public.admin_users (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  email character varying NOT NULL UNIQUE,
  display_name character varying NOT NULL,
  role USER-DEFINED NOT NULL DEFAULT 'branch_admin'::admin_role,
  branch_ids ARRAY DEFAULT '{}'::uuid[],
  can_manage_users boolean DEFAULT false,
  can_manage_settings boolean DEFAULT false,
  can_view_reports boolean DEFAULT false,
  can_manage_all_branches boolean DEFAULT false,
  teacher_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamp with time zone,
  updated_by uuid,
  auth_user_id uuid,
  CONSTRAINT admin_users_pkey PRIMARY KEY (id),
  CONSTRAINT admin_users_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teachers(id),
  CONSTRAINT admin_users_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id)
);

-- ==========================================
-- ATTENDANCE
-- ==========================================
CREATE TABLE public.attendance (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  schedule_id uuid NOT NULL,
  student_id uuid NOT NULL,
  status USER-DEFINED NOT NULL,
  note text,
  feedback text,
  checked_at timestamp with time zone,
  checked_by uuid,
  CONSTRAINT attendance_pkey PRIMARY KEY (id),
  CONSTRAINT attendance_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.class_schedules(id),
  CONSTRAINT attendance_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id)
);

-- ==========================================
-- BRANCHES
-- ==========================================
CREATE TABLE public.branches (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name character varying NOT NULL,
  code character varying NOT NULL UNIQUE,
  address text NOT NULL,
  phone character varying NOT NULL,
  location_lat numeric,
  location_lng numeric,
  open_time time without time zone NOT NULL DEFAULT '09:00:00'::time without time zone,
  close_time time without time zone NOT NULL DEFAULT '18:00:00'::time without time zone,
  open_days ARRAY NOT NULL DEFAULT '{0,1,2,3,4,5,6}'::integer[],
  is_active boolean NOT NULL DEFAULT true,
  manager_name character varying,
  manager_phone character varying,
  line_group_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT branches_pkey PRIMARY KEY (id)
);

-- ==========================================
-- CLASS SCHEDULES
-- ==========================================
CREATE TABLE public.class_schedules (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  class_id uuid NOT NULL,
  session_date date NOT NULL,
  session_number integer NOT NULL,
  topic character varying,
  status USER-DEFINED NOT NULL DEFAULT 'scheduled'::schedule_status,
  actual_teacher_id uuid,
  note text,
  original_date date,
  rescheduled_at timestamp with time zone,
  rescheduled_by uuid,
  CONSTRAINT class_schedules_pkey PRIMARY KEY (id),
  CONSTRAINT class_schedules_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id),
  CONSTRAINT class_schedules_actual_teacher_id_fkey FOREIGN KEY (actual_teacher_id) REFERENCES public.teachers(id)
);

-- ==========================================
-- CLASSES
-- ==========================================
CREATE TABLE public.classes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  subject_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  room_id uuid NOT NULL,
  name character varying NOT NULL,
  code character varying NOT NULL UNIQUE,
  description text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  total_sessions integer NOT NULL,
  days_of_week ARRAY NOT NULL DEFAULT '{}'::integer[],
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  max_students integer NOT NULL DEFAULT 10,
  min_students integer NOT NULL DEFAULT 1,
  enrolled_count integer NOT NULL DEFAULT 0,
  price_per_session numeric NOT NULL,
  total_price numeric NOT NULL,
  material_fee numeric DEFAULT 0,
  registration_fee numeric DEFAULT 0,
  status USER-DEFINED NOT NULL DEFAULT 'draft'::class_status,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT classes_pkey PRIMARY KEY (id),
  CONSTRAINT classes_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id),
  CONSTRAINT classes_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teachers(id),
  CONSTRAINT classes_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id),
  CONSTRAINT classes_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id)
);

-- ==========================================
-- ENROLLMENT TRANSFER HISTORY
-- ==========================================
CREATE TABLE public.enrollment_transfer_history (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  enrollment_id uuid NOT NULL,
  from_class_id uuid NOT NULL,
  to_class_id uuid NOT NULL,
  transferred_at timestamp with time zone NOT NULL DEFAULT now(),
  reason text,
  CONSTRAINT enrollment_transfer_history_pkey PRIMARY KEY (id),
  CONSTRAINT enrollment_transfer_history_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(id),
  CONSTRAINT enrollment_transfer_history_from_class_id_fkey FOREIGN KEY (from_class_id) REFERENCES public.classes(id),
  CONSTRAINT enrollment_transfer_history_to_class_id_fkey FOREIGN KEY (to_class_id) REFERENCES public.classes(id)
);

-- ==========================================
-- ENROLLMENTS
-- ==========================================
CREATE TABLE public.enrollments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  student_id uuid NOT NULL,
  class_id uuid NOT NULL,
  parent_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  enrolled_at timestamp with time zone NOT NULL DEFAULT now(),
  status USER-DEFINED NOT NULL DEFAULT 'active'::enrollment_status,
  original_price numeric NOT NULL,
  discount numeric NOT NULL DEFAULT 0,
  discount_type USER-DEFINED NOT NULL DEFAULT 'fixed'::discount_type,
  final_price numeric NOT NULL,
  promotion_code character varying,
  payment_method USER-DEFINED NOT NULL DEFAULT 'transfer'::payment_method,
  payment_status USER-DEFINED NOT NULL DEFAULT 'pending'::payment_status,
  paid_amount numeric NOT NULL DEFAULT 0,
  paid_date timestamp with time zone,
  receipt_number character varying,
  transferred_from uuid,
  dropped_reason text,
  CONSTRAINT enrollments_pkey PRIMARY KEY (id),
  CONSTRAINT enrollments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT enrollments_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id),
  CONSTRAINT enrollments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.parents(id),
  CONSTRAINT enrollments_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id),
  CONSTRAINT enrollments_transferred_from_fkey FOREIGN KEY (transferred_from) REFERENCES public.classes(id)
);

-- ==========================================
-- EVENT REGISTRATION PARENTS
-- ==========================================
CREATE TABLE public.event_registration_parents (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  registration_id uuid NOT NULL,
  name character varying NOT NULL,
  phone character varying NOT NULL,
  email character varying,
  is_main_contact boolean NOT NULL DEFAULT false,
  CONSTRAINT event_registration_parents_pkey PRIMARY KEY (id),
  CONSTRAINT event_registration_parents_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES public.event_registrations(id)
);

-- ==========================================
-- EVENT REGISTRATION STUDENTS
-- ==========================================
CREATE TABLE public.event_registration_students (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  registration_id uuid NOT NULL,
  student_id uuid,
  name character varying NOT NULL,
  nickname character varying NOT NULL,
  birthdate date NOT NULL,
  school_name character varying,
  grade_level character varying,
  CONSTRAINT event_registration_students_pkey PRIMARY KEY (id),
  CONSTRAINT event_registration_students_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES public.event_registrations(id),
  CONSTRAINT event_registration_students_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id)
);

-- ==========================================
-- EVENT REGISTRATIONS
-- ==========================================
CREATE TABLE public.event_registrations (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  event_id uuid NOT NULL,
  event_name character varying NOT NULL,
  schedule_id uuid NOT NULL,
  schedule_date date NOT NULL,
  schedule_time character varying NOT NULL,
  branch_id uuid NOT NULL,
  is_guest boolean NOT NULL DEFAULT false,
  line_user_id character varying,
  line_display_name character varying,
  line_picture_url text,
  parent_id uuid,
  parent_name character varying NOT NULL,
  parent_phone character varying NOT NULL,
  parent_email character varying,
  parent_address text,
  attendee_count integer NOT NULL DEFAULT 1,
  status USER-DEFINED NOT NULL DEFAULT 'confirmed'::event_registration_status,
  registered_at timestamp with time zone NOT NULL DEFAULT now(),
  registered_from USER-DEFINED NOT NULL DEFAULT 'liff'::registration_source,
  cancelled_at timestamp with time zone,
  cancelled_by uuid,
  cancellation_reason text,
  attended boolean,
  attendance_checked_at timestamp with time zone,
  attendance_checked_by uuid,
  attendance_note text,
  special_request text,
  referral_source character varying,
  CONSTRAINT event_registrations_pkey PRIMARY KEY (id),
  CONSTRAINT event_registrations_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT event_registrations_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.event_schedules(id),
  CONSTRAINT event_registrations_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id),
  CONSTRAINT event_registrations_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.parents(id)
);

-- ==========================================
-- EVENT SCHEDULES
-- ==========================================
CREATE TABLE public.event_schedules (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  event_id uuid NOT NULL,
  date date NOT NULL,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  max_attendees integer NOT NULL,
  attendees_by_branch jsonb DEFAULT '{}'::jsonb,
  status USER-DEFINED NOT NULL DEFAULT 'available'::event_schedule_status,
  CONSTRAINT event_schedules_pkey PRIMARY KEY (id),
  CONSTRAINT event_schedules_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id)
);

-- ==========================================
-- EVENTS
-- ==========================================
CREATE TABLE public.events (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name character varying NOT NULL,
  description text NOT NULL,
  full_description text,
  image_url text,
  location character varying NOT NULL,
  location_url text,
  branch_ids ARRAY NOT NULL DEFAULT '{}'::uuid[],
  event_type USER-DEFINED NOT NULL,
  highlights ARRAY DEFAULT '{}'::text[],
  target_audience text,
  what_to_bring ARRAY DEFAULT '{}'::text[],
  registration_start_date timestamp with time zone NOT NULL,
  registration_end_date timestamp with time zone NOT NULL,
  counting_method USER-DEFINED NOT NULL DEFAULT 'registrations'::counting_method,
  enable_reminder boolean NOT NULL DEFAULT true,
  reminder_days_before integer NOT NULL DEFAULT 1,
  reminder_time time without time zone,
  status USER-DEFINED NOT NULL DEFAULT 'draft'::event_status,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  updated_at timestamp with time zone,
  updated_by uuid,
  CONSTRAINT events_pkey PRIMARY KEY (id)
);

-- ==========================================
-- HOLIDAYS
-- ==========================================
CREATE TABLE public.holidays (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name character varying NOT NULL,
  date date NOT NULL,
  type USER-DEFINED NOT NULL DEFAULT 'national'::holiday_type,
  branches ARRAY DEFAULT '{}'::uuid[],
  description text,
  CONSTRAINT holidays_pkey PRIMARY KEY (id)
);

-- ==========================================
-- LINK TOKENS
-- ==========================================
CREATE TABLE public.link_tokens (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  token character varying NOT NULL UNIQUE,
  parent_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  used boolean NOT NULL DEFAULT false,
  used_at timestamp with time zone,
  linked_line_user_id character varying,
  CONSTRAINT link_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT link_tokens_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.parents(id)
);

-- ==========================================
-- MAKEUP CLASSES
-- ==========================================
CREATE TABLE public.makeup_classes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  type USER-DEFINED NOT NULL DEFAULT 'scheduled'::makeup_type,
  original_class_id uuid NOT NULL,
  original_schedule_id uuid NOT NULL,
  original_session_number integer,
  original_session_date date,
  class_name character varying NOT NULL,
  class_code character varying NOT NULL,
  subject_id uuid NOT NULL,
  subject_name character varying NOT NULL,
  student_id uuid NOT NULL,
  student_name character varying NOT NULL,
  student_nickname character varying NOT NULL,
  parent_id uuid NOT NULL,
  parent_name character varying NOT NULL,
  parent_phone character varying NOT NULL,
  parent_line_user_id character varying,
  branch_id uuid NOT NULL,
  branch_name character varying NOT NULL,
  request_date date NOT NULL,
  requested_by uuid NOT NULL,
  reason text NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::makeup_status,
  makeup_date date,
  makeup_start_time time without time zone,
  makeup_end_time time without time zone,
  makeup_teacher_id uuid,
  makeup_teacher_name character varying,
  makeup_branch_id uuid,
  makeup_room_id uuid,
  makeup_room_name character varying,
  makeup_confirmed_at timestamp with time zone,
  makeup_confirmed_by uuid,
  attendance_status USER-DEFINED,
  attendance_checked_by uuid,
  attendance_checked_at timestamp with time zone,
  attendance_note text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone,
  CONSTRAINT makeup_classes_pkey PRIMARY KEY (id),
  CONSTRAINT makeup_classes_original_class_id_fkey FOREIGN KEY (original_class_id) REFERENCES public.classes(id),
  CONSTRAINT makeup_classes_original_schedule_id_fkey FOREIGN KEY (original_schedule_id) REFERENCES public.class_schedules(id),
  CONSTRAINT makeup_classes_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id),
  CONSTRAINT makeup_classes_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT makeup_classes_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.parents(id),
  CONSTRAINT makeup_classes_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id),
  CONSTRAINT makeup_classes_makeup_teacher_id_fkey FOREIGN KEY (makeup_teacher_id) REFERENCES public.teachers(id),
  CONSTRAINT makeup_classes_makeup_branch_id_fkey FOREIGN KEY (makeup_branch_id) REFERENCES public.branches(id),
  CONSTRAINT makeup_classes_makeup_room_id_fkey FOREIGN KEY (makeup_room_id) REFERENCES public.rooms(id)
);

-- ==========================================
-- NOTIFICATIONS
-- ==========================================
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  user_type character varying NOT NULL DEFAULT 'parent'::character varying,
  type USER-DEFINED NOT NULL,
  title character varying NOT NULL,
  body text NOT NULL,
  image_url text,
  action_url text,
  data jsonb DEFAULT '{}'::jsonb,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  read_at timestamp with time zone,
  is_read boolean NOT NULL DEFAULT false,
  CONSTRAINT notifications_pkey PRIMARY KEY (id)
);

-- ==========================================
-- PARENTS
-- ==========================================
CREATE TABLE public.parents (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  line_user_id character varying UNIQUE,
  display_name character varying NOT NULL,
  picture_url text,
  phone character varying NOT NULL,
  emergency_phone character varying,
  email character varying,
  address_house_number character varying,
  address_street character varying,
  address_sub_district character varying,
  address_district character varying,
  address_province character varying,
  address_postal_code character varying,
  preferred_branch_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_login_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT parents_pkey PRIMARY KEY (id),
  CONSTRAINT parents_preferred_branch_id_fkey FOREIGN KEY (preferred_branch_id) REFERENCES public.branches(id)
);

-- ==========================================
-- PROMOTIONS
-- ==========================================
CREATE TABLE public.promotions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name character varying NOT NULL,
  code character varying NOT NULL UNIQUE,
  description text NOT NULL,
  type USER-DEFINED NOT NULL,
  value numeric NOT NULL,
  min_purchase numeric,
  applicable_to ARRAY DEFAULT '{all}'::text[],
  valid_branches ARRAY DEFAULT '{}'::uuid[],
  valid_subjects ARRAY DEFAULT '{}'::uuid[],
  start_date date NOT NULL,
  end_date date NOT NULL,
  usage_limit integer,
  used_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT promotions_pkey PRIMARY KEY (id)
);

-- ==========================================
-- ROOMS
-- ==========================================
CREATE TABLE public.rooms (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  branch_id uuid NOT NULL,
  name character varying NOT NULL,
  capacity integer NOT NULL DEFAULT 10,
  floor character varying,
  has_projector boolean NOT NULL DEFAULT false,
  has_whiteboard boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT rooms_pkey PRIMARY KEY (id),
  CONSTRAINT rooms_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id)
);

-- ==========================================
-- SETTINGS
-- ==========================================
CREATE TABLE public.settings (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  key character varying NOT NULL UNIQUE,
  value jsonb NOT NULL,
  description text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT settings_pkey PRIMARY KEY (id)
);

-- ==========================================
-- STUDENT FEEDBACK
-- ==========================================
CREATE TABLE public.student_feedback (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  student_id uuid NOT NULL,
  parent_id uuid NOT NULL,
  class_id uuid NOT NULL,
  class_name character varying NOT NULL,
  subject_id uuid NOT NULL,
  subject_name character varying NOT NULL,
  schedule_id uuid NOT NULL,
  session_number integer NOT NULL,
  session_date date NOT NULL,
  feedback text NOT NULL,
  teacher_id uuid NOT NULL,
  teacher_name character varying NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT student_feedback_pkey PRIMARY KEY (id),
  CONSTRAINT student_feedback_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT student_feedback_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.parents(id),
  CONSTRAINT student_feedback_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id),
  CONSTRAINT student_feedback_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id),
  CONSTRAINT student_feedback_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.class_schedules(id),
  CONSTRAINT student_feedback_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teachers(id)
);

-- ==========================================
-- STUDENTS
-- ==========================================
CREATE TABLE public.students (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  parent_id uuid NOT NULL,
  name character varying NOT NULL,
  nickname character varying NOT NULL,
  birthdate date NOT NULL,
  gender USER-DEFINED NOT NULL,
  school_name character varying,
  grade_level character varying,
  profile_image text,
  allergies text,
  special_needs text,
  emergency_contact character varying,
  emergency_phone character varying,
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT students_pkey PRIMARY KEY (id),
  CONSTRAINT students_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.parents(id)
);

-- ==========================================
-- SUBJECTS
-- ==========================================
CREATE TABLE public.subjects (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name character varying NOT NULL,
  code character varying NOT NULL UNIQUE,
  description text NOT NULL,
  category USER-DEFINED NOT NULL,
  level USER-DEFINED NOT NULL,
  age_range_min integer NOT NULL DEFAULT 6,
  age_range_max integer NOT NULL DEFAULT 18,
  color character varying NOT NULL DEFAULT '#3B82F6'::character varying,
  icon character varying,
  prerequisites ARRAY DEFAULT '{}'::uuid[],
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT subjects_pkey PRIMARY KEY (id)
);

-- ==========================================
-- TEACHERS
-- ==========================================
CREATE TABLE public.teachers (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name character varying NOT NULL,
  nickname character varying,
  email character varying NOT NULL UNIQUE,
  phone character varying NOT NULL,
  line_user_id character varying,
  specialties ARRAY DEFAULT '{}'::uuid[],
  available_branches ARRAY DEFAULT '{}'::uuid[],
  profile_image text,
  hourly_rate numeric,
  bank_name character varying,
  bank_account_number character varying,
  bank_account_name character varying,
  is_active boolean NOT NULL DEFAULT true,
  has_login boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone,
  CONSTRAINT teachers_pkey PRIMARY KEY (id)
);

-- ==========================================
-- TEACHING MATERIALS
-- ==========================================
CREATE TABLE public.teaching_materials (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  subject_id uuid NOT NULL,
  session_number integer NOT NULL,
  title character varying NOT NULL,
  description text,
  objectives ARRAY DEFAULT '{}'::text[],
  materials ARRAY DEFAULT '{}'::text[],
  preparation ARRAY DEFAULT '{}'::text[],
  canva_url text NOT NULL,
  embed_url text NOT NULL,
  thumbnail_url text,
  duration integer NOT NULL,
  teaching_notes text,
  tags ARRAY DEFAULT '{}'::text[],
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  updated_at timestamp with time zone,
  updated_by uuid,
  CONSTRAINT teaching_materials_pkey PRIMARY KEY (id),
  CONSTRAINT teaching_materials_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id)
);

-- ==========================================
-- TRIAL BOOKING STUDENTS
-- ==========================================
CREATE TABLE public.trial_booking_students (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  booking_id uuid NOT NULL,
  name character varying NOT NULL,
  school_name character varying,
  grade_level character varying,
  birthdate date,
  subject_interests ARRAY DEFAULT '{}'::uuid[],
  CONSTRAINT trial_booking_students_pkey PRIMARY KEY (id),
  CONSTRAINT trial_booking_students_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.trial_bookings(id)
);

-- ==========================================
-- TRIAL BOOKINGS
-- ==========================================
CREATE TABLE public.trial_bookings (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  source USER-DEFINED NOT NULL DEFAULT 'online'::trial_source,
  parent_name character varying NOT NULL,
  parent_phone character varying NOT NULL,
  parent_email character varying,
  branch_id uuid,
  status USER-DEFINED NOT NULL DEFAULT 'new'::trial_booking_status,
  assigned_to uuid,
  contacted_at timestamp with time zone,
  contact_note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone,
  CONSTRAINT trial_bookings_pkey PRIMARY KEY (id),
  CONSTRAINT trial_bookings_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id),
  CONSTRAINT trial_bookings_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.admin_users(id)
);

-- ==========================================
-- TRIAL RESCHEDULE HISTORY
-- ==========================================
CREATE TABLE public.trial_reschedule_history (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  session_id uuid NOT NULL,
  original_date date NOT NULL,
  original_time time without time zone NOT NULL,
  new_date date NOT NULL,
  new_time time without time zone NOT NULL,
  reason text,
  rescheduled_by uuid NOT NULL,
  rescheduled_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT trial_reschedule_history_pkey PRIMARY KEY (id),
  CONSTRAINT trial_reschedule_history_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.trial_sessions(id)
);

-- ==========================================
-- TRIAL SESSIONS
-- ==========================================
CREATE TABLE public.trial_sessions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  booking_id uuid NOT NULL,
  student_name character varying NOT NULL,
  subject_id uuid NOT NULL,
  scheduled_date date NOT NULL,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  teacher_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  room_id uuid NOT NULL,
  room_name character varying,
  status USER-DEFINED NOT NULL DEFAULT 'scheduled'::trial_session_status,
  attended boolean,
  feedback text,
  teacher_note text,
  interested_level USER-DEFINED,
  converted boolean DEFAULT false,
  converted_to_class_id uuid,
  conversion_note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  CONSTRAINT trial_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT trial_sessions_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.trial_bookings(id),
  CONSTRAINT trial_sessions_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id),
  CONSTRAINT trial_sessions_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teachers(id),
  CONSTRAINT trial_sessions_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id),
  CONSTRAINT trial_sessions_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id),
  CONSTRAINT trial_sessions_converted_to_class_id_fkey FOREIGN KEY (converted_to_class_id) REFERENCES public.classes(id)
);
```

---

## Field Naming Convention

**Database (snake_case)** ↔ **TypeScript (camelCase)**

| Database Column | TypeScript Property | Example |
|----------------|-------------------|---------|
| `display_name` | `displayName` | 'John Doe' |
| `line_user_id` | `lineUserId` | 'U1234...' |
| `branch_ids` | `branchIds` | ['uuid1', 'uuid2'] |
| `is_active` | `isActive` | true |
| `created_at` | `createdAt` | Date |
| `age_range_min` | `ageRange.min` | 6 |
| `can_manage_users` | `permissions.canManageUsers` | true |

---

## Common Patterns

### 1. การ Query ข้อมูลพื้นฐาน
```typescript
const { data, error } = await supabase
  .from('parents')
  .select('*')
  .order('created_at', { ascending: false });
```

### 2. การ Join ตาราง
```typescript
const { data, error } = await supabase
  .from('students')
  .select(`
    *,
    parents:parent_id (
      id,
      display_name,
      phone
    )
  `)
  .eq('is_active', true);
```

### 3. Error Handling
```typescript
if (error) {
  if (error.code === 'PGRST116') {
    // Not found
    return null;
  }
  throw error;
}
```

---

## Important Notes

### Parents Table
- ใช้ `display_name` (ไม่ใช่ `name`)
- ใช้ `line_user_id` (ไม่ใช่ `line_id`)
- มี address fields แยกเป็น: `address_house_number`, `address_street`, `address_sub_district`, `address_district`, `address_province`, `address_postal_code`
- **ไม่มี** `student_ids`, `is_active`, หรือ `notes` columns

### Students Table
- เชื่อมกับ parents ผ่าน `parent_id` foreign key
- มี `is_active` column

### Admin Users
- เชื่อมกับ auth.users ผ่าน `auth_user_id`
- Permission flags เป็น flat columns ไม่ใช่ nested object

### Classes
- ใช้ `days_of_week` เป็น integer array (0=Sun, 6=Sat)
- `enrolled_count` เป็น denormalized counter

---

## Quick Field Reference

### Parents
```
id, line_user_id, display_name, picture_url, phone, emergency_phone,
email, address_*, preferred_branch_id, created_at, last_login_at
```

### Students
```
id, parent_id, name, nickname, birthdate, gender, school_name,
grade_level, profile_image, allergies, special_needs,
emergency_contact, emergency_phone, is_active
```

### Classes
```
id, subject_id, teacher_id, branch_id, room_id, name, code,
description, start_date, end_date, total_sessions, days_of_week,
start_time, end_time, max_students, min_students, enrolled_count,
price_per_session, total_price, material_fee, registration_fee,
status, created_at
```

### Class Schedules
```
id, class_id, session_date, session_number, topic, status,
actual_teacher_id, note, original_date, rescheduled_at,
rescheduled_by
```

---

**Last Updated:** 2025-12-08
**Schema Version:** Production
