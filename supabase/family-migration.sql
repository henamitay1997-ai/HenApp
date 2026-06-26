-- ============================================================
-- מיגרציה: שיתוף משפחה בין הורים
-- הרץ/י ב-Supabase SQL Editor אחרי schema.sql הקודם
-- ============================================================

-- פונקציית עזר: משפחות של המשתמש
create or replace function public.user_family_ids()
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select family_id from public.family_members where user_id = auth.uid();
$$;

-- יצירת קוד הזמנה
create or replace function public.generate_invite_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
  attempts int := 0;
begin
  loop
    result := '';
    for i in 1..8 loop
      result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    end loop;
  exit when not exists (select 1 from public.families where invite_code = result);
    attempts := attempts + 1;
    if attempts > 20 then
      raise exception 'לא ניתן ליצור קוד הזמנה';
    end if;
  end loop;
  return result;
end;
$$;

-- משפחות
create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'המשפחה שלנו',
  invite_code text unique not null,
  created_at timestamptz default now()
);

-- חברי משפחה
create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references public.families on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  parent_role text not null check (parent_role in ('a', 'b')),
  joined_at timestamptz default now(),
  unique (family_id, user_id),
  unique (family_id, parent_role)
);

-- הגדרות משפחה (משותפות)
create table if not exists public.family_settings (
  family_id uuid references public.families on delete cascade primary key,
  parent_a_name text not null default 'הורה א',
  parent_b_name text not null default 'הורה ב',
  custody_pattern text not null default 'alternating-weeks',
  custody_start_date date not null default current_date,
  week_schedule jsonb not null default '{"0":"a","1":"a","2":"a","3":"b","4":"b","5":"b","6":"b"}'::jsonb,
  updated_at timestamptz default now()
);

-- העדפת משתמש: באיזה הורה אני פועל/ת
create table if not exists public.user_family_prefs (
  user_id uuid references auth.users on delete cascade not null,
  family_id uuid references public.families on delete cascade not null,
  current_parent text not null default 'a' check (current_parent in ('a', 'b')),
  primary key (user_id, family_id)
);

alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.family_settings enable row level security;
alter table public.user_family_prefs enable row level security;

-- הוספת family_id לטבלאות קיימות
alter table public.children add column if not exists family_id uuid references public.families on delete cascade;
alter table public.events add column if not exists family_id uuid references public.families on delete cascade;
alter table public.expenses add column if not exists family_id uuid references public.families on delete cascade;
alter table public.messages add column if not exists family_id uuid references public.families on delete cascade;

-- מיגרציית נתונים קיימים: כל משתמש מקבל משפחה משלו
do $$
declare
  r record;
  v_family_id uuid;
  v_code text;
begin
  for r in select id from auth.users loop
    if not exists (select 1 from public.family_members where user_id = r.id) then
      v_code := public.generate_invite_code();
      insert into public.families (name, invite_code) values ('המשפחה שלנו', v_code) returning id into v_family_id;
      insert into public.family_members (family_id, user_id, parent_role) values (v_family_id, r.id, 'a');
      insert into public.family_settings (family_id)
      select v_family_id
      where not exists (select 1 from public.family_settings where family_id = v_family_id);
      insert into public.user_family_prefs (user_id, family_id, current_parent)
      values (r.id, v_family_id, 'a')
      on conflict do nothing;

      -- העבר הגדרות מ-user_settings אם קיימות
      update public.family_settings fs set
        parent_a_name = us.parent_a_name,
        parent_b_name = us.parent_b_name,
        custody_pattern = us.custody_pattern,
        custody_start_date = us.custody_start_date,
        week_schedule = us.week_schedule
      from public.user_settings us
      where fs.family_id = v_family_id and us.user_id = r.id;

      -- העבר נתונים למשפחה
      update public.children set family_id = v_family_id where user_id = r.id and family_id is null;
      update public.events set family_id = v_family_id where user_id = r.id and family_id is null;
      update public.expenses set family_id = v_family_id where user_id = r.id and family_id is null;
      update public.messages set family_id = v_family_id where user_id = r.id and family_id is null;

      update public.user_family_prefs set current_parent = us.current_parent
      from public.user_settings us
      where user_family_prefs.user_id = r.id and user_family_prefs.family_id = v_family_id and us.user_id = r.id;
    end if;
  end loop;
end $$;

-- אינדקסים
create index if not exists idx_family_members_user on public.family_members(user_id);
create index if not exists idx_children_family on public.children(family_id);
create index if not exists idx_events_family on public.events(family_id, date);
create index if not exists idx_expenses_family on public.expenses(family_id, date);
create index if not exists idx_messages_family on public.messages(family_id, created_at);
create index if not exists idx_families_invite on public.families(invite_code);

-- RLS: משפחות
drop policy if exists "Members read family" on public.families;
drop policy if exists "Members read family members" on public.family_members;
drop policy if exists "Members read family settings" on public.family_settings;
drop policy if exists "Members manage family settings" on public.family_settings;
drop policy if exists "Users manage own prefs" on public.user_family_prefs;
drop policy if exists "Anyone can lookup invite code" on public.families;

create policy "Members read family" on public.families
  for select using (id in (select public.user_family_ids()));

create policy "Members read family members" on public.family_members
  for select using (family_id in (select public.user_family_ids()));

create policy "Members read family settings" on public.family_settings
  for select using (family_id in (select public.user_family_ids()));

create policy "Members manage family settings" on public.family_settings
  for all using (family_id in (select public.user_family_ids()))
  with check (family_id in (select public.user_family_ids()));

