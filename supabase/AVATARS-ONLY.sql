-- AVATARS-ONLY.sql — run in Supabase SQL Editor (safe to run again)

alter table public.family_settings
  add column if not exists parent_a_avatar text,
  add column if not exists parent_b_avatar text;

alter table public.user_settings
  add column if not exists parent_a_avatar text,
  add column if not exists parent_b_avatar text;

alter table public.children
  add column if not exists avatar_url text;
