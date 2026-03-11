ALTER TABLE puzzles ADD COLUMN IF NOT EXISTS alternative_paths jsonb DEFAULT NULL;

COMMENT ON COLUMN puzzles.alternative_paths IS 'For Hard difficulty: array of valid complete paths longer than optimal_path. Each entry is an array of entity IDs. Null for Easy/Medium.';
