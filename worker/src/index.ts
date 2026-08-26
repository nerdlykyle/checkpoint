interface Env {
  ALLOWED_ORIGINS: string
  CHECKPOINT_BOARD_ID: string
  STEAM_WEB_API_KEY?: string
}

const STEAM_API = 'https://api.steampowered.com'

function allowedOrigin(request: Request, env: Env) {
  const origin = request.headers.get('Origin') || ''
  const allowed = env.ALLOWED_ORIGINS.split(',').map((value) => value.trim())
  return allowed.includes(origin) ? origin : allowed[0]
}

function responseHeaders(request: Request, env: Env) {
  return {
    'Access-Control-Allow-Origin': allowedOrigin(request, env),
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Accept, Content-Type',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    Vary: 'Origin',
  }
}

function json(request: Request, env: Env, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: responseHeaders(request, env) })
}

function parseIds(value: string | null, maximum: number) {
  return [...new Set((value || '').split(',').map((item) => item.trim()).filter((item) => /^\d{1,20}$/.test(item)))].slice(0, maximum)
}

function boardAllowed(url: URL, env: Env) {
  return Boolean(env.CHECKPOINT_BOARD_ID && url.searchParams.get('board') === env.CHECKPOINT_BOARD_ID)
}

async function steamRequest(env: Env, interfaceName: string, method: string, version: string, input: Record<string, unknown>) {
  if (!env.STEAM_WEB_API_KEY) throw new Error('steam_unconfigured')
  const url = new URL(`${STEAM_API}/${interfaceName}/${method}/${version}/`)
  url.searchParams.set('key', env.STEAM_WEB_API_KEY)
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value))
  }
  const response = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(response.status === 401 ? 'steam_private' : 'steam_unavailable')
  return response.json() as Promise<Record<string, unknown>>
}

async function playerSummaries(env: Env, steamIds: string[]) {
  const raw = await steamRequest(env, 'ISteamUser', 'GetPlayerSummaries', 'v2', { steamids: steamIds.join(',') })
  const response = raw.response as { players?: Array<Record<string, unknown>> } | undefined
  return response?.players || []
}

function profileFromSummary(player: Record<string, unknown>) {
  return {
    steamId: String(player.steamid || ''),
    name: String(player.personaname || 'Steam player'),
    avatarUrl: String(player.avatarfull || player.avatarmedium || ''),
    profileUrl: String(player.profileurl || ''),
    currentGameAppId: player.gameid ? String(player.gameid) : undefined,
    currentGameName: player.gameextrainfo ? String(player.gameextrainfo) : undefined,
  }
}

