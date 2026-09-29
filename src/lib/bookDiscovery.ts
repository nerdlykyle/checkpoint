import type { Book } from '../types.ts'

export type DiscoveryPick = {
  id: string
  month: string
  title: string
  authors: string[]
  description: string
  isbn13: string
  coverUrl?: string
  openLibraryKey?: string
  bookshopUrl: string
  discussionUrl?: string
  metadataUrl?: string
}

export type BookDiscoveryFeed = { version: number; sourceUrl: string; lastCheckedAt: string; picks: DiscoveryPick[] }

function normalized(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function findDiscoveryBook(books: Book[], pick: DiscoveryPick) {
  return books.find((book) => book.discoveryIds?.includes(pick.id)
    || book.isbn13 === pick.isbn13
    || (pick.openLibraryKey && book.openLibraryKey === pick.openLibraryKey)
    || (normalized(book.title) === normalized(pick.title) && book.authors.some((author) => pick.authors.some((candidate) => normalized(candidate) === normalized(author)))))
}

export function addDiscoveryBook(books: Book[], pick: DiscoveryPick, userId: string, action: 'shelf' | 'nominate'): Book[] {
  const existing = findDiscoveryBook(books, pick)
  if (action === 'nominate' && (existing?.passedOnAt || existing?.club)) return books
  const book: Book = existing ?? {
    id: crypto.randomUUID(), title: pick.title, authors: pick.authors, description: pick.description,
    isbn13: pick.isbn13, coverUrl: pick.coverUrl, openLibraryKey: pick.openLibraryKey,
    addedBy: userId, createdAt: new Date().toISOString(), nominated: false,
    upvotes: [], downvotes: [], shelves: {}, progress: {}, ratings: {}, comments: [],
  }
  const updated: Book = {
    ...book,
    discoveryIds: [...new Set([...(book.discoveryIds ?? []), pick.id])],
    ...(action === 'shelf'
      ? { shelves: { ...book.shelves, [userId]: book.shelves[userId] ?? 'to-read' } }
      : { nominated: true, upvotes: [...new Set([...book.upvotes, userId])], downvotes: book.downvotes.filter((id) => id !== userId) }),
  }
  return existing ? books.map((item) => item.id === existing.id ? updated : item) : [updated, ...books]
}

export function centralMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit' }).formatToParts(now)
  return `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}`
}

export function discoveryPickLabel(pick: DiscoveryPick, latestMonth: string, now = new Date()) {
  const current = centralMonth(now)
  return pick.month > current ? 'Upcoming pick' : pick.month === current ? 'Current monthly pick' : pick.month === latestMonth ? 'Latest announced pick' : 'Past pick'
}

export async function loadBookDiscovery(signal?: AbortSignal): Promise<BookDiscoveryFeed> {
  const response = await fetch(`${import.meta.env.BASE_URL}jeselnik-books.json`, { signal, cache: 'no-cache' })
  if (!response.ok) throw new Error('Book discovery is unavailable right now. Please try again.')
  const feed = await response.json() as BookDiscoveryFeed
  if (feed.version !== 1 || !Array.isArray(feed.picks) || !feed.picks.length || !Number.isFinite(Date.parse(feed.lastCheckedAt))) throw new Error('The saved book collection could not be loaded.')
  return feed
}
