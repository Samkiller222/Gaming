-- Per-user list of places a game is owned (Steam, PS5 disc, Game Pass, ...).
-- The list grows as each user adds new entries from the library.
create table public.game_locations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (length(trim(name)) between 1 and 60),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create unique index game_locations_user_name_idx
  on public.game_locations (user_id, lower(trim(name)));

alter table public.game_locations enable row level security;

create policy "game_locations_select_own" on public.game_locations
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "game_locations_insert_own" on public.game_locations
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "game_locations_update_own" on public.game_locations
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "game_locations_delete_own" on public.game_locations
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- The composite foreign key makes sure a game can only point at a location
-- owned by the same user (FK checks bypass RLS, so this is the real guard).
alter table public.games
  add column location_id uuid,
  add constraint games_location_fk
    foreign key (location_id, user_id)
    references public.game_locations (id, user_id)
    on delete set null (location_id);

create index games_location_id_idx on public.games (location_id);
