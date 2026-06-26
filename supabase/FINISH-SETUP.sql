-- FINISH-SETUP.sql — run this if RUN-NOW stopped with "policy already exists"
-- Supabase -> SQL Editor -> New query -> paste all -> Run

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
    raise exception 'Must be logged in to join family';
  end if;

  select id into v_family_id
  from public.families where invite_code = upper(trim(p_invite_code));

  if v_family_id is null then
    raise exception 'Invalid invite code';
  end if;

  if exists (select 1 from public.family_members where family_id = v_family_id and user_id = auth.uid()) then
    return jsonb_build_object('family_id', v_family_id, 'already_member', true);
  end if;

  select count(*) into v_member_count from public.family_members where family_id = v_family_id;
  if v_member_count >= 2 then
    raise exception 'Family is full';
  end if;

  if exists (select 1 from public.family_members where family_id = v_family_id and parent_role = 'a') then
    v_assigned_role := 'b';
  else
    v_assigned_role := 'a';
  end if;

  select family_id into v_old_family_id
  from public.family_members where user_id = auth.uid() limit 1;

  if v_old_family_id is not null and v_old_family_id != v_family_id then
    select count(*) into v_old_member_count from public.family_members where family_id = v_old_family_id;
    if v_old_member_count > 1 then
      raise exception 'Already in a family with another parent';
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
  insert into public.families (name, invite_code) values ('Our Family', v_code) returning id into v_family_id;
  insert into public.family_members (family_id, user_id, parent_role) values (v_family_id, new.id, 'a');
  insert into public.family_settings (family_id) values (v_family_id);
  insert into public.user_family_prefs (user_id, family_id, current_parent) values (new.id, v_family_id, 'a');

  return new;
end;
$$;

grant execute on function public.ensure_user_family() to authenticated;
grant execute on function public.join_family_by_code(text) to authenticated;

drop policy if exists "Family members read partner profiles" on public.profiles;
create policy "Family members read partner profiles" on public.profiles
  for select using (
    id in (
      select fm2.user_id from public.family_members fm1
      join public.family_members fm2 on fm1.family_id = fm2.family_id
      where fm1.user_id = auth.uid()
    )
  );

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
    insert into public.families (name, invite_code) values ('Our Family', v_code) returning id into v_family_id;
    insert into public.family_members (family_id, user_id, parent_role) values (v_family_id, auth.uid(), 'a');
    insert into public.family_settings (family_id) values (v_family_id) on conflict do nothing;
    insert into public.user_family_prefs (user_id, family_id, current_parent) values (auth.uid(), v_family_id, 'a') on conflict do nothing;
  end if;

  insert into public.family_settings (family_id)
  values (v_family_id) on conflict do nothing;

  update public.children set family_id = v_family_id where user_id = auth.uid() and (family_id is null or family_id != v_family_id);
  update public.events set family_id = v_family_id where user_id = auth.uid() and (family_id is null or family_id != v_family_id);
  update public.expenses set family_id = v_family_id where user_id = auth.uid() and (family_id is null or family_id != v_family_id);
  update public.messages set family_id = v_family_id where user_id = auth.uid() and (family_id is null or family_id != v_family_id);

  return v_family_id;
end;
$$;

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

do $$
declare
  r record;
  v_family_id uuid;
  v_code text;
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

  for r in
    select distinct c.user_id as uid
    from public.children c
    where c.user_id is not null
      and not exists (select 1 from public.family_members fm where fm.user_id = c.user_id)
  loop
    v_code := public.generate_invite_code();
    insert into public.families (name, invite_code) values ('Our Family', v_code) returning id into v_family_id;
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

alter table public.family_settings
  add column if not exists parent_a_avatar text,
  add column if not exists parent_b_avatar text;

alter table public.user_settings
  add column if not exists parent_a_avatar text,
  add column if not exists parent_b_avatar text;

alter table public.children
  add column if not exists avatar_url text;
