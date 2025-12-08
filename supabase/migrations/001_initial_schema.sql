-- =====================================================
-- Codelab School LMS - PostgreSQL Schema Migration
-- Migrated from Firebase Firestore
-- =====================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For text search

-- =====================================================
-- ENUM Types
-- =====================================================

CREATE TYPE admin_role AS ENUM ('super_admin', 'branch_admin', 'teacher');
CREATE TYPE gender_type AS ENUM ('M', 'F');
CREATE TYPE subject_category AS ENUM ('Coding', 'Robotics', 'AI', 'Other');
CREATE TYPE subject_level AS ENUM ('Beginner', 'Intermediate', 'Advanced');
CREATE TYPE class_status AS ENUM ('draft', 'published', 'started', 'completed', 'cancelled');
CREATE TYPE schedule_status AS ENUM ('scheduled', 'completed', 'cancelled', 'rescheduled');
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late', 'sick', 'leave');
CREATE TYPE enrollment_status AS ENUM ('active', 'completed', 'dropped', 'transferred');
CREATE TYPE discount_type AS ENUM ('percentage', 'fixed');
CREATE TYPE payment_method AS ENUM ('cash', 'transfer', 'credit');
CREATE TYPE payment_status AS ENUM ('pending', 'partial', 'paid');
CREATE TYPE trial_source AS ENUM ('online', 'walkin', 'phone');
CREATE TYPE trial_booking_status AS ENUM ('new', 'contacted', 'scheduled', 'completed', 'converted', 'cancelled');
CREATE TYPE trial_session_status AS ENUM ('scheduled', 'attended', 'absent', 'cancelled');
CREATE TYPE interest_level AS ENUM ('high', 'medium', 'low', 'not_interested');
CREATE TYPE notification_type AS ENUM ('reminder', 'announcement', 'schedule_change', 'payment', 'makeup', 'system');
CREATE TYPE promotion_type AS ENUM ('percentage', 'fixed', 'package');
CREATE TYPE holiday_type AS ENUM ('national', 'branch');
CREATE TYPE makeup_type AS ENUM ('scheduled', 'ad-hoc');
CREATE TYPE makeup_status AS ENUM ('pending', 'scheduled', 'completed', 'cancelled');
CREATE TYPE makeup_attendance_status AS ENUM ('present', 'absent');
CREATE TYPE event_type AS ENUM ('open-house', 'parent-meeting', 'showcase', 'workshop', 'other');
CREATE TYPE event_status AS ENUM ('draft', 'published', 'completed', 'cancelled');
CREATE TYPE event_schedule_status AS ENUM ('available', 'full', 'cancelled');
CREATE TYPE event_registration_status AS ENUM ('confirmed', 'cancelled', 'attended', 'no-show');
CREATE TYPE registration_source AS ENUM ('liff', 'admin');
CREATE TYPE counting_method AS ENUM ('students', 'parents', 'registrations');

-- =====================================================
-- 1. BRANCHES (สาขา)
-- =====================================================
CREATE TABLE branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) NOT NULL UNIQUE,
    address TEXT NOT NULL,
    phone VARCHAR(20) NOT NULL,
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),
    open_time TIME NOT NULL DEFAULT '09:00',
    close_time TIME NOT NULL DEFAULT '18:00',
    open_days INTEGER[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}', -- 0=Sunday
    is_active BOOLEAN NOT NULL DEFAULT true,
    manager_name VARCHAR(100),
    manager_phone VARCHAR(20),
    line_group_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_branches_code ON branches(code);
CREATE INDEX idx_branches_is_active ON branches(is_active);

-- =====================================================
-- 2. ROOMS (ห้องเรียน - เดิมเป็น subcollection ของ branches)
-- =====================================================
CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 10,
    floor VARCHAR(10),
    has_projector BOOLEAN NOT NULL DEFAULT false,
    has_whiteboard BOOLEAN NOT NULL DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT true,
    UNIQUE(branch_id, name)
);

CREATE INDEX idx_rooms_branch_id ON rooms(branch_id);
CREATE INDEX idx_rooms_is_active ON rooms(is_active);

