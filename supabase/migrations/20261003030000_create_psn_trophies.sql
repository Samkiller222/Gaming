-- PlayStation trophy sync.

-- The PSN account each user has connected (by public online ID).
create table public.psn_accounts (
  user_id        uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  online_id      text not null,
  account_id     text not null,
  avatar_url     text,
  last_synced_at timestamptz,
  created_at     timestamptz not null default now()
);

-- The user's trophy lists as last fetched from PSN (one row per trophy set).
create table public.psn_trophy_titles (
  user_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  np_communication_id text not null,
  np_service_name     text not null,
  platform            text not null,
  title               text not null,
  icon_url            text,
  progress            smallint not null default 0,
  earned_bronze       integer not null default 0,
  earned_silver       integer not null default 0,
  earned_gold         integer not null default 0,
  earned_platinum     integer not null default 0,
  defined_bronze      integer not null default 0,
  defined_silver      integer not null default 0,
  defined_gold        integer not null default 0,
  defined_platinum    integer not null default 0,
  last_updated        timestamptz,
  synced_at           timestamptz not null default now(),
  primary key (user_id, np_communication_id)
);

-- Which trophy list belongs to which game. A row with a null
-- np_communication_id records "manually unlinked" so auto-matching skips it.
create table public.game_trophy_links (
  game_id             uuid primary key,
  user_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  np_communication_id text,
  matched_by          text not null check (matched_by in ('auto', 'manual')),
  created_at          timestamptz not null default now(),
  unique (user_id, np_communication_id),
  foreign key (game_id, user_id) references public.games (id, user_id) on delete cascade,
  foreign key (user_id, np_communication_id)
    references public.psn_trophy_titles (user_id, np_communication_id) on delete cascade
);

create index game_trophy_links_game_fk_idx on public.game_trophy_links (game_id, user_id);

alter table public.psn_accounts enable row level security;
alter table public.psn_trophy_titles enable row level security;
alter table public.game_trophy_links enable row level security;

create policy "psn_accounts_all_own" on public.psn_accounts
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "psn_trophy_titles_all_own" on public.psn_trophy_titles
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "game_trophy_links_all_own" on public.game_trophy_links
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
