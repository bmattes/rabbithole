-- Drop old unique constraint (one puzzle per category per day)
ALTER TABLE puzzles DROP CONSTRAINT IF EXISTS puzzles_category_id_date_key;

-- Add new unique constraint (one puzzle per category per day per difficulty)
ALTER TABLE puzzles ADD CONSTRAINT puzzles_category_id_date_difficulty_key
  UNIQUE (category_id, date, difficulty);

-- Add difficulty column if it doesn't exist
ALTER TABLE puzzles ADD COLUMN IF NOT EXISTS difficulty text NOT NULL DEFAULT 'easy';