-- =====================================================
-- 3. PARENTS (ผู้ปกครอง)
-- =====================================================
CREATE TABLE parents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    line_user_id VARCHAR(50) UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    picture_url TEXT,
    phone VARCHAR(20) NOT NULL,
    emergency_phone VARCHAR(20),
    email VARCHAR(255),
    -- Address as separate columns (แทน nested object)
    address_house_number VARCHAR(50),
    address_street VARCHAR(100),
    address_sub_district VARCHAR(100),
    address_district VARCHAR(100),
    address_province VARCHAR(100),
    address_postal_code VARCHAR(10),
    preferred_branch_id UUID REFERENCES branches(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_parents_line_user_id ON parents(line_user_id);
CREATE INDEX idx_parents_phone ON parents(phone);
CREATE INDEX idx_parents_created_at ON parents(created_at DESC);

-- =====================================================
-- 4. STUDENTS (นักเรียน - เดิมเป็น subcollection ของ parents)
-- =====================================================
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    nickname VARCHAR(50) NOT NULL,
    birthdate DATE NOT NULL,
    gender gender_type NOT NULL,
    school_name VARCHAR(100),
    grade_level VARCHAR(20),
    profile_image TEXT,
    allergies TEXT,
    special_needs TEXT,
    emergency_contact VARCHAR(100),
    emergency_phone VARCHAR(20),
    is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX idx_students_parent_id ON students(parent_id);
CREATE INDEX idx_students_birthdate ON students(birthdate);
CREATE INDEX idx_students_is_active ON students(is_active);

-- =====================================================
-- 5. TEACHERS (ครู)
-- =====================================================
CREATE TABLE teachers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    nickname VARCHAR(50),
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL,
    line_user_id VARCHAR(50),
    specialties UUID[] DEFAULT '{}', -- Array of subject IDs
    available_branches UUID[] DEFAULT '{}', -- Array of branch IDs
    profile_image TEXT,
    hourly_rate DECIMAL(10, 2),
    -- Bank account as separate columns
    bank_name VARCHAR(50),
    bank_account_number VARCHAR(20),
    bank_account_name VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT true,
    has_login BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE INDEX idx_teachers_email ON teachers(email);
CREATE INDEX idx_teachers_is_active ON teachers(is_active);
CREATE INDEX idx_teachers_available_branches ON teachers USING GIN(available_branches);

-- =====================================================
-- 6. ADMIN_USERS (ผู้ดูแลระบบ)
-- =====================================================
CREATE TABLE admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    role admin_role NOT NULL DEFAULT 'branch_admin',
    branch_ids UUID[] DEFAULT '{}', -- Empty = all branches
    -- Permissions as separate columns
    can_manage_users BOOLEAN DEFAULT false,
    can_manage_settings BOOLEAN DEFAULT false,
    can_view_reports BOOLEAN DEFAULT false,
    can_manage_all_branches BOOLEAN DEFAULT false,
    teacher_id UUID REFERENCES teachers(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID
);

CREATE INDEX idx_admin_users_email ON admin_users(email);
CREATE INDEX idx_admin_users_role ON admin_users(role);
CREATE INDEX idx_admin_users_is_active ON admin_users(is_active);
CREATE INDEX idx_admin_users_branch_ids ON admin_users USING GIN(branch_ids);

-- =====================================================
-- 7. SUBJECTS (วิชา)
-- =====================================================
CREATE TABLE subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    category subject_category NOT NULL,
    level subject_level NOT NULL,
    age_range_min INTEGER NOT NULL DEFAULT 6,
    age_range_max INTEGER NOT NULL DEFAULT 18,
    color VARCHAR(7) NOT NULL DEFAULT '#3B82F6', -- Hex color
    icon VARCHAR(50),
    prerequisites UUID[] DEFAULT '{}', -- Array of subject IDs
    is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX idx_subjects_code ON subjects(code);
CREATE INDEX idx_subjects_category ON subjects(category);
CREATE INDEX idx_subjects_level ON subjects(level);
CREATE INDEX idx_subjects_is_active ON subjects(is_active);

-- =====================================================
-- 8. CLASSES (คลาสเรียน)
-- =====================================================
CREATE TABLE classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_id UUID NOT NULL REFERENCES subjects(id),
    teacher_id UUID NOT NULL REFERENCES teachers(id),
    branch_id UUID NOT NULL REFERENCES branches(id),
    room_id UUID NOT NULL REFERENCES rooms(id),
    name VARCHAR(150) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_sessions INTEGER NOT NULL,
    days_of_week INTEGER[] NOT NULL DEFAULT '{}', -- [1,3,5] = Mon, Wed, Fri
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    max_students INTEGER NOT NULL DEFAULT 10,
    min_students INTEGER NOT NULL DEFAULT 1,
    enrolled_count INTEGER NOT NULL DEFAULT 0,
    -- Pricing as separate columns
    price_per_session DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    material_fee DECIMAL(10, 2) DEFAULT 0,
    registration_fee DECIMAL(10, 2) DEFAULT 0,
    status class_status NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_classes_subject_id ON classes(subject_id);
CREATE INDEX idx_classes_teacher_id ON classes(teacher_id);
CREATE INDEX idx_classes_branch_id ON classes(branch_id);
CREATE INDEX idx_classes_room_id ON classes(room_id);
CREATE INDEX idx_classes_code ON classes(code);
CREATE INDEX idx_classes_status ON classes(status);
CREATE INDEX idx_classes_start_date ON classes(start_date);
CREATE INDEX idx_classes_created_at ON classes(created_at DESC);

-- =====================================================
-- 9. CLASS_SCHEDULES (ตารางเรียน - เดิมเป็น subcollection ของ classes)
-- =====================================================
CREATE TABLE class_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    session_date DATE NOT NULL,
    session_number INTEGER NOT NULL,
    topic VARCHAR(200),
    status schedule_status NOT NULL DEFAULT 'scheduled',
    actual_teacher_id UUID REFERENCES teachers(id),
    note TEXT,
    original_date DATE, -- If rescheduled
    rescheduled_at TIMESTAMPTZ,
    rescheduled_by UUID,
    UNIQUE(class_id, session_number)
);

