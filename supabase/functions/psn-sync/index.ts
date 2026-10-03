// psn-sync: connects a user's PSN online ID and pulls their trophy lists.
//
// Uses one PSN login (the PSN_NPSSO secret) to read *public* trophy data, so
// users never hand over PSN credentials. Their trophy privacy must be "Anyone".
// All database writes go through the caller's JWT, so RLS still applies.
//
// POST { action: "connect", onlineId }  -> look up the account and save it
// POST { action: "sync" }               -> fetch all trophy lists and upsert them
import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  exchangeAccessCodeForAuthTokens,
  exchangeNpssoForAccessCode,
  getProfileFromUserName,
  getUserTitles,
  makeUniversalSearch,
  type TrophyTitle,
} from 'npm:psn-api@2.18.1'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

class UserError extends Error {}

// Access tokens last about an hour; reuse one while this instance is warm.
let cached: { accessToken: string; expiresAt: number } | null = null

async function psnAuth() {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached
  const npsso = Deno.env.get('PSN_NPSSO')
  if (!npsso) throw new UserError('PSN is not configured on the server (missing PSN_NPSSO secret).')
  try {
    const code = await exchangeNpssoForAccessCode(npsso)
    const tokens = await exchangeAccessCodeForAuthTokens(code)
    cached = { accessToken: tokens.accessToken, expiresAt: Date.now() + tokens.expiresIn * 1000 }
    return cached
  } catch {
    throw new UserError(
      'The server’s PSN login has expired. The app owner needs to update the PSN_NPSSO secret.',
    )
  }
}

async function findAccount(auth: { accessToken: string }, onlineId: string) {
  try {
    const { profile } = await getProfileFromUserName(auth, onlineId)
    if (profile?.accountId) {
      return { onlineId: profile.onlineId, accountId: profile.accountId, avatarUrl: profile.avatarUrls?.[0]?.avatarUrl ?? null }
    }
  } catch {
    // Fall through to universal search.
  }
  const search = await makeUniversalSearch(auth, onlineId, 'SocialAllAccounts')
  const hit = search.domainResponses?.[0]?.results?.find(
    (r) => r.socialMetadata.onlineId.toLowerCase() === onlineId.toLowerCase(),
  )
  if (!hit) throw new UserError(`No PSN account called “${onlineId}” was found.`)
  const m = hit.socialMetadata
  return { onlineId: m.onlineId, accountId: m.accountId, avatarUrl: m.avatarUrl ?? null }
}

async function fetchAllTitles(auth: { accessToken: string }, accountId: string) {
  const titles: TrophyTitle[] = []
  let offset = 0
  for (;;) {
    let page
    try {
      page = await getUserTitles(auth, accountId, { limit: 800, offset })
    } catch (e) {
      const msg = String((e as Error)?.message ?? e)
      if (/private|forbidden|2240526|not.?allowed/i.test(msg)) {
        throw new UserError(
          'This PSN profile’s trophies are private. On PlayStation set Privacy → Trophies to “Anyone”.',
        )
      }
      throw e
    }
    // psn-api resolves with an { error } body instead of throwing for some failures.
    // deno-lint-ignore no-explicit-any
    const err = (page as any).error
    if (err) {
      throw new UserError(
        err.code === 2240526 || /not permitted|private/i.test(err.message ?? '')
          ? 'This PSN profile’s trophies are private. On PlayStation set Privacy → Trophies to “Anyone”.'
          : `PSN error: ${err.message ?? 'unknown'}`,
      )
    }
    titles.push(...page.trophyTitles)
    if (page.nextOffset == null || page.trophyTitles.length === 0) break
    offset = page.nextOffset
  }
  return titles
}

const toRow = (userId: string, t: TrophyTitle) => ({
  user_id: userId,
  np_communication_id: t.npCommunicationId,
  np_service_name: t.npServiceName,
  platform: t.trophyTitlePlatform,
  title: t.trophyTitleName,
  icon_url: t.trophyTitleIconUrl,
  progress: t.progress,
  earned_bronze: t.earnedTrophies.bronze,
  earned_silver: t.earnedTrophies.silver,
  earned_gold: t.earnedTrophies.gold,
  earned_platinum: t.earnedTrophies.platinum,
  defined_bronze: t.definedTrophies.bronze,
  defined_silver: t.definedTrophies.silver,
  defined_gold: t.definedTrophies.gold,
  defined_platinum: t.definedTrophies.platinum,
  last_updated: t.lastUpdatedDateTime,
  synced_at: new Date().toISOString(),
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  )
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) return json({ error: 'Not signed in' }, 401)
  const userId = userData.user.id

  try {
    const body = await req.json().catch(() => ({}))
    const auth = await psnAuth()

    if (body.action === 'connect') {
      const onlineId = String(body.onlineId ?? '').trim()
      if (!/^[A-Za-z][A-Za-z0-9_-]{2,15}$/.test(onlineId)) {
        throw new UserError('That doesn’t look like a PSN online ID (3–16 letters, numbers, - or _).')
      }
      const account = await findAccount(auth, onlineId)
      const { data, error } = await supabase
        .from('psn_accounts')
        .upsert({
          user_id: userId,
          online_id: account.onlineId,
          account_id: account.accountId,
          avatar_url: account.avatarUrl,
        })
        .select()
        .single()
      if (error) throw error
      return json({ account: data })
    }

    if (body.action === 'sync') {
      const { data: account, error } = await supabase
        .from('psn_accounts')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()
      if (error) throw error
      if (!account) throw new UserError('Connect a PSN account first.')

      const titles = await fetchAllTitles(auth, account.account_id)
      const rows = titles.map((t) => toRow(userId, t))
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await supabase.from('psn_trophy_titles').upsert(rows.slice(i, i + 500))
        if (error) throw error
      }

      // Drop lists that no longer appear on the profile (e.g. hidden games).
      const keep = new Set(rows.map((r) => r.np_communication_id))
      const { data: existing, error: existingError } = await supabase
        .from('psn_trophy_titles')
        .select('np_communication_id')
        .eq('user_id', userId)
      if (existingError) throw existingError
      const stale = existing.map((r) => r.np_communication_id).filter((id) => !keep.has(id))
      // An empty response is more likely a PSN hiccup than a wiped profile; keep everything.
      if (stale.length && rows.length) {
        const { error } = await supabase
          .from('psn_trophy_titles')
          .delete()
          .eq('user_id', userId)
          .in('np_communication_id', stale)
        if (error) throw error
      }

      const { data: updated, error: updateError } = await supabase
        .from('psn_accounts')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('user_id', userId)
        .select()
        .single()
      if (updateError) throw updateError
      return json({ account: updated, count: rows.length })
    }

    throw new UserError('Unknown action')
  } catch (e) {
    if (e instanceof UserError) return json({ error: e.message }, 400)
    console.error(e)
    return json({ error: 'Something went wrong talking to PSN. Try again in a minute.' }, 502)
  }
})
