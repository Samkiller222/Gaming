import { useState } from 'react'
import { STATUSES, statusPatch } from '../lib/statuses.js'
import { Cover } from './Search.jsx'
import LocationPicker from './LocationPicker.jsx'
import TrophyInfo from './TrophyInfo.jsx'
import { Cup } from './TrophyCounts.jsx'

export default function GameCard({
  game,
  locations,
  onUpdate,
  onRemove,
  onAddLocation,
  onSetLocations,
  onManageLocations,
  psn,
  games,
}) {
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function run(action) {
    setBusy(true)
    setError('')
    try {
      await action()
      return true
    } catch (e) {
      setError(e.message)
      return false
    } finally {
      setBusy(false)
    }
  }

  const changeStatus = (status) => run(() => onUpdate(game.id, statusPatch(game, status)))

  const remove = () => {
    if (confirm(`Remove "${game.title}" from your library?`)) run(() => onRemove(game.id))
  }

  return (
    <article className={`card status-${game.status}`}>
      <Cover src={game.cover_url} title={game.title} />
      {hasPlatinum(game, psn) && (
        <span className="platinum-badge" title="Platinum earned">
          <Cup /> Platinum
        </span>
      )}
      <span className="badge">{STATUSES.find((s) => s.value === game.status)?.label}</span>
      <div className="card-body">
        <h3>{game.title}</h3>
        <p className="meta">
          {game.genres.slice(0, 2).join(', ') || '—'}
          {game.rating != null && <span className="rating"> · ★ {game.rating}/10</span>}
          {game.playtime_hours != null && ` · ${game.playtime_hours}h`}
        </p>
        <select
          aria-label="Status"
          value={game.status}
          disabled={busy}
          onChange={(e) => changeStatus(e.target.value)}
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <LocationPicker
          value={game.location_ids}
          locations={locations}
          disabled={busy}
          onAddLocation={onAddLocation}
          onManage={onManageLocations}
          onChange={(ids) => run(() => onSetLocations(game.id, ids))}
        />
        {psn.account && <TrophyInfo game={game} psn={psn} games={games} />}

        {editing ? (
          <DetailsForm
            game={game}
            busy={busy}
            onCancel={() => setEditing(false)}
            onSave={async (patch) => {
              if (await run(() => onUpdate(game.id, patch))) setEditing(false)
            }}
          />
        ) : (
          <div className="card-actions">
            <button className="ghost" onClick={() => setEditing(true)}>
              Details
            </button>
            <button className="ghost danger" onClick={remove} disabled={busy}>
              Remove
            </button>
          </div>
        )}
        {error && <p className="error">{error}</p>}
      </div>
    </article>
  )
}

function hasPlatinum(game, psn) {
  const np = psn.linkByGame[game.id]?.np_communication_id
  return np ? psn.titlesById[np]?.earned_platinum > 0 : false
}

const blankToNull = (v) => (v === '' ? null : v)

function DetailsForm({ game, busy, onSave, onCancel }) {
  const [form, setForm] = useState({
    playtime_hours: game.playtime_hours ?? '',
    rating: game.rating ?? '',
    started_at: game.started_at ?? '',
    finished_at: game.finished_at ?? '',
    notes: game.notes ?? '',
  })
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  function submit(e) {
    e.preventDefault()
    onSave({
      playtime_hours: blankToNull(form.playtime_hours),
      rating: form.rating === '' ? null : Number(form.rating),
      started_at: blankToNull(form.started_at),
      finished_at: blankToNull(form.finished_at),
      notes: form.notes.trim() || null,
    })
  }

  return (
    <form className="details" onSubmit={submit}>
      <div className="row">
        <label>
          Hours
          <input
            type="number"
            min="0"
            step="0.5"
            value={form.playtime_hours}
            onChange={set('playtime_hours')}
          />
        </label>
        <label>
          Rating
          <select value={form.rating} onChange={set('rating')}>
            <option value="">—</option>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="row">
        <label>
          Started
          <input type="date" value={form.started_at} onChange={set('started_at')} />
        </label>
        <label>
          Finished
          <input type="date" value={form.finished_at} onChange={set('finished_at')} />
        </label>
      </div>
      <label>
        Notes
        <textarea rows="3" value={form.notes} onChange={set('notes')} />
      </label>
      <div className="card-actions">
        <button type="submit" disabled={busy}>
          Save
        </button>
        <button type="button" className="ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