CREATE INDEX idx_class_schedules_class_id ON class_schedules(class_id);
CREATE INDEX idx_class_schedules_session_date ON class_schedules(session_date);
CREATE INDEX idx_class_schedules_status ON class_schedules(status);

-- =====================================================
-- 10. ATTENDANCE (การเช็คชื่อ - แยกจาก class_schedules)
-- =====================================================
CREATE TABLE attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schedule_id UUID NOT NULL REFERENCES class_schedules(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id),
    status attendance_status NOT NULL,
    note TEXT,
    feedback TEXT, -- Teacher's feedback on student
    checked_at TIMESTAMPTZ,
    checked_by UUID,
    UNIQUE(schedule_id, student_id)
);

CREATE INDEX idx_attendance_schedule_id ON attendance(schedule_id);
CREATE INDEX idx_attendance_student_id ON attendance(student_id);

-- =====================================================
-- 11. ENROLLMENTS (การลงทะเบียน)
-- =====================================================
CREATE TABLE enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id),
    class_id UUID NOT NULL REFERENCES classes(id),
    parent_id UUID NOT NULL REFERENCES parents(id),
    branch_id UUID NOT NULL REFERENCES branches(id),
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status enrollment_status NOT NULL DEFAULT 'active',
    -- Pricing
    original_price DECIMAL(10, 2) NOT NULL,
    discount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    discount_type discount_type NOT NULL DEFAULT 'fixed',
    final_price DECIMAL(10, 2) NOT NULL,
    promotion_code VARCHAR(50),
    -- Payment
    payment_method payment_method NOT NULL DEFAULT 'transfer',
    payment_status payment_status NOT NULL DEFAULT 'pending',
    paid_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    paid_date TIMESTAMPTZ,
    receipt_number VARCHAR(50),
    transferred_from UUID REFERENCES classes(id),
    dropped_reason TEXT,
    UNIQUE(student_id, class_id)
);

CREATE INDEX idx_enrollments_student_id ON enrollments(student_id);
CREATE INDEX idx_enrollments_class_id ON enrollments(class_id);
CREATE INDEX idx_enrollments_parent_id ON enrollments(parent_id);
CREATE INDEX idx_enrollments_branch_id ON enrollments(branch_id);
CREATE INDEX idx_enrollments_status ON enrollments(status);
CREATE INDEX idx_enrollments_payment_status ON enrollments(payment_status);
CREATE INDEX idx_enrollments_enrolled_at ON enrollments(enrolled_at DESC);

