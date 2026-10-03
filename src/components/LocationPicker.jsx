import { useEffect, useRef, useState } from 'react'

// Multi-select of the user's own locations. The toggle shows what's picked;
// opening it reveals a checklist plus a field that adds a new location to the
// user's list and ticks it for this game.
export default function LocationPicker({
  value,
  locations,
  onChange,
  onAddLocation,
  onManage,
  disabled,
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const selected = locations.filter((l) => value.includes(l.id))

  const toggle = (id) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])

  async function add(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setBusy(true)
    setError('')
    try {
      const location = await onAddLocation(trimmed)
      if (!value.includes(location.id)) await onChange([...value, location.id])
      setName('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="location" ref={ref}>
      <button
        type="button"
        className="location-toggle"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className="location-label">Where</span>
        <span className="location-chips">
          {selected.length === 0 ? (
            <span className="muted">Not set</span>
          ) : (
            selected.map((l) => (
              <span key={l.id} className="chip">
                {l.name}
              </span>
            ))
          )}
        </span>
        <span aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="location-panel">
          {locations.length === 0 && <p className="muted">No locations yet — add your first.</p>}
          {locations.map((l) => (
            <label key={l.id} className="location-option">
              <input
                type="checkbox"
                checked={value.includes(l.id)}
                disabled={disabled || busy}
                onChange={() => toggle(l.id)}
              />
              {l.name}
            </label>
          ))}
          <form className="location-add" onSubmit={add}>
            <input
              maxLength={60}
              placeholder="Add new…"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button type="submit" disabled={busy || !name.trim()}>
              Add
            </button>
            {error && <p className="error">{error}</p>}
          </form>
          {locations.length > 0 && (
            <button
              type="button"
              className="link manage-link"
              onClick={() => {
                setOpen(false)
                onManage()
              }}
            >
              Rename or delete locations…
            </button>
          )}
        </div>
      )}
    </div>
  )
}
