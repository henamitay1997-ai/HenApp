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

-- 3. טבלת עדכונים
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

-- 4. הרשאות API (חשוב!)
grant usage on schema public to authenticated, anon;
grant select, insert, update, delete on public.consent_forms to authenticated;
grant select, insert, update, delete on public.app_updates to authenticated;

-- 5. RLS — אותו עיקרון כמו הוצאות / הודעות
alter table public.consent_forms enable row level security;
alter table public.app_updates enable row level security;

drop policy if exists "Users manage own consent forms" on public.consent_forms;
drop policy if exists "Family members manage consent forms" on public.consent_forms;
create policy "Family members manage consent forms" on public.consent_forms
  for all using (
    (family_id is not null and family_id in (select public.user_family_ids()))
    or user_id = auth.uid()
  )
  with check (
    (family_id is not null and family_id in (select public.user_family_ids()))
    or user_id = auth.uid()
  );

drop policy if exists "Users manage own app updates" on public.app_updates;
drop policy if exists "Family members manage app updates" on public.app_updates;
create policy "Family members manage app updates" on public.app_updates
  for all using (
    (family_id is not null and family_id in (select public.user_family_ids()))
    or user_id = auth.uid()
  )
  with check (
    (family_id is not null and family_id in (select public.user_family_ids()))
    or user_id = auth.uid()
  );

-- 6. רענון cache של ה-API (חובה אחרי יצירת טבלאות!)
notify pgrst, 'reload schema';

select '✅ טבלאות האישורים מוכנות! רענני/י את האתר (Ctrl+F5) ונסי/י שוב.' as result;