-- =====================================================
-- 12. ENROLLMENT_TRANSFER_HISTORY (ประวัติการโอนย้าย)
-- =====================================================
CREATE TABLE enrollment_transfer_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
    from_class_id UUID NOT NULL REFERENCES classes(id),
    to_class_id UUID NOT NULL REFERENCES classes(id),
    transferred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason TEXT
);

CREATE INDEX idx_transfer_history_enrollment_id ON enrollment_transfer_history(enrollment_id);

-- =====================================================
-- 13. TRIAL_BOOKINGS (การจองทดลองเรียน)
-- =====================================================
CREATE TABLE trial_bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source trial_source NOT NULL DEFAULT 'online',
    parent_name VARCHAR(100) NOT NULL,
    parent_phone VARCHAR(20) NOT NULL,
    parent_email VARCHAR(255),
    branch_id UUID REFERENCES branches(id),
    status trial_booking_status NOT NULL DEFAULT 'new',
    assigned_to UUID REFERENCES admin_users(id),
    contacted_at TIMESTAMPTZ,
    contact_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE INDEX idx_trial_bookings_status ON trial_bookings(status);
CREATE INDEX idx_trial_bookings_branch_id ON trial_bookings(branch_id);
CREATE INDEX idx_trial_bookings_created_at ON trial_bookings(created_at DESC);

-- =====================================================
-- 14. TRIAL_BOOKING_STUDENTS (นักเรียนที่จองทดลอง)
-- =====================================================
CREATE TABLE trial_booking_students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES trial_bookings(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    school_name VARCHAR(100),
    grade_level VARCHAR(20),
    birthdate DATE,
    subject_interests UUID[] DEFAULT '{}' -- Array of subject IDs
);

CREATE INDEX idx_trial_booking_students_booking_id ON trial_booking_students(booking_id);

-- =====================================================
-- 15. TRIAL_SESSIONS (คลาสทดลองเรียน)
-- =====================================================
CREATE TABLE trial_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES trial_bookings(id),
    student_name VARCHAR(100) NOT NULL,
    subject_id UUID NOT NULL REFERENCES subjects(id),
    scheduled_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    teacher_id UUID NOT NULL REFERENCES teachers(id),
    branch_id UUID NOT NULL REFERENCES branches(id),
    room_id UUID NOT NULL REFERENCES rooms(id),
    room_name VARCHAR(50),
    status trial_session_status NOT NULL DEFAULT 'scheduled',
    attended BOOLEAN,
    feedback TEXT,
    teacher_note TEXT,
    interested_level interest_level,
    converted BOOLEAN DEFAULT false,
    converted_to_class_id UUID REFERENCES classes(id),
    conversion_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_trial_sessions_booking_id ON trial_sessions(booking_id);
CREATE INDEX idx_trial_sessions_branch_id ON trial_sessions(branch_id);
CREATE INDEX idx_trial_sessions_scheduled_date ON trial_sessions(scheduled_date);
CREATE INDEX idx_trial_sessions_status ON trial_sessions(status);

-- =====================================================
-- 16. TRIAL_RESCHEDULE_HISTORY (ประวัติการเลื่อนคลาสทดลอง)
-- =====================================================
CREATE TABLE trial_reschedule_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES trial_sessions(id) ON DELETE CASCADE,
    original_date DATE NOT NULL,
    original_time TIME NOT NULL,
    new_date DATE NOT NULL,
    new_time TIME NOT NULL,
    reason TEXT,
    rescheduled_by UUID NOT NULL,
    rescheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trial_reschedule_session_id ON trial_reschedule_history(session_id);

