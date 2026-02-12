export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Enum Types (matching PostgreSQL enums)
export type AdminRole = 'super_admin' | 'branch_admin' | 'teacher'
export type GenderType = 'M' | 'F'
export type SubjectCategory = 'Coding' | 'Robotics' | 'AI' | 'Other'
export type SubjectLevel = 'Beginner' | 'Intermediate' | 'Advanced'
export type ClassStatus = 'draft' | 'published' | 'started' | 'completed' | 'cancelled'
export type ScheduleStatus = 'scheduled' | 'completed' | 'cancelled' | 'rescheduled'
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'sick' | 'leave'
export type EnrollmentStatus = 'active' | 'completed' | 'dropped' | 'transferred'
export type DiscountType = 'percentage' | 'fixed'
export type PaymentMethod = 'cash' | 'transfer' | 'credit'
export type PaymentStatus = 'pending' | 'partial' | 'paid'
export type TrialSource = 'online' | 'walkin' | 'phone'
export type TrialBookingStatus = 'new' | 'contacted' | 'scheduled' | 'completed' | 'converted' | 'cancelled'
export type TrialSessionStatus = 'scheduled' | 'attended' | 'absent' | 'cancelled'
export type InterestLevel = 'high' | 'medium' | 'low' | 'not_interested'
export type NotificationType = 'reminder' | 'announcement' | 'schedule_change' | 'payment' | 'makeup' | 'system'
export type PromotionType = 'percentage' | 'fixed' | 'package'
export type HolidayType = 'national' | 'branch'
export type MakeupType = 'scheduled' | 'ad-hoc'
export type MakeupStatus = 'pending' | 'scheduled' | 'completed' | 'cancelled'
export type MakeupAttendanceStatus = 'present' | 'absent'
export type EventType = 'open-house' | 'parent-meeting' | 'showcase' | 'workshop' | 'other'
export type EventStatus = 'draft' | 'published' | 'completed' | 'cancelled'
export type EventScheduleStatus = 'available' | 'full' | 'cancelled'
export type EventRegistrationStatus = 'confirmed' | 'cancelled' | 'attended' | 'no-show'
export type RegistrationSource = 'liff' | 'admin'
export type CountingMethod = 'students' | 'parents' | 'registrations'

