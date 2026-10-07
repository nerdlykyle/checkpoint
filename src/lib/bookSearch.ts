import type { Book, BookSeries } from '../types'
import { inferSeries, matchesCatalogBook, normalizeGenres } from './bookOrganization.ts'

export type BookSearchResult = {
  genres?: string[]
  series?: BookSeries
  catalogId: string
  source: 'google-books' | 'open-library'
  title: string
  authors: string[]
  description: string
  coverUrl?: string
  publishedYear?: number
  isbn10?: string
  isbn13?: string
  googleBooksId?: string
  openLibraryKey?: string
}

function secureCover(url?: string) {
  return url?.replace(/^http:/, 'https:').replace('&edge=curl', '')
}

function yearFrom(value?: string) {
  const year = value?.match(/\b(1[4-9]\d{2}|20\d{2}|21\d{2})\b/)?.[1]
  return year ? Number(year) : undefined
}

function isbnFromLink(value: string) {
  try {
    const url = new URL(value)
    const candidate = `${url.pathname} ${url.search}`.match(/(?:isbn(?:=|\/)|dp\/)(97[89]\d{10}|\d{9}[\dX])/i)?.[1]
    return candidate?.toUpperCase()
  } catch {
    return undefined
  }
}

function normalizedQuery(input: string) {
  const trimmed = input.trim()
  const isbn = /^\d[\d\s-]{8,16}[\dX]$/i.test(trimmed)
    ? trimmed.replace(/[\s-]/g, '').toUpperCase()
    : isbnFromLink(trimmed)
  return isbn ? `isbn:${isbn}` : trimmed
}

async function googleBooks(query: string, apiKey: string, signal?: AbortSignal): Promise<BookSearchResult[]> {
  if (!apiKey) throw new Error('Google Books search is not configured yet.')
  const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=20&printType=books&key=${encodeURIComponent(apiKey)}`, { signal })
  if (response.status === 429) throw new Error('Google Books has reached its search limit. Please try again later.')
  if (response.status === 400 || response.status === 401 || response.status === 403) throw new Error('Google Books access needs attention. Check the Books API key, website restrictions, and quota in Google Cloud.')
  if (!response.ok) throw new Error('Google Books search is temporarily unavailable.')
  const data = await response.json() as {
    items?: Array<{ id: string; volumeInfo?: {
      title?: string; subtitle?: string; categories?: string[]; authors?: string[]; description?: string; publishedDate?: string
      imageLinks?: { thumbnail?: string; smallThumbnail?: string }
      industryIdentifiers?: Array<{ type?: string; identifier?: string }>
    } }>
  }
  return (data.items ?? []).flatMap((item) => {
    const info = item.volumeInfo
    if (!info?.title) return []
    const isbn10 = info.industryIdentifiers?.find((id) => id.type === 'ISBN_10')?.identifier
    const isbn13 = info.industryIdentifiers?.find((id) => id.type === 'ISBN_13')?.identifier
    return [{
      catalogId: `google:${item.id}`,
      source: 'google-books' as const,
      title: info.title,
      genres: normalizeGenres(info.categories),
      series: inferSeries(info.subtitle, info.title),
      authors: info.authors ?? ['Unknown author'],
      description: info.description ?? '',
      coverUrl: secureCover(info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail),
      publishedYear: yearFrom(info.publishedDate),
      isbn10,
      isbn13,
      googleBooksId: item.id,
    }]
  })
}

async function openLibrary(query: string, signal?: AbortSignal): Promise<BookSearchResult[]> {
  const raw = query.startsWith('isbn:') ? query.slice(5) : query
  const parameter = query.startsWith('isbn:') ? `isbn=${encodeURIComponent(raw)}` : `q=${encodeURIComponent(raw)}`
  const response = await fetch(`https://openlibrary.org/search.json?${parameter}&limit=20&fields=key,title,author_name,first_publish_year,isbn,cover_i,subject`, { signal })
  if (!response.ok) throw new Error('Open Library search is unavailable.')
  const data = await response.json() as { docs?: Array<{ key?: string; title?: string; author_name?: string[]; first_publish_year?: number; isbn?: string[]; cover_i?: number; subject?: string[] }> }
  return (data.docs ?? []).flatMap((item) => {
    if (!item.key || !item.title) return []
    const isbn10 = item.isbn?.find((isbn) => isbn.length === 10)
    const isbn13 = item.isbn?.find((isbn) => isbn.length === 13)
    return [{
      catalogId: `open-library:${item.key}`,
      source: 'open-library' as const,
      title: item.title,
      genres: normalizeGenres(item.subject),
      series: inferSeries(item.title),
      authors: item.author_name ?? ['Unknown author'],
      description: '',
      coverUrl: item.cover_i ? `https://covers.openlibrary.org/b/id/${item.cover_i}-L.jpg` : undefined,
      publishedYear: item.first_publish_year,
      isbn10,
      isbn13,
      openLibraryKey: item.key,
    }]
  })
}

export type BookSearchResponse = { results: BookSearchResult[]; warning?: string }

