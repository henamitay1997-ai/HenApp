-- ============================================================
-- תיקון שמירת נתונים — הרץ/י אם נתונים לא נשמרים
-- ============================================================

-- תיקון ensure_user_family: גם מתקן נתונים יתומים
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

  if v_family_id is null then
    v_code := public.generate_invite_code();
    insert into public.families (name, invite_code) values ('המשפחה שלנו', v_code) returning id into v_family_id;
    insert into public.family_members (family_id, user_id, parent_role) values (v_family_id, auth.uid(), 'a');
    insert into public.family_settings (family_id) values (v_family_id) on conflict do nothing;
    insert into public.user_family_prefs (user_id, family_id, current_parent) values (auth.uid(), v_family_id, 'a') on conflict do nothing;
  end if;

  -- ודא שיש הגדרות משפחה
  insert into public.family_settings (family_id)
  values (v_family_id) on conflict do nothing;

  -- תיקון נתונים יתומים (ללא family_id)
  update public.children set family_id = v_family_id where user_id = auth.uid() and (family_id is null or family_id != v_family_id);
  update public.events set family_id = v_family_id where user_id = auth.uid() and (family_id is null or family_id != v_family_id);
  update public.expenses set family_id = v_family_id where user_id = auth.uid() and (family_id is null or family_id != v_family_id);
  update public.messages set family_id = v_family_id where user_id = auth.uid() and (family_id is null or family_id != v_family_id);

  return v_family_id;
end;
$$;

-- מדיניות גיבוי: גישה לפי user_id כשאין family_id
drop policy if exists "Users fallback children" on public.children;
drop policy if exists "Users fallback events" on public.events;
drop policy if exists "Users fallback expenses" on public.expenses;
drop policy if exists "Users fallback messages" on public.messages;

create policy "Users fallback children" on public.children
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users fallback events" on public.events
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users fallback expenses" on public.expenses
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users fallback messages" on public.messages
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- תיקון כל הנתונים הקיימים של כל המשתמשים
do $$
declare
  r record;
  v_family_id uuid;
begin
  for r in
    select distinct fm.user_id, fm.family_id
    from public.family_members fm
  loop
    update public.children set family_id = r.family_id where user_id = r.user_id and family_id is null;
    update public.events set family_id = r.family_id where user_id = r.user_id and family_id is null;
    update public.expenses set family_id = r.family_id where user_id = r.user_id and family_id is null;
    update public.messages set family_id = r.family_id where user_id = r.user_id and family_id is null;
  end loop;

  -- משתמשים עם נתונים אבל בלי משפחה
  for r in
    select distinct c.user_id as uid
    from public.children c
    where c.user_id is not null
      and not exists (select 1 from public.family_members fm where fm.user_id = c.user_id)
  loop
    v_code := public.generate_invite_code();
    insert into public.families (name, invite_code) values ('המשפחה שלנו', v_code) returning id into v_family_id;
    insert into public.family_members (family_id, user_id, parent_role) values (v_family_id, r.uid, 'a');
    insert into public.family_settings (family_id) values (v_family_id) on conflict do nothing;
    insert into public.user_family_prefs (user_id, family_id, current_parent) values (r.uid, v_family_id, 'a') on conflict do nothing;
    update public.children set family_id = v_family_id where user_id = r.uid and family_id is null;
    update public.events set family_id = v_family_id where user_id = r.uid and family_id is null;
    update public.expenses set family_id = v_family_id where user_id = r.uid and family_id is null;
    update public.messages set family_id = v_family_id where user_id = r.uid and family_id is null;
  end loop;
end $$;

grant execute on function public.ensure_user_family() to authenticated;
