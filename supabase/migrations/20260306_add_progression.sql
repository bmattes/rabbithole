-- Add progression columns to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS total_xp             INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS streak               INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_played_date     DATE,
  ADD COLUMN IF NOT EXISTS unlocked_categories  JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_subscriber        BOOLEAN NOT NULL DEFAULT false;
