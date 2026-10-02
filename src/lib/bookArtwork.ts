import type { Book } from '../types.ts'
import { normalizeBookText } from './bookOrganization.ts'

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

export function bookCoverCandidates(book: ArtworkBook, large = false) {
  const candidates = [normalizeBookCover(book.coverUrl, large)]
  let googleId = book.googleBooksId
  if (!googleId && book.coverUrl) {
    try { const url = new URL(book.coverUrl); if (url.hostname === 'books.google.com') googleId = url.searchParams.get('id') || undefined } catch { /* Try the other identifiers. */ }
  }
  if (googleId && /^[\w-]+$/.test(googleId)) candidates.push(`https://books.google.com/books/content?id=${encodeURIComponent(googleId)}&printsec=frontcover&img=1&zoom=1&source=gbs_api`)
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
const lookupCache = new Map<string, { until: number; promise: Promise<string | undefined> }>()
let queue = Promise.resolve()
let nextRequestAt = 0
export function lookupBookArtwork(book: ArtworkBook, refresh = false): Promise<string | undefined> {
  const key = artworkKey(book), cached = lookupCache.get(key)
  if (!refresh && cached && cached.until > Date.now()) return cached.promise
  const promise = queue.then(async () => {
    const delay = Math.max(0, nextRequestAt - Date.now())
    if (delay) await new Promise(resolve => setTimeout(resolve, delay))
    nextRequestAt = Date.now() + 1100
    const read = async (url: string) => {
      const response = await fetch(url, { signal: AbortSignal.timeout(10000), headers: { Accept: 'application/json' } })
      if (!response.ok) throw new Error('Cover catalog unavailable')
      return response.json()
    }
    if (book.openLibraryKey && /^\/(works\/OL\d+W|books\/OL\d+M)$/.test(book.openLibraryKey)) {
      const data = await read(`https://openlibrary.org${book.openLibraryKey}.json`) as { covers?: number[] }
      const id = data.covers?.find(value => Number.isInteger(value) && value > 0)
      if (id) return `https://covers.openlibrary.org/b/id/${id}-M.jpg?default=false`
      // No cover for this known work/edition; don't choose a different book.
      return undefined
    }
    const params = new URLSearchParams({ title: book.title, author: book.authors[0] || '', limit: '8', fields: 'key,title,author_name,isbn,cover_i' })
    const data = await read(`https://openlibrary.org/search.json?${params}`) as { docs?: CoverSearchResult[] }
    const id = matchingCover(book, data.docs || [])
    return id ? `https://covers.openlibrary.org/b/id/${id}-M.jpg?default=false` : undefined
  }).catch(() => undefined)
  queue = promise.then(() => {})
  if (lookupCache.size >= 200) lookupCache.delete(lookupCache.keys().next().value!)
  lookupCache.set(key, { until: Date.now() + 5 * 60 * 1000, promise })
  return promise
}
