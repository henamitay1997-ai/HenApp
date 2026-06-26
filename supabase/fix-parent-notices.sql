-- תיקון תזכורות — הרץ/י אם parent-notices.sql כבר הורץ אבל עדיין יש שגיאה

grant usage on schema public to authenticated, anon;
grant select, insert, update, delete on public.parent_notices to authenticated;

alter table public.parent_notices enable row level security;

drop policy if exists "Family members manage parent notices" on public.parent_notices;
create policy "Family members manage parent notices" on public.parent_notices
  for all using (
    user_id = auth.uid()
    or (
      family_id is not null
      and exists (
        select 1 from public.family_members fm
        where fm.family_id = parent_notices.family_id
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
        where fm.family_id = parent_notices.family_id
          and fm.user_id = auth.uid()
      )
    )
  );

notify pgrst, 'reload schema';

select '✅ תיקון תזכורות הושלם' as result;
