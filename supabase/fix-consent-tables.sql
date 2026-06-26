-- תיקון טבלאות אישורים — הרץ/י אם consent-forms.sql כבר הורץ אבל עדיין יש שגיאה
-- SQL Editor → הדבק/י הכל → Run

grant usage on schema public to authenticated, anon;
grant select, insert, update, delete on public.consent_forms to authenticated;
grant select, insert, update, delete on public.app_updates to authenticated;

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

notify pgrst, 'reload schema';

select '✅ תיקון הושלם — רענני/י את האתר' as result;