-- =====================================================
-- 17. MAKEUP_CLASSES (คลาสชดเชย)
-- =====================================================
CREATE TABLE makeup_classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type makeup_type NOT NULL DEFAULT 'scheduled',
    -- Original Class Info
    original_class_id UUID NOT NULL REFERENCES classes(id),
    original_schedule_id UUID NOT NULL REFERENCES class_schedules(id),
    original_session_number INTEGER,
    original_session_date DATE,
    -- Denormalized Class Data
    class_name VARCHAR(150) NOT NULL,
    class_code VARCHAR(50) NOT NULL,
    subject_id UUID NOT NULL REFERENCES subjects(id),
    subject_name VARCHAR(100) NOT NULL,
    -- Student Info
    student_id UUID NOT NULL REFERENCES students(id),
    student_name VARCHAR(100) NOT NULL,
    student_nickname VARCHAR(50) NOT NULL,
    -- Parent Info
    parent_id UUID NOT NULL REFERENCES parents(id),
    parent_name VARCHAR(100) NOT NULL,
    parent_phone VARCHAR(20) NOT NULL,
    parent_line_user_id VARCHAR(50),
    -- Branch Info
    branch_id UUID NOT NULL REFERENCES branches(id),
    branch_name VARCHAR(100) NOT NULL,
    -- Request Info
    request_date DATE NOT NULL,
    requested_by UUID NOT NULL,
    reason TEXT NOT NULL,
    status makeup_status NOT NULL DEFAULT 'pending',
    -- Makeup Schedule
    makeup_date DATE,
    makeup_start_time TIME,
    makeup_end_time TIME,
    makeup_teacher_id UUID REFERENCES teachers(id),
    makeup_teacher_name VARCHAR(100),
    makeup_branch_id UUID REFERENCES branches(id),
    makeup_room_id UUID REFERENCES rooms(id),
    makeup_room_name VARCHAR(50),
    makeup_confirmed_at TIMESTAMPTZ,
    makeup_confirmed_by UUID,
    -- Attendance
    attendance_status makeup_attendance_status,
    attendance_checked_by UUID,
    attendance_checked_at TIMESTAMPTZ,
    attendance_note TEXT,
    -- Metadata
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE INDEX idx_makeup_classes_student_id ON makeup_classes(student_id);
CREATE INDEX idx_makeup_classes_branch_id ON makeup_classes(branch_id);
CREATE INDEX idx_makeup_classes_status ON makeup_classes(status);
CREATE INDEX idx_makeup_classes_created_at ON makeup_classes(created_at DESC);

-- =====================================================
-- 18. NOTIFICATIONS (แจ้งเตือน)
-- =====================================================
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL, -- Can be parent_id or admin_id
    user_type VARCHAR(20) NOT NULL DEFAULT 'parent', -- 'parent' or 'admin'
    type notification_type NOT NULL,
    title VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,
    image_url TEXT,
    action_url TEXT,
    data JSONB DEFAULT '{}',
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ,
    is_read BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_sent_at ON notifications(sent_at DESC);

-- =====================================================
-- 19. PROMOTIONS (โปรโมชั่น)
-- =====================================================
CREATE TABLE promotions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    type promotion_type NOT NULL,
    value DECIMAL(10, 2) NOT NULL,
    -- Conditions
    min_purchase DECIMAL(10, 2),
    applicable_to TEXT[] DEFAULT '{"all"}', -- ['subjects', 'branches', 'all']
    valid_branches UUID[] DEFAULT '{}',
    valid_subjects UUID[] DEFAULT '{}',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    usage_limit INTEGER,
    used_count INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX idx_promotions_code ON promotions(code);
CREATE INDEX idx_promotions_is_active ON promotions(is_active);
CREATE INDEX idx_promotions_start_date ON promotions(start_date);
CREATE INDEX idx_promotions_end_date ON promotions(end_date);

-- =====================================================
-- 20. HOLIDAYS (วันหยุด)
-- =====================================================
CREATE TABLE holidays (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    type holiday_type NOT NULL DEFAULT 'national',
    branches UUID[] DEFAULT '{}', -- Empty for national holidays
    description TEXT
);

CREATE INDEX idx_holidays_date ON holidays(date);
CREATE INDEX idx_holidays_type ON holidays(type);

-- =====================================================
-- 21. TEACHING_MATERIALS (สื่อการสอน)
-- =====================================================
CREATE TABLE teaching_materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_id UUID NOT NULL REFERENCES subjects(id),
    session_number INTEGER NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    objectives TEXT[] DEFAULT '{}',
    materials TEXT[] DEFAULT '{}', -- Equipment needed
    preparation TEXT[] DEFAULT '{}', -- Pre-class prep steps
    canva_url TEXT NOT NULL,
    embed_url TEXT NOT NULL,
    thumbnail_url TEXT,
    duration INTEGER NOT NULL, -- Minutes
    teaching_notes TEXT,
    tags TEXT[] DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL,
    updated_at TIMESTAMPTZ,
    updated_by UUID,
    UNIQUE(subject_id, session_number)
);

