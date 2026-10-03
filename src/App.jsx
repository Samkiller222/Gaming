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
      return
    }
    setLoading(true)
    supabase
      .from('games')
      .select('*')
      .order('added_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setGames(data)
        setLoading(false)
      })
  }, [userId])

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
    setGames((gs) => [data, ...gs])
  }, [])

  const updateGame = useCallback(async (id, patch) => {
    const { data, error } = await supabase
      .from('games')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    setGames((gs) => gs.map((g) => (g.id === id ? data : g)))
  }, [])

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
            loading={loading}
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
