-- Replace initial 5 categories with full 25-category catalogue
-- Old domains (movies, basketball, music, science, history) are superseded
-- by more focused domains. We deactivate stale ones and upsert the full list.

-- Deactivate any categories not in the new list
update categories set active = false
where name not in (
  'World History', 'Movies', 'Comics', 'Hip-Hop', 'Rock Music',
  'Pop Music', 'Football / Soccer', 'Video Games', 'Literature',
  'Philosophy', 'Science', 'Visual Art', 'Geography', 'Classical Music',
  'Royals & Monarchs', 'Tennis', 'TV Shows', 'R&B / Soul',
  'Military History', 'Sport', 'Country Music', 'Electronic Music',
  'Mythology', 'Space & Astronomy', 'Food & Cuisine'
);

-- Insert all 25 categories (upsert by name)
insert into categories (name, wikidata_domain, active) values
  ('World History',     'history',        true),
  ('Movies',            'movies',         true),
  ('Comics',            'comics',         true),
  ('Hip-Hop',           'mb_hiphop',      true),
  ('Rock Music',        'mb_rock',        true),
  ('Pop Music',         'mb_pop',         true),
  ('Football / Soccer', 'soccer',         true),
  ('Video Games',       'videogames',     true),
  ('Literature',        'literature',     true),
  ('Philosophy',        'philosophy',     true),
  ('Science',           'science',        true),
  ('Visual Art',        'art',            true),
  ('Geography',         'geography',      true),
  ('Classical Music',   'music',          true),
  ('Royals & Monarchs', 'royals',         true),
  ('Tennis',            'tennis',         true),
  ('TV Shows',          'tv',             true),
  ('R&B / Soul',        'mb_rnb',         true),
  ('Military History',  'military',       true),
  ('Sport',             'sport',          true),
  ('Country Music',     'mb_country',     true),
  ('Electronic Music',  'mb_electronic',  true),
  ('Mythology',         'mythology',      true),
  ('Space & Astronomy', 'space',          true),
  ('Food & Cuisine',    'food',           true)
on conflict (name) do update
  set wikidata_domain = excluded.wikidata_domain,
      active = excluded.active;