CREATE INDEX idx_teaching_materials_subject_id ON teaching_materials(subject_id);
CREATE INDEX idx_teaching_materials_session_number ON teaching_materials(session_number);
CREATE INDEX idx_teaching_materials_is_active ON teaching_materials(is_active);

-- =====================================================
-- 22. EVENTS (อีเว้นท์)
-- =====================================================
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    full_description TEXT, -- Markdown support
    image_url TEXT,
    location VARCHAR(200) NOT NULL,
    location_url TEXT, -- Google Maps URL
    branch_ids UUID[] NOT NULL DEFAULT '{}',
    event_type event_type NOT NULL,
    highlights TEXT[] DEFAULT '{}',
    target_audience TEXT,
    what_to_bring TEXT[] DEFAULT '{}',
    registration_start_date TIMESTAMPTZ NOT NULL,
    registration_end_date TIMESTAMPTZ NOT NULL,
    counting_method counting_method NOT NULL DEFAULT 'registrations',
    enable_reminder BOOLEAN NOT NULL DEFAULT true,
    reminder_days_before INTEGER NOT NULL DEFAULT 1,
    reminder_time TIME,
    status event_status NOT NULL DEFAULT 'draft',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL,
    updated_at TIMESTAMPTZ,
    updated_by UUID
);

CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_is_active ON events(is_active);
CREATE INDEX idx_events_created_at ON events(created_at DESC);
CREATE INDEX idx_events_branch_ids ON events USING GIN(branch_ids);

-- =====================================================
-- 23. EVENT_SCHEDULES (ตารางอีเว้นท์)
-- =====================================================
CREATE TABLE event_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    max_attendees INTEGER NOT NULL,
    attendees_by_branch JSONB DEFAULT '{}', -- {branch_id: count}
    status event_schedule_status NOT NULL DEFAULT 'available'
);

CREATE INDEX idx_event_schedules_event_id ON event_schedules(event_id);
CREATE INDEX idx_event_schedules_date ON event_schedules(date);
CREATE INDEX idx_event_schedules_status ON event_schedules(status);

-- =====================================================
-- 24. EVENT_REGISTRATIONS (การลงทะเบียนอีเว้นท์)
-- =====================================================
CREATE TABLE event_registrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id),
    event_name VARCHAR(200) NOT NULL, -- Denormalized
    schedule_id UUID NOT NULL REFERENCES event_schedules(id),
    schedule_date DATE NOT NULL, -- Denormalized
    schedule_time VARCHAR(20) NOT NULL, -- "09:00-12:00"
    branch_id UUID NOT NULL REFERENCES branches(id),
    -- Registration Info
    is_guest BOOLEAN NOT NULL DEFAULT false,
    line_user_id VARCHAR(50),
    line_display_name VARCHAR(100),
    line_picture_url TEXT,
    parent_id UUID REFERENCES parents(id),
    parent_name VARCHAR(100) NOT NULL,
    parent_phone VARCHAR(20) NOT NULL,
    parent_email VARCHAR(255),
    parent_address TEXT,
    attendee_count INTEGER NOT NULL DEFAULT 1,
    -- Status
    status event_registration_status NOT NULL DEFAULT 'confirmed',
    registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    registered_from registration_source NOT NULL DEFAULT 'liff',
    -- Cancellation
    cancelled_at TIMESTAMPTZ,
    cancelled_by UUID,
    cancellation_reason TEXT,
    -- Attendance
    attended BOOLEAN,
    attendance_checked_at TIMESTAMPTZ,
    attendance_checked_by UUID,
    attendance_note TEXT,
    -- Additional
    special_request TEXT,
    referral_source VARCHAR(100)
);

CREATE INDEX idx_event_registrations_event_id ON event_registrations(event_id);
CREATE INDEX idx_event_registrations_schedule_id ON event_registrations(schedule_id);
CREATE INDEX idx_event_registrations_branch_id ON event_registrations(branch_id);
CREATE INDEX idx_event_registrations_parent_id ON event_registrations(parent_id);
CREATE INDEX idx_event_registrations_status ON event_registrations(status);

