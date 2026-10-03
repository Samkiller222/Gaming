import { useMemo, useState } from 'react'
import TrophyCounts from './TrophyCounts.jsx'

// Trophy progress for one game, plus a picker to fix or remove the link.
export default function TrophyInfo({ game, psn, games }) {
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const link = psn.linkByGame[game.id]
  const t = link?.np_communication_id ? psn.titlesById[link.np_communication_id] : null

  const options = useMemo(() => {
    if (!picking) return []
    const titleOf = Object.fromEntries(games.map((g) => [g.id, g.title]))
    return [...psn.titles]
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((x) => {
        const owner = psn.gameByTitle[x.np_communication_id]
        return { ...x, takenBy: owner && owner !== game.id ? titleOf[owner] : null }
      })
  }, [picking, psn.titles, psn.gameByTitle, games, game.id])

  async function choose(value) {
    setBusy(true)
    setError('')
    try {
      await psn.setLink(game.id, value || null)
      setPicking(false)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (picking) {
    return (
      <div className="trophies">
        <select
          autoFocus
          aria-label="Trophy list"
          disabled={busy}
          value={t?.np_communication_id ?? ''}
          onChange={(e) => choose(e.target.value)}
        >
          <option value="">No trophy list</option>
          {options.map((x) => (
            <option key={x.np_communication_id} value={x.np_communication_id} disabled={!!x.takenBy}>
              {x.title} ({x.platform.replace(/,/g, '/')})
              {x.takenBy ? ` — linked to ${x.takenBy}` : ''}
            </option>
          ))}
        </select>
        <button type="button" className="link small" onClick={() => setPicking(false)}>
          Cancel
        </button>
        {error && <p className="error">{error}</p>}
      </div>
    )
  }

  if (!t) {
    return (
      <div className="trophies none">
        <span className="muted">No trophy list</span>
        <button type="button" className="link small" onClick={() => setPicking(true)}>
          Link
        </button>
      </div>
    )
  }

  return (
    <div className="trophies" title={`${t.title} (${t.platform})`}>
      <div className="trophy-row">
        <span className="trophy-pct">{t.progress}%</span>
        <div
          className="trophy-bar"
          role="progressbar"
          aria-valuenow={t.progress}
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <span style={{ width: `${t.progress}%` }} />
        </div>
        <button type="button" className="link small" onClick={() => setPicking(true)}>
          Change
        </button>
      </div>
      <TrophyCounts t={t} />
    </div>
  )
}
