-- בקשות שינוי משמורת + תזכורת יום לפני — הרץ/י ב-Supabase SQL Editor

alter table public.parent_notices
  add column if not exists remind_day_before boolean not null default true;

create table if not exists public.custody_change_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  family_id uuid,
  date date not null,
  end_date date,
  child_id uuid,
  title text not null default '',
  reason text not null default '',
  requested_by text not null check (requested_by in ('a', 'b')),
  assign_to text not null check (assign_to in ('a', 'b')),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text,
  responded_by text check (responded_by is null or responded_by in ('a', 'b')),
  responded_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists custody_change_requests_family_idx on public.custody_change_requests (family_id);
create index if not exists custody_change_requests_date_idx on public.custody_change_requests (date);

grant select, insert, update, delete on public.custody_change_requests to authenticated;

alter table public.custody_change_requests enable row level security;

drop policy if exists "Family members manage custody requests" on public.custody_change_requests;
create policy "Family members manage custody requests" on public.custody_change_requests
  for all using (
    user_id = auth.uid()
    or (
      family_id is not null
      and exists (
        select 1 from public.family_members fm
        where fm.family_id = custody_change_requests.family_id
          and fm.user_id = auth.uid()
      )
    )
  )
  with check (
    user_id = auth.uid()
    or (
      family_id is not null
      and exists (
        select 1 from public.family_members fm
        where fm.family_id = custody_change_requests.family_id
          and fm.user_id = auth.uid()
      )
    )
  );

notify pgrst, 'reload schema';

select '✅ בקשות משמורת ותזכורות יום-לפני מוכנות' as result;
