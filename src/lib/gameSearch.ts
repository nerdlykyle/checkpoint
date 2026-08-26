export type GameSearchResult = {
  catalogId: string
  steamAppId: string
  title: string
  coverUrl: string
}

type SteamCatalogEntry = [number, string]

const REMOTE_CATALOG = 'https://raw.githubusercontent.com/jsnli/SteamAppIDList/master/data/games_appid.json'
const catalogPromises = new Map<string, Promise<SteamCatalogEntry[]>>()

function normalize(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim().replace(/^(the|an|a)\s+/, '')
}

function bucketFor(value: string) {
  const first = normalize(value)[0]
  return first && /[a-z0-9]/.test(first) ? first : '_'
}

function isCompactCatalog(value: unknown): value is SteamCatalogEntry[] {
  return Array.isArray(value) && value.every((entry) => Array.isArray(entry) && typeof entry[0] === 'number' && typeof entry[1] === 'string')
}

function isFullCatalog(value: unknown): value is { appid: number; name: string }[] {
  return Array.isArray(value) && value.every((entry) => entry && typeof entry === 'object' && 'appid' in entry && 'name' in entry && typeof entry.appid === 'number' && typeof entry.name === 'string')
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

      const remoteResponse = await fetch(REMOTE_CATALOG, { signal })
      if (!remoteResponse.ok) throw new Error('Steam catalog is unavailable')
      const remoteData = await remoteResponse.json() as unknown
      if (!isFullCatalog(remoteData)) throw new Error('Steam catalog format changed')
      return remoteData.filter((game) => bucketFor(game.name) === bucket).map((game) => [game.appid, game.name] as SteamCatalogEntry)
    })().catch((error) => {
      catalogPromises.delete(bucket)
      throw error
    })
    catalogPromises.set(bucket, catalogPromise)
  }
  return catalogPromises.get(bucket)!
}

export async function searchGames(query: string, signal?: AbortSignal): Promise<GameSearchResult[]> {
  const games = await loadCatalog(query, signal)
  const needle = normalize(query)
  if (!needle) return []

  return games
    .flatMap(([appId, title]) => {
      const normalizedTitle = normalize(title)
      const position = normalizedTitle.indexOf(needle)
      if (position < 0) return []
      const score = normalizedTitle === needle ? 0 : position === 0 ? 1 : 2
      return [{ appId, title, score }]
    })
    .sort((left, right) => left.score - right.score || left.title.length - right.title.length || left.title.localeCompare(right.title))
    .slice(0, 8)
    .map(({ appId, title }) => ({
      catalogId: String(appId),
      steamAppId: String(appId),
      title,
      coverUrl: `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`,
    }))
}
