-- Omnichannel Chat System
-- Tables: chat_channels, chat_contacts, chat_conversations, chat_messages, chat_quick_replies

-- 1. Chat Channels (LINE OA, FB Page, IG Account)
CREATE TABLE public.chat_channels (
  id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  type text NOT NULL CHECK (type IN ('line', 'facebook', 'instagram')),
  name text NOT NULL,
  platform_id text,
  platform_name text,
  platform_avatar_url text,
  credentials jsonb NOT NULL DEFAULT '{}',
  webhook_secret text,
  webhook_verified boolean DEFAULT false,
  is_active boolean DEFAULT true,
  branch_id uuid REFERENCES public.branches(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  created_by uuid
);

-- 2. Chat Contacts (external users who message us)
CREATE TABLE public.chat_contacts (
  id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  channel_id uuid NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  platform_user_id text NOT NULL,
  display_name text,
  avatar_url text,
  parent_id uuid REFERENCES public.parents(id),
  phone text,
  email text,
  tags text[] DEFAULT '{}',
  custom_data jsonb DEFAULT '{}',
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  UNIQUE(channel_id, platform_user_id)
);
CREATE INDEX idx_chat_contacts_parent ON public.chat_contacts(parent_id);
CREATE INDEX idx_chat_contacts_last_msg ON public.chat_contacts(last_message_at DESC);

-- 3. Chat Conversations (1 per contact)
CREATE TABLE public.chat_conversations (
  id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  channel_id uuid NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.chat_contacts(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'assigned', 'resolved', 'archived')),
  assigned_to uuid,
  unread_count integer DEFAULT 0,
  last_message_preview text,
  last_message_at timestamptz,
  trial_booking_id uuid,
  enrollment_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  UNIQUE(contact_id)
);
CREATE INDEX idx_chat_conv_status ON public.chat_conversations(status, last_message_at DESC);
CREATE INDEX idx_chat_conv_assigned ON public.chat_conversations(assigned_to);
CREATE INDEX idx_chat_conv_channel ON public.chat_conversations(channel_id, last_message_at DESC);

-- 4. Chat Messages (core table — Realtime subscription target)
CREATE TABLE public.chat_messages (
  id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  sender_type text NOT NULL CHECK (sender_type IN ('contact', 'admin', 'system')),
  sender_id text,
  sender_name text,
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'sticker', 'file', 'audio', 'video', 'location', 'template', 'system')),
  content text,
  media_url text,
  media_metadata jsonb,
  platform_message_id text,
  status text DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  error_message text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_chat_msg_conv ON public.chat_messages(conversation_id, created_at DESC);
CREATE INDEX idx_chat_msg_created ON public.chat_messages(created_at DESC);

-- 5. Quick Replies (saved message templates)
CREATE TABLE public.chat_quick_replies (
  id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  title text NOT NULL,
  content text NOT NULL,
  category text DEFAULT 'general',
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable Supabase Realtime on chat tables
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_conversations;
