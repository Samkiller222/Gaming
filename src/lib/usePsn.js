import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase.js'
import { searchGames } from './rawg.js'
import { bestRawgMatch, bestTitleMatch, callPsn, statusFromTrophies } from './psn.js'

// PSN connection, trophy lists and game↔trophy-list links for the signed-in user.
export default function usePsn({ userId, games, addGame }) {
  const [account, setAccount] = useState(null)
  const [titles, setTitles] = useState([])
  const [links, setLinks] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')

  const loadTitlesAndLinks = useCallback(async () => {
    const [t, l] = await Promise.all([
      supabase.from('psn_trophy_titles').select('*').order('last_updated', { ascending: false }),
      supabase.from('game_trophy_links').select('*'),
    ])
    if (t.error) throw t.error
    if (l.error) throw l.error
    setTitles(t.data)
    setLinks(l.data)
    return { titles: t.data, links: l.data }
  }, [])

  useEffect(() => {
    if (!userId) {
      setAccount(null)
      setTitles([])
      setLinks([])
      setLoaded(false)
      return
    }
    Promise.all([
      supabase.from('psn_accounts').select('*').maybeSingle(),
      loadTitlesAndLinks(),
    ])
      .then(([a]) => {
        if (a.error) throw a.error
        setAccount(a.data)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoaded(true))
  }, [userId, loadTitlesAndLinks])

  const titlesById = useMemo(
    () => Object.fromEntries(titles.map((t) => [t.np_communication_id, t])),
    [titles],
  )
  const linkByGame = useMemo(
    () => Object.fromEntries(links.map((l) => [l.game_id, l])),
    [links],
  )
  // Trophy list id → game id, for showing which lists are already taken.
  const gameByTitle = useMemo(
    () =>
      Object.fromEntries(
        links.filter((l) => l.np_communication_id).map((l) => [l.np_communication_id, l.game_id]),
      ),
    [links],
  )

  // Link games that have no link row yet to their best-matching trophy list.
  const autoMatch = useCallback(async (candidates, allTitles, allLinks) => {
    const linkedGames = new Set(allLinks.map((l) => l.game_id))
    const takenTitles = new Set(allLinks.map((l) => l.np_communication_id).filter(Boolean))
    const rows = []
    for (const game of candidates) {
      if (linkedGames.has(game.id)) continue
      const match = bestTitleMatch(
        game.title,
        allTitles.filter((t) => !takenTitles.has(t.np_communication_id)),
      )
      if (!match) continue
      takenTitles.add(match.np_communication_id)
      rows.push({ game_id: game.id, np_communication_id: match.np_communication_id, matched_by: 'auto' })
    }
    if (!rows.length) return 0
    const { data, error } = await supabase.from('game_trophy_links').insert(rows).select()
    if (error) throw error
    setLinks((ls) => [...ls, ...data])
    return data.length
  }, [])

  const sync = useCallback(async () => {
    const res = await callPsn('sync')
    setAccount(res.account)
    const fresh = await loadTitlesAndLinks()
    const matched = await autoMatch(games, fresh.titles, fresh.links)
    return { count: res.count, matched }
  }, [games, autoMatch, loadTitlesAndLinks])

  const connect = useCallback(
    async (onlineId) => {
      const res = await callPsn('connect', { onlineId })
      setAccount(res.account)
    },
    [],
  )

  const disconnect = useCallback(async () => {
    // Deleting the trophy lists cascades to the game links.
    const t = await supabase.from('psn_trophy_titles').delete().eq('user_id', userId)
    if (t.error) throw t.error
    const a = await supabase.from('psn_accounts').delete().eq('user_id', userId)
    if (a.error) throw a.error
    setAccount(null)
    setTitles([])
    setLinks([])
  }, [userId])

  // Manually link a game to a trophy list, or to null to mark "no trophies".
  const setLink = useCallback(async (gameId, npId) => {
    const { data, error } = await supabase
      .from('game_trophy_links')
      .upsert({ game_id: gameId, np_communication_id: npId, matched_by: 'manual' })
      .select()
      .single()
    if (error) {
      if (error.code === '23505') throw new Error('That trophy list is already linked to another game.')
      throw error
    }
    setLinks((ls) => [...ls.filter((l) => l.game_id !== gameId), data])
  }, [])

  // Link a freshly added game if one of the trophy lists matches it.
  const matchNewGame = useCallback(
    (game) => autoMatch([game], titles, links).catch(() => 0),
    [autoMatch, titles, links],
  )

  // Add trophy lists to the library: find each on RAWG, add the game (or
  // reuse it if it's already in the library), and link the trophy list.
  const importTitles = useCallback(
    async (toImport, onProgress) => {
      const results = { added: [], linked: [], failed: [] }
      const byRawg = new Map(games.map((g) => [g.rawg_id, g]))
      let currentLinks = links
      for (const [i, t] of toImport.entries()) {
        onProgress?.(i, t)
        try {
          const found = bestRawgMatch(t.title, await searchGames(t.title))
          if (!found) {
            results.failed.push({ title: t.title, reason: 'Not found on RAWG' })
            continue
          }
          let game = byRawg.get(found.rawg_id)
          if (game) {
            if (currentLinks.some((l) => l.game_id === game.id && l.np_communication_id)) {
              results.failed.push({ title: t.title, reason: `“${game.title}” already has a trophy list` })
              continue
            }
            results.linked.push(t.title)
          } else {
            game = await addGame(found, statusFromTrophies(t))
            byRawg.set(game.rawg_id, game)
            results.added.push(t.title)
          }
          const { data, error } = await supabase
            .from('game_trophy_links')
            .upsert({ game_id: game.id, np_communication_id: t.np_communication_id, matched_by: 'manual' })
            .select()
            .single()
          if (error) throw error
          currentLinks = [...currentLinks.filter((l) => l.game_id !== game.id), data]
          setLinks(currentLinks)
        } catch (e) {
          results.failed.push({ title: t.title, reason: e.message })
        }
      }
      onProgress?.(toImport.length, null)
      return results
    },
    [games, links, addGame],
  )

  return {
    loaded,
    error,
    account,
    titles,
    titlesById,
    linkByGame,
    gameByTitle,
    connect,
    disconnect,
    sync,
    setLink,
    matchNewGame,
    importTitles,
  }
}
