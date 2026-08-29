import { readFile, writeFile } from 'node:fs/promises'

const MINIMUM_REVIEWS = 25
const MINIMUM_ONLINE_PLAYERS = 3
const MAX_PUBLISHED_CANDIDATES = 60
const seedUrl = new URL('./recommendation-candidates.json', import.meta.url)
const outputUrl = new URL('../public/recommendations.json', import.meta.url)

const seeds = JSON.parse(await readFile(seedUrl, 'utf8'))

function centralDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return { year: Number(values.year), month: Number(values.month), day: Number(values.day) }
}

function mostRecentFriday() {
  const parts = centralDateParts()
  const centralNoon = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12))
  const daysSinceFriday = (centralNoon.getUTCDay() - 5 + 7) % 7
  centralNoon.setUTCDate(centralNoon.getUTCDate() - daysSinceFriday)
  return centralNoon.toISOString().slice(0, 10)
}

function hash(value) {
  let result = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 16777619)
  }
  return result >>> 0
}

async function fetchJson(url, options, attempts = 3) {
  let lastError
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, options)
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
      return await response.json()
    } catch (error) {
      lastError = error
      if (attempt + 1 < attempts) await new Promise((resolve) => setTimeout(resolve, 450 * (attempt + 1)))
    }
  }
  throw lastError
}

async function igdbCandidates() {
  const clientId = process.env.IGDB_CLIENT_ID
  const clientSecret = process.env.IGDB_CLIENT_SECRET
  if (!clientId || !clientSecret) return []

  const tokenUrl = new URL('https://id.twitch.tv/oauth2/token')
  tokenUrl.searchParams.set('client_id', clientId)
  tokenUrl.searchParams.set('client_secret', clientSecret)
  tokenUrl.searchParams.set('grant_type', 'client_credentials')
  const token = await fetchJson(tokenUrl, { method: 'POST' })
  const headers = { 'Client-ID': clientId, Authorization: `Bearer ${token.access_token}`, Accept: 'application/json' }
  const modes = await fetchJson('https://api.igdb.com/v4/multiplayer_modes', {
    method: 'POST', headers,
    body: 'fields game,onlinecoopmax; where platform = 6 & onlinecoop = true & onlinecoopmax >= 3; limit 500;',
  })
  const maxByGame = new Map()
  for (const mode of modes) maxByGame.set(mode.game, Math.max(maxByGame.get(mode.game) || 0, mode.onlinecoopmax || 0))
  const gameIds = [...maxByGame.keys()]
  const games = []
  for (let index = 0; index < gameIds.length; index += 150) {
    const ids = gameIds.slice(index, index + 150)
    const rows = await fetchJson('https://api.igdb.com/v4/games', {
      method: 'POST', headers,
      body: `fields name,first_release_date,genres.name,summary,websites.url,websites.category,external_games.uid,external_games.url; where id = (${ids.join(',')}); limit 500;`,
    })
    games.push(...rows)
    await new Promise((resolve) => setTimeout(resolve, 300))
  }

  return games.flatMap((game) => {
    const urls = [...(game.websites || []).map((website) => website.url), ...(game.external_games || []).map((external) => external.url)].filter(Boolean)
    const ids = urls.flatMap((url) => String(url).match(/store\.steampowered\.com\/app\/(\d+)/i)?.[1] || [])
    const steamAppId = ids[0]
    if (!steamAppId) return []
    return [{
      steamAppId,
      title: game.name,
      onlineCoopMax: maxByGame.get(game.id),
      year: game.first_release_date ? new Date(game.first_release_date * 1000).getUTCFullYear() : undefined,
      genres: (game.genres || []).map((genre) => genre.name).filter(Boolean),
      summary: game.summary || '',
    }]
  })
}

