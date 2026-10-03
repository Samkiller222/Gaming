# Game Backlog

A personal game backlog manager: search games via the [RAWG API](https://rawg.io/apidocs),
add them to your library, track status/playtime/rating, and filter your collection.

Built with React + Vite, Supabase (email auth + Postgres with row-level security), and
deployed to GitHub Pages by GitHub Actions.

## Features

- Email/password sign up and sign in (Supabase Auth)
- Debounced RAWG search; add a game straight into any status
- Library grid filterable by status, platform, genre and title, sortable by date added,
  title, rating or playtime
- Status changes from the card (starting/finishing a game stamps `started_at`/`finished_at`)
- Per-game details: playtime, rating (1–10), dates, notes
- "Where" multi-select on each game (Steam, PS5 disc, Game Pass, …). Tick as many as
  apply; each user's list grows as they add entries, and the library can be filtered by it
- PlayStation trophies: connect a PSN online ID, sync trophy progress onto matching games
  (progress bar, per-grade counts, platinum badge), fix matches by hand, and import games
  from your PSN trophy list into the library
- Manage locations: rename or delete your places from the library toolbar or the bottom of
  any game's Where checklist (deleting removes the place from every game that had it)

## Database

`supabase/migrations/20261003000000_create_games.sql` creates `public.games`:

| column | type |
| --- | --- |
| `id` | uuid PK |
| `user_id` | uuid → `auth.users`, defaults to `auth.uid()` |
| `rawg_id` | integer (unique per user) |
| `title`, `cover_url`, `notes` | text |
| `platforms`, `genres` | text[] |
| `status` | `wishlist` \| `backlog` \| `playing` \| `completed` \| `dropped` |
| `playtime_hours` | numeric(7,1) |
| `rating` | smallint 1–10 |
| `started_at`, `finished_at` | date |
| `added_at` | timestamptz |

`public.game_locations` (`20261003010000_…`) holds each user's list of places
(`id`, `user_id`, `name`), unique per user case-insensitively.
`public.game_location_links` (`20261003020000_…`) links games to locations
(many-to-many). Composite foreign keys on `(game_id, user_id)` and
`(location_id, user_id)` ensure both ends belong to the same user; deleting a game or a
location removes its links. (`games.location_id` from the earlier single-select version is
no longer used.)

RLS is enabled on all three tables with policies restricted to `auth.uid() = user_id`
(links have select/insert/delete only), so each user only ever sees their own rows.

## PlayStation trophies

PSN has no official public API, so this uses the same unofficial API as the PlayStation
app via [`psn-api`](https://github.com/achievements-app/psn-api). It can change or break
without notice, and it is not endorsed by Sony.

How it fits together:

- `supabase/functions/psn-sync` (Edge Function) is the only code that talks to PSN. It
  signs in with **one** PSN login owned by the app owner (the `PSN_NPSSO` secret) and reads
  *public* trophy data, so users never give the app their PSN credentials. It runs with
  the caller's JWT, so all writes go through RLS.
- `supabase/migrations/20261003030000_create_psn_trophies.sql` adds `psn_accounts`
  (online ID → account ID), `psn_trophy_titles` (each trophy list with progress and
  per-grade counts) and `game_trophy_links` (game ↔ trophy list). All are per-user RLS.
- Matching games to trophy lists happens in the browser (`src/lib/psn.js`): titles are
  normalised (™/®, accents, punctuation, `&`/`and`) and compared exactly, or with a known
  edition/platform suffix such as "Director's Cut". PS5 lists win over PS4 ones. Any match
  can be changed or removed from the game card, and manual choices are never overwritten.
- Import looks each selected trophy list up on RAWG, adds the game (status from progress:
  platinum/100% → Completed, >0% → Playing, else Backlog) and links it.

Users need their trophies visible to **Anyone** (PS5: Settings → Users and Accounts →
Privacy → Gaming | Media → Trophies).

### Setting the PSN_NPSSO secret

1. In a browser, sign in at https://www.playstation.com with the PSN account the app
   should use (any account works; a spare one is fine).
2. In the same browser, open https://ca.account.sony.com/api/v1/ssocookie and copy the
   64-character `npsso` value.
3. In Supabase → Edge Functions → Secrets, add `PSN_NPSSO` with that value.

The token lasts about two months. When it expires, syncing shows "The server's PSN login
has expired"; repeat the steps above.

## Local development

```sh
cp .env.example .env.local   # fill in the values
npm install
npm run dev
```

| variable | where to get it |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API keys (publishable/anon key) |
| `VITE_RAWG_API_KEY` | https://rawg.io/apidocs |

All three end up in the client bundle. That is expected: the Supabase publishable key is
safe to expose because RLS guards the data, and RAWG keys are meant for client use.

## Deploying to GitHub Pages

1. In the repo, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
2. In **Settings → Secrets and variables → Actions**, add the repository secrets
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `VITE_RAWG_API_KEY`.
3. Push to `main` (or run the workflow manually). `.github/workflows/deploy.yml` builds
   with `VITE_BASE_PATH=/<repo-name>/` so assets resolve under
   `https://<user>.github.io/<repo-name>/`.
4. In Supabase → Authentication → URL Configuration, set the **Site URL** (and add a
   redirect URL) to your Pages URL so confirmation emails link back to the app.
