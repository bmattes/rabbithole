create table if not exists hint_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default current_date,
  hints_used integer not null default 0,
  unique(user_id, usage_date)
);

alter table hint_usage enable row level security;

create policy "Users can read own hint usage"
  on hint_usage for select
  using (auth.uid() = user_id);

create policy "Users can insert own hint usage"
  on hint_usage for insert
  with check (auth.uid() = user_id);

create policy "Users can update own hint usage"
  on hint_usage for update
  using (auth.uid() = user_id);
