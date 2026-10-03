-- Game backlog table. Each row is one game in one user's library.
create table public.games (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  rawg_id        integer not null,
  title          text not null,
  cover_url      text,
  platforms      text[] not null default '{}',
  genres         text[] not null default '{}',
  status         text not null default 'backlog'
                 check (status in ('wishlist', 'backlog', 'playing', 'completed', 'dropped')),
  playtime_hours numeric(7, 1) check (playtime_hours >= 0),
  rating         smallint check (rating between 1 and 10),
  started_at     date,
  finished_at    date,
  notes          text,
  added_at       timestamptz not null default now(),
  unique (user_id, rawg_id)
);

create index games_user_id_idx on public.games (user_id);
create index games_user_status_idx on public.games (user_id, status);

alter table public.games enable row level security;

create policy "games_select_own" on public.games
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "games_insert_own" on public.games
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "games_update_own" on public.games
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "games_delete_own" on public.games
  for delete to authenticated
  using ((select auth.uid()) = user_id);