export interface Database {
  public: {
    Tables: {
      branches: {
        Row: {
          id: string
          name: string
          code: string
          address: string
          phone: string
          location_lat: number | null
          location_lng: number | null
          open_time: string
          close_time: string
          open_days: number[]
          is_active: boolean
          manager_name: string | null
          manager_phone: string | null
          line_group_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          code: string
          address: string
          phone: string
          location_lat?: number | null
          location_lng?: number | null
          open_time?: string
          close_time?: string
          open_days?: number[]
          is_active?: boolean
          manager_name?: string | null
          manager_phone?: string | null
          line_group_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          code?: string
          address?: string
          phone?: string
          location_lat?: number | null
          location_lng?: number | null
          open_time?: string
          close_time?: string
          open_days?: number[]
          is_active?: boolean
          manager_name?: string | null
          manager_phone?: string | null
          line_group_url?: string | null
          created_at?: string
        }
      }
      rooms: {
        Row: {
          id: string
          branch_id: string
          name: string
          capacity: number
          floor: string | null
          has_projector: boolean
          has_whiteboard: boolean
          is_active: boolean
        }
        Insert: {
          id?: string
          branch_id: string
          name: string
          capacity?: number
          floor?: string | null
          has_projector?: boolean
          has_whiteboard?: boolean
          is_active?: boolean
        }
        Update: {
          id?: string
          branch_id?: string
          name?: string
          capacity?: number
          floor?: string | null
          has_projector?: boolean
          has_whiteboard?: boolean
          is_active?: boolean
        }
      }
      parents: {
        Row: {
          id: string
          line_user_id: string | null
          display_name: string
          picture_url: string | null
          phone: string
          emergency_phone: string | null
          email: string | null
          address_house_number: string | null
          address_street: string | null
          address_sub_district: string | null
          address_district: string | null
          address_province: string | null
          address_postal_code: string | null
          preferred_branch_id: string | null
          created_at: string
          last_login_at: string
        }
        Insert: {
          id?: string
          line_user_id?: string | null
          display_name: string
          picture_url?: string | null
          phone: string
          emergency_phone?: string | null
          email?: string | null
          address_house_number?: string | null
          address_street?: string | null
          address_sub_district?: string | null
          address_district?: string | null
          address_province?: string | null
          address_postal_code?: string | null
          preferred_branch_id?: string | null
          created_at?: string
          last_login_at?: string
        }
        Update: {
          id?: string
          line_user_id?: string | null
          display_name?: string
          picture_url?: string | null
          phone?: string
          emergency_phone?: string | null
          email?: string | null
          address_house_number?: string | null
          address_street?: string | null
          address_sub_district?: string | null
          address_district?: string | null
          address_province?: string | null
          address_postal_code?: string | null
          preferred_branch_id?: string | null
          created_at?: string
          last_login_at?: string
        }
      }
      students: {
        Row: {
          id: string
          parent_id: string
          name: string
          nickname: string
          birthdate: string
          gender: GenderType
          school_name: string | null
          grade_level: string | null
          profile_image: string | null
          allergies: string | null
          special_needs: string | null
          emergency_contact: string | null
          emergency_phone: string | null
          is_active: boolean
        }
        Insert: {
          id?: string
          parent_id: string
          name: string
          nickname: string
          birthdate: string
          gender: GenderType
          school_name?: string | null
          grade_level?: string | null
          profile_image?: string | null
          allergies?: string | null
          special_needs?: string | null
          emergency_contact?: string | null
          emergency_phone?: string | null
          is_active?: boolean
        }
        Update: {
          id?: string
          parent_id?: string
          name?: string
          nickname?: string
          birthdate?: string
          gender?: GenderType
          school_name?: string | null
          grade_level?: string | null
          profile_image?: string | null
          allergies?: string | null
          special_needs?: string | null
          emergency_contact?: string | null
          emergency_phone?: string | null
          is_active?: boolean
        }
      }
      teachers: {
        Row: {
          id: string
          name: string
          nickname: string | null
          email: string
          phone: string
          line_user_id: string | null
          specialties: string[]
          available_branches: string[]
          profile_image: string | null
          hourly_rate: number | null
          bank_name: string | null
          bank_account_number: string | null
          bank_account_name: string | null
          is_active: boolean
          has_login: boolean
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          nickname?: string | null
          email: string
          phone: string
          line_user_id?: string | null
          specialties?: string[]
          available_branches?: string[]
          profile_image?: string | null
          hourly_rate?: number | null
          bank_name?: string | null
          bank_account_number?: string | null
          bank_account_name?: string | null
          is_active?: boolean
          has_login?: boolean
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          nickname?: string | null
          email?: string
          phone?: string
          line_user_id?: string | null
          specialties?: string[]
          available_branches?: string[]
          profile_image?: string | null
          hourly_rate?: number | null
          bank_name?: string | null
          bank_account_number?: string | null
          bank_account_name?: string | null
          is_active?: boolean
          has_login?: boolean
          created_at?: string
          updated_at?: string | null
        }
      }
      admin_users: {
        Row: {
          id: string
          email: string
          display_name: string
          role: AdminRole
          branch_ids: string[]
          can_manage_users: boolean | null
          can_manage_settings: boolean | null
          can_view_reports: boolean | null
          can_manage_all_branches: boolean | null
          teacher_id: string | null
          is_active: boolean
          created_at: string
          created_by: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          email: string
          display_name: string
          role?: AdminRole
          branch_ids?: string[]
          can_manage_users?: boolean | null
          can_manage_settings?: boolean | null
          can_view_reports?: boolean | null
          can_manage_all_branches?: boolean | null
          teacher_id?: string | null
          is_active?: boolean
          created_at?: string
          created_by?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          email?: string
          display_name?: string
          role?: AdminRole
          branch_ids?: string[]
          can_manage_users?: boolean | null
          can_manage_settings?: boolean | null
          can_view_reports?: boolean | null
          can_manage_all_branches?: boolean | null
          teacher_id?: string | null
          is_active?: boolean
          created_at?: string
          created_by?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
      }
      subjects: {
        Row: {
          id: string
          name: string
          code: string
          description: string
          category: SubjectCategory
          level: SubjectLevel
          age_range_min: number
          age_range_max: number
          color: string
          icon: string | null
          prerequisites: string[]
          is_active: boolean
        }
        Insert: {
          id?: string
          name: string
          code: string
          description: string
          category: SubjectCategory
          level: SubjectLevel
          age_range_min?: number
          age_range_max?: number
          color?: string
          icon?: string | null
          prerequisites?: string[]
          is_active?: boolean
        }
        Update: {
          id?: string
          name?: string
          code?: string
          description?: string
          category?: SubjectCategory
          level?: SubjectLevel
          age_range_min?: number
          age_range_max?: number
          color?: string
          icon?: string | null
          prerequisites?: string[]
          is_active?: boolean
        }
      }
      classes: {
        Row: {
          id: string
          subject_id: string
          teacher_id: string
          branch_id: string
          room_id: string
          name: string
          code: string
          description: string | null
          start_date: string
          end_date: string
          total_sessions: number
          days_of_week: number[]
          start_time: string
          end_time: string
          max_students: number
          min_students: number
          enrolled_count: number
          price_per_session: number
          total_price: number
          material_fee: number | null
          registration_fee: number | null
          status: ClassStatus
          created_at: string
        }
        Insert: {
          id?: string
          subject_id: string
          teacher_id: string
          branch_id: string
          room_id: string
          name: string
          code: string
          description?: string | null
          start_date: string
          end_date: string
          total_sessions: number
          days_of_week?: number[]
          start_time: string
          end_time: string
          max_students?: number
          min_students?: number
          enrolled_count?: number
          price_per_session: number
          total_price: number
          material_fee?: number | null
          registration_fee?: number | null
          status?: ClassStatus
          created_at?: string
        }
        Update: {
          id?: string
          subject_id?: string
          teacher_id?: string
          branch_id?: string
          room_id?: string
          name?: string
          code?: string
          description?: string | null
          start_date?: string
          end_date?: string
          total_sessions?: number
          days_of_week?: number[]
          start_time?: string
          end_time?: string
          max_students?: number
          min_students?: number
          enrolled_count?: number
          price_per_session?: number
          total_price?: number
          material_fee?: number | null
          registration_fee?: number | null
          status?: ClassStatus
          created_at?: string
        }
      }
      class_schedules: {
        Row: {
          id: string
          class_id: string
          session_date: string
          session_number: number
          topic: string | null
          status: ScheduleStatus
          actual_teacher_id: string | null
          note: string | null
          original_date: string | null
          rescheduled_at: string | null
          rescheduled_by: string | null
        }
        Insert: {
          id?: string
          class_id: string
          session_date: string
          session_number: number
          topic?: string | null
          status?: ScheduleStatus
          actual_teacher_id?: string | null
          note?: string | null
          original_date?: string | null
          rescheduled_at?: string | null
          rescheduled_by?: string | null
        }
        Update: {
          id?: string
          class_id?: string
          session_date?: string
          session_number?: number
          topic?: string | null
          status?: ScheduleStatus
          actual_teacher_id?: string | null
          note?: string | null
          original_date?: string | null
          rescheduled_at?: string | null
          rescheduled_by?: string | null
        }
      }
      attendance: {
        Row: {
          id: string
          schedule_id: string
          student_id: string
          status: AttendanceStatus
          note: string | null
          feedback: string | null
          checked_at: string | null
          checked_by: string | null
        }
        Insert: {
          id?: string
          schedule_id: string
          student_id: string
          status: AttendanceStatus
          note?: string | null
          feedback?: string | null
          checked_at?: string | null
          checked_by?: string | null
        }
        Update: {
          id?: string
          schedule_id?: string
          student_id?: string
          status?: AttendanceStatus
          note?: string | null
          feedback?: string | null
          checked_at?: string | null
          checked_by?: string | null
        }
      }
      enrollments: {
        Row: {
          id: string
          student_id: string
          class_id: string
          parent_id: string
          branch_id: string
          enrolled_at: string
          status: EnrollmentStatus
          original_price: number
          discount: number
          discount_type: DiscountType
          final_price: number
          promotion_code: string | null
          payment_method: PaymentMethod
          payment_status: PaymentStatus
          paid_amount: number
          paid_date: string | null
          receipt_number: string | null
          transferred_from: string | null
          dropped_reason: string | null
        }
        Insert: {
          id?: string
          student_id: string
          class_id: string
          parent_id: string
          branch_id: string
          enrolled_at?: string
          status?: EnrollmentStatus
          original_price: number
          discount?: number
          discount_type?: DiscountType
          final_price: number
          promotion_code?: string | null
          payment_method?: PaymentMethod
          payment_status?: PaymentStatus
          paid_amount?: number
          paid_date?: string | null
          receipt_number?: string | null
          transferred_from?: string | null
          dropped_reason?: string | null
        }
        Update: {
          id?: string
          student_id?: string
          class_id?: string
          parent_id?: string
          branch_id?: string
          enrolled_at?: string
          status?: EnrollmentStatus
          original_price?: number
          discount?: number
          discount_type?: DiscountType
          final_price?: number
          promotion_code?: string | null
          payment_method?: PaymentMethod
          payment_status?: PaymentStatus
          paid_amount?: number
          paid_date?: string | null
          receipt_number?: string | null
          transferred_from?: string | null
          dropped_reason?: string | null
        }
      }
      enrollment_transfer_history: {
        Row: {
          id: string
          enrollment_id: string
          from_class_id: string
          to_class_id: string
          transferred_at: string
          reason: string | null
        }
        Insert: {
          id?: string
          enrollment_id: string
          from_class_id: string
          to_class_id: string
          transferred_at?: string
          reason?: string | null
        }
        Update: {
          id?: string
          enrollment_id?: string
          from_class_id?: string
          to_class_id?: string
          transferred_at?: string
          reason?: string | null
        }
      }
      trial_bookings: {
        Row: {
          id: string
          source: TrialSource
          parent_name: string
          parent_phone: string
          parent_email: string | null
          branch_id: string | null
          status: TrialBookingStatus
          assigned_to: string | null
          contacted_at: string | null
          contact_note: string | null
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          source?: TrialSource
          parent_name: string
          parent_phone: string
          parent_email?: string | null
          branch_id?: string | null
          status?: TrialBookingStatus
          assigned_to?: string | null
          contacted_at?: string | null
          contact_note?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          source?: TrialSource
          parent_name?: string
          parent_phone?: string
          parent_email?: string | null
          branch_id?: string | null
          status?: TrialBookingStatus
          assigned_to?: string | null
          contacted_at?: string | null
          contact_note?: string | null
          created_at?: string
          updated_at?: string | null
        }
      }
      trial_booking_students: {
        Row: {
          id: string
          booking_id: string
          name: string
          school_name: string | null
          grade_level: string | null
          birthdate: string | null
          subject_interests: string[]
        }
        Insert: {
          id?: string
          booking_id: string
          name: string
          school_name?: string | null
          grade_level?: string | null
          birthdate?: string | null
          subject_interests?: string[]
        }
        Update: {
          id?: string
          booking_id?: string
          name?: string
          school_name?: string | null
          grade_level?: string | null
          birthdate?: string | null
          subject_interests?: string[]
        }
      }
      trial_sessions: {
        Row: {
          id: string
          booking_id: string
          student_name: string
          subject_id: string
          scheduled_date: string
          start_time: string
          end_time: string
          teacher_id: string
          branch_id: string
          room_id: string
          room_name: string | null
          status: TrialSessionStatus
          attended: boolean | null
          feedback: string | null
          teacher_note: string | null
          interested_level: InterestLevel | null
          converted: boolean | null
          converted_to_class_id: string | null
          conversion_note: string | null
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          booking_id: string
          student_name: string
          subject_id: string
          scheduled_date: string
          start_time: string
          end_time: string
          teacher_id: string
          branch_id: string
          room_id: string
          room_name?: string | null
          status?: TrialSessionStatus
          attended?: boolean | null
          feedback?: string | null
          teacher_note?: string | null
          interested_level?: InterestLevel | null
          converted?: boolean | null
          converted_to_class_id?: string | null
          conversion_note?: string | null
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          booking_id?: string
          student_name?: string
          subject_id?: string
          scheduled_date?: string
          start_time?: string
          end_time?: string
          teacher_id?: string
          branch_id?: string
          room_id?: string
          room_name?: string | null
          status?: TrialSessionStatus
          attended?: boolean | null
          feedback?: string | null
          teacher_note?: string | null
          interested_level?: InterestLevel | null
          converted?: boolean | null
          converted_to_class_id?: string | null
          conversion_note?: string | null
          created_at?: string
          completed_at?: string | null
        }
      }
      trial_reschedule_history: {
        Row: {
          id: string
          session_id: string
          original_date: string
          original_time: string
          new_date: string
          new_time: string
          reason: string | null
          rescheduled_by: string
          rescheduled_at: string
        }
        Insert: {
          id?: string
          session_id: string
          original_date: string
          original_time: string
          new_date: string
          new_time: string
          reason?: string | null
          rescheduled_by: string
          rescheduled_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          original_date?: string
          original_time?: string
          new_date?: string
          new_time?: string
          reason?: string | null
          rescheduled_by?: string
          rescheduled_at?: string
        }
      }
      makeup_classes: {
        Row: {
          id: string
          type: MakeupType
          original_class_id: string
          original_schedule_id: string
          original_session_number: number | null
          original_session_date: string | null
          class_name: string
          class_code: string
          subject_id: string
          subject_name: string
          student_id: string
          student_name: string
          student_nickname: string
          parent_id: string
          parent_name: string
          parent_phone: string
          parent_line_user_id: string | null
          branch_id: string
          branch_name: string
          request_date: string
          requested_by: string
          reason: string
          status: MakeupStatus
          makeup_date: string | null
          makeup_start_time: string | null
          makeup_end_time: string | null
          makeup_teacher_id: string | null
          makeup_teacher_name: string | null
          makeup_branch_id: string | null
          makeup_room_id: string | null
          makeup_room_name: string | null
          makeup_confirmed_at: string | null
          makeup_confirmed_by: string | null
          attendance_status: MakeupAttendanceStatus | null
          attendance_checked_by: string | null
          attendance_checked_at: string | null
          attendance_note: string | null
          notes: string | null
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          type?: MakeupType
          original_class_id: string
          original_schedule_id: string
          original_session_number?: number | null
          original_session_date?: string | null
          class_name: string
          class_code: string
          subject_id: string
          subject_name: string
          student_id: string
          student_name: string
          student_nickname: string
          parent_id: string
          parent_name: string
          parent_phone: string
          parent_line_user_id?: string | null
          branch_id: string
          branch_name: string
          request_date: string
          requested_by: string
          reason: string
          status?: MakeupStatus
          makeup_date?: string | null
          makeup_start_time?: string | null
          makeup_end_time?: string | null
          makeup_teacher_id?: string | null
          makeup_teacher_name?: string | null
          makeup_branch_id?: string | null
          makeup_room_id?: string | null
          makeup_room_name?: string | null
          makeup_confirmed_at?: string | null
          makeup_confirmed_by?: string | null
          attendance_status?: MakeupAttendanceStatus | null
          attendance_checked_by?: string | null
          attendance_checked_at?: string | null
          attendance_note?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          type?: MakeupType
          original_class_id?: string
          original_schedule_id?: string
          original_session_number?: number | null
          original_session_date?: string | null
          class_name?: string
          class_code?: string
          subject_id?: string
          subject_name?: string
          student_id?: string
          student_name?: string
          student_nickname?: string
          parent_id?: string
          parent_name?: string
          parent_phone?: string
          parent_line_user_id?: string | null
          branch_id?: string
          branch_name?: string
          request_date?: string
          requested_by?: string
          reason?: string
          status?: MakeupStatus
          makeup_date?: string | null
          makeup_start_time?: string | null
          makeup_end_time?: string | null
          makeup_teacher_id?: string | null
          makeup_teacher_name?: string | null
          makeup_branch_id?: string | null
          makeup_room_id?: string | null
          makeup_room_name?: string | null
          makeup_confirmed_at?: string | null
          makeup_confirmed_by?: string | null
          attendance_status?: MakeupAttendanceStatus | null
          attendance_checked_by?: string | null
          attendance_checked_at?: string | null
          attendance_note?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string | null
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          user_type: string
          type: NotificationType
          title: string
          body: string
          image_url: string | null
          action_url: string | null
          data: Json
          sent_at: string
          read_at: string | null
          is_read: boolean
        }
        Insert: {
          id?: string
          user_id: string
          user_type?: string
          type: NotificationType
          title: string
          body: string
          image_url?: string | null
          action_url?: string | null
          data?: Json
          sent_at?: string
          read_at?: string | null
          is_read?: boolean
        }
        Update: {
          id?: string
          user_id?: string
          user_type?: string
          type?: NotificationType
          title?: string
          body?: string
          image_url?: string | null
          action_url?: string | null
          data?: Json
          sent_at?: string
          read_at?: string | null
          is_read?: boolean
        }
      }
      promotions: {
        Row: {
          id: string
          name: string
          code: string
          description: string
          type: PromotionType
          value: number
          min_purchase: number | null
          applicable_to: string[]
          valid_branches: string[]
          valid_subjects: string[]
          start_date: string
          end_date: string
          usage_limit: number | null
          used_count: number
          is_active: boolean
        }
        Insert: {
          id?: string
          name: string
          code: string
          description: string
          type: PromotionType
          value: number
          min_purchase?: number | null
          applicable_to?: string[]
          valid_branches?: string[]
          valid_subjects?: string[]
          start_date: string
          end_date: string
          usage_limit?: number | null
          used_count?: number
          is_active?: boolean
        }
        Update: {
          id?: string
          name?: string
          code?: string
          description?: string
          type?: PromotionType
          value?: number
          min_purchase?: number | null
          applicable_to?: string[]
          valid_branches?: string[]
          valid_subjects?: string[]
          start_date?: string
          end_date?: string
          usage_limit?: number | null
          used_count?: number
          is_active?: boolean
        }
      }
      holidays: {
        Row: {
          id: string
          name: string
          date: string
          type: HolidayType
          branches: string[]
          description: string | null
        }
        Insert: {
          id?: string
          name: string
          date: string
          type?: HolidayType
          branches?: string[]
          description?: string | null
        }
        Update: {
          id?: string
          name?: string
          date?: string
          type?: HolidayType
          branches?: string[]
          description?: string | null
        }
      }
      teaching_materials: {
        Row: {
          id: string
          subject_id: string
          session_number: number
          title: string
          description: string | null
          objectives: string[]
          materials: string[]
          preparation: string[]
          canva_url: string
          embed_url: string
          thumbnail_url: string | null
          duration: number
          teaching_notes: string | null
          tags: string[]
          is_active: boolean
          created_at: string
          created_by: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          subject_id: string
          session_number: number
          title: string
          description?: string | null
          objectives?: string[]
          materials?: string[]
          preparation?: string[]
          canva_url: string
          embed_url: string
          thumbnail_url?: string | null
          duration: number
          teaching_notes?: string | null
          tags?: string[]
          is_active?: boolean
          created_at?: string
          created_by: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          subject_id?: string
          session_number?: number
          title?: string
          description?: string | null
          objectives?: string[]
          materials?: string[]
          preparation?: string[]
          canva_url?: string
          embed_url?: string
          thumbnail_url?: string | null
          duration?: number
          teaching_notes?: string | null
          tags?: string[]
          is_active?: boolean
          created_at?: string
          created_by?: string
          updated_at?: string | null
          updated_by?: string | null
        }
      }
      events: {
        Row: {
          id: string
          name: string
          description: string
          full_description: string | null
          image_url: string | null
          location: string
          location_url: string | null
          branch_ids: string[]
          event_type: EventType
          highlights: string[]
          target_audience: string | null
          what_to_bring: string[]
          registration_start_date: string
          registration_end_date: string
          counting_method: CountingMethod
          enable_reminder: boolean
          reminder_days_before: number
          reminder_time: string | null
          status: EventStatus
          is_active: boolean
          created_at: string
          created_by: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          name: string
          description: string
          full_description?: string | null
          image_url?: string | null
          location: string
          location_url?: string | null
          branch_ids?: string[]
          event_type: EventType
          highlights?: string[]
          target_audience?: string | null
          what_to_bring?: string[]
          registration_start_date: string
          registration_end_date: string
          counting_method?: CountingMethod
          enable_reminder?: boolean
          reminder_days_before?: number
          reminder_time?: string | null
          status?: EventStatus
          is_active?: boolean
          created_at?: string
          created_by: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          name?: string
          description?: string
          full_description?: string | null
          image_url?: string | null
          location?: string
          location_url?: string | null
          branch_ids?: string[]
          event_type?: EventType
          highlights?: string[]
          target_audience?: string | null
          what_to_bring?: string[]
          registration_start_date?: string
          registration_end_date?: string
          counting_method?: CountingMethod
          enable_reminder?: boolean
          reminder_days_before?: number
          reminder_time?: string | null
          status?: EventStatus
          is_active?: boolean
          created_at?: string
          created_by?: string
          updated_at?: string | null
          updated_by?: string | null
        }
      }
      event_schedules: {
        Row: {
          id: string
          event_id: string
          date: string
          start_time: string
          end_time: string
          max_attendees: number
          attendees_by_branch: Json
          status: EventScheduleStatus
        }
        Insert: {
          id?: string
          event_id: string
          date: string
          start_time: string
          end_time: string
          max_attendees: number
          attendees_by_branch?: Json
          status?: EventScheduleStatus
        }
        Update: {
          id?: string
          event_id?: string
          date?: string
          start_time?: string
          end_time?: string
          max_attendees?: number
          attendees_by_branch?: Json
          status?: EventScheduleStatus
        }
      }
      event_registrations: {
        Row: {
          id: string
          event_id: string
          event_name: string
          schedule_id: string
          schedule_date: string
          schedule_time: string
          branch_id: string
          is_guest: boolean
          line_user_id: string | null
          line_display_name: string | null
          line_picture_url: string | null
          parent_id: string | null
          parent_name: string
          parent_phone: string
          parent_email: string | null
          parent_address: string | null
          attendee_count: number
          status: EventRegistrationStatus
          registered_at: string
          registered_from: RegistrationSource
          cancelled_at: string | null
          cancelled_by: string | null
          cancellation_reason: string | null
          attended: boolean | null
          attendance_checked_at: string | null
          attendance_checked_by: string | null
          attendance_note: string | null
          special_request: string | null
          referral_source: string | null
        }
        Insert: {
          id?: string
          event_id: string
          event_name: string
          schedule_id: string
          schedule_date: string
          schedule_time: string
          branch_id: string
          is_guest?: boolean
          line_user_id?: string | null
          line_display_name?: string | null
          line_picture_url?: string | null
          parent_id?: string | null
          parent_name: string
          parent_phone: string
          parent_email?: string | null
          parent_address?: string | null
          attendee_count?: number
          status?: EventRegistrationStatus
          registered_at?: string
          registered_from?: RegistrationSource
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancellation_reason?: string | null
          attended?: boolean | null
          attendance_checked_at?: string | null
          attendance_checked_by?: string | null
          attendance_note?: string | null
          special_request?: string | null
          referral_source?: string | null
        }
        Update: {
          id?: string
          event_id?: string
          event_name?: string
          schedule_id?: string
          schedule_date?: string
          schedule_time?: string
          branch_id?: string
          is_guest?: boolean
          line_user_id?: string | null
          line_display_name?: string | null
          line_picture_url?: string | null
          parent_id?: string | null
          parent_name?: string
          parent_phone?: string
          parent_email?: string | null
          parent_address?: string | null
          attendee_count?: number
          status?: EventRegistrationStatus
          registered_at?: string
          registered_from?: RegistrationSource
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancellation_reason?: string | null
          attended?: boolean | null
          attendance_checked_at?: string | null
          attendance_checked_by?: string | null
          attendance_note?: string | null
          special_request?: string | null
          referral_source?: string | null
        }
      }
      event_registration_parents: {
        Row: {
          id: string
          registration_id: string
          name: string
          phone: string
          email: string | null
          is_main_contact: boolean
        }
        Insert: {
          id?: string
          registration_id: string
          name: string
          phone: string
          email?: string | null
          is_main_contact?: boolean
        }
        Update: {
          id?: string
          registration_id?: string
          name?: string
          phone?: string
          email?: string | null
          is_main_contact?: boolean
        }
      }
      event_registration_students: {
        Row: {
          id: string
          registration_id: string
          student_id: string | null
          name: string
          nickname: string
          birthdate: string
          school_name: string | null
          grade_level: string | null
        }
        Insert: {
          id?: string
          registration_id: string
          student_id?: string | null
          name: string
          nickname: string
          birthdate: string
          school_name?: string | null
          grade_level?: string | null
        }
        Update: {
          id?: string
          registration_id?: string
          student_id?: string | null
          name?: string
          nickname?: string
          birthdate?: string
          school_name?: string | null
          grade_level?: string | null
        }
      }
      link_tokens: {
        Row: {
          id: string
          token: string
          parent_id: string
          created_at: string
          expires_at: string
          used: boolean
          used_at: string | null
          linked_line_user_id: string | null
        }
        Insert: {
          id?: string
          token: string
          parent_id: string
          created_at?: string
          expires_at: string
          used?: boolean
          used_at?: string | null
          linked_line_user_id?: string | null
        }
        Update: {
          id?: string
          token?: string
          parent_id?: string
          created_at?: string
          expires_at?: string
          used?: boolean
          used_at?: string | null
          linked_line_user_id?: string | null
        }
      }
      student_feedback: {
        Row: {
          id: string
          student_id: string
          parent_id: string
          class_id: string
          class_name: string
          subject_id: string
          subject_name: string
          schedule_id: string
          session_number: number
          session_date: string
          feedback: string
          teacher_id: string
          teacher_name: string
          created_at: string
        }
        Insert: {
          id?: string
          student_id: string
          parent_id: string
          class_id: string
          class_name: string
          subject_id: string
          subject_name: string
          schedule_id: string
          session_number: number
          session_date: string
          feedback: string
          teacher_id: string
          teacher_name: string
          created_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          parent_id?: string
          class_id?: string
          class_name?: string
          subject_id?: string
          subject_name?: string
          schedule_id?: string
          session_number?: number
          session_date?: string
          feedback?: string
          teacher_id?: string
          teacher_name?: string
          created_at?: string
        }
      }
      fb_conversion_logs: {
        Row: {
          id: string
          event_type: string
          fb_event_name: string
          event_id: string
          member_id: string | null
          reference_id: string | null
          phone_hash: string | null
          email_hash: string | null
          payload: Json | null
          fb_response: Json | null
          fb_status: string
          audience_actions: Json | null
          audience_status: string
          is_resend: boolean
          original_log_id: string | null
          retry_count: number
          branch_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          event_type: string
          fb_event_name: string
          event_id: string
          member_id?: string | null
          reference_id?: string | null
          phone_hash?: string | null
          email_hash?: string | null
          payload?: Json | null
          fb_response?: Json | null
          fb_status?: string
          audience_actions?: Json | null
          audience_status?: string
          is_resend?: boolean
          original_log_id?: string | null
          retry_count?: number
          branch_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          event_type?: string
          fb_event_name?: string
          event_id?: string
          member_id?: string | null
          reference_id?: string | null
          phone_hash?: string | null
          email_hash?: string | null
          payload?: Json | null
          fb_response?: Json | null
          fb_status?: string
          audience_actions?: Json | null
          audience_status?: string
          is_resend?: boolean
          original_log_id?: string | null
          retry_count?: number
          branch_id?: string | null
          created_at?: string
        }
      }
      settings: {
        Row: {
          id: string
          key: string
          value: Json
          description: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          key: string
          value: Json
          description?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          key?: string
          value?: Json
          description?: string | null
          updated_at?: string
          updated_by?: string | null
        }
      }
    }
    Views: {
      v_students_with_parents: {
        Row: {
          id: string
          parent_id: string
          name: string
          nickname: string
          birthdate: string
          gender: GenderType
          school_name: string | null
          grade_level: string | null
          profile_image: string | null
          allergies: string | null
          special_needs: string | null
          emergency_contact: string | null
          emergency_phone: string | null
          is_active: boolean
          parent_name: string
          parent_phone: string
          parent_line_user_id: string | null
          parent_email: string | null
        }
      }
      v_classes_full: {
        Row: {
          id: string
          subject_id: string
          teacher_id: string
          branch_id: string
          room_id: string
          name: string
          code: string
          description: string | null
          start_date: string
          end_date: string
          total_sessions: number
          days_of_week: number[]
          start_time: string
          end_time: string
          max_students: number
          min_students: number
          enrolled_count: number
          price_per_session: number
          total_price: number
          material_fee: number | null
          registration_fee: number | null
          status: ClassStatus
          created_at: string
          subject_name: string
          subject_code: string
          subject_category: SubjectCategory
          teacher_name: string
          teacher_nickname: string | null
          branch_name: string
          branch_code: string
          room_name: string
        }
      }
      v_enrollments_full: {
        Row: {
          id: string
          student_id: string
          class_id: string
          parent_id: string
          branch_id: string
          enrolled_at: string
          status: EnrollmentStatus
          original_price: number
          discount: number
          discount_type: DiscountType
          final_price: number
          promotion_code: string | null
          payment_method: PaymentMethod
          payment_status: PaymentStatus
          paid_amount: number
          paid_date: string | null
          receipt_number: string | null
          transferred_from: string | null
          dropped_reason: string | null
          student_name: string
          student_nickname: string
          parent_name: string
          parent_phone: string
          class_name: string
          class_code: string
          subject_name: string
          branch_name: string
        }
      }
    }
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_super_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      get_admin_branch_ids: {
        Args: Record<PropertyKey, never>
        Returns: string[] | null
      }
      admin_has_branch_access: {
        Args: { target_branch_id: string }
        Returns: boolean
      }
      get_parent_id_from_line: {
        Args: Record<PropertyKey, never>
        Returns: string | null
      }
    }
    Enums: {
      admin_role: AdminRole
      gender_type: GenderType
      subject_category: SubjectCategory
      subject_level: SubjectLevel
      class_status: ClassStatus
      schedule_status: ScheduleStatus
      attendance_status: AttendanceStatus
      enrollment_status: EnrollmentStatus
      discount_type: DiscountType
      payment_method: PaymentMethod
      payment_status: PaymentStatus
      trial_source: TrialSource
      trial_booking_status: TrialBookingStatus
      trial_session_status: TrialSessionStatus
      interest_level: InterestLevel
      notification_type: NotificationType
      promotion_type: PromotionType
      holiday_type: HolidayType
      makeup_type: MakeupType
      makeup_status: MakeupStatus
      makeup_attendance_status: MakeupAttendanceStatus
      event_type: EventType
      event_status: EventStatus
      event_schedule_status: EventScheduleStatus
      event_registration_status: EventRegistrationStatus
      registration_source: RegistrationSource
      counting_method: CountingMethod
    }
  }
}

