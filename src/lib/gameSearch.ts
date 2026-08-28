export type GameSearchResult = {
  catalogId: string
  steamAppId: string
  title: string
  coverUrl: string
  thumbnailUrl: string
  contentType: 'game' | 'dlc'
}

type SteamCatalogEntry = [number, string, (0 | 1)?]

type SteamStoreLink = {
  appId: number
  slugTitle: string
}

const REMOTE_CATALOGS = [
  'https://raw.githubusercontent.com/jsnli/SteamAppIDList/master/data/games_appid.json',
  'https://raw.githubusercontent.com/jsnli/SteamAppIDList/master/data/dlc_appid.json',
]
const catalogPromises = new Map<string, Promise<SteamCatalogEntry[]>>()

function normalize(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/\bgoty\b/g, 'game of the year')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/^(the|an|a)\s+/, '')
}

function bucketFor(value: string) {
  const first = normalize(value)[0]
  return first && /[a-z0-9]/.test(first) ? first : '_'
}

function isCompactCatalog(value: unknown): value is SteamCatalogEntry[] {
  return Array.isArray(value) && value.every((entry) => Array.isArray(entry)
    && typeof entry[0] === 'number'
    && typeof entry[1] === 'string'
    && (entry[2] === undefined || entry[2] === 0 || entry[2] === 1))
}

function isFullCatalog(value: unknown): value is { appid: number; name: string }[] {
  return Array.isArray(value) && value.every((entry) => entry && typeof entry === 'object' && 'appid' in entry && 'name' in entry && typeof entry.appid === 'number' && typeof entry.name === 'string')
}

function resultFromEntry([appId, title, catalogKind = 0]: SteamCatalogEntry): GameSearchResult {
  return {
    catalogId: String(appId),
    steamAppId: String(appId),
    title,
    coverUrl: `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900_2x.jpg`,
    thumbnailUrl: `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`,
    contentType: catalogKind === 1 ? 'dlc' : 'game',
  }
}

export function parseSteamStoreLink(input: string): SteamStoreLink | null {
  const clean = input.trim()
  const clientMatch = clean.match(/^steam:\/\/store\/(\d{1,10})(?:\/|$)/i)
  if (clientMatch) return { appId: Number(clientMatch[1]), slugTitle: '' }
  try {
    const url = new URL(clean)
    if (!['store.steampowered.com', 'www.store.steampowered.com'].includes(url.hostname.toLowerCase())) return null
    const match = url.pathname.match(/^\/(?:agecheck\/)?app\/(\d{1,10})(?:\/([^/]+))?/i)
    if (!match) return null
    const slugTitle = match[2] ? decodeURIComponent(match[2]).replace(/[_-]+/g, ' ').trim() : ''
    return { appId: Number(match[1]), slugTitle }
  } catch {
    return null
  }
}

export async function resolveSteamStoreLink(input: string, signal?: AbortSignal, fallbackContentType: 'game' | 'dlc' = 'game'): Promise<GameSearchResult | null> {
  const link = parseSteamStoreLink(input)
  if (!link) return null
  if (link.slugTitle) {
    try {
      const catalog = await loadCatalog(link.slugTitle, signal)
      const exactEntry = catalog.find(([appId]) => appId === link.appId)
      if (exactEntry) return resultFromEntry(exactEntry)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
    }
  }
  const fallbackTitle = link.slugTitle || `Steam app ${link.appId}`
  return resultFromEntry([link.appId, fallbackTitle, fallbackContentType === 'dlc' ? 1 : 0])
}

async function loadCatalog(query: string, signal?: AbortSignal) {
  const bucket = bucketFor(query)
  if (!catalogPromises.has(bucket)) {
    const catalogPromise = (async () => {
      const localResponse = await fetch(`${import.meta.env.BASE_URL}steam-games/${bucket}.json`, { signal })
      if (localResponse.ok) {
        try {
          const localData = await localResponse.json() as unknown
          if (isCompactCatalog(localData)) return localData
        } catch {
          // Development servers can return the app shell for an unknown catalog path.
        }
      }

      const remoteResponses = await Promise.all(REMOTE_CATALOGS.map((catalog) => fetch(catalog, { signal })))
      if (remoteResponses.some((response) => !response.ok)) throw new Error('Steam catalog is unavailable')
      const remoteCatalogs = await Promise.all(remoteResponses.map((response) => response.json() as Promise<unknown>))
      if (!remoteCatalogs.every(isFullCatalog)) throw new Error('Steam catalog format changed')
      return remoteCatalogs.flatMap((catalog, catalogIndex) => catalog
        .filter((game) => bucketFor(game.name) === bucket)
        .map((game) => [game.appid, game.name, catalogIndex === 1 ? 1 : 0] as SteamCatalogEntry))
    })().catch((error) => {
      catalogPromises.delete(bucket)
      throw error
    })
    catalogPromises.set(bucket, catalogPromise)
  }
  return catalogPromises.get(bucket)!
}

function searchNeedles(query: string) {
  const needle = normalize(query)
  const firstGameMatch = needle.match(/^(.*) 1$/)
  if (!firstGameMatch) return [needle]
  return [`${firstGameMatch[1]} game of the year`, firstGameMatch[1]]
}

function matchScore(title: string, needles: string[]) {
  const normalizedTitle = normalize(title)
  let bestScore = Number.POSITIVE_INFINITY
  for (const [variantIndex, needle] of needles.entries()) {
    if (!needle) continue
    const position = normalizedTitle.indexOf(needle)
    if (position < 0) continue
    const baseScore = normalizedTitle === needle
      ? 0
      : normalizedTitle.startsWith(`${needle} `)
        ? 1
        : position === 0
          ? 3
          : normalizedTitle.includes(` ${needle} `) || normalizedTitle.endsWith(` ${needle}`)
            ? 4
            : 5
    bestScore = Math.min(bestScore, baseScore + variantIndex * 10)
  }
  return bestScore
}

export async function searchGames(query: string, signal?: AbortSignal, contentType?: 'game' | 'dlc'): Promise<GameSearchResult[]> {
  const games = await loadCatalog(query, signal)
  const needles = searchNeedles(query)
  if (!needles[0]) return []

  return games
    .flatMap(([appId, title, catalogKind = 0]) => {
      const resultType: 'game' | 'dlc' = catalogKind === 1 ? 'dlc' : 'game'
      if (contentType && resultType !== contentType) return []
      const score = matchScore(title, needles)
      if (!Number.isFinite(score)) return []
      return [{ appId, title, score, resultType }]
    })
    .sort((left, right) => left.score - right.score || left.appId - right.appId || left.title.localeCompare(right.title))
    .slice(0, 20)
    .map(({ appId, title, resultType }) => resultFromEntry([appId, title, resultType === 'dlc' ? 1 : 0]))
}
