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
- "Where" dropdown on each game (Steam, PS5 disc, Game Pass, …). Each user's list grows
  as they add entries via "+ Add new…", and the library can be filtered by it

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
| `location_id` | uuid → `game_locations`, nullable |

`supabase/migrations/20261003010000_create_game_locations.sql` creates
`public.game_locations` (`id`, `user_id`, `name`, `created_at`), unique per user
(case-insensitive). A composite foreign key `(location_id, user_id)` ensures a game can
only reference a location owned by the same user; deleting a location clears it from
those games.

RLS is enabled on both tables with select/insert/update/delete policies restricted to
`auth.uid() = user_id`, so each user only ever sees their own rows.

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