create policy "Users manage own prefs" on public.user_family_prefs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- עדכון RLS לטבלאות נתונים
drop policy if exists "Users manage own children" on public.children;
drop policy if exists "Users manage own events" on public.events;
drop policy if exists "Users manage own expenses" on public.expenses;
drop policy if exists "Users manage own messages" on public.messages;

create policy "Family members manage children" on public.children
  for all using (family_id in (select public.user_family_ids()))
  with check (family_id in (select public.user_family_ids()));

create policy "Family members manage events" on public.events
  for all using (family_id in (select public.user_family_ids()))
  with check (family_id in (select public.user_family_ids()));

create policy "Family members manage expenses" on public.expenses
  for all using (family_id in (select public.user_family_ids()))
  with check (family_id in (select public.user_family_ids()));

create policy "Family members manage messages" on public.messages
  for all using (family_id in (select public.user_family_ids()))
  with check (family_id in (select public.user_family_ids()));

-- יצירת משפחה למשתמש חדש
create or replace function public.ensure_user_family()
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_family_id uuid;
  v_code text;
begin
  select family_id into v_family_id
  from public.family_members where user_id = auth.uid() limit 1;

  if v_family_id is not null then
    -- ודא הגדרות + תיקון נתונים יתומים
    insert into public.family_settings (family_id) values (v_family_id) on conflict do nothing;
    update public.children set family_id = v_family_id where user_id = auth.uid() and family_id is null;
    update public.events set family_id = v_family_id where user_id = auth.uid() and family_id is null;
    update public.expenses set family_id = v_family_id where user_id = auth.uid() and family_id is null;
    update public.messages set family_id = v_family_id where user_id = auth.uid() and family_id is null;
    return v_family_id;
  end if;

  v_code := public.generate_invite_code();
  insert into public.families (name, invite_code) values ('המשפחה שלנו', v_code) returning id into v_family_id;
  insert into public.family_members (family_id, user_id, parent_role) values (v_family_id, auth.uid(), 'a');
  insert into public.family_settings (family_id) values (v_family_id);
  insert into public.user_family_prefs (user_id, family_id, current_parent) values (auth.uid(), v_family_id, 'a');

  return v_family_id;
end;
$$;

-- הצטרפות למשפחה לפי קוד
create or replace function public.join_family_by_code(p_invite_code text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_family_id uuid;
  v_member_count int;
  v_assigned_role text;
  v_old_family_id uuid;
  v_old_member_count int;
begin
  if auth.uid() is null then
    raise exception 'יש להתחבר כדי להצטרף למשפחה';
  end if;

  select id into v_family_id
  from public.families where invite_code = upper(trim(p_invite_code));

  if v_family_id is null then
    raise exception 'קוד הזמנה לא תקין';
  end if;

  if exists (select 1 from public.family_members where family_id = v_family_id and user_id = auth.uid()) then
    return jsonb_build_object('family_id', v_family_id, 'already_member', true);
  end if;

  select count(*) into v_member_count from public.family_members where family_id = v_family_id;
  if v_member_count >= 2 then
    raise exception 'המשפחה מלאה — כבר יש 2 הורים מחוברים';
  end if;

  if exists (select 1 from public.family_members where family_id = v_family_id and parent_role = 'a') then
    v_assigned_role := 'b';
  else
    v_assigned_role := 'a';
  end if;

  -- עזיבת משפחה ישנה אם המשתמש לבד בה
  select family_id into v_old_family_id
  from public.family_members where user_id = auth.uid() limit 1;

  if v_old_family_id is not null and v_old_family_id != v_family_id then
    select count(*) into v_old_member_count from public.family_members where family_id = v_old_family_id;
    if v_old_member_count > 1 then
      raise exception 'כבר את/ה חלק ממשפחה עם הורה נוסף. צא/י מהמשפחה הנוכחית קודם.';
    end if;
    delete from public.family_members where user_id = auth.uid() and family_id = v_old_family_id;
    delete from public.user_family_prefs where user_id = auth.uid() and family_id = v_old_family_id;
    delete from public.families where id = v_old_family_id;
  end if;

  insert into public.family_members (family_id, user_id, parent_role)
  values (v_family_id, auth.uid(), v_assigned_role);

  insert into public.user_family_prefs (user_id, family_id, current_parent)
  values (auth.uid(), v_family_id, v_assigned_role)
  on conflict (user_id, family_id) do update set current_parent = v_assigned_role;

  return jsonb_build_object(
    'family_id', v_family_id,
    'parent_role', v_assigned_role,
    'already_member', false
  );
end;
$$;

-- עדכון trigger למשתמש חדש
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_family_id uuid;
  v_code text;
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.email)
  on conflict (id) do nothing;

  v_code := public.generate_invite_code();
  insert into public.families (name, invite_code) values ('המשפחה שלנו', v_code) returning id into v_family_id;
  insert into public.family_members (family_id, user_id, parent_role) values (v_family_id, new.id, 'a');
  insert into public.family_settings (family_id) values (v_family_id);
  insert into public.user_family_prefs (user_id, family_id, current_parent) values (new.id, v_family_id, 'a');

  return new;
end;
$$;

grant execute on function public.ensure_user_family() to authenticated;
grant execute on function public.join_family_by_code(text) to authenticated;

-- הרשאת קריאת פרופילים של בני משפחה
drop policy if exists "Family members read partner profiles" on public.profiles;
create policy "Family members read partner profiles" on public.profiles
  for select using (
    id in (
      select fm2.user_id from public.family_members fm1
      join public.family_members fm2 on fm1.family_id = fm2.family_id
      where fm1.user_id = auth.uid()
    )
  );