// Helper types for easier usage
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
export type Views<T extends keyof Database['public']['Views']> = Database['public']['Views'][T]['Row']

// Commonly used types
export type Branch = Tables<'branches'>
export type Room = Tables<'rooms'>
export type Parent = Tables<'parents'>
export type Student = Tables<'students'>
export type Teacher = Tables<'teachers'>
export type AdminUser = Tables<'admin_users'>
export type Subject = Tables<'subjects'>
export type Class = Tables<'classes'>
export type ClassSchedule = Tables<'class_schedules'>
export type Attendance = Tables<'attendance'>
export type Enrollment = Tables<'enrollments'>
export type TrialBooking = Tables<'trial_bookings'>
export type TrialSession = Tables<'trial_sessions'>
export type MakeupClass = Tables<'makeup_classes'>
export type Notification = Tables<'notifications'>
export type Promotion = Tables<'promotions'>
export type Holiday = Tables<'holidays'>
export type TeachingMaterial = Tables<'teaching_materials'>
export type Event = Tables<'events'>
export type EventSchedule = Tables<'event_schedules'>
export type EventRegistration = Tables<'event_registrations'>
export type LinkToken = Tables<'link_tokens'>
export type StudentFeedback = Tables<'student_feedback'>
export type Setting = Tables<'settings'>

// View types
export type StudentWithParent = Views<'v_students_with_parents'>
export type ClassFull = Views<'v_classes_full'>
export type EnrollmentFull = Views<'v_enrollments_full'>