async function resolveSteamProfile(env: Env, input: string) {
  const clean = input.trim()
  let steamId = clean.match(/(?:profiles\/)?(7656\d{13})/)?.[1]
  if (!steamId) {
    const vanity = clean.match(/steamcommunity\.com\/id\/([^/?#]+)/i)?.[1] || (/^[\w.-]{2,64}$/.test(clean) ? clean : '')
    if (!vanity) throw new Error('invalid_steam_profile')
    const raw = await steamRequest(env, 'ISteamUser', 'ResolveVanityURL', 'v1', { vanityurl: vanity, url_type: 1 })
    const response = raw.response as { success?: number; steamid?: string } | undefined
    if (response?.success !== 1 || !response.steamid) throw new Error('steam_profile_not_found')
    steamId = response.steamid
  }
  const summary = (await playerSummaries(env, [steamId]))[0]
  if (!summary) throw new Error('steam_profile_not_found')
  const profile = profileFromSummary(summary)
  return {
    steamId: profile.steamId,
    steamName: profile.name,
    steamProfileUrl: profile.profileUrl,
    steamAvatarUrl: profile.avatarUrl,
  }
}

async function loadOwnedGames(env: Env, steamId: string) {
  const raw = await steamRequest(env, 'IPlayerService', 'GetOwnedGames', 'v1', {
    steamid: steamId,
    include_appinfo: false,
    include_played_free_games: true,
    format: 'json',
  })
  const response = raw.response as { game_count?: number; games?: Array<{ appid: number; playtime_forever?: number; rtime_last_played?: number }> } | undefined
  return { accessible: Boolean(response && ('game_count' in response || Array.isArray(response.games))), games: response?.games || [] }
}

async function crewSnapshot(env: Env, steamIds: string[], appIds: string[]) {
  const [summaries, ...ownedLists] = await Promise.all([
    playerSummaries(env, steamIds),
    ...steamIds.map((steamId) => loadOwnedGames(env, steamId)),
  ])
  const ownership: Record<string, Record<string, { owned: boolean; playtimeMinutes: number; lastPlayedAt?: number }>> = {}
  const privateSteamIds = steamIds.filter((_steamId, index) => !ownedLists[index].accessible)
  for (const appId of appIds) {
    ownership[appId] = {}
    for (const [index, steamId] of steamIds.entries()) {
      if (ownedLists[index].accessible) ownership[appId][steamId] = { owned: false, playtimeMinutes: 0 }
    }
  }
  steamIds.forEach((steamId, playerIndex) => {
    for (const game of ownedLists[playerIndex].games) {
      const appId = String(game.appid)
      if (!ownership[appId]) continue
      ownership[appId][steamId] = {
        owned: true,
        playtimeMinutes: game.playtime_forever || 0,
        lastPlayedAt: game.rtime_last_played || undefined,
      }
    }
  })
  return {
    players: summaries.map(profileFromSummary),
    ownership,
    privateSteamIds,
    updatedAt: new Date().toISOString(),
  }
}

async function achievementSnapshot(env: Env, steamIds: string[], appId: string) {
  const achievements = await Promise.all(steamIds.map(async (steamId) => {
    try {
      const raw = await steamRequest(env, 'ISteamUserStats', 'GetPlayerAchievements', 'v1', { steamid: steamId, appid: Number(appId), l: 'english' })
      const playerstats = raw.playerstats as { achievements?: Array<{ achieved?: number }> } | undefined
      const rows = playerstats?.achievements || []
      return { steamId, unlocked: rows.filter((item) => item.achieved === 1).length, total: rows.length }
    } catch {
      return { steamId, unlocked: 0, total: 0 }
    }
  }))
  return { achievements }
}

async function handleRequest(request: Request, env: Env) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: responseHeaders(request, env) })
  if (request.method !== 'GET') return json(request, env, { error: 'method_not_allowed' }, 405)
  const url = new URL(request.url)
  if (url.pathname === '/health') return json(request, env, { ok: true, steamConfigured: Boolean(env.STEAM_WEB_API_KEY) })
  if (!boardAllowed(url, env)) return json(request, env, { error: 'board_not_allowed' }, 403)
  try {
    if (url.pathname === '/steam/resolve') {
      const profile = url.searchParams.get('profile') || ''
      return json(request, env, await resolveSteamProfile(env, profile))
    }
    if (url.pathname === '/steam/crew') {
      const steamIds = parseIds(url.searchParams.get('steamIds'), 3)
      const appIds = parseIds(url.searchParams.get('appIds'), 200)
      if (!steamIds.length || !appIds.length) throw new Error('invalid_request')
      return json(request, env, await crewSnapshot(env, steamIds, appIds))
    }
    if (url.pathname === '/steam/achievements') {
      const steamIds = parseIds(url.searchParams.get('steamIds'), 3)
      const appId = parseIds(url.searchParams.get('appId'), 1)[0]
      if (!steamIds.length || !appId) throw new Error('invalid_request')
      return json(request, env, await achievementSnapshot(env, steamIds, appId))
    }
    return json(request, env, { error: 'not_found' }, 404)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'service_unavailable'
    const status = message.startsWith('invalid_') ? 400 : message === 'steam_unconfigured' ? 503 : 502
    return json(request, env, { error: message }, status)
  }
}

export default {
  fetch: handleRequest,
}
