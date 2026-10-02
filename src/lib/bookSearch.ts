import type { Book, BookSeries } from '../types'
import { inferSeries, matchesCatalogBook, normalizeGenres } from './bookOrganization'

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

async function googleBooks(query: string, signal?: AbortSignal): Promise<BookSearchResult[]> {
  const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=20&printType=books`, { signal })
  if (!response.ok) throw new Error('Google Books search is unavailable.')
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

export async function searchBooks(input: string, signal?: AbortSignal) {
  signal = signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000)
  const query = normalizedQuery(input)
  if (query.length < 2) return []
  try {
    const primary = await googleBooks(query, signal)
    if (primary.length) return primary
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
  }
  return openLibrary(query, signal)
}

// Enrich only a verified matching book. User corrections always take precedence.
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
        const rawSeries = data.series?.find((value) => typeof value === 'string' && value.trim())
        series ??= inferSeries(data.subtitle, data.title, ...(data.series ?? []))
        if (!series && rawSeries) {
          const numbered = rawSeries.match(/^(.+?)\s*(?:--|;|#)\s*(\d+(?:\.\d+)?)\s*$/)
          series = numbered ? { name: numbered[1].trim(), position: Number(numbered[2]) } : { name: rawSeries.trim() }
        }
        if (!genres.length) genres = normalizeGenres(data.subjects)
      }
    } catch (error) { if (signal?.aborted) throw error }
  }
  return { genres, ...(series ? { series } : {}) }
}
