-- תזכורות, דיווחי היעדרות והפרות משמורת — הרץ/י ב-Supabase SQL Editor

create table if not exists public.parent_notices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  family_id uuid,
  notice_type text not null
    check (notice_type in ('reminder', 'absence', 'cancellation', 'military', 'violation')),
  preset_id text,
  title text not null,
  description text not null default '',
  date date not null,
  time text,
  child_id uuid,
  location text not null default '',
  with_person text not null default '',
  created_by text not null default 'a' check (created_by in ('a', 'b')),
  violator_role text check (violator_role is null or violator_role in ('a', 'b')),
  requires_ack boolean not null default true,
  acknowledged_by text check (acknowledged_by is null or acknowledged_by in ('a', 'b')),
  acknowledged_at timestamptz,
  has_penalty boolean not null default false,
  penalty_amount numeric,
  expense_id uuid,
  status text not null default 'active'
    check (status in ('active', 'acknowledged', 'cancelled')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists parent_notices_family_idx on public.parent_notices (family_id);
create index if not exists parent_notices_date_idx on public.parent_notices (date);

grant usage on schema public to authenticated, anon;
grant select, insert, update, delete on public.parent_notices to authenticated;

alter table public.parent_notices enable row level security;

drop policy if exists "Family members manage parent notices" on public.parent_notices;
create policy "Family members manage parent notices" on public.parent_notices
  for all using (
    (family_id is not null and family_id in (select public.user_family_ids()))
    or user_id = auth.uid()
  )
  with check (
    (family_id is not null and family_id in (select public.user_family_ids()))
    or user_id = auth.uid()
  );

notify pgrst, 'reload schema';

select '✅ טבלת תזכורות ודיווחים מוכנה' as result;
