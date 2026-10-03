import { useEffect, useState } from 'react'

// Modal for renaming and deleting the user's locations.
export default function LocationManager({ locations, games, onRename, onDelete, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const usage = (id) => games.filter((g) => g.location_ids.includes(id)).length

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="manage-title">
        <div className="modal-head">
          <h2 id="manage-title">Manage locations</h2>
          <button className="ghost" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {locations.length === 0 ? (
          <p className="muted">
            No locations yet. Add one from the “Where” picker on any game.
          </p>
        ) : (
          <ul className="location-list">
            {locations.map((l) => (
              <LocationRow
                key={l.id}
                location={l}
                count={usage(l.id)}
                onRename={onRename}
                onDelete={onDelete}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function LocationRow({ location, count, onRename, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(location.name)
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

  async function save(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || trimmed === location.name) return setEditing(false)
    if (await run(() => onRename(location.id, trimmed))) setEditing(false)
  }

  function remove() {
    const where = count === 1 ? '1 game' : `${count} games`
    const msg = count
      ? `Delete “${location.name}”? It will be removed from ${where}.`
      : `Delete “${location.name}”?`
    if (confirm(msg)) run(() => onDelete(location.id))
  }

  return (
    <li>
      {editing ? (
        <form className="location-row" onSubmit={save}>
          <input
            autoFocus
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation()
                setName(location.name)
                setEditing(false)
              }
            }}
          />
          <button type="submit" disabled={busy || !name.trim()}>
            Save
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setName(location.name)
              setEditing(false)
            }}
          >
            Cancel
          </button>
        </form>
      ) : (
        <div className="location-row">
          <span className="location-name">{location.name}</span>
          <span className="muted count">{count === 1 ? '1 game' : `${count} games`}</span>
          <button className="ghost" onClick={() => setEditing(true)} disabled={busy}>
            Rename
          </button>
          <button className="ghost danger" onClick={remove} disabled={busy}>
            Delete
          </button>
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </li>
  )
}
