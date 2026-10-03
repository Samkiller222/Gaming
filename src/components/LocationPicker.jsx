import { useState } from 'react'

const ADD_NEW = '__add_new__'

// Dropdown of the user's own locations. Picking "+ Add new…" swaps in a text
// field; the new name is saved to the user's list and selected for this game.
export default function LocationPicker({ value, locations, onChange, onAddLocation, disabled }) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function add(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setBusy(true)
    setError('')
    try {
      const location = await onAddLocation(trimmed)
      await onChange(location.id)
      setAdding(false)
      setName('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (adding) {
    return (
      <form className="location-add" onSubmit={add}>
        <input
          autoFocus
          maxLength={60}
          placeholder="e.g. Steam, PS5 disc, Game Pass"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setAdding(false)}
        />
        <button type="submit" disabled={busy || !name.trim()}>
          Add
        </button>
        <button type="button" className="ghost" onClick={() => setAdding(false)}>
          ✕
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    )
  }

  return (
    <label className="location">
      <span>Where</span>
      <select
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => {
          if (e.target.value === ADD_NEW) setAdding(true)
          else onChange(e.target.value || null)
        }}
      >
        <option value="">Not set</option>
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
        <option value={ADD_NEW}>+ Add new…</option>
      </select>
    </label>
  )
}