async function mapConcurrently(values, concurrency, task) {
  const results = Array.from({ length: values.length })
  let cursor = 0
  async function worker() {
    while (cursor < values.length) {
      const index = cursor++
      results[index] = await task(values[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker))
  return results
}

async function steamReview(candidate) {
  try {
    const url = new URL(`https://store.steampowered.com/appreviews/${candidate.steamAppId}`)
    url.searchParams.set('json', '1')
    url.searchParams.set('language', 'all')
    url.searchParams.set('purchase_type', 'all')
    url.searchParams.set('num_per_page', '0')
    const data = await fetchJson(url, { headers: { Accept: 'application/json' } })
    const summary = data.query_summary
    const totalReviews = Number(summary?.total_reviews || 0)
    const positive = Number(summary?.total_positive || 0)
    const positivePercent = totalReviews ? Math.round(positive / totalReviews * 100) : 0
    if (totalReviews < MINIMUM_REVIEWS || positivePercent < 70) return null
    const detailsUrl = new URL('https://store.steampowered.com/api/appdetails')
    detailsUrl.searchParams.set('appids', candidate.steamAppId)
    detailsUrl.searchParams.set('cc', 'us')
    detailsUrl.searchParams.set('l', 'english')
    const detailsResponse = await fetchJson(detailsUrl, { headers: { Accept: 'application/json' } }).catch(() => null)
    const details = detailsResponse?.[candidate.steamAppId]?.data
    if (details && (details.type !== 'game' || details.platforms?.windows === false)) return null
    const genres = details?.genres?.map((genre) => genre.description).filter(Boolean) || candidate.genres || []
    const onlineCoopMax = Number(candidate.onlineCoopMax || 0)
    const cleanSummary = String(details?.short_description || candidate.summary || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ').trim()
    const releaseYear = String(details?.release_date?.date || '').match(/\b(?:19|20)\d{2}\b/)?.[0]
    return {
      steamAppId: String(candidate.steamAppId),
      title: details?.name || candidate.title,
      year: candidate.year || (releaseYear ? Number(releaseYear) : undefined),
      genres,
      summary: cleanSummary || `A well-reviewed online co-op game for ${onlineCoopMax} players.`,
      why: `${onlineCoopMax}-player online co-op with ${summary.review_score_desc.toLowerCase()} Steam reviews${genres.length ? ` and ${genres.slice(0, 2).join('/').toLowerCase()} gameplay` : ''}.`,
      onlineCoopMax,
      reviewSummary: summary.review_score_desc,
      positivePercent,
      totalReviews,
      coverUrl: `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${candidate.steamAppId}/library_600x900_2x.jpg`,
      headerUrl: details?.header_image || `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${candidate.steamAppId}/header.jpg`,
      steamUrl: `https://store.steampowered.com/app/${candidate.steamAppId}/`,
    }
  } catch (error) {
    console.warn(`Skipping Steam app ${candidate.steamAppId}:`, error instanceof Error ? error.message : error)
    return null
  }
}

const editionDate = mostRecentFriday()
let discovered = []
try {
  discovered = await igdbCandidates()
  if (discovered.length) console.log(`Discovered ${discovered.length} IGDB games with 3+ player online co-op.`)
} catch (error) {
  console.warn('IGDB discovery failed; using the verified curated pool.', error instanceof Error ? error.message : error)
}

const candidatesById = new Map(discovered.map((candidate) => [String(candidate.steamAppId), candidate]))
for (const seed of seeds) candidatesById.set(String(seed.steamAppId), { ...candidatesById.get(String(seed.steamAppId)), ...seed })
const candidates = [...candidatesById.values()].filter((candidate) => Number(candidate.onlineCoopMax) >= MINIMUM_ONLINE_PLAYERS)
const checked = (await mapConcurrently(candidates, 4, steamReview)).filter(Boolean)

if (!checked.length) {
  console.warn('No recommendation refresh was available; keeping the previously generated feed.')
  process.exit(0)
}

let ordered
if (editionDate === '2026-08-28') {
  const seedOrder = new Map(seeds.map((seed, index) => [String(seed.steamAppId), index]))
  ordered = checked.sort((left, right) => (seedOrder.get(left.steamAppId) ?? 9999) - (seedOrder.get(right.steamAppId) ?? 9999))
} else {
  const stable = checked.sort((left, right) => hash(left.steamAppId) - hash(right.steamAppId))
  const weekNumber = Math.floor(new Date(`${editionDate}T12:00:00Z`).getTime() / (7 * 24 * 60 * 60 * 1000))
  const start = stable.length ? (weekNumber * 25) % stable.length : 0
  ordered = [...stable.slice(start), ...stable.slice(0, start)]
}

const feed = {
  editionDate,
  generatedAt: new Date().toISOString(),
  minimumReviews: MINIMUM_REVIEWS,
  minimumOnlinePlayers: MINIMUM_ONLINE_PLAYERS,
  recommendations: ordered.slice(0, MAX_PUBLISHED_CANDIDATES),
}
await writeFile(outputUrl, `${JSON.stringify(feed, null, 2)}\n`)
console.log(`Published ${feed.recommendations.length} verified candidates for the ${editionDate} recommendation edition.`)
