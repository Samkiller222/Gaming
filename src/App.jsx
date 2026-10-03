import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, supabaseConfigured } from './lib/supabase.js'
import { rawgConfigured } from './lib/rawg.js'
import Auth from './components/Auth.jsx'
import Search from './components/Search.jsx'
import Library from './components/Library.jsx'

export default function App() {
  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [tab, setTab] = useState('library')
  const [games, setGames] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id

  useEffect(() => {
    if (!userId) {
      setGames([])
      setLocations([])
      return
    }
    setLoading(true)
    Promise.all([
      supabase
        .from('games')
        .select('*, links:game_location_links(location_id)')
        .order('added_at', { ascending: false }),
      supabase.from('game_locations').select('*').order('name'),
    ]).then(([games, locations]) => {
      const err = games.error ?? locations.error
      if (err) setError(err.message)
      else {
        setGames(
          games.data.map(({ links, ...g }) => ({
            ...g,
            location_ids: links.map((l) => l.location_id),
          })),
        )
        setLocations(locations.data)
      }
      setLoading(false)
    })
  }, [userId])

  // Reuse an existing location when the name matches case-insensitively,
  // otherwise add it to this user's list.
  const addLocation = useCallback(
    async (name) => {
      const existing = locations.find((l) => l.name.toLowerCase() === name.toLowerCase())
      if (existing) return existing
      const { data, error } = await supabase
        .from('game_locations')
        .insert({ name })
        .select()
        .single()
      if (error) throw error
      setLocations((ls) => [...ls, data].sort((a, b) => a.name.localeCompare(b.name)))
      return data
    },
    [locations],
  )

  const addGame = useCallback(async (game, status) => {
    const { data, error } = await supabase
      .from('games')
      .insert({
        rawg_id: game.rawg_id,
        title: game.title,
        cover_url: game.cover_url,
        platforms: game.platforms,
        genres: game.genres,
        status,
      })
      .select()
      .single()
    if (error) throw error
    setGames((gs) => [{ ...data, location_ids: [] }, ...gs])
  }, [])

  const updateGame = useCallback(async (id, patch) => {
    const { data, error } = await supabase
      .from('games')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    setGames((gs) => gs.map((g) => (g.id === id ? { ...g, ...data } : g)))
  }, [])

  // Sync a game's locations to `ids` by inserting/deleting only the differences.
  // The UI updates immediately and rolls back if either request fails.
  const setGameLocations = useCallback(
    async (gameId, ids) => {
      const current = games.find((g) => g.id === gameId)?.location_ids ?? []
      const added = ids.filter((id) => !current.includes(id))
      const removed = current.filter((id) => !ids.includes(id))
      const apply = (location_ids) =>
        setGames((gs) => gs.map((g) => (g.id === gameId ? { ...g, location_ids } : g)))
      apply(ids)
      try {
        if (added.length) {
          const { error } = await supabase
            .from('game_location_links')
            .insert(added.map((location_id) => ({ game_id: gameId, location_id })))
          if (error) throw error
        }
        if (removed.length) {
          const { error } = await supabase
            .from('game_location_links')
            .delete()
            .eq('game_id', gameId)
            .in('location_id', removed)
          if (error) throw error
        }
      } catch (e) {
        apply(current)
        throw e
      }
    },
    [games],
  )

  const removeGame = useCallback(async (id) => {
    const { error } = await supabase.from('games').delete().eq('id', id)
    if (error) throw error
    setGames((gs) => gs.filter((g) => g.id !== id))
  }, [])

  const ownedIds = useMemo(() => new Set(games.map((g) => g.rawg_id)), [games])

  if (!supabaseConfigured) {
    return (
      <Notice title="Supabase is not configured">
        Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> (see{' '}
        <code>.env.example</code>) and restart the dev server.
      </Notice>
    )
  }
  if (!authReady) return null
  if (!session) return <Auth />

  return (
    <div className="app">
      <header className="topbar">
        <h1>Backlog</h1>
        <nav className="tabs">
          <button className={tab === 'library' ? 'active' : ''} onClick={() => setTab('library')}>
            Library <span className="count">{games.length}</span>
          </button>
          <button className={tab === 'search' ? 'active' : ''} onClick={() => setTab('search')}>
            Search
          </button>
        </nav>
        <div className="user">
          <span>{session.user.email}</span>
          <button className="ghost" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </header>

      <main>
        {error && <p className="error">{error}</p>}
        {tab === 'library' ? (
          <Library
            games={games}
            locations={locations}
            loading={loading}
            onAddLocation={addLocation}
            onSetLocations={setGameLocations}
            onUpdate={updateGame}
            onRemove={removeGame}
            onGoSearch={() => setTab('search')}
          />
        ) : rawgConfigured ? (
          <Search ownedIds={ownedIds} onAdd={addGame} />
        ) : (
          <Notice title="RAWG is not configured">
            Set <code>VITE_RAWG_API_KEY</code> to enable search.
          </Notice>
        )}
      </main>

      <footer>
        Game data from{' '}
        <a href="https://rawg.io" target="_blank" rel="noreferrer">
          RAWG
        </a>
      </footer>
    </div>
  )
}

function Notice({ title, children }) {
  return (
    <div className="notice">
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  )
}
