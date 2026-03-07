-- Add group chat support to chat_contacts
ALTER TABLE public.chat_contacts ADD COLUMN IF NOT EXISTS is_group boolean DEFAULT false;
ALTER TABLE public.chat_contacts ADD COLUMN IF NOT EXISTS group_id text;
ALTER TABLE public.chat_contacts ADD COLUMN IF NOT EXISTS member_count integer;

-- Index for quick group filtering
CREATE INDEX IF NOT EXISTS idx_chat_contacts_is_group ON public.chat_contacts (is_group);
