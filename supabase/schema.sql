-- ============================================================
-- הורים ביחד — סכמת DB מלאה
-- הרץ/י ב-Supabase SQL Editor (אפשר להריץ שוב בבטחה)
-- ============================================================

-- פרופילים
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  email text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users read own profile" on public.profiles;
drop policy if exists "Users update own profile" on public.profiles;
drop policy if exists "Users insert own profile" on public.profiles;

create policy "Users read own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- הגדרות משתמש
create table if not exists public.user_settings (
  user_id uuid references auth.users on delete cascade primary key,
  parent_a_name text not null default 'הורה א',
  parent_b_name text not null default 'הורה ב',
  current_parent text not null default 'a' check (current_parent in ('a', 'b')),
  custody_pattern text not null default 'alternating-weeks',
  custody_start_date date not null default current_date,
  week_schedule jsonb not null default '{"0":"a","1":"a","2":"a","3":"b","4":"b","5":"b","6":"b"}'::jsonb,
  updated_at timestamptz default now()
);

alter table public.user_settings enable row level security;

drop policy if exists "Users manage own settings" on public.user_settings;
create policy "Users manage own settings" on public.user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ילדים
create table if not exists public.children (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  birth_date date,
  school text default '',
  allergies text default '',
  notes text default '',
  created_at timestamptz default now()
);

alter table public.children enable row level security;

drop policy if exists "Users manage own children" on public.children;
create policy "Users manage own children" on public.children
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- אירועים
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  date date not null,
  time text default '',
  child_id uuid references public.children on delete set null,
  location text default '',
  notes text default '',
  created_by text not null default 'a' check (created_by in ('a', 'b')),
  created_at timestamptz default now()
);

alter table public.events enable row level security;

drop policy if exists "Users manage own events" on public.events;
create policy "Users manage own events" on public.events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- הוצאות
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  amount numeric not null default 0,
  date date not null,
  paid_by text not null default 'a' check (paid_by in ('a', 'b')),
  split_percent int not null default 50,
  paid boolean not null default false,
  category text default 'אחר',
  child_id uuid references public.children on delete set null,
  notes text default '',
  created_at timestamptz default now()
);

alter table public.expenses enable row level security;

drop policy if exists "Users manage own expenses" on public.expenses;
create policy "Users manage own expenses" on public.expenses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- הודעות
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  text text not null,
  sender text not null default 'a' check (sender in ('a', 'b')),
  created_at timestamptz default now()
);

alter table public.messages enable row level security;

drop policy if exists "Users manage own messages" on public.messages;
create policy "Users manage own messages" on public.messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- אינדקסים
create index if not exists idx_children_user on public.children(user_id);
create index if not exists idx_events_user_date on public.events(user_id, date);
create index if not exists idx_expenses_user_date on public.expenses(user_id, date);
create index if not exists idx_messages_user on public.messages(user_id, created_at);

-- פרופיל אוטומטי + הגדרות ברירת מחדל בהרשמה
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.email)
  on conflict (id) do nothing;

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- הגדרות למשתמשים קיימים שאין להם עדיין
insert into public.user_settings (user_id)
select id from auth.users
where id not in (select user_id from public.user_settings)
on conflict do nothing;
