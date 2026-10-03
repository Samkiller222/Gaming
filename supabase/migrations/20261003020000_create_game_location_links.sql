-- Many-to-many between games and the user's locations, so a game can be
-- owned in several places (e.g. Steam and a PS5 disc).
alter table public.games add constraint games_id_user_id_key unique (id, user_id);

create table public.game_location_links (
  game_id     uuid not null,
  location_id uuid not null,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (game_id, location_id),
  -- Composite FKs keep both ends owned by the same user (FK checks bypass RLS).
  foreign key (game_id, user_id) references public.games (id, user_id) on delete cascade,
  foreign key (location_id, user_id) references public.game_locations (id, user_id) on delete cascade
);

create index game_location_links_game_fk_idx on public.game_location_links (game_id, user_id);
create index game_location_links_location_fk_idx on public.game_location_links (location_id, user_id);

alter table public.game_location_links enable row level security;

create policy "game_location_links_select_own" on public.game_location_links
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "game_location_links_insert_own" on public.game_location_links
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "game_location_links_delete_own" on public.game_location_links
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Carry over any single-location picks made before this change.
insert into public.game_location_links (game_id, location_id, user_id)
select id, location_id, user_id from public.games where location_id is not null;
