-- 한국용 NAYESO 앱: Supabase SQL Editor에서 1회 실행
create table if not exists public.app_state (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.app_state (id, data)
values ('main', '{}'::jsonb)
on conflict (id) do nothing;

alter table public.app_state enable row level security;

drop policy if exists "anon read app_state" on public.app_state;
drop policy if exists "anon insert app_state" on public.app_state;
drop policy if exists "anon update app_state" on public.app_state;

create policy "anon read app_state" on public.app_state
for select to anon, authenticated using (true);
create policy "anon insert app_state" on public.app_state
for insert to anon, authenticated with check (true);
create policy "anon update app_state" on public.app_state
for update to anon, authenticated using (true) with check (true);
