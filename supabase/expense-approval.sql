-- אישור הוצאות — הרץ/י ב-Supabase SQL Editor
alter table public.expenses
  add column if not exists requires_approval boolean not null default false,
  add column if not exists approval_status text not null default 'approved'
    check (approval_status in ('pending', 'approved', 'rejected')),
  add column if not exists created_by text not null default 'a'
    check (created_by in ('a', 'b')),
  add column if not exists responded_by text
    check (responded_by is null or responded_by in ('a', 'b')),
  add column if not exists responded_at timestamptz,
  add column if not exists agree_to_split boolean not null default true;
