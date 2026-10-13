import type { Movie } from './movies.ts'

export type MovieCollection = { id: number; name: string }
export type MovieCollections = Record<number, MovieCollection | null>
type Entry = { collection: MovieCollection | null; expires: number }
const KEY = 'checkpoint-movie-series-v1'
const TTL = 7 * 24 * 60 * 60_000

export function validMovieCollection(value: unknown): value is MovieCollection | null {
  if (value === null) return true
  if (!value || typeof value !== 'object') return false
  const row = value as MovieCollection
  return Number.isSafeInteger(row.id) && row.id > 0 && typeof row.name === 'string' && !!row.name.trim() && row.name.length <= 250
}

// Public catalog metadata only. Never rewrite a saved movie or other members'
// shelves to organize a view. This also supports movies added before stacking.
export function movieCollectionCache(storage?: Pick<Storage, 'getItem' | 'setItem'>) {
  let entries: Record<string, Entry> = {}
  try {
    const saved = JSON.parse(storage?.getItem(KEY) || '{}')
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      entries = Object.fromEntries(Object.entries(saved).filter(([id, value]) => {
        const row = value as Entry | null
        return /^[1-9]\d{0,9}$/.test(id) && row && Number.isFinite(row.expires) && row.expires > Date.now() && validMovieCollection(row.collection)
      }).slice(-500)) as Record<string, Entry>
    }
  } catch { /* Cache is optional. */ }
  return {
    get: (id: number) => entries[id]?.expires > Date.now() ? entries[id].collection : undefined,
    set: (id: number, collection: MovieCollection | null) => {
      entries[id] = { collection, expires: Date.now() + TTL }
      entries = Object.fromEntries(Object.entries(entries).slice(-500))
      try { storage?.setItem(KEY, JSON.stringify(entries)) } catch { /* Memory still works. */ }
    },
  }
}

export async function loadMovieCollections(ids: number[], request: (id: number, signal: AbortSignal) => Promise<{ tmdbId: number; collection?: MovieCollection | null }>, signal: AbortSignal, onResult: (id: number, collection: MovieCollection | null) => void, cache = movieCollectionCache()) {
  const pending: number[] = [], failed: number[] = []
  for (const id of new Set(ids)) {
    const saved = cache.get(id)
    if (saved !== undefined) onResult(id, saved)
    else pending.push(id)
  }
  let next = 0
  const work = async () => {
    while (!signal.aborted && next < pending.length) {
      const id = pending[next++]
      try {
        const result = await request(id, signal)
        signal.throwIfAborted()
        // An older server without this field is not proof of no collection.
        if (result.tmdbId !== id || !validMovieCollection(result.collection)) throw new Error('Series metadata unavailable')
        cache.set(id, result.collection)
        onResult(id, result.collection)
      } catch { if (!signal.aborted) failed.push(id) }
    }
  }
  await Promise.all([work(), work()])
  return failed
}

export function movieCollections(items: Movie[], metadata: MovieCollections) {
  const groups: { key: string; title: string; items: Movie[] }[] = []
  for (const item of items) {
    const series = item.tmdbId ? metadata[item.tmdbId] : null
    const key = series ? `series:${series.id}` : `movie:${item.id}`
    const group = groups.find(group => group.key === key)
    if (group) group.items.push(item)
    else groups.push({ key, title: series?.name || item.title, items: [item] })
  }
  // Lead with the first saved release, not the newest sequel. Unknown release
  // years go last so missing metadata cannot displace the original movie.
  return groups.map(group => ({ ...group, items: [...group.items].sort((a,b) => (a.year || '9999').localeCompare(b.year || '9999') || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)) }))
}
