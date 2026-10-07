import type { Book } from '../types.ts'
import { normalizeBookText } from './bookOrganization.ts'
import { lookupGoogleBookCover, lookupGoogleCoverForBook } from './bookSearch.ts'

export type ArtworkBook = Pick<Book, 'title' | 'authors' | 'coverUrl' | 'isbn10' | 'isbn13' | 'googleBooksId' | 'openLibraryKey'>

export function normalizeBookCover(value?: string, large = false) {
  if (!value) return undefined
  try {
    const url = new URL(value)
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return undefined
    url.protocol = 'https:'
    if (['books.google.com', 'books.googleusercontent.com'].includes(url.hostname)) {
      url.searchParams.delete('edge')
      url.searchParams.set('zoom', large ? '2' : '1')
    }
    if (url.hostname === 'covers.openlibrary.org') {
      url.pathname = url.pathname.replace(/-[SML]\.jpg$/i, large ? '-L.jpg' : '-M.jpg')
      // Missing covers must fail, not return a successful blank placeholder.
      url.searchParams.set('default', 'false')
    }
    return url.href
  } catch { return undefined }
}

function googleVolumeId(book: ArtworkBook) {
  let googleId = book.googleBooksId
  if (!googleId && book.coverUrl) {
    try { const url = new URL(book.coverUrl); if (url.hostname === 'books.google.com') googleId = url.searchParams.get('id') || undefined } catch { /* Try the other identifiers. */ }
  }
  return googleId && /^[\w-]+$/.test(googleId) ? googleId : undefined
}

export function bookCoverCandidates(book: ArtworkBook, large = false) {
  const candidates = [normalizeBookCover(book.coverUrl, large)]
  // Some editions only have the smaller cover. Keep that actual URL as a
  // fallback instead of requiring the higher resolution to exist.
  if (large) candidates.push(normalizeBookCover(book.coverUrl))
  const googleId = googleVolumeId(book)
  if (googleId) candidates.push(`https://books.google.com/books/content?id=${encodeURIComponent(googleId)}&printsec=frontcover&img=1&zoom=1&source=gbs_api`)
  for (const value of [book.isbn13, book.isbn10]) {
    const isbn = value?.replace(/[\s-]/g, '').toUpperCase()
    if (isbn && /^(?:97[89]\d{10}|\d{9}[\dX])$/.test(isbn)) candidates.push(`https://covers.openlibrary.org/b/isbn/${isbn}-${large ? 'L' : 'M'}.jpg?default=false`)
  }
  if (book.openLibraryKey && /^\/books\/OL\d+M$/.test(book.openLibraryKey)) candidates.push(`https://covers.openlibrary.org/b/olid/${book.openLibraryKey.split('/').pop()}-${large ? 'L' : 'M'}.jpg?default=false`)
  return [...new Set(candidates.filter((value): value is string => Boolean(value)))]
}

export const artworkKey = (book: ArtworkBook) => JSON.stringify([book.coverUrl, book.googleBooksId, book.isbn13, book.isbn10, book.openLibraryKey, book.title, book.authors])

type CoverSearchResult = { title?: string; author_name?: string[]; cover_i?: number; isbn?: string[]; key?: string }
export function matchingCover(book: ArtworkBook, results: CoverSearchResult[]) {
  return results.find(result => Number.isInteger(result.cover_i) && result.cover_i! > 0 && (
    (book.isbn13 && result.isbn?.includes(book.isbn13)) || (book.isbn10 && result.isbn?.includes(book.isbn10)) ||
    (book.openLibraryKey && result.key === book.openLibraryKey) ||
    (normalizeBookText(book.title) === normalizeBookText(result.title || '') && book.authors.some(author => normalizeBookText(author) !== 'unknownauthor' && result.author_name?.some(candidate => normalizeBookText(candidate) === normalizeBookText(author))))
  ))?.cover_i
}

