import { useMemo, useState } from 'react'
import { STATUSES } from '../lib/statuses.js'
import GameCard from './GameCard.jsx'

const SORTS = {
  added: { label: 'Recently added', fn: (a, b) => b.added_at.localeCompare(a.added_at) },
  title: { label: 'Title', fn: (a, b) => a.title.localeCompare(b.title) },
  rating: { label: 'Rating', fn: (a, b) => (b.rating ?? -1) - (a.rating ?? -1) },
  playtime: {
    label: 'Playtime',
    fn: (a, b) => (b.playtime_hours ?? -1) - (a.playtime_hours ?? -1),
  },
}

const uniqueSorted = (lists) => [...new Set(lists.flat())].sort((a, b) => a.localeCompare(b))

export default function Library({ games, loading, onUpdate, onRemove, onGoSearch }) {
  const [status, setStatus] = useState('all')
  const [platform, setPlatform] = useState('')
  const [genre, setGenre] = useState('')
  const [text, setText] = useState('')
  const [sort, setSort] = useState('added')

  const platforms = useMemo(() => uniqueSorted(games.map((g) => g.platforms)), [games])
  const genres = useMemo(() => uniqueSorted(games.map((g) => g.genres)), [games])

  const counts = useMemo(() => {
    const c = { all: games.length }
    for (const g of games) c[g.status] = (c[g.status] ?? 0) + 1
    return c
  }, [games])

  const visible = useMemo(() => {
    const t = text.trim().toLowerCase()
    return games
      .filter(
        (g) =>
          (status === 'all' || g.status === status) &&
          (!platform || g.platforms.includes(platform)) &&
          (!genre || g.genres.includes(genre)) &&
          (!t || g.title.toLowerCase().includes(t)),
      )
      .sort(SORTS[sort].fn)
  }, [games, status, platform, genre, text, sort])

  if (loading) return <p className="muted">Loading your library…</p>

  if (games.length === 0) {
    return (
      <div className="empty">
        <h2>Your library is empty</h2>
        <p className="muted">Search for games and add them to start tracking your backlog.</p>
        <button onClick={onGoSearch}>Find games</button>
      </div>
    )
  }

  const filtered = status !== 'all' || platform || genre || text

  return (
    <section>
      <div className="status-pills">
        {[{ value: 'all', label: 'All' }, ...STATUSES].map((s) => (
          <button
            key={s.value}
            className={`pill ${status === s.value ? 'active' : ''}`}
            onClick={() => setStatus(s.value)}
          >
            {s.label} <span className="count">{counts[s.value] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="filters">
        <input
          type="search"
          placeholder="Filter by title…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
          <option value="">All platforms</option>
          {platforms.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <select value={genre} onChange={(e) => setGenre(e.target.value)}>
          <option value="">All genres</option>
          {genres.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          {Object.entries(SORTS).map(([k, s]) => (
            <option key={k} value={k}>
              Sort: {s.label}
            </option>
          ))}
        </select>
        {filtered && (
          <button
            className="ghost"
            onClick={() => {
              setStatus('all')
              setPlatform('')
              setGenre('')
              setText('')
            }}
          >
            Clear
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="muted">No games match these filters.</p>
      ) : (
        <div className="grid">
          {visible.map((g) => (
            <GameCard key={g.id} game={g} onUpdate={onUpdate} onRemove={onRemove} />
          ))}
        </div>
      )}
    </section>
  )
}
