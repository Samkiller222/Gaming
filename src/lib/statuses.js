export const STATUSES = [
  { value: 'wishlist', label: 'Wishlist' },
  { value: 'backlog', label: 'Backlog' },
  { value: 'playing', label: 'Playing' },
  { value: 'completed', label: 'Completed' },
  { value: 'dropped', label: 'Dropped' },
]

export const statusLabel = (value) =>
  STATUSES.find((s) => s.value === value)?.label ?? value

const today = () => new Date().toISOString().slice(0, 10)

// Fields to write when a game moves to a new status: stamp the start date
// when play begins and the finish date when it ends, without overwriting
// dates the user already has.
export function statusPatch(game, status) {
  const patch = { status }
  if (status === 'playing' && !game.started_at) patch.started_at = today()
  if ((status === 'completed' || status === 'dropped') && !game.finished_at) {
    patch.finished_at = today()
    if (!game.started_at) patch.started_at = today()
  }
  return patch
}
