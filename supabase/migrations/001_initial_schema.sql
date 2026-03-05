-- Categories
create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  wikidata_domain text not null,
  active boolean not null default true,
  created_at timestamptz default now()
);

-- Puzzle status enum
create type puzzle_status as enum ('pending_review', 'approved', 'published');

-- Puzzles
create table puzzles (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references categories(id) not null,
  date date not null,
  start_concept text not null,
  end_concept text not null,
  bubbles jsonb not null default '[]',
  connections jsonb not null default '{}',
  optimal_path jsonb not null default '[]',
  narrative text,
  status puzzle_status not null default 'pending_review',
  created_at timestamptz default now(),
  unique(category_id, date)
);

-- Users (extends Supabase auth.users)
create table users (
  id uuid primary key references auth.users(id),
  display_name text not null,
  avatar text,
  streak integer not null default 0,
  created_at timestamptz default now()
);

-- Player runs
create table player_runs (
  id uuid primary key default gen_random_uuid(),
  puzzle_id uuid references puzzles(id) not null,
  user_id uuid references users(id) not null,
  path jsonb not null default '[]',
  time_ms integer not null,
  score integer not null,
  created_at timestamptz default now(),
  unique(puzzle_id, user_id)
);

-- Leaderboard view
create or replace view leaderboard as
  select
    pr.puzzle_id,
    pr.user_id,
    u.display_name,
    u.avatar,
    pr.score,
    pr.time_ms,
    pr.path,
    rank() over (partition by pr.puzzle_id order by pr.score desc, pr.time_ms asc) as rank
  from player_runs pr
  join users u on u.id = pr.user_id;

-- Row Level Security
alter table users enable row level security;
alter table player_runs enable row level security;

create policy "Users can read all users" on users for select using (true);
create policy "Users can update own profile" on users for update using (auth.uid() = id);
create policy "Users can insert own profile" on users for insert with check (auth.uid() = id);

create policy "Anyone can read published puzzles" on puzzles for select using (status = 'published');
create policy "Anyone can read categories" on categories for select using (active = true);
create policy "Anyone can read leaderboard" on player_runs for select using (true);
create policy "Users can insert own runs" on player_runs for insert with check (auth.uid() = user_id);
