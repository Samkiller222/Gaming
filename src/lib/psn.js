import { supabase } from './supabase.js'

// Call the psn-sync Edge Function and surface its error message.
export async function callPsn(action, extra = {}) {
  const { data, error } = await supabase.functions.invoke('psn-sync', {
    body: { action, ...extra },
  })
  if (error) {
    let message = error.message
    try {
      message = (await error.context.json()).error ?? message
    } catch {
      // Keep the generic message.
    }
    throw new Error(message)
  }
  return data
}

// Edition/platform suffixes PSN often appends that RAWG leaves off (or vice versa).
const SUFFIX =
  /^(the )?((digital )?(deluxe|complete|definitive|standard|ultimate|gold|goty|game of the year|anniversary|enhanced) edition|director s cut|ps4|ps5|ps4 (and|&) ps5|playstation ?[45]( edition)?)$/

export function normalizeTitle(s) {
  return s
    .replace(/[™®©]/g, '') // before NFKD, which would turn ™ into "TM"
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// 2 = same title, 1 = same title plus a known edition/platform suffix, 0 = no match.
function score(a, b) {
  if (a === b) return 2
  const [short, long] = a.length <= b.length ? [a, b] : [b, a]
  if (short.length >= 3 && long.startsWith(short + ' ')) {
    const rest = long.slice(short.length + 1)
    if (SUFFIX.test(rest)) return 1
  }
  return 0
}

const isPs5 = (t) => t.platform.split(',').includes('PS5')

// Best PSN trophy list for a game title, or null. Prefers exact matches,
// then PS5 lists over PS4, then the most recently played.
export function bestTitleMatch(gameTitle, titles) {
  const g = normalizeTitle(gameTitle)
  let best = null
  let bestScore = 0
  for (const t of titles) {
    const s = score(g, normalizeTitle(t.title))
    if (!s) continue
    if (
      s > bestScore ||
      (s === bestScore &&
        (isPs5(t) - isPs5(best) || (t.last_updated ?? '').localeCompare(best.last_updated ?? '')) > 0)
    ) {
      best = t
      bestScore = s
    }
  }
  return best
}

// Best RAWG search result for a PSN title (falls back to RAWG's top hit).
export function bestRawgMatch(psnTitle, results) {
  const p = normalizeTitle(psnTitle)
  return (
    results.find((r) => score(p, normalizeTitle(r.title)) === 2) ??
    results.find((r) => score(p, normalizeTitle(r.title)) === 1) ??
    results[0] ??
    null
  )
}

// Library status to use when importing a game from its trophy progress.
export function statusFromTrophies(t) {
  if (t.earned_platinum > 0 || t.progress >= 100) return 'completed'
  if (t.progress > 0) return 'playing'
  return 'backlog'
}

export const trophyTotals = (t) => ({
  earned: t.earned_bronze + t.earned_silver + t.earned_gold + t.earned_platinum,
  defined: t.defined_bronze + t.defined_silver + t.defined_gold + t.defined_platinum,
})
