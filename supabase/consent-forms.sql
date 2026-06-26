-- ═══════════════════════════════════════════════════════════════
-- טפסי הסכמה + עדכונים — הרץ/י את כל הקובץ ב-Supabase SQL Editor
-- Dashboard → SQL Editor → New query → הדבק/י הכל → Run
-- ═══════════════════════════════════════════════════════════════

-- 1. ת.ז. בפרופיל
alter table public.profiles
  add column if not exists id_number text;

-- 2. טבלת טפסי הסכמה
create table if not exists public.consent_forms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  family_id uuid,
  form_type text not null default 'parental_activity',
  status text not null default 'draft'
    check (status in ('draft', 'pending_signature', 'completed')),
  document_code text unique,
  child_id uuid,
  institution_name text not null default '',
  activity_description text not null default '',
  child_full_name text not null default '',
  child_id_number text not null default '',
  parent_a_name text not null default '',
  parent_a_id_number text not null default '',
  parent_a_signed_at timestamptz,
  parent_a_signature text,
  parent_b_name text not null default '',
  parent_b_id_number text not null default '',
  parent_b_signed_at timestamptz,
  parent_b_signature text,
  created_by text not null default 'a' check (created_by in ('a', 'b')),
  sent_to_partner_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. טבלת עדכונים באפליקציה
create table if not exists public.app_updates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  family_id uuid,
  target_parent_role text check (target_parent_role is null or target_parent_role in ('a', 'b')),
  update_type text not null default 'general',
  title text not null,
  body text not null default '',
  link_page text not null default 'updates',
  reference_id uuid,
  read_by_a boolean not null default false,
  read_by_b boolean not null default false,
  created_at timestamptz default now()
);

create index if not exists consent_forms_family_idx on public.consent_forms (family_id);
create index if not exists consent_forms_user_idx on public.consent_forms (user_id);
create index if not exists app_updates_family_idx on public.app_updates (family_id);

alter table public.consent_forms enable row level security;
alter table public.app_updates enable row level security;

-- 4. הרשאות — עובד גם עם משפחה וגם בלי
drop policy if exists "Users manage own consent forms" on public.consent_forms;
create policy "Users manage own consent forms" on public.consent_forms
  for all using (
    user_id = auth.uid()
    or (
      family_id is not null
      and exists (
        select 1 from public.family_members fm
        where fm.family_id = consent_forms.family_id
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
        where fm.family_id = consent_forms.family_id
          and fm.user_id = auth.uid()
      )
    )
  );

drop policy if exists "Users manage own app updates" on public.app_updates;
create policy "Users manage own app updates" on public.app_updates
  for all using (
    user_id = auth.uid()
    or (
      family_id is not null
      and exists (
        select 1 from public.family_members fm
        where fm.family_id = app_updates.family_id
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
        where fm.family_id = app_updates.family_id
          and fm.user_id = auth.uid()
      )
    )
  );

-- אם הרצת עד כאן בלי שגיאות — הכל מוכן!
select '✅ טבלאות האישורים נוצרו בהצלחה!' as result;
