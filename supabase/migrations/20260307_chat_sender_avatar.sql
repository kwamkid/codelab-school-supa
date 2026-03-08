-- Add sender_avatar_url to chat_messages for per-user avatars in group chats
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS sender_avatar_url text;
