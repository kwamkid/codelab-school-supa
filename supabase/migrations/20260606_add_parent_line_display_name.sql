-- Add LINE display name to parents so the actual LINE profile name (e.g. "Peam")
-- can be stored and shown on the parent detail page, separate from the parent's
-- own entered name (display_name).
-- Idempotent: safe to run whether or not the column already exists.
ALTER TABLE parents ADD COLUMN IF NOT EXISTS line_display_name text;

COMMENT ON COLUMN parents.line_display_name IS 'LINE profile display name captured at link time (distinct from display_name, the parent''s own name).';
