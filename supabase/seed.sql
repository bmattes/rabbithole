insert into categories (name, wikidata_domain, active) values
  ('Movies',     'movies',     true),
  ('Basketball', 'basketball', true),
  ('Music',      'music',      true),
  ('Science',    'science',    true),
  ('History',    'history',    true)
on conflict (name) do nothing;
