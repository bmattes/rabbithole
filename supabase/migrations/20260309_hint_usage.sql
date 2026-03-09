create table if not exists hint_usages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default current_date,
  hints_used integer not null default 0,
  created_at timestamptz not null default now(),
  unique(user_id, usage_date)
);

alter table hint_usages enable row level security;

create policy "Users can read own hint usage"
  on hint_usages for select
  using (auth.uid() = user_id);

create policy "Users can insert own hint usage"
  on hint_usages for insert
  with check (auth.uid() = user_id);

create policy "Users can update own hint usage"
  on hint_usages for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
