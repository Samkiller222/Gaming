import { useEffect, useState } from 'react'
import { searchGames } from '../lib/rawg.js'
import { STATUSES } from '../lib/statuses.js'

export default function Search({ ownedIds, onAdd }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Debounced search as the user types.
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      setError('')
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setLoading(true)
      searchGames(q, { signal: controller.signal })
        .then((r) => {
          setResults(r)
          setError('')
        })
        .catch((e) => e.name !== 'AbortError' && setError(e.message))
        .finally(() => !controller.signal.aborted && setLoading(false))
    }, 350)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  return (
    <section>
      <input
        className="search-input"
        type="search"
        placeholder="Search RAWG for a game…"
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Searching…</p>}
      {!loading && query.trim().length >= 2 && results.length === 0 && !error && (
        <p className="muted">No games found.</p>
      )}
      <div className="grid">
        {results.map((game) => (
          <SearchResult
            key={game.rawg_id}
            game={game}
            owned={ownedIds.has(game.rawg_id)}
            onAdd={onAdd}
          />
        ))}
      </div>
    </section>
  )
}

function SearchResult({ game, owned, onAdd }) {
  const [status, setStatus] = useState('backlog')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function add() {
    setBusy(true)
    setError('')
    try {
      await onAdd(game, status)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="card">
      <Cover src={game.cover_url} title={game.title} />
      <div className="card-body">
        <h3>{game.title}</h3>
        <p className="meta">
          {game.released?.slice(0, 4) ?? 'TBA'}
          {game.genres.length > 0 && ` · ${game.genres.slice(0, 2).join(', ')}`}
        </p>
        <p className="meta platforms">{game.platforms.join(', ')}</p>
        {owned ? (
          <p className="owned">✓ In your library</p>
        ) : (
          <div className="add-row">
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <button onClick={add} disabled={busy}>
              {busy ? 'Adding…' : 'Add'}
            </button>
          </div>
        )}
        {error && <p className="error">{error}</p>}
      </div>
    </article>
  )
}

export function Cover({ src, title }) {
  // RAWG serves resized images under /media/resize/<w>/-/...
  const thumb =
    src?.startsWith('https://media.rawg.io/media/') && !src.includes('/resize/')
      ? src.replace('/media/', '/media/resize/420/-/')
      : src
  return thumb ? (
    <img className="cover" src={thumb} alt="" loading="lazy" />
  ) : (
    <div className="cover placeholder">{title.slice(0, 1)}</div>
  )
}