// A bounded, in-memory cache avoids repeating successful searches without storing
// API keys or search history on disk. Failed/partial searches are never cached.
export function createBookSearch(apiKey: string) {
  const cache = new Map<string, { results: BookSearchResult[]; expiresAt: number }>()
  return async (input: string, signal?: AbortSignal): Promise<BookSearchResponse> => {
    signal?.throwIfAborted()
    const query = normalizedQuery(input)
    if (query.length < 2) return { results: [] }
    const cached = cache.get(query)
    if (cached && cached.expiresAt > Date.now()) return { results: structuredClone(cached.results) }
    cache.delete(query)
    const remember = (results: BookSearchResult[]) => {
      if (results.length) {
        if (cache.size >= 50) cache.delete(cache.keys().next().value!)
        cache.set(query, { results: structuredClone(results), expiresAt: Date.now() + 5 * 60_000 })
      }
      return { results }
    }
    // Each provider gets its own timeout so a slow primary cannot exhaust the
    // fallback's time budget. Caller cancellation still stops both immediately.
    const providerSignal = () => signal ? AbortSignal.any([signal, AbortSignal.timeout(7000)]) : AbortSignal.timeout(7000)
    let warning: string | undefined
    try {
      const primary = await googleBooks(query, apiKey.trim(), providerSignal())
      signal?.throwIfAborted()
      if (primary.length) return remember(primary)
    } catch (error) {
      signal?.throwIfAborted()
      warning = error instanceof DOMException && error.name === 'TimeoutError'
        ? 'Google Books took too long to respond.'
        : error instanceof TypeError ? 'Google Books could not be reached. Check your connection.'
          : error instanceof Error ? error.message : 'Google Books search is unavailable.'
    }
    try {
      const results = await openLibrary(query, providerSignal())
      signal?.throwIfAborted()
      return warning ? { results, warning: `${warning} ${results.length ? 'Showing Open Library results only.' : 'Open Library found no matches; Google Books could not be checked.'}` } : remember(results)
    } catch {
      signal?.throwIfAborted()
      throw new Error(`${warning ? `${warning} ` : ''}Open Library could not be reached. Please try again.`)
    }
  }
}

export const searchBookCatalog = createBookSearch(import.meta.env?.VITE_GOOGLE_BOOKS_API_KEY ?? '')

export async function searchBooks(input: string, signal?: AbortSignal) {
  return (await searchBookCatalog(input, signal)).results
}

// Enrich only a verified matching book. User corrections always take precedence.
function catalogSeries(data: { title?: string; subtitle?: string; series?: string[] }) {
  const values = Array.isArray(data.series) ? data.series.filter((value): value is string => typeof value === 'string' && Boolean(value.trim())) : []
  const inferred = inferSeries(data.subtitle, data.title, ...values)
  if (inferred) return inferred
  const raw = values[0]
  if (!raw) return undefined
  const numbered = raw.match(/^(.+?)\s*(?:--|;|#)\s*(\d+(?:\.\d+)?)\s*$/)
  return numbered ? { name: numbered[1].trim(), position: Number(numbered[2]) } : { name: raw.trim() }
}

export async function lookupBookMetadata(book: Book, signal?: AbortSignal): Promise<Pick<Book, 'genres' | 'series'>> {
  signal = signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000)
  const query = book.isbn13 || book.isbn10 ? `isbn:${book.isbn13 ?? book.isbn10}` : `${book.title} ${book.authors[0] ?? ''}`
  const candidates = await searchBooks(query, signal)
  const match = candidates.find((candidate) => matchesCatalogBook(book, candidate))
  let series = book.series ?? match?.series ?? inferSeries(book.title)
  let genres = book.genres?.length ? book.genres : match?.genres ?? []
  const isbn = book.isbn13 ?? book.isbn10 ?? match?.isbn13 ?? match?.isbn10
  const key = book.openLibraryKey ?? match?.openLibraryKey
  const url = isbn && /^[\dX]{10,13}$/.test(isbn) ? `https://openlibrary.org/isbn/${isbn}.json`
    : key && /^\/works\/OL\d+W$/.test(key) ? `https://openlibrary.org${key}.json` : undefined
  if (url && (!series || !genres.length)) {
    try {
      const response = await fetch(url, { signal })
      if (response.ok) {
        const data = await response.json() as { title?: string; subtitle?: string; series?: string[]; subjects?: string[] }
        series ??= catalogSeries(data)
        if (!genres.length) genres = normalizeGenres(data.subjects)
      }
    } catch (error) { if (signal?.aborted) throw error }
  }
  // Series belongs to the work, not the chosen cover/format. Check sibling editions
  // only after verifying both title and author; never replace the selected artwork.
  if (!series) {
    try {
      const siblings = await openLibrary(`${book.title} ${book.authors[0] ?? ''}`, signal)
      const works = siblings.filter(candidate => matchesCatalogBook({ title: book.title, authors: book.authors }, candidate))
        .filter(candidate => /^\/works\/OL\d+W$/.test(candidate.openLibraryKey ?? '')).slice(0, 3)
      for (const work of works) {
        const response = await fetch(`https://openlibrary.org${work.openLibraryKey}/editions.json?limit=10`, { signal })
        if (!response.ok) continue
        const data = await response.json() as { entries?: Array<{ title?: string; subtitle?: string; series?: string[] }> }
        series = data.entries?.map(catalogSeries).find(Boolean)
        if (series) break
      }
    } catch (error) { if (signal.aborted) throw error }
  }
  return { genres, ...(series ? { series } : {}) }
}
