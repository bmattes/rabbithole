-- Add QC score to puzzles for post-run review
ALTER TABLE puzzles ADD COLUMN IF NOT EXISTS qc_score numeric(4,2);