// Only exhausted, visible covers need metadata lookup. Coalesce duplicate requests
// and serialize across the page to avoid hammering the public catalog on mobile.
const lookupCache = new Map<string, { until: number; pending: boolean; promise: Promise<string[]> }>()
let queue = Promise.resolve()
let nextRequestAt = 0
export function lookupBookArtworkCandidates(book: ArtworkBook, refresh = false): Promise<string[]> {
  const key = artworkKey(book), cached = lookupCache.get(key)
  if (cached && (cached.pending || (!refresh && cached.until > Date.now()))) return cached.promise
  const slot = queue.then(async () => {
    const delay = Math.max(0, nextRequestAt - Date.now())
    if (delay) await new Promise(resolve => setTimeout(resolve, delay))
    nextRequestAt = Date.now() + 1100
  })
  // Rate-limit starts, not the entire request: one slow cover must not hold up
  // every other visible book for ten seconds each.
  queue = slot
  const promise = slot.then(async () => {
    const googleId = googleVolumeId(book)
    const google = (googleId ? lookupGoogleBookCover(googleId, AbortSignal.timeout(7000)) : lookupGoogleCoverForBook(book, AbortSignal.timeout(7000))).catch(() => undefined)
    const read = async (url: string) => {
      const response = await fetch(url, { signal: AbortSignal.timeout(7000), cache: refresh ? 'reload' : 'default', headers: { Accept: 'application/json' } })
      if (!response.ok) throw new Error('Cover catalog unavailable')
      return response.json()
    }
    const library = (async () => {
      if (book.openLibraryKey && /^\/(works\/OL\d+W|books\/OL\d+M)$/.test(book.openLibraryKey)) {
        const data = await read(`https://openlibrary.org${book.openLibraryKey}.json`) as { covers?: number[] }
        const id = data.covers?.find(value => Number.isInteger(value) && value > 0)
        return id ? `https://covers.openlibrary.org/b/id/${id}-M.jpg?default=false` : undefined
      }
      const params = new URLSearchParams({ title: book.title, author: book.authors[0] || '', limit: '8', fields: 'key,title,author_name,isbn,cover_i' })
      const data = await read(`https://openlibrary.org/search.json?${params}`) as { docs?: CoverSearchResult[] }
      const id = matchingCover(book, data.docs || [])
      return id ? `https://covers.openlibrary.org/b/id/${id}-M.jpg?default=false` : undefined
    })().catch(() => undefined)
    return (await Promise.all([google, library])).filter((url): url is string => Boolean(url))
  }).catch(() => [])
  if (lookupCache.size >= 200) lookupCache.delete(lookupCache.keys().next().value!)
  const entry = { until: 0, pending: true, promise }
  lookupCache.set(key, entry)
  void promise.then(value => { entry.pending = false; entry.until = Date.now() + (value.length ? 5 * 60_000 : 20_000) })
  return promise
}

export async function lookupBookArtwork(book: ArtworkBook, refresh = false) {
  return (await lookupBookArtworkCandidates(book, refresh))[0]
}

const artworkVersions = new Map<string, number>()
const artworkListeners = new Map<string, Set<() => void>>()
const loadedCovers = new Map<string, string>()
export const bookArtworkVersion = (key: string) => artworkVersions.get(key) ?? 0
export function subscribeBookArtwork(key: string, listener: () => void) {
  const listeners = artworkListeners.get(key) ?? new Set()
  listeners.add(listener); artworkListeners.set(key, listeners)
  return () => { listeners.delete(listener); if (!listeners.size) artworkListeners.delete(key) }
}
export function refreshBookArtwork(book: ArtworkBook) {
  const key = artworkKey(book)
  lookupCache.delete(key)
  loadedCovers.delete(`${key}:false`); loadedCovers.delete(`${key}:true`)
  artworkVersions.set(key, Math.max(Date.now(), bookArtworkVersion(key) + 1))
  artworkListeners.get(key)?.forEach(listener => listener())
}

export function retryBookCover(url: string, refreshToken: number) {
  if (!refreshToken) return url
  const target = new URL(url)
  // Don't modify arbitrary custom/signed artwork URLs. These catalog image
  // endpoints accept extra query parameters, giving an explicit retry a fresh URL.
  if (['books.google.com', 'books.googleusercontent.com', 'covers.openlibrary.org'].includes(target.hostname)) {
    target.searchParams.set('checkpoint_retry', String(refreshToken))
  }
  return target.href
}

// Probe candidates sequentially before rendering. Each load owns its own timeout
// and cancellation, so a late failure cannot skip the next (working) candidate.
export async function resolveBookArtwork(book: ArtworkBook, options: {
  large: boolean
  refreshToken?: number
  signal: AbortSignal
  probe: (url: string, signal: AbortSignal) => Promise<boolean>
  lookup?: (book: ArtworkBook) => Promise<string[]>
}) {
  const { large, signal, probe, refreshToken = 0, lookup = lookupBookArtworkCandidates } = options
  const cacheKey = `${artworkKey(book)}:${large}`
  const tried = new Set<string>()
  const tryUrls = async (urls: (string | undefined)[]) => {
    for (const source of urls) {
      signal.throwIfAborted()
      if (!source) continue
      const url = retryBookCover(source, refreshToken)
      if (tried.has(url)) continue
      tried.add(url)
      if (await probe(url, signal)) {
        signal.throwIfAborted()
        if (loadedCovers.size >= 200) loadedCovers.delete(loadedCovers.keys().next().value!)
        loadedCovers.set(cacheKey, url)
        return url
      }
    }
    return undefined
  }
  const cached = await tryUrls([loadedCovers.get(cacheKey)])
  if (cached) return cached
  let recovered: string[] | undefined
  const recoveryUrls = (urls: string[]) => urls.flatMap(url => [normalizeBookCover(url, large), normalizeBookCover(url)])
  if (refreshToken) {
    // An explicit refresh asks the catalogs for current artwork first, rather
    // than accepting the same stale (or pre-release placeholder) image again.
    recovered = await lookup(book)
    signal.throwIfAborted()
    const fresh = await tryUrls(recoveryUrls(recovered))
    if (fresh) return fresh
  }
  const initial = await tryUrls(bookCoverCandidates(book, large))
  if (initial) return initial
  signal.throwIfAborted()
  recovered ??= await lookup(book)
  signal.throwIfAborted()
  return tryUrls(recoveryUrls(recovered))
}
