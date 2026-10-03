const API = 'https://api.rawg.io/api'
const key = import.meta.env.VITE_RAWG_API_KEY

export const rawgConfigured = Boolean(key)

export async function searchGames(query, { signal } = {}) {
  const params = new URLSearchParams({ key, search: query, page_size: '20' })
  const res = await fetch(`${API}/games?${params}`, { signal })
  if (!res.ok) throw new Error(`RAWG search failed (${res.status})`)
  const data = await res.json()
  return data.results.map(toGame)
}

// Normalise a RAWG game into the shape of a row in the games table.
function toGame(g) {
  return {
    rawg_id: g.id,
    title: g.name,
    cover_url: g.background_image,
    platforms: (g.platforms ?? []).map((p) => p.platform.name),
    genres: (g.genres ?? []).map((x) => x.name),
    released: g.released,
    rawg_rating: g.rating,
  }
}