-- =====================================================
-- 25. EVENT_REGISTRATION_PARENTS (ผู้ปกครองที่ลงทะเบียน - หลายคน)
-- =====================================================
CREATE TABLE event_registration_parents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    registration_id UUID NOT NULL REFERENCES event_registrations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    is_main_contact BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_event_reg_parents_registration_id ON event_registration_parents(registration_id);

-- =====================================================
-- 26. EVENT_REGISTRATION_STUDENTS (นักเรียนที่ลงทะเบียน - หลายคน)
-- =====================================================
CREATE TABLE event_registration_students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    registration_id UUID NOT NULL REFERENCES event_registrations(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id),
    name VARCHAR(100) NOT NULL,
    nickname VARCHAR(50) NOT NULL,
    birthdate DATE NOT NULL,
    school_name VARCHAR(100),
    grade_level VARCHAR(20)
);

CREATE INDEX idx_event_reg_students_registration_id ON event_registration_students(registration_id);

-- =====================================================
-- 27. LINK_TOKENS (Token สำหรับเชื่อม LINE Account)
-- =====================================================
CREATE TABLE link_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token VARCHAR(64) NOT NULL UNIQUE,
    parent_id UUID NOT NULL REFERENCES parents(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN NOT NULL DEFAULT false,
    used_at TIMESTAMPTZ,
    linked_line_user_id VARCHAR(50)
);

CREATE INDEX idx_link_tokens_token ON link_tokens(token);
CREATE INDEX idx_link_tokens_parent_id ON link_tokens(parent_id);
CREATE INDEX idx_link_tokens_expires_at ON link_tokens(expires_at);

-- =====================================================
-- 28. STUDENT_FEEDBACK (ฟีดแบ็คแยกออกมาเพื่อ query ง่าย)
-- =====================================================
CREATE TABLE student_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id),
    parent_id UUID NOT NULL REFERENCES parents(id),
    class_id UUID NOT NULL REFERENCES classes(id),
    class_name VARCHAR(150) NOT NULL,
    subject_id UUID NOT NULL REFERENCES subjects(id),
    subject_name VARCHAR(100) NOT NULL,
    schedule_id UUID NOT NULL REFERENCES class_schedules(id),
    session_number INTEGER NOT NULL,
    session_date DATE NOT NULL,
    feedback TEXT NOT NULL,
    teacher_id UUID NOT NULL REFERENCES teachers(id),
    teacher_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_student_feedback_student_id ON student_feedback(student_id);
CREATE INDEX idx_student_feedback_parent_id ON student_feedback(parent_id);
CREATE INDEX idx_student_feedback_class_id ON student_feedback(class_id);
CREATE INDEX idx_student_feedback_created_at ON student_feedback(created_at DESC);

-- =====================================================
-- 29. SETTINGS (ตั้งค่าระบบ)
-- =====================================================
CREATE TABLE settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) NOT NULL UNIQUE,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID
);

CREATE INDEX idx_settings_key ON settings(key);

-- =====================================================
-- VIEWS สำหรับ Query ที่ใช้บ่อย
-- =====================================================

-- View: Students with Parent Info
CREATE VIEW v_students_with_parents AS
SELECT
    s.*,
    p.display_name as parent_name,
    p.phone as parent_phone,
    p.line_user_id as parent_line_user_id,
    p.email as parent_email
FROM students s
JOIN parents p ON s.parent_id = p.id;

-- View: Classes with Related Info
CREATE VIEW v_classes_full AS
SELECT
    c.*,
    sub.name as subject_name,
    sub.code as subject_code,
    sub.category as subject_category,
    t.name as teacher_name,
    t.nickname as teacher_nickname,
    b.name as branch_name,
    b.code as branch_code,
    r.name as room_name
FROM classes c
JOIN subjects sub ON c.subject_id = sub.id
JOIN teachers t ON c.teacher_id = t.id
JOIN branches b ON c.branch_id = b.id
JOIN rooms r ON c.room_id = r.id;

-- View: Enrollments with Full Info
CREATE VIEW v_enrollments_full AS
SELECT
    e.*,
    s.name as student_name,
    s.nickname as student_nickname,
    p.display_name as parent_name,
    p.phone as parent_phone,
    c.name as class_name,
    c.code as class_code,
    sub.name as subject_name,
    b.name as branch_name
