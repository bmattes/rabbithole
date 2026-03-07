-- Replace Electronic Music (broken graph) with Basketball and American Football

-- Deactivate Electronic Music
UPDATE categories SET active = false WHERE wikidata_domain = 'mb_electronic';

-- Add Basketball and American Football
INSERT INTO categories (name, wikidata_domain, active)
VALUES
  ('Basketball',        'basketball',       true),
  ('American Football', 'americanfootball', true)
ON CONFLICT (name) DO UPDATE SET active = true, wikidata_domain = EXCLUDED.wikidata_domain;
