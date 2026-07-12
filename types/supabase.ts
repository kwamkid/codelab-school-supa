// AUTO-GENERATED from Supabase (project yzgvmyyuthfarytrszfe) — do not hand-edit the Database interface.
// Regenerate via: supabase gen types typescript (or the Supabase MCP generate_typescript_types tool).

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_invitations: {
        Row: {
          branch_ids: string[] | null
          can_manage_all_branches: boolean | null
          can_manage_settings: boolean | null
          can_manage_users: boolean | null
          can_view_reports: boolean | null
          created_at: string
          created_by: string | null
          display_name: string | null
          email: string | null
          expires_at: string
          id: string
          nickname: string | null
          revoked_at: string | null
          revoked_by: string | null
          role: Database["public"]["Enums"]["admin_role"]
          teacher_data: Json | null
          token: string
          used_at: string | null
          used_by_auth_id: string | null
          used_by_email: string | null
        }
        Insert: {
          branch_ids?: string[] | null
          can_manage_all_branches?: boolean | null
          can_manage_settings?: boolean | null
          can_manage_users?: boolean | null
          can_view_reports?: boolean | null
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          email?: string | null
          expires_at: string
          id?: string
          nickname?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          role?: Database["public"]["Enums"]["admin_role"]
          teacher_data?: Json | null
          token: string
          used_at?: string | null
          used_by_auth_id?: string | null
          used_by_email?: string | null
        }
        Update: {
          branch_ids?: string[] | null
          can_manage_all_branches?: boolean | null
          can_manage_settings?: boolean | null
          can_manage_users?: boolean | null
          can_view_reports?: boolean | null
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          email?: string | null
          expires_at?: string
          id?: string
          nickname?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          role?: Database["public"]["Enums"]["admin_role"]
          teacher_data?: Json | null
          token?: string
          used_at?: string | null
          used_by_auth_id?: string | null
          used_by_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_invitations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_invitations_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_users: {
        Row: {
          auth_user_id: string | null
          branch_ids: string[] | null
          can_manage_all_branches: boolean | null
          can_manage_settings: boolean | null
          can_manage_users: boolean | null
          can_view_reports: boolean | null
          created_at: string
          created_by: string | null
          display_name: string
          email: string
          id: string
          is_active: boolean
          nickname: string | null
          role: Database["public"]["Enums"]["admin_role"]
          teacher_id: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          auth_user_id?: string | null
          branch_ids?: string[] | null
          can_manage_all_branches?: boolean | null
          can_manage_settings?: boolean | null
          can_manage_users?: boolean | null
          can_view_reports?: boolean | null
          created_at?: string
          created_by?: string | null
          display_name: string
          email: string
          id?: string
          is_active?: boolean
          nickname?: string | null
          role?: Database["public"]["Enums"]["admin_role"]
          teacher_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          auth_user_id?: string | null
          branch_ids?: string[] | null
          can_manage_all_branches?: boolean | null
          can_manage_settings?: boolean | null
          can_manage_users?: boolean | null
          can_view_reports?: boolean | null
          created_at?: string
          created_by?: string | null
          display_name?: string
          email?: string
          id?: string
          is_active?: boolean
          nickname?: string | null
          role?: Database["public"]["Enums"]["admin_role"]
          teacher_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_users_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          checked_at: string | null
          checked_by: string | null
          feedback: string | null
          id: string
          note: string | null
          photos: string[]
          schedule_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
        }
        Insert: {
          checked_at?: string | null
          checked_by?: string | null
          feedback?: string | null
          id?: string
          note?: string | null
          photos?: string[]
          schedule_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
        }
        Update: {
          checked_at?: string | null
          checked_by?: string | null
          feedback?: string | null
          id?: string
          note?: string | null
          photos?: string[]
          schedule_id?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "class_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      backup_logs: {
        Row: {
          backup_date: string
          created_at: string | null
          duration_ms: number | null
          error_message: string | null
          file_name: string
          file_size_bytes: number | null
          id: string
          status: string
          tables_count: number | null
          total_rows: number | null
        }
        Insert: {
          backup_date?: string
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          file_name: string
          file_size_bytes?: number | null
          id?: string
          status: string
          tables_count?: number | null
          total_rows?: number | null
        }
        Update: {
          backup_date?: string
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          file_name?: string
          file_size_bytes?: number | null
          id?: string
          status?: string
          tables_count?: number | null
          total_rows?: number | null
        }
        Relationships: []
      }
      branch_payment_settings: {
        Row: {
          bank_accounts: Json
          branch_id: string
          enabled_methods: string[]
          id: string
          online_payment_config: Json | null
          online_payment_enabled: boolean
          online_payment_provider: string | null
          promptpay_name: string | null
          promptpay_number: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bank_accounts?: Json
          branch_id: string
          enabled_methods?: string[]
          id?: string
          online_payment_config?: Json | null
          online_payment_enabled?: boolean
          online_payment_provider?: string | null
          promptpay_name?: string | null
          promptpay_number?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bank_accounts?: Json
          branch_id?: string
          enabled_methods?: string[]
          id?: string
          online_payment_config?: Json | null
          online_payment_enabled?: boolean
          online_payment_provider?: string | null
          promptpay_name?: string | null
          promptpay_number?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branch_payment_settings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: true
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string
          close_time: string
          code: string
          created_at: string
          id: string
          invoice_company_id: string | null
          is_active: boolean
          line_group_url: string | null
          location_lat: number | null
          location_lng: number | null
          manager_name: string | null
          manager_phone: string | null
          name: string
          open_days: number[]
          open_time: string
          phone: string
        }
        Insert: {
          address: string
          close_time?: string
          code: string
          created_at?: string
          id?: string
          invoice_company_id?: string | null
          is_active?: boolean
          line_group_url?: string | null
          location_lat?: number | null
          location_lng?: number | null
          manager_name?: string | null
          manager_phone?: string | null
          name: string
          open_days?: number[]
          open_time?: string
          phone: string
        }
        Update: {
          address?: string
          close_time?: string
          code?: string
          created_at?: string
          id?: string
          invoice_company_id?: string | null
          is_active?: boolean
          line_group_url?: string | null
          location_lat?: number | null
          location_lng?: number | null
          manager_name?: string | null
          manager_phone?: string | null
          name?: string
          open_days?: number[]
          open_time?: string
          phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_invoice_company_id_fkey"
            columns: ["invoice_company_id"]
            isOneToOne: false
            referencedRelation: "invoice_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_channels: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          credentials: Json
          id: string
          is_active: boolean | null
          name: string
          platform_avatar_url: string | null
          platform_id: string | null
          platform_name: string | null
          type: string
          updated_at: string | null
          webhook_secret: string | null
          webhook_verified: boolean | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          credentials?: Json
          id?: string
          is_active?: boolean | null
          name: string
          platform_avatar_url?: string | null
          platform_id?: string | null
          platform_name?: string | null
          type: string
          updated_at?: string | null
          webhook_secret?: string | null
          webhook_verified?: boolean | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          credentials?: Json
          id?: string
          is_active?: boolean | null
          name?: string
          platform_avatar_url?: string | null
          platform_id?: string | null
          platform_name?: string | null
          type?: string
          updated_at?: string | null
          webhook_secret?: string | null
          webhook_verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_channels_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_contacts: {
        Row: {
          avatar_url: string | null
          branch_ids: string[] | null
          channel_id: string
          created_at: string
          custom_data: Json | null
          display_name: string | null
          email: string | null
          group_id: string | null
          id: string
          is_group: boolean | null
          last_message_at: string | null
          member_count: number | null
          parent_id: string | null
          phone: string | null
          platform_user_id: string
          tags: string[] | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          branch_ids?: string[] | null
          channel_id: string
          created_at?: string
          custom_data?: Json | null
          display_name?: string | null
          email?: string | null
          group_id?: string | null
          id?: string
          is_group?: boolean | null
          last_message_at?: string | null
          member_count?: number | null
          parent_id?: string | null
          phone?: string | null
          platform_user_id: string
          tags?: string[] | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          branch_ids?: string[] | null
          channel_id?: string
          created_at?: string
          custom_data?: Json | null
          display_name?: string | null
          email?: string | null
          group_id?: string | null
          id?: string
          is_group?: boolean | null
          last_message_at?: string | null
          member_count?: number | null
          parent_id?: string | null
          phone?: string | null
          platform_user_id?: string
          tags?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_contacts_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "chat_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_contacts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          assigned_to: string | null
          channel_id: string
          contact_id: string
          created_at: string
          enrollment_id: string | null
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          status: string
          trial_booking_id: string | null
          unread_count: number | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          channel_id: string
          contact_id: string
          created_at?: string
          enrollment_id?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          status?: string
          trial_booking_id?: string | null
          unread_count?: number | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          channel_id?: string
          contact_id?: string
          created_at?: string
          enrollment_id?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          status?: string
          trial_booking_id?: string | null
          unread_count?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "chat_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "chat_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          direction: string
          error_message: string | null
          id: string
          media_metadata: Json | null
          media_url: string | null
          message_type: string
          metadata: Json | null
          platform_message_id: string | null
          sender_avatar_url: string | null
          sender_id: string | null
          sender_name: string | null
          sender_type: string
          status: string | null
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          direction: string
          error_message?: string | null
          id?: string
          media_metadata?: Json | null
          media_url?: string | null
          message_type?: string
          metadata?: Json | null
          platform_message_id?: string | null
          sender_avatar_url?: string | null
          sender_id?: string | null
          sender_name?: string | null
          sender_type: string
          status?: string | null
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          direction?: string
          error_message?: string | null
          id?: string
          media_metadata?: Json | null
          media_url?: string | null
          message_type?: string
          metadata?: Json | null
          platform_message_id?: string | null
          sender_avatar_url?: string | null
          sender_id?: string | null
          sender_name?: string | null
          sender_type?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_quick_replies: {
        Row: {
          category: string | null
          content: string
          created_at: string
          created_by: string | null
          id: string
          image_url: string | null
          images: Json | null
          is_active: boolean | null
          sort_order: number | null
          title: string
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          images?: Json | null
          is_active?: boolean | null
          sort_order?: number | null
          title: string
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          images?: Json | null
          is_active?: boolean | null
          sort_order?: number | null
          title?: string
        }
        Relationships: []
      }
      class_schedules: {
        Row: {
          actual_end_time: string | null
          actual_room_id: string | null
          actual_start_time: string | null
          actual_teacher_id: string | null
          class_id: string
          id: string
          note: string | null
          original_date: string | null
          rescheduled_at: string | null
          rescheduled_by: string | null
          session_date: string
          session_number: number
          status: Database["public"]["Enums"]["schedule_status"]
          topic: string | null
        }
        Insert: {
          actual_end_time?: string | null
          actual_room_id?: string | null
          actual_start_time?: string | null
          actual_teacher_id?: string | null
          class_id: string
          id?: string
          note?: string | null
          original_date?: string | null
          rescheduled_at?: string | null
          rescheduled_by?: string | null
          session_date: string
          session_number: number
          status?: Database["public"]["Enums"]["schedule_status"]
          topic?: string | null
        }
        Update: {
          actual_end_time?: string | null
          actual_room_id?: string | null
          actual_start_time?: string | null
          actual_teacher_id?: string | null
          class_id?: string
          id?: string
          note?: string | null
          original_date?: string | null
          rescheduled_at?: string | null
          rescheduled_by?: string | null
          session_date?: string
          session_number?: number
          status?: Database["public"]["Enums"]["schedule_status"]
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_schedules_actual_room_id_fkey"
            columns: ["actual_room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_schedules_actual_teacher_id_fkey"
            columns: ["actual_teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_schedules_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_schedules_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "v_classes_full"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          branch_id: string
          code: string
          created_at: string
          days_of_week: number[]
          description: string | null
          end_date: string
          end_time: string
          enrolled_count: number
          id: string
          material_fee: number | null
          max_students: number
          min_students: number
          name: string
          pause_from: string | null
          pause_to: string | null
          price_per_session: number
          registration_fee: number | null
          room_id: string
          start_date: string
          start_time: string
          status: Database["public"]["Enums"]["class_status"]
          subject_id: string
          teacher_id: string
          total_price: number
          total_sessions: number
        }
        Insert: {
          branch_id: string
          code: string
          created_at?: string
          days_of_week?: number[]
          description?: string | null
          end_date: string
          end_time: string
          enrolled_count?: number
          id?: string
          material_fee?: number | null
          max_students?: number
          min_students?: number
          name: string
          pause_from?: string | null
          pause_to?: string | null
          price_per_session: number
          registration_fee?: number | null
          room_id: string
          start_date: string
          start_time: string
          status?: Database["public"]["Enums"]["class_status"]
          subject_id: string
          teacher_id: string
          total_price: number
          total_sessions: number
        }
        Update: {
          branch_id?: string
          code?: string
          created_at?: string
          days_of_week?: number[]
          description?: string | null
          end_date?: string
          end_time?: string
          enrolled_count?: number
          id?: string
          material_fee?: number | null
          max_students?: number
          min_students?: number
          name?: string
          pause_from?: string | null
          pause_to?: string | null
          price_per_session?: number
          registration_fee?: number | null
          room_id?: string
          start_date?: string
          start_time?: string
          status?: Database["public"]["Enums"]["class_status"]
          subject_id?: string
          teacher_id?: string
          total_price?: number
          total_sessions?: number
        }
        Relationships: [
          {
            foreignKeyName: "classes_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_notes: {
        Row: {
          billing_address: Json | null
          billing_company_branch: string | null
          billing_name: string | null
          billing_tax_id: string | null
          billing_type: string | null
          branch_id: string
          created_at: string | null
          created_by: string | null
          credit_note_number: string
          customer_address: Json | null
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          customer_tax_id: string | null
          document_type: string
          enrollment_id: string | null
          id: string
          invoice_company_id: string
          issued_date: string | null
          items: Json
          payment_date: string | null
          reason: string
          receipt_id: string | null
          refund_amount: number
          refund_type: string
          status: string
          tax_invoice_id: string | null
          updated_at: string | null
          vat_amount: number
        }
        Insert: {
          billing_address?: Json | null
          billing_company_branch?: string | null
          billing_name?: string | null
          billing_tax_id?: string | null
          billing_type?: string | null
          branch_id: string
          created_at?: string | null
          created_by?: string | null
          credit_note_number: string
          customer_address?: Json | null
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          customer_tax_id?: string | null
          document_type?: string
          enrollment_id?: string | null
          id?: string
          invoice_company_id: string
          issued_date?: string | null
          items?: Json
          payment_date?: string | null
          reason: string
          receipt_id?: string | null
          refund_amount: number
          refund_type?: string
          status?: string
          tax_invoice_id?: string | null
          updated_at?: string | null
          vat_amount?: number
        }
        Update: {
          billing_address?: Json | null
          billing_company_branch?: string | null
          billing_name?: string | null
          billing_tax_id?: string | null
          billing_type?: string | null
          branch_id?: string
          created_at?: string | null
          created_by?: string | null
          credit_note_number?: string
          customer_address?: Json | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          customer_tax_id?: string | null
          document_type?: string
          enrollment_id?: string | null
          id?: string
          invoice_company_id?: string
          issued_date?: string | null
          items?: Json
          payment_date?: string | null
          reason?: string
          receipt_id?: string | null
          refund_amount?: number
          refund_type?: string
          status?: string
          tax_invoice_id?: string | null
          updated_at?: string | null
          vat_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "credit_notes_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_tax_invoice_id_fkey"
            columns: ["tax_invoice_id"]
            isOneToOne: false
            referencedRelation: "tax_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollment_transfer_history: {
        Row: {
          enrollment_id: string
          from_class_id: string
          id: string
          reason: string | null
          to_class_id: string
          transferred_at: string
        }
        Insert: {
          enrollment_id: string
          from_class_id: string
          id?: string
          reason?: string | null
          to_class_id: string
          transferred_at?: string
        }
        Update: {
          enrollment_id?: string
          from_class_id?: string
          id?: string
          reason?: string | null
          to_class_id?: string
          transferred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_transfer_history_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_transfer_history_from_class_id_fkey"
            columns: ["from_class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_transfer_history_from_class_id_fkey"
            columns: ["from_class_id"]
            isOneToOne: false
            referencedRelation: "v_classes_full"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_transfer_history_to_class_id_fkey"
            columns: ["to_class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_transfer_history_to_class_id_fkey"
            columns: ["to_class_id"]
            isOneToOne: false
            referencedRelation: "v_classes_full"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          branch_id: string
          class_id: string
          discount: number
          discount_type: Database["public"]["Enums"]["discount_type"]
          dropped_reason: string | null
          enrolled_at: string
          final_price: number
          id: string
          original_price: number
          paid_amount: number
          paid_date: string | null
          parent_id: string
          payment_method: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          payment_type: string
          promotion_code: string | null
          receipt_number: string | null
          status: Database["public"]["Enums"]["enrollment_status"]
          student_id: string
          transferred_from: string | null
          updated_at: string | null
        }
        Insert: {
          branch_id: string
          class_id: string
          discount?: number
          discount_type?: Database["public"]["Enums"]["discount_type"]
          dropped_reason?: string | null
          enrolled_at?: string
          final_price: number
          id?: string
          original_price: number
          paid_amount?: number
          paid_date?: string | null
          parent_id: string
          payment_method?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          payment_type?: string
          promotion_code?: string | null
          receipt_number?: string | null
          status?: Database["public"]["Enums"]["enrollment_status"]
          student_id: string
          transferred_from?: string | null
          updated_at?: string | null
        }
        Update: {
          branch_id?: string
          class_id?: string
          discount?: number
          discount_type?: Database["public"]["Enums"]["discount_type"]
          dropped_reason?: string | null
          enrolled_at?: string
          final_price?: number
          id?: string
          original_price?: number
          paid_amount?: number
          paid_date?: string | null
          parent_id?: string
          payment_method?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          payment_type?: string
          promotion_code?: string | null
          receipt_number?: string | null
          status?: Database["public"]["Enums"]["enrollment_status"]
          student_id?: string
          transferred_from?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "v_classes_full"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_transferred_from_fkey"
            columns: ["transferred_from"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_transferred_from_fkey"
            columns: ["transferred_from"]
            isOneToOne: false
            referencedRelation: "v_classes_full"
            referencedColumns: ["id"]
          },
        ]
      }
      event_registration_parents: {
        Row: {
          email: string | null
          id: string
          is_main_contact: boolean
          name: string
          phone: string
          registration_id: string
        }
        Insert: {
          email?: string | null
          id?: string
          is_main_contact?: boolean
          name: string
          phone: string
          registration_id: string
        }
        Update: {
          email?: string | null
          id?: string
          is_main_contact?: boolean
          name?: string
          phone?: string
          registration_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_registration_parents_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "event_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_registration_students: {
        Row: {
          birthdate: string
          grade_level: string | null
          id: string
          name: string
          nickname: string
          registration_id: string
          school_name: string | null
          student_id: string | null
        }
        Insert: {
          birthdate: string
          grade_level?: string | null
          id?: string
          name: string
          nickname: string
          registration_id: string
          school_name?: string | null
          student_id?: string | null
        }
        Update: {
          birthdate?: string
          grade_level?: string | null
          id?: string
          name?: string
          nickname?: string
          registration_id?: string
          school_name?: string | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_registration_students_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "event_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registration_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      event_registrations: {
        Row: {
          attendance_checked_at: string | null
          attendance_checked_by: string | null
          attendance_note: string | null
          attended: boolean | null
          attendee_count: number
          branch_id: string
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          event_id: string
          event_name: string
          id: string
          is_guest: boolean
          line_display_name: string | null
          line_picture_url: string | null
          line_user_id: string | null
          parent_address: string | null
          parent_email: string | null
          parent_id: string | null
          parent_name: string
          parent_phone: string
          parents: Json | null
          referral_source: string | null
          registered_at: string
          registered_from: Database["public"]["Enums"]["registration_source"]
          schedule_date: string
          schedule_id: string
          schedule_time: string
          special_request: string | null
          status: Database["public"]["Enums"]["event_registration_status"]
          students: Json | null
        }
        Insert: {
          attendance_checked_at?: string | null
          attendance_checked_by?: string | null
          attendance_note?: string | null
          attended?: boolean | null
          attendee_count?: number
          branch_id: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          event_id: string
          event_name: string
          id?: string
          is_guest?: boolean
          line_display_name?: string | null
          line_picture_url?: string | null
          line_user_id?: string | null
          parent_address?: string | null
          parent_email?: string | null
          parent_id?: string | null
          parent_name: string
          parent_phone: string
          parents?: Json | null
          referral_source?: string | null
          registered_at?: string
          registered_from?: Database["public"]["Enums"]["registration_source"]
          schedule_date: string
          schedule_id: string
          schedule_time: string
          special_request?: string | null
          status?: Database["public"]["Enums"]["event_registration_status"]
          students?: Json | null
        }
        Update: {
          attendance_checked_at?: string | null
          attendance_checked_by?: string | null
          attendance_note?: string | null
          attended?: boolean | null
          attendee_count?: number
          branch_id?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          event_id?: string
          event_name?: string
          id?: string
          is_guest?: boolean
          line_display_name?: string | null
          line_picture_url?: string | null
          line_user_id?: string | null
          parent_address?: string | null
          parent_email?: string | null
          parent_id?: string | null
          parent_name?: string
          parent_phone?: string
          parents?: Json | null
          referral_source?: string | null
          registered_at?: string
          registered_from?: Database["public"]["Enums"]["registration_source"]
          schedule_date?: string
          schedule_id?: string
          schedule_time?: string
          special_request?: string | null
          status?: Database["public"]["Enums"]["event_registration_status"]
          students?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "event_registrations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "event_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      event_schedules: {
        Row: {
          attendees_by_branch: Json | null
          date: string
          end_time: string
          event_id: string
          id: string
          max_attendees: number
          max_attendees_by_branch: Json | null
          start_time: string
          status: Database["public"]["Enums"]["event_schedule_status"]
        }
        Insert: {
          attendees_by_branch?: Json | null
          date: string
          end_time: string
          event_id: string
          id?: string
          max_attendees: number
          max_attendees_by_branch?: Json | null
          start_time: string
          status?: Database["public"]["Enums"]["event_schedule_status"]
        }
        Update: {
          attendees_by_branch?: Json | null
          date?: string
          end_time?: string
          event_id?: string
          id?: string
          max_attendees?: number
          max_attendees_by_branch?: Json | null
          start_time?: string
          status?: Database["public"]["Enums"]["event_schedule_status"]
        }
        Relationships: [
          {
            foreignKeyName: "event_schedules_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          branch_ids: string[]
          counting_method: Database["public"]["Enums"]["counting_method"]
          created_at: string
          created_by: string
          description: string
          enable_reminder: boolean
          event_type: Database["public"]["Enums"]["event_type"]
          full_description: string | null
          highlights: string[] | null
          id: string
          image_url: string | null
          is_active: boolean
          location: string
          location_url: string | null
          name: string
          registration_end_date: string
          registration_start_date: string
          reminder_days_before: number
          reminder_time: string | null
          status: Database["public"]["Enums"]["event_status"]
          target_audience: string | null
          updated_at: string | null
          updated_by: string | null
          view_count: number | null
          what_to_bring: string[] | null
        }
        Insert: {
          branch_ids?: string[]
          counting_method?: Database["public"]["Enums"]["counting_method"]
          created_at?: string
          created_by: string
          description: string
          enable_reminder?: boolean
          event_type: Database["public"]["Enums"]["event_type"]
          full_description?: string | null
          highlights?: string[] | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          location: string
          location_url?: string | null
          name: string
          registration_end_date: string
          registration_start_date: string
          reminder_days_before?: number
          reminder_time?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          target_audience?: string | null
          updated_at?: string | null
          updated_by?: string | null
          view_count?: number | null
          what_to_bring?: string[] | null
        }
        Update: {
          branch_ids?: string[]
          counting_method?: Database["public"]["Enums"]["counting_method"]
          created_at?: string
          created_by?: string
          description?: string
          enable_reminder?: boolean
          event_type?: Database["public"]["Enums"]["event_type"]
          full_description?: string | null
          highlights?: string[] | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          location?: string
          location_url?: string | null
          name?: string
          registration_end_date?: string
          registration_start_date?: string
          reminder_days_before?: number
          reminder_time?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          target_audience?: string | null
          updated_at?: string | null
          updated_by?: string | null
          view_count?: number | null
          what_to_bring?: string[] | null
        }
        Relationships: []
      }
      fb_conversion_logs: {
        Row: {
          audience_actions: Json | null
          audience_status: string | null
          branch_id: string | null
          created_at: string | null
          email_hash: string | null
          event_id: string
          event_type: string
          fb_event_name: string
          fb_response: Json | null
          fb_status: string | null
          id: string
          is_resend: boolean | null
          member_id: string | null
          original_log_id: string | null
          payload: Json | null
          phone_hash: string | null
          reference_id: string | null
          retry_count: number | null
        }
        Insert: {
          audience_actions?: Json | null
          audience_status?: string | null
          branch_id?: string | null
          created_at?: string | null
          email_hash?: string | null
          event_id: string
          event_type: string
          fb_event_name: string
          fb_response?: Json | null
          fb_status?: string | null
          id?: string
          is_resend?: boolean | null
          member_id?: string | null
          original_log_id?: string | null
          payload?: Json | null
          phone_hash?: string | null
          reference_id?: string | null
          retry_count?: number | null
        }
        Update: {
          audience_actions?: Json | null
          audience_status?: string | null
          branch_id?: string | null
          created_at?: string | null
          email_hash?: string | null
          event_id?: string
          event_type?: string
          fb_event_name?: string
          fb_response?: Json | null
          fb_status?: string | null
          id?: string
          is_resend?: boolean | null
          member_id?: string | null
          original_log_id?: string | null
          payload?: Json | null
          phone_hash?: string | null
          reference_id?: string | null
          retry_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fb_conversion_logs_original_log_id_fkey"
            columns: ["original_log_id"]
            isOneToOne: false
            referencedRelation: "fb_conversion_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays: {
        Row: {
          branches: string[] | null
          date: string
          description: string | null
          id: string
          name: string
          type: Database["public"]["Enums"]["holiday_type"]
        }
        Insert: {
          branches?: string[] | null
          date: string
          description?: string | null
          id?: string
          name: string
          type?: Database["public"]["Enums"]["holiday_type"]
        }
        Update: {
          branches?: string[] | null
          date?: string
          description?: string | null
          id?: string
          name?: string
          type?: Database["public"]["Enums"]["holiday_type"]
        }
        Relationships: []
      }
      invoice_companies: {
        Row: {
          address: Json | null
          branch_label: string | null
          created_at: string
          credit_note_prefix: string
          current_credit_note_month: string | null
          current_invoice_month: string | null
          current_refund_note_month: string | null
          current_tax_invoice_month: string | null
          email: string | null
          id: string
          invoice_prefix: string
          is_active: boolean
          is_vat_registered: boolean
          name: string
          next_credit_note_number: number
          next_invoice_number: number
          next_refund_note_number: number
          next_tax_invoice_number: number
          phone: string | null
          refund_note_prefix: string
          tax_id: string | null
          tax_invoice_prefix: string
          updated_at: string
        }
        Insert: {
          address?: Json | null
          branch_label?: string | null
          created_at?: string
          credit_note_prefix?: string
          current_credit_note_month?: string | null
          current_invoice_month?: string | null
          current_refund_note_month?: string | null
          current_tax_invoice_month?: string | null
          email?: string | null
          id?: string
          invoice_prefix?: string
          is_active?: boolean
          is_vat_registered?: boolean
          name: string
          next_credit_note_number?: number
          next_invoice_number?: number
          next_refund_note_number?: number
          next_tax_invoice_number?: number
          phone?: string | null
          refund_note_prefix?: string
          tax_id?: string | null
          tax_invoice_prefix?: string
          updated_at?: string
        }
        Update: {
          address?: Json | null
          branch_label?: string | null
          created_at?: string
          credit_note_prefix?: string
          current_credit_note_month?: string | null
          current_invoice_month?: string | null
          current_refund_note_month?: string | null
          current_tax_invoice_month?: string | null
          email?: string | null
          id?: string
          invoice_prefix?: string
          is_active?: boolean
          is_vat_registered?: boolean
          name?: string
          next_credit_note_number?: number
          next_invoice_number?: number
          next_refund_note_number?: number
          next_tax_invoice_number?: number
          phone?: string | null
          refund_note_prefix?: string
          tax_id?: string | null
          tax_invoice_prefix?: string
          updated_at?: string
        }
        Relationships: []
      }
      line_notification_queue: {
        Row: {
          created_at: string
          id: string
          last_error: string | null
          payload: Json | null
          ref_id: string | null
          retry_count: number
          schedule_id: string | null
          sent_at: string | null
          status: string
          student_id: string | null
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_error?: string | null
          payload?: Json | null
          ref_id?: string | null
          retry_count?: number
          schedule_id?: string | null
          sent_at?: string | null
          status?: string
          student_id?: string | null
          type?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_error?: string | null
          payload?: Json | null
          ref_id?: string | null
          retry_count?: number
          schedule_id?: string | null
          sent_at?: string | null
          status?: string
          student_id?: string | null
          type?: string
        }
        Relationships: []
      }
      link_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          linked_line_user_id: string | null
          parent_id: string
          token: string
          used: boolean
          used_at: string | null
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          linked_line_user_id?: string | null
          parent_id: string
          token: string
          used?: boolean
          used_at?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          linked_line_user_id?: string | null
          parent_id?: string
          token?: string
          used?: boolean
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "link_tokens_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
        ]
      }
      makeup_classes: {
        Row: {
          attendance_checked_at: string | null
          attendance_checked_by: string | null
          attendance_note: string | null
          attendance_status:
            | Database["public"]["Enums"]["makeup_attendance_status"]
            | null
          branch_id: string
          branch_name: string
          class_code: string
          class_name: string
          counts_toward_quota: boolean
          created_at: string
          id: string
          makeup_branch_id: string | null
          makeup_confirmed_at: string | null
          makeup_confirmed_by: string | null
          makeup_date: string | null
          makeup_end_time: string | null
          makeup_room_id: string | null
          makeup_room_name: string | null
          makeup_start_time: string | null
          makeup_teacher_id: string | null
          makeup_teacher_name: string | null
          notes: string | null
          original_class_id: string
          original_schedule_id: string
          original_session_date: string | null
          original_session_number: number | null
          parent_id: string
          parent_line_user_id: string | null
          parent_name: string
          parent_phone: string
          reason: string
          request_date: string
          requested_by: string
          status: Database["public"]["Enums"]["makeup_status"]
          student_id: string
          student_name: string
          student_nickname: string
          subject_id: string
          subject_name: string
          type: Database["public"]["Enums"]["makeup_type"]
          updated_at: string | null
        }
        Insert: {
          attendance_checked_at?: string | null
          attendance_checked_by?: string | null
          attendance_note?: string | null
          attendance_status?:
            | Database["public"]["Enums"]["makeup_attendance_status"]
            | null
          branch_id: string
          branch_name: string
          class_code: string
          class_name: string
          counts_toward_quota?: boolean
          created_at?: string
          id?: string
          makeup_branch_id?: string | null
          makeup_confirmed_at?: string | null
          makeup_confirmed_by?: string | null
          makeup_date?: string | null
          makeup_end_time?: string | null
          makeup_room_id?: string | null
          makeup_room_name?: string | null
          makeup_start_time?: string | null
          makeup_teacher_id?: string | null
          makeup_teacher_name?: string | null
          notes?: string | null
          original_class_id: string
          original_schedule_id: string
          original_session_date?: string | null
          original_session_number?: number | null
          parent_id: string
          parent_line_user_id?: string | null
          parent_name: string
          parent_phone: string
          reason: string
          request_date: string
          requested_by: string
          status?: Database["public"]["Enums"]["makeup_status"]
          student_id: string
          student_name: string
          student_nickname: string
          subject_id: string
          subject_name: string
          type?: Database["public"]["Enums"]["makeup_type"]
          updated_at?: string | null
        }
        Update: {
          attendance_checked_at?: string | null
          attendance_checked_by?: string | null
          attendance_note?: string | null
          attendance_status?:
            | Database["public"]["Enums"]["makeup_attendance_status"]
            | null
          branch_id?: string
          branch_name?: string
          class_code?: string
          class_name?: string
          counts_toward_quota?: boolean
          created_at?: string
          id?: string
          makeup_branch_id?: string | null
          makeup_confirmed_at?: string | null
          makeup_confirmed_by?: string | null
          makeup_date?: string | null
          makeup_end_time?: string | null
          makeup_room_id?: string | null
          makeup_room_name?: string | null
          makeup_start_time?: string | null
          makeup_teacher_id?: string | null
          makeup_teacher_name?: string | null
          notes?: string | null
          original_class_id?: string
          original_schedule_id?: string
          original_session_date?: string | null
          original_session_number?: number | null
          parent_id?: string
          parent_line_user_id?: string | null
          parent_name?: string
          parent_phone?: string
          reason?: string
          request_date?: string
          requested_by?: string
          status?: Database["public"]["Enums"]["makeup_status"]
          student_id?: string
          student_name?: string
          student_nickname?: string
          subject_id?: string
          subject_name?: string
          type?: Database["public"]["Enums"]["makeup_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "makeup_classes_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "makeup_classes_makeup_branch_id_fkey"
            columns: ["makeup_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "makeup_classes_makeup_room_id_fkey"
            columns: ["makeup_room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "makeup_classes_makeup_teacher_id_fkey"
            columns: ["makeup_teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "makeup_classes_original_class_id_fkey"
            columns: ["original_class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "makeup_classes_original_class_id_fkey"
            columns: ["original_class_id"]
            isOneToOne: false
            referencedRelation: "v_classes_full"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "makeup_classes_original_schedule_id_fkey"
            columns: ["original_schedule_id"]
            isOneToOne: false
            referencedRelation: "class_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "makeup_classes_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "makeup_classes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "makeup_classes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_logs: {
        Row: {
          class_id: string | null
          class_name: string | null
          created_at: string | null
          error_message: string | null
          id: string
          line_user_id: string | null
          makeup_id: string | null
          message_preview: string | null
          recipient_id: string | null
          recipient_name: string | null
          recipient_type: string
          schedule_id: string | null
          sent_at: string | null
          status: string
          student_id: string | null
          student_name: string | null
          type: string
        }
        Insert: {
          class_id?: string | null
          class_name?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          line_user_id?: string | null
          makeup_id?: string | null
          message_preview?: string | null
          recipient_id?: string | null
          recipient_name?: string | null
          recipient_type: string
          schedule_id?: string | null
          sent_at?: string | null
          status: string
          student_id?: string | null
          student_name?: string | null
          type: string
        }
        Update: {
          class_id?: string | null
          class_name?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          line_user_id?: string | null
          makeup_id?: string | null
          message_preview?: string | null
          recipient_id?: string | null
          recipient_name?: string | null
          recipient_type?: string
          schedule_id?: string | null
          sent_at?: string | null
          status?: string
          student_id?: string | null
          student_name?: string | null
          type?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_url: string | null
          body: string
          data: Json | null
          id: string
          image_url: string | null
          is_read: boolean
          read_at: string | null
          sent_at: string
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
          user_type: string
        }
        Insert: {
          action_url?: string | null
          body: string
          data?: Json | null
          id?: string
          image_url?: string | null
          is_read?: boolean
          read_at?: string | null
          sent_at?: string
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
          user_type?: string
        }
        Update: {
          action_url?: string | null
          body?: string
          data?: Json | null
          id?: string
          image_url?: string | null
          is_read?: boolean
          read_at?: string | null
          sent_at?: string
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
          user_type?: string
        }
        Relationships: []
      }
      parents: {
        Row: {
          address_district: string | null
          address_house_number: string | null
          address_postal_code: string | null
          address_province: string | null
          address_street: string | null
          address_sub_district: string | null
          created_at: string
          display_name: string
          email: string | null
          emergency_phone: string | null
          id: string
          last_login_at: string
          line_display_name: string | null
          line_user_id: string | null
          phone: string
          picture_url: string | null
          preferred_branch_id: string | null
        }
        Insert: {
          address_district?: string | null
          address_house_number?: string | null
          address_postal_code?: string | null
          address_province?: string | null
          address_street?: string | null
          address_sub_district?: string | null
          created_at?: string
          display_name: string
          email?: string | null
          emergency_phone?: string | null
          id?: string
          last_login_at?: string
          line_display_name?: string | null
          line_user_id?: string | null
          phone: string
          picture_url?: string | null
          preferred_branch_id?: string | null
        }
        Update: {
          address_district?: string | null
          address_house_number?: string | null
          address_postal_code?: string | null
          address_province?: string | null
          address_street?: string | null
          address_sub_district?: string | null
          created_at?: string
          display_name?: string
          email?: string | null
          emergency_phone?: string | null
          id?: string
          last_login_at?: string
          line_display_name?: string | null
          line_user_id?: string | null
          phone?: string
          picture_url?: string | null
          preferred_branch_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parents_preferred_branch_id_fkey"
            columns: ["preferred_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount: number
          created_at: string
          enrollment_id: string
          id: string
          method: string
          note: string | null
          receipt_number: string | null
          recorded_by: string | null
          transaction_date: string
        }
        Insert: {
          amount: number
          created_at?: string
          enrollment_id: string
          id?: string
          method?: string
          note?: string | null
          receipt_number?: string | null
          recorded_by?: string | null
          transaction_date?: string
        }
        Update: {
          amount?: number
          created_at?: string
          enrollment_id?: string
          id?: string
          method?: string
          note?: string | null
          receipt_number?: string | null
          recorded_by?: string | null
          transaction_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          applicable_to: string[] | null
          code: string
          description: string
          end_date: string
          id: string
          is_active: boolean
          min_purchase: number | null
          name: string
          start_date: string
          type: Database["public"]["Enums"]["promotion_type"]
          usage_limit: number | null
          used_count: number
          valid_branches: string[] | null
          valid_subjects: string[] | null
          value: number
        }
        Insert: {
          applicable_to?: string[] | null
          code: string
          description: string
          end_date: string
          id?: string
          is_active?: boolean
          min_purchase?: number | null
          name: string
          start_date: string
          type: Database["public"]["Enums"]["promotion_type"]
          usage_limit?: number | null
          used_count?: number
          valid_branches?: string[] | null
          valid_subjects?: string[] | null
          value: number
        }
        Update: {
          applicable_to?: string[] | null
          code?: string
          description?: string
          end_date?: string
          id?: string
          is_active?: boolean
          min_purchase?: number | null
          name?: string
          start_date?: string
          type?: Database["public"]["Enums"]["promotion_type"]
          usage_limit?: number | null
          used_count?: number
          valid_branches?: string[] | null
          valid_subjects?: string[] | null
          value?: number
        }
        Relationships: []
      }
      quiz_categories: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          emoji: string | null
          icon: string | null
          icon_type: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          emoji?: string | null
          icon?: string | null
          icon_type?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          emoji?: string | null
          icon?: string | null
          icon_type?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      quiz_questions: {
        Row: {
          competency: string | null
          correct_answer: number
          created_at: string | null
          id: string
          image_url: string | null
          options: Json | null
          options_en: Json | null
          options_th: Json | null
          points: number | null
          question: string | null
          question_en: string | null
          question_th: string | null
          quiz_id: string
          sort_order: number | null
        }
        Insert: {
          competency?: string | null
          correct_answer: number
          created_at?: string | null
          id?: string
          image_url?: string | null
          options?: Json | null
          options_en?: Json | null
          options_th?: Json | null
          points?: number | null
          question?: string | null
          question_en?: string | null
          question_th?: string | null
          quiz_id: string
          sort_order?: number | null
        }
        Update: {
          competency?: string | null
          correct_answer?: number
          created_at?: string | null
          id?: string
          image_url?: string | null
          options?: Json | null
          options_en?: Json | null
          options_th?: Json | null
          points?: number | null
          question?: string | null
          question_en?: string | null
          question_th?: string | null
          quiz_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_results: {
        Row: {
          answers: Json | null
          branch_id: string | null
          branch_name: string | null
          created_at: string | null
          difficulty: string | null
          emoji: string | null
          id: string
          max_score: number | null
          original_total_questions: number | null
          percentage: number | null
          quiz_data: Json | null
          quiz_id: string | null
          quiz_title: string | null
          quiz_title_en: string | null
          quiz_title_th: string | null
          school_name: string | null
          score: number | null
          selected_question_count: number | null
          student_code: string | null
          student_id: string | null
          student_name: string
          total_questions: number | null
          total_time: number | null
        }
        Insert: {
          answers?: Json | null
          branch_id?: string | null
          branch_name?: string | null
          created_at?: string | null
          difficulty?: string | null
          emoji?: string | null
          id?: string
          max_score?: number | null
          original_total_questions?: number | null
          percentage?: number | null
          quiz_data?: Json | null
          quiz_id?: string | null
          quiz_title?: string | null
          quiz_title_en?: string | null
          quiz_title_th?: string | null
          school_name?: string | null
          score?: number | null
          selected_question_count?: number | null
          student_code?: string | null
          student_id?: string | null
          student_name: string
          total_questions?: number | null
          total_time?: number | null
        }
        Update: {
          answers?: Json | null
          branch_id?: string | null
          branch_name?: string | null
          created_at?: string | null
          difficulty?: string | null
          emoji?: string | null
          id?: string
          max_score?: number | null
          original_total_questions?: number | null
          percentage?: number | null
          quiz_data?: Json | null
          quiz_id?: string | null
          quiz_title?: string | null
          quiz_title_en?: string | null
          quiz_title_th?: string | null
          school_name?: string | null
          score?: number | null
          selected_question_count?: number | null
          student_code?: string | null
          student_id?: string | null
          student_name?: string
          total_questions?: number | null
          total_time?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_results_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_results_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          category_id: string | null
          created_at: string | null
          created_by: string | null
          difficulty: string | null
          emoji: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          question_count: number | null
          title: string
          title_en: string | null
          title_th: string | null
          updated_at: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          created_by?: string | null
          difficulty?: string | null
          emoji?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          question_count?: number | null
          title: string
          title_en?: string | null
          title_th?: string | null
          updated_at?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          created_by?: string | null
          difficulty?: string | null
          emoji?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          question_count?: number | null
          title?: string
          title_en?: string | null
          title_th?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "quiz_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          customer_address: Json | null
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          customer_tax_id: string | null
          discount_amount: number | null
          discount_type: string | null
          discount_value: number | null
          enrollment_id: string | null
          id: string
          invoice_company_id: string
          issued_at: string | null
          items: Json
          note: string | null
          paid_amount: number | null
          payment_date: string | null
          payment_method: string | null
          payment_type: string | null
          promotion_code: string | null
          receipt_number: string
          status: string
          subtotal: number
          total_amount: number
          updated_at: string
          vat_amount: number
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          customer_address?: Json | null
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          customer_tax_id?: string | null
          discount_amount?: number | null
          discount_type?: string | null
          discount_value?: number | null
          enrollment_id?: string | null
          id?: string
          invoice_company_id: string
          issued_at?: string | null
          items?: Json
          note?: string | null
          paid_amount?: number | null
          payment_date?: string | null
          payment_method?: string | null
          payment_type?: string | null
          promotion_code?: string | null
          receipt_number: string
          status?: string
          subtotal?: number
          total_amount?: number
          updated_at?: string
          vat_amount?: number
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          customer_address?: Json | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          customer_tax_id?: string | null
          discount_amount?: number | null
          discount_type?: string | null
          discount_value?: number | null
          enrollment_id?: string | null
          id?: string
          invoice_company_id?: string
          issued_at?: string | null
          items?: Json
          note?: string | null
          paid_amount?: number | null
          payment_date?: string | null
          payment_method?: string | null
          payment_type?: string | null
          promotion_code?: string | null
          receipt_number?: string
          status?: string
          subtotal?: number
          total_amount?: number
          updated_at?: string
          vat_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_invoice_company_id_fkey"
            columns: ["invoice_company_id"]
            isOneToOne: false
            referencedRelation: "invoice_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          branch_id: string
          capacity: number
          floor: string | null
          has_projector: boolean
          has_whiteboard: boolean
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          branch_id: string
          capacity?: number
          floor?: string | null
          has_projector?: boolean
          has_whiteboard?: boolean
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          branch_id?: string
          capacity?: number
          floor?: string | null
          has_projector?: boolean
          has_whiteboard?: boolean
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          abbreviation: string | null
          aliases: string[] | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          name_en: string | null
          province: string | null
          updated_at: string | null
        }
        Insert: {
          abbreviation?: string | null
          aliases?: string[] | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          name_en?: string | null
          province?: string | null
          updated_at?: string | null
        }
        Update: {
          abbreviation?: string | null
          aliases?: string[] | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          name_en?: string | null
          province?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      short_links: {
        Row: {
          click_count: number
          code: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          ref_id: string | null
          target_path: string
        }
        Insert: {
          click_count?: number
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          ref_id?: string | null
          target_path: string
        }
        Update: {
          click_count?: number
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          ref_id?: string | null
          target_path?: string
        }
        Relationships: []
      }
      student_feedback: {
        Row: {
          class_id: string
          class_name: string
          created_at: string
          feedback: string
          id: string
          parent_id: string
          schedule_id: string
          session_date: string
          session_number: number
          student_id: string
          subject_id: string
          subject_name: string
          teacher_id: string
          teacher_name: string
        }
        Insert: {
          class_id: string
          class_name: string
          created_at?: string
          feedback: string
          id?: string
          parent_id: string
          schedule_id: string
          session_date: string
          session_number: number
          student_id: string
          subject_id: string
          subject_name: string
          teacher_id: string
          teacher_name: string
        }
        Update: {
          class_id?: string
          class_name?: string
          created_at?: string
          feedback?: string
          id?: string
          parent_id?: string
          schedule_id?: string
          session_date?: string
          session_number?: number
          student_id?: string
          subject_id?: string
          subject_name?: string
          teacher_id?: string
          teacher_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_feedback_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_feedback_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "v_classes_full"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_feedback_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_feedback_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "class_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_feedback_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_feedback_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_feedback_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          allergies: string | null
          birthdate: string
          created_at: string | null
          emergency_contact: string | null
          emergency_phone: string | null
          gender: Database["public"]["Enums"]["gender_type"]
          grade_level: string | null
          id: string
          is_active: boolean
          name: string
          name_en: string | null
          nickname: string
          parent_id: string
          profile_image: string | null
          school_name: string | null
          special_needs: string | null
          student_code: string | null
        }
        Insert: {
          allergies?: string | null
          birthdate: string
          created_at?: string | null
          emergency_contact?: string | null
          emergency_phone?: string | null
          gender: Database["public"]["Enums"]["gender_type"]
          grade_level?: string | null
          id?: string
          is_active?: boolean
          name: string
          name_en?: string | null
          nickname: string
          parent_id: string
          profile_image?: string | null
          school_name?: string | null
          special_needs?: string | null
          student_code?: string | null
        }
        Update: {
          allergies?: string | null
          birthdate?: string
          created_at?: string | null
          emergency_contact?: string | null
          emergency_phone?: string | null
          gender?: Database["public"]["Enums"]["gender_type"]
          grade_level?: string | null
          id?: string
          is_active?: boolean
          name?: string
          name_en?: string | null
          nickname?: string
          parent_id?: string
          profile_image?: string | null
          school_name?: string | null
          special_needs?: string | null
          student_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          age_range_max: number
          age_range_min: number
          category: Database["public"]["Enums"]["subject_category"]
          code: string
          color: string
          description: string
          icon: string | null
          id: string
          is_active: boolean
          level: Database["public"]["Enums"]["subject_level"]
          name: string
          prerequisites: string[] | null
        }
        Insert: {
          age_range_max?: number
          age_range_min?: number
          category: Database["public"]["Enums"]["subject_category"]
          code: string
          color?: string
          description: string
          icon?: string | null
          id?: string
          is_active?: boolean
          level: Database["public"]["Enums"]["subject_level"]
          name: string
          prerequisites?: string[] | null
        }
        Update: {
          age_range_max?: number
          age_range_min?: number
          category?: Database["public"]["Enums"]["subject_category"]
          code?: string
          color?: string
          description?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          level?: Database["public"]["Enums"]["subject_level"]
          name?: string
          prerequisites?: string[] | null
        }
        Relationships: []
      }
      tax_invoices: {
        Row: {
          billing_address: Json | null
          billing_company_branch: string | null
          billing_name: string
          billing_tax_id: string | null
          billing_type: string
          branch_id: string
          created_at: string
          created_by: string | null
          customer_address: Json | null
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          customer_tax_id: string | null
          discount_amount: number | null
          discount_type: string | null
          discount_value: number | null
          enrollment_id: string | null
          id: string
          invoice_company_id: string
          issued_at: string | null
          items: Json
          note: string | null
          original_payment_date: string | null
          paid_amount: number | null
          payment_date: string | null
          payment_method: string | null
          payment_type: string | null
          promotion_code: string | null
          receipt_id: string | null
          replaces_id: string | null
          status: string
          subtotal: number
          tax_invoice_number: string
          total_amount: number
          updated_at: string
          vat_amount: number
          void_reason: string | null
          voided_by_id: string | null
        }
        Insert: {
          billing_address?: Json | null
          billing_company_branch?: string | null
          billing_name?: string
          billing_tax_id?: string | null
          billing_type?: string
          branch_id: string
          created_at?: string
          created_by?: string | null
          customer_address?: Json | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          customer_tax_id?: string | null
          discount_amount?: number | null
          discount_type?: string | null
          discount_value?: number | null
          enrollment_id?: string | null
          id?: string
          invoice_company_id: string
          issued_at?: string | null
          items?: Json
          note?: string | null
          original_payment_date?: string | null
          paid_amount?: number | null
          payment_date?: string | null
          payment_method?: string | null
          payment_type?: string | null
          promotion_code?: string | null
          receipt_id?: string | null
          replaces_id?: string | null
          status?: string
          subtotal?: number
          tax_invoice_number: string
          total_amount?: number
          updated_at?: string
          vat_amount?: number
          void_reason?: string | null
          voided_by_id?: string | null
        }
        Update: {
          billing_address?: Json | null
          billing_company_branch?: string | null
          billing_name?: string
          billing_tax_id?: string | null
          billing_type?: string
          branch_id?: string
          created_at?: string
          created_by?: string | null
          customer_address?: Json | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          customer_tax_id?: string | null
          discount_amount?: number | null
          discount_type?: string | null
          discount_value?: number | null
          enrollment_id?: string | null
          id?: string
          invoice_company_id?: string
          issued_at?: string | null
          items?: Json
          note?: string | null
          original_payment_date?: string | null
          paid_amount?: number | null
          payment_date?: string | null
          payment_method?: string | null
          payment_type?: string | null
          promotion_code?: string | null
          receipt_id?: string | null
          replaces_id?: string | null
          status?: string
          subtotal?: number
          tax_invoice_number?: string
          total_amount?: number
          updated_at?: string
          vat_amount?: number
          void_reason?: string | null
          voided_by_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tax_invoices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_invoices_invoice_company_id_fkey"
            columns: ["invoice_company_id"]
            isOneToOne: false
            referencedRelation: "invoice_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_invoices_receipt_fk"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_invoices_replaces_id_fkey"
            columns: ["replaces_id"]
            isOneToOne: false
            referencedRelation: "tax_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_invoices_voided_by_id_fkey"
            columns: ["voided_by_id"]
            isOneToOne: false
            referencedRelation: "tax_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          available_branches: string[] | null
          bank_account_name: string | null
          bank_account_number: string | null
          bank_name: string | null
          created_at: string
          email: string
          has_login: boolean
          hourly_rate: number | null
          id: string
          is_active: boolean
          line_user_id: string | null
          name: string
          name_en: string | null
          nickname: string | null
          phone: string
          profile_image: string | null
          specialties: string[] | null
          updated_at: string | null
        }
        Insert: {
          available_branches?: string[] | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          created_at?: string
          email: string
          has_login?: boolean
          hourly_rate?: number | null
          id?: string
          is_active?: boolean
          line_user_id?: string | null
          name: string
          name_en?: string | null
          nickname?: string | null
          phone: string
          profile_image?: string | null
          specialties?: string[] | null
          updated_at?: string | null
        }
        Update: {
          available_branches?: string[] | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          created_at?: string
          email?: string
          has_login?: boolean
          hourly_rate?: number | null
          id?: string
          is_active?: boolean
          line_user_id?: string | null
          name?: string
          name_en?: string | null
          nickname?: string | null
          phone?: string
          profile_image?: string | null
          specialties?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      teaching_materials: {
        Row: {
          canva_url: string
          created_at: string
          created_by: string
          description: string | null
          duration: number
          embed_url: string
          id: string
          is_active: boolean
          materials: string[] | null
          objectives: string[] | null
          preparation: string[] | null
          session_number: number
          subject_id: string
          tags: string[] | null
          teaching_notes: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          canva_url: string
          created_at?: string
          created_by: string
          description?: string | null
          duration: number
          embed_url: string
          id?: string
          is_active?: boolean
          materials?: string[] | null
          objectives?: string[] | null
          preparation?: string[] | null
          session_number: number
          subject_id: string
          tags?: string[] | null
          teaching_notes?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          canva_url?: string
          created_at?: string
          created_by?: string
          description?: string | null
          duration?: number
          embed_url?: string
          id?: string
          is_active?: boolean
          materials?: string[] | null
          objectives?: string[] | null
          preparation?: string[] | null
          session_number?: number
          subject_id?: string
          tags?: string[] | null
          teaching_notes?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teaching_materials_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_booking_students: {
        Row: {
          birthdate: string | null
          booking_id: string
          grade_level: string | null
          id: string
          name: string
          school_name: string | null
          subject_interests: string[] | null
        }
        Insert: {
          birthdate?: string | null
          booking_id: string
          grade_level?: string | null
          id?: string
          name: string
          school_name?: string | null
          subject_interests?: string[] | null
        }
        Update: {
          birthdate?: string | null
          booking_id?: string
          grade_level?: string | null
          id?: string
          name?: string
          school_name?: string | null
          subject_interests?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "trial_booking_students_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "trial_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_bookings: {
        Row: {
          assigned_to: string | null
          branch_id: string | null
          contact_note: string | null
          contacted_at: string | null
          created_at: string
          id: string
          parent_email: string | null
          parent_name: string
          parent_phone: string
          source: Database["public"]["Enums"]["trial_source"]
          status: Database["public"]["Enums"]["trial_booking_status"]
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          branch_id?: string | null
          contact_note?: string | null
          contacted_at?: string | null
          created_at?: string
          id?: string
          parent_email?: string | null
          parent_name: string
          parent_phone: string
          source?: Database["public"]["Enums"]["trial_source"]
          status?: Database["public"]["Enums"]["trial_booking_status"]
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          branch_id?: string | null
          contact_note?: string | null
          contacted_at?: string | null
          created_at?: string
          id?: string
          parent_email?: string | null
          parent_name?: string
          parent_phone?: string
          source?: Database["public"]["Enums"]["trial_source"]
          status?: Database["public"]["Enums"]["trial_booking_status"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trial_bookings_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_bookings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_reschedule_history: {
        Row: {
          id: string
          new_date: string
          new_time: string
          original_date: string
          original_time: string
          reason: string | null
          rescheduled_at: string
          rescheduled_by: string
          session_id: string
        }
        Insert: {
          id?: string
          new_date: string
          new_time: string
          original_date: string
          original_time: string
          reason?: string | null
          rescheduled_at?: string
          rescheduled_by: string
          session_id: string
        }
        Update: {
          id?: string
          new_date?: string
          new_time?: string
          original_date?: string
          original_time?: string
          reason?: string | null
          rescheduled_at?: string
          rescheduled_by?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trial_reschedule_history_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "trial_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_sessions: {
        Row: {
          attended: boolean | null
          booking_id: string
          branch_id: string
          completed_at: string | null
          conversion_note: string | null
          converted: boolean | null
          converted_to_class_id: string | null
          created_at: string
          end_time: string
          feedback: string | null
          id: string
          interested_level: Database["public"]["Enums"]["interest_level"] | null
          room_id: string
          room_name: string | null
          scheduled_date: string
          start_time: string
          status: Database["public"]["Enums"]["trial_session_status"]
          student_name: string
          subject_id: string
          teacher_id: string
          teacher_note: string | null
        }
        Insert: {
          attended?: boolean | null
          booking_id: string
          branch_id: string
          completed_at?: string | null
          conversion_note?: string | null
          converted?: boolean | null
          converted_to_class_id?: string | null
          created_at?: string
          end_time: string
          feedback?: string | null
          id?: string
          interested_level?:
            | Database["public"]["Enums"]["interest_level"]
            | null
          room_id: string
          room_name?: string | null
          scheduled_date: string
          start_time: string
          status?: Database["public"]["Enums"]["trial_session_status"]
          student_name: string
          subject_id: string
          teacher_id: string
          teacher_note?: string | null
        }
        Update: {
          attended?: boolean | null
          booking_id?: string
          branch_id?: string
          completed_at?: string | null
          conversion_note?: string | null
          converted?: boolean | null
          converted_to_class_id?: string | null
          created_at?: string
          end_time?: string
          feedback?: string | null
          id?: string
          interested_level?:
            | Database["public"]["Enums"]["interest_level"]
            | null
          room_id?: string
          room_name?: string | null
          scheduled_date?: string
          start_time?: string
          status?: Database["public"]["Enums"]["trial_session_status"]
          student_name?: string
          subject_id?: string
          teacher_id?: string
          teacher_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trial_sessions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "trial_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_sessions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_sessions_converted_to_class_id_fkey"
            columns: ["converted_to_class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_sessions_converted_to_class_id_fkey"
            columns: ["converted_to_class_id"]
            isOneToOne: false
            referencedRelation: "v_classes_full"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_sessions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_sessions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_sessions_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_classes_full: {
        Row: {
          branch_code: string | null
          branch_id: string | null
          branch_name: string | null
          code: string | null
          created_at: string | null
          days_of_week: number[] | null
          description: string | null
          end_date: string | null
          end_time: string | null
          enrolled_count: number | null
          id: string | null
          material_fee: number | null
          max_students: number | null
          min_students: number | null
          name: string | null
          price_per_session: number | null
          registration_fee: number | null
          room_id: string | null
          room_name: string | null
          start_date: string | null
          start_time: string | null
          status: Database["public"]["Enums"]["class_status"] | null
          subject_category:
            | Database["public"]["Enums"]["subject_category"]
            | null
          subject_code: string | null
          subject_id: string | null
          subject_name: string | null
          teacher_id: string | null
          teacher_name: string | null
          teacher_nickname: string | null
          total_price: number | null
          total_sessions: number | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_has_branch_access: {
        Args: { target_branch_id: string }
        Returns: boolean
      }
      check_availability: {
        Args: {
          p_branch_id: string
          p_check_date: string
          p_end_time: string
          p_exclude_id?: string
          p_exclude_type?: string
          p_room_id: string
          p_start_time: string
          p_teacher_id: string
        }
        Returns: Json
      }
      check_range_availability: {
        Args: {
          p_branch_id: string
          p_dates: string[]
          p_end_time: string
          p_exclude_class_id?: string
          p_room_id: string
          p_start_time: string
          p_teacher_id: string
        }
        Returns: Json
      }
      generate_next_credit_note_number: {
        Args: { p_company_id: string }
        Returns: string
      }
      generate_next_receipt_number: {
        Args: { p_company_id: string }
        Returns: string
      }
      generate_next_refund_note_number: {
        Args: { p_company_id: string }
        Returns: string
      }
      generate_next_tax_invoice_number: {
        Args: { p_company_id: string }
        Returns: string
      }
      get_admin_branch_ids: { Args: never; Returns: string[] }
      get_admin_users_with_last_login: {
        Args: never
        Returns: {
          avatar_url: string
          branch_ids: string[]
          can_manage_all_branches: boolean
          can_manage_settings: boolean
          can_manage_users: boolean
          can_view_reports: boolean
          created_at: string
          display_name: string
          email: string
          id: string
          is_active: boolean
          last_login_at: string
          nickname: string
          role: string
          teacher_id: string
          teacher_nickname: string
          updated_at: string
        }[]
      }
      get_class_lookup_data: { Args: { p_branch_id?: string }; Returns: Json }
      get_class_reminders: {
        Args: { p_date: string }
        Returns: {
          branch_name: string
          class_id: string
          class_name: string
          end_time: string
          line_user_id: string
          parent_id: string
          room_name: string
          schedule_id: string
          session_date: string
          session_number: number
          start_time: string
          student_id: string
          student_name: string
          student_nickname: string
          subject_name: string
          teacher_name: string
          teacher_nickname: string
        }[]
      }
      get_daily_timetable: {
        Args: { p_branch_id?: string; p_date: string }
        Returns: Json
      }
      get_dashboard_stats: { Args: { p_branch_id?: string }; Returns: Json }
      get_enrollment_stats: { Args: { p_branch_id?: string }; Returns: Json }
      get_event_conversion: { Args: { p_event_id: string }; Returns: Json }
      get_events_with_stats: { Args: { p_branch_id?: string }; Returns: Json }
      get_liff_feedback: { Args: { p_line_user_id: string }; Returns: Json }
      get_liff_home: { Args: { p_line_user_id: string }; Returns: Json }
      get_liff_makeup: { Args: { p_line_user_id: string }; Returns: Json }
      get_liff_profile: { Args: { p_line_user_id: string }; Returns: Json }
      get_liff_schedule: {
        Args: { p_end: string; p_line_user_id: string; p_start: string }
        Returns: Json
      }
      get_parent_id_from_line: { Args: never; Returns: string }
      get_reschedule_preview: { Args: never; Returns: Json }
      get_teacher_daily_schedule: {
        Args: { p_branch_id?: string; p_date: string; p_teacher_id: string }
        Returns: Json
      }
      get_weekly_timetable: {
        Args: { p_branch_id?: string; p_week_end: string; p_week_start: string }
        Returns: Json
      }
      increment_event_view: { Args: { p_event_id: string }; Returns: undefined }
      increment_short_link_click: {
        Args: { p_code: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      sync_all_enrollment_statuses: {
        Args: never
        Returns: {
          class_id: string
          class_name: string
          new_status: string
          updated_count: number
        }[]
      }
    }
    Enums: {
      admin_role: "super_admin" | "branch_admin" | "teacher"
      attendance_status: "present" | "absent" | "late" | "sick" | "leave"
      class_status:
        | "draft"
        | "published"
        | "started"
        | "completed"
        | "cancelled"
      counting_method: "students" | "parents" | "registrations"
      discount_type: "percentage" | "fixed"
      enrollment_status:
        | "active"
        | "completed"
        | "dropped"
        | "transferred"
        | "paused"
      event_registration_status:
        | "confirmed"
        | "cancelled"
        | "attended"
        | "no-show"
      event_schedule_status: "available" | "full" | "cancelled"
      event_status: "draft" | "published" | "completed" | "cancelled"
      event_type:
        | "open-house"
        | "parent-meeting"
        | "showcase"
        | "workshop"
        | "other"
      gender_type: "M" | "F"
      holiday_type: "national" | "branch"
      interest_level: "high" | "medium" | "low" | "not_interested"
      makeup_attendance_status: "present" | "absent"
      makeup_status: "pending" | "scheduled" | "completed" | "cancelled"
      makeup_type: "scheduled" | "ad-hoc"
      notification_type:
        | "reminder"
        | "announcement"
        | "schedule_change"
        | "payment"
        | "makeup"
        | "system"
      payment_method: "cash" | "transfer" | "credit"
      payment_status: "pending" | "partial" | "paid"
      promotion_type: "percentage" | "fixed" | "package"
      registration_source: "liff" | "admin"
      schedule_status: "scheduled" | "completed" | "cancelled" | "rescheduled"
      subject_category: "Coding" | "Robotics" | "AI" | "Other"
      subject_level: "Beginner" | "Intermediate" | "Advanced"
      trial_booking_status:
        | "new"
        | "contacted"
        | "scheduled"
        | "completed"
        | "converted"
        | "cancelled"
      trial_session_status: "scheduled" | "attended" | "absent" | "cancelled"
      trial_source: "online" | "walkin" | "phone"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      admin_role: ["super_admin", "branch_admin", "teacher"],
      attendance_status: ["present", "absent", "late", "sick", "leave"],
      class_status: ["draft", "published", "started", "completed", "cancelled"],
      counting_method: ["students", "parents", "registrations"],
      discount_type: ["percentage", "fixed"],
      enrollment_status: [
        "active",
        "completed",
        "dropped",
        "transferred",
        "paused",
      ],
      event_registration_status: [
        "confirmed",
        "cancelled",
        "attended",
        "no-show",
      ],
      event_schedule_status: ["available", "full", "cancelled"],
      event_status: ["draft", "published", "completed", "cancelled"],
      event_type: [
        "open-house",
        "parent-meeting",
        "showcase",
        "workshop",
        "other",
      ],
      gender_type: ["M", "F"],
      holiday_type: ["national", "branch"],
      interest_level: ["high", "medium", "low", "not_interested"],
      makeup_attendance_status: ["present", "absent"],
      makeup_status: ["pending", "scheduled", "completed", "cancelled"],
      makeup_type: ["scheduled", "ad-hoc"],
      notification_type: [
        "reminder",
        "announcement",
        "schedule_change",
        "payment",
        "makeup",
        "system",
      ],
      payment_method: ["cash", "transfer", "credit"],
      payment_status: ["pending", "partial", "paid"],
      promotion_type: ["percentage", "fixed", "package"],
      registration_source: ["liff", "admin"],
      schedule_status: ["scheduled", "completed", "cancelled", "rescheduled"],
      subject_category: ["Coding", "Robotics", "AI", "Other"],
      subject_level: ["Beginner", "Intermediate", "Advanced"],
      trial_booking_status: [
        "new",
        "contacted",
        "scheduled",
        "completed",
        "converted",
        "cancelled",
      ],
      trial_session_status: ["scheduled", "attended", "absent", "cancelled"],
      trial_source: ["online", "walkin", "phone"],
    },
  },
} as const

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

// ---------------------------------------------------------------------------
// Convenience helpers over the generated Database type.
// Preserved for existing lib/supabase/services/* imports after regenerating types.
// ---------------------------------------------------------------------------
type PublicSchema = Database['public']

export type Tables<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Row']
export type InsertTables<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Insert']
export type UpdateTables<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Update']

// Table-row aliases used by lib/supabase/services/*
export type AdminUser = Tables<'admin_users'>
export type Branch = Tables<'branches'>
export type Class = Tables<'classes'>
export type ClassSchedule = Tables<'class_schedules'>
export type Enrollment = Tables<'enrollments'>
export type Student = Tables<'students'>
export type Parent = Tables<'parents'>
export type Teacher = Tables<'teachers'>
export type Subject = Tables<'subjects'>
export type Room = Tables<'rooms'>
export type Holiday = Tables<'holidays'>
export type MakeupClass = Tables<'makeup_classes'>
export type Event = Tables<'events'>
export type EventSchedule = Tables<'event_schedules'>
export type EventRegistration = Tables<'event_registrations'>
export type TrialBooking = Tables<'trial_bookings'>
export type TrialSession = Tables<'trial_sessions'>

// "Full"/joined aliases — map to the corresponding view when present,
// otherwise fall back to the base table row.
export type ClassFull = PublicSchema['Views'] extends { v_classes_full: { Row: infer R } }
  ? R
  : Tables<'classes'>
export type EnrollmentFull = Tables<'enrollments'>
export type StudentWithParent = Tables<'students'>
