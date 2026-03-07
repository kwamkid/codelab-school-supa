-- Add branch_ids to chat_contacts for multi-branch filtering
-- (LINE OA / FB shared across branches, so contacts need explicit branch tags)

ALTER TABLE public.chat_contacts
  ADD COLUMN IF NOT EXISTS branch_ids uuid[] DEFAULT '{}';

-- GIN index for array containment queries (@> and &&)
CREATE INDEX IF NOT EXISTS idx_chat_contacts_branch_ids
  ON public.chat_contacts USING GIN (branch_ids);

-- GIN index for tags array search
CREATE INDEX IF NOT EXISTS idx_chat_contacts_tags
  ON public.chat_contacts USING GIN (tags);