FROM enrollments e
JOIN students s ON e.student_id = s.id
JOIN parents p ON e.parent_id = p.id
JOIN classes c ON e.class_id = c.id
JOIN subjects sub ON c.subject_id = sub.id
JOIN branches b ON e.branch_id = b.id;

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function: Update enrolled_count when enrollment changes
CREATE OR REPLACE FUNCTION update_class_enrolled_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE classes SET enrolled_count = enrolled_count + 1 WHERE id = NEW.class_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE classes SET enrolled_count = enrolled_count - 1 WHERE id = OLD.class_id;
    ELSIF TG_OP = 'UPDATE' AND OLD.class_id != NEW.class_id THEN
        UPDATE classes SET enrolled_count = enrolled_count - 1 WHERE id = OLD.class_id;
        UPDATE classes SET enrolled_count = enrolled_count + 1 WHERE id = NEW.class_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_enrollment_count
AFTER INSERT OR UPDATE OR DELETE ON enrollments
FOR EACH ROW EXECUTE FUNCTION update_class_enrolled_count();

-- Function: Update promotion used_count
CREATE OR REPLACE FUNCTION update_promotion_used_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.promotion_code IS NOT NULL THEN
        UPDATE promotions SET used_count = used_count + 1 WHERE code = NEW.promotion_code;
    ELSIF TG_OP = 'DELETE' AND OLD.promotion_code IS NOT NULL THEN
        UPDATE promotions SET used_count = used_count - 1 WHERE code = OLD.promotion_code;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_promotion_usage
AFTER INSERT OR DELETE ON enrollments
FOR EACH ROW EXECUTE FUNCTION update_promotion_used_count();

-- Function: Auto update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER tr_teachers_updated_at BEFORE UPDATE ON teachers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_admin_users_updated_at BEFORE UPDATE ON admin_users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_trial_bookings_updated_at BEFORE UPDATE ON trial_bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_makeup_classes_updated_at BEFORE UPDATE ON makeup_classes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_teaching_materials_updated_at BEFORE UPDATE ON teaching_materials FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_settings_updated_at BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE branches IS 'สาขาของโรงเรียน';
COMMENT ON TABLE rooms IS 'ห้องเรียนในแต่ละสาขา';
COMMENT ON TABLE parents IS 'ข้อมูลผู้ปกครอง';
COMMENT ON TABLE students IS 'ข้อมูลนักเรียน';
COMMENT ON TABLE teachers IS 'ข้อมูลครูผู้สอน';
COMMENT ON TABLE admin_users IS 'ผู้ดูแลระบบและสิทธิ์การใช้งาน';
COMMENT ON TABLE subjects IS 'วิชาที่เปิดสอน';
COMMENT ON TABLE classes IS 'คลาสเรียน';
COMMENT ON TABLE class_schedules IS 'ตารางเรียนของแต่ละคลาส';
COMMENT ON TABLE attendance IS 'การเช็คชื่อเข้าเรียน';
COMMENT ON TABLE enrollments IS 'การลงทะเบียนเรียน';
COMMENT ON TABLE trial_bookings IS 'การจองทดลองเรียน';
COMMENT ON TABLE trial_sessions IS 'คลาสทดลองเรียน';
COMMENT ON TABLE makeup_classes IS 'คลาสชดเชย';
COMMENT ON TABLE notifications IS 'การแจ้งเตือนในระบบ';
COMMENT ON TABLE promotions IS 'โปรโมชั่นและส่วนลด';
COMMENT ON TABLE holidays IS 'วันหยุด';
COMMENT ON TABLE teaching_materials IS 'สื่อการสอน';
COMMENT ON TABLE events IS 'กิจกรรมและอีเว้นท์';
COMMENT ON TABLE event_schedules IS 'รอบจัดกิจกรรม';
COMMENT ON TABLE event_registrations IS 'การลงทะเบียนเข้าร่วมกิจกรรม';
COMMENT ON TABLE link_tokens IS 'Token สำหรับเชื่อมบัญชี LINE';
COMMENT ON TABLE student_feedback IS 'ฟีดแบ็คจากครูถึงนักเรียน';
COMMENT ON TABLE settings IS 'ตั้งค่าระบบทั่วไป';
