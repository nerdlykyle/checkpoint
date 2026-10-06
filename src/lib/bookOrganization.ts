import type { Book, BookSeries, BookShelf } from '../types.ts'

export const shelfNames: Record<BookShelf, string> = { 'to-read': 'To read', reading: 'Reading', read: 'Read', paused: 'Paused', dnf: 'Didn’t finish' }
export const normalizeBookText = (text: string) => text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')

export function normalizeGenres(subjects: string[] = []) {
  const patterns: [string, RegExp][] = [
    ['Sci-fi', /science fiction|sci.?fi|space opera|cyberpunk/i], ['Horror', /horror|ghost stories/i],
    ['Fantasy', /fantasy|magic|lit.?rpg/i], ['Mystery', /mystery|detective/i], ['Thriller', /thriller|suspense/i],
    ['Romance', /romance|love stories/i], ['Historical fiction', /historical fiction|fiction.*historical/i],
    ['Nonfiction', /non.?fiction/i], ['Biography & memoir', /biograph|memoir/i], ['History', /^history(?:$|\s*\/)/i],
    ['Young adult', /young adult/i], ['Comics & graphic novels', /comic|graphic novel|manga/i],
    ['Literary fiction', /literary/i], ['Poetry', /poetry/i], ['Self-development', /self.help|personal growth/i],
  ]
  return patterns.filter(([, pattern]) => subjects.some((subject) => pattern.test(subject))).map(([name]) => name)
}

// Only infer explicitly numbered series; never guess a series from an author's name.
export function inferSeries(...texts: (string | undefined)[]): BookSeries | undefined {
  for (const text of texts) {
    if (!text) continue
    const match = text.match(/\(([^()]+?),\s*(?:book\s*)?#?\s*(\d+(?:\.\d+)?)(?:\s+of\s+(\d+))?\)/i)
      ?? text.match(/^(.+?)(?:\s*[:,—–-]\s*|\s+)(?:book|volume|vol\.?)\s+(\d+(?:\.\d+)?)(?:\s+of\s+(\d+))?\b/i)
    if (match) return { name: match[1].trim(), position: Number(match[2]), ...(match[3] ? { total: Number(match[3]) } : {}) }
  }
}

export function personalQueue(books: Book[], reader: string, shelf?: BookShelf) {
  return books.filter((book) => shelf ? book.shelves[reader] === shelf : Boolean(book.shelves[reader]))
    .sort((a, b) => (a.readerOrganization?.[reader]?.order ?? Number.MAX_SAFE_INTEGER) - (b.readerOrganization?.[reader]?.order ?? Number.MAX_SAFE_INTEGER) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
}

export function movePersonalBook(books: Book[], reader: string, id: string, position: number) {
  const book = books.find((item) => item.id === id)
  if (!book?.shelves[reader] || !Number.isFinite(position)) return books
  const queue = personalQueue(books, reader, book.shelves[reader])
  const from = queue.findIndex((item) => item.id === id)
  queue.splice(from, 1)
  queue.splice(Math.max(0, Math.min(queue.length, Math.round(position) - 1)), 0, book)
  const ranks = new Map(queue.map((item, index) => [item.id, index + 1]))
  return books.map((item) => ranks.has(item.id) ? { ...item, readerOrganization: { ...item.readerOrganization, [reader]: { ...item.readerOrganization?.[reader], order: ranks.get(item.id)! } } } : item)
}

export function setPersonalShelf(books: Book[], reader: string, id: string, shelf: BookShelf, source?: string) {
  const existing = books.find((book) => book.id === id)
  if (!existing || existing.shelves[reader] === shelf) return books
  const queue = personalQueue(books, reader, shelf)
  const ranks = new Map([...queue, existing].map((book, index) => [book.id, index + 1]))
  return books.map((book) => {
    if (!ranks.has(book.id)) return book
    const organization = { ...book.readerOrganization?.[reader], order: ranks.get(book.id)! }
    if (book.id === id && !existing.shelves[reader]) {
      delete organization.savedFrom
      if (source && source !== reader && existing.shelves[source]) organization.savedFrom = source
    }
    return { ...book, shelves: { ...book.shelves, [reader]: shelf }, readerOrganization: { ...book.readerOrganization, [reader]: organization } }
  })
}

export function sameSeries(a: Book, b: Book) {
  return Boolean(a.series?.name && b.series?.name && normalizeBookText(a.series.name) === normalizeBookText(b.series.name) && a.authors.some((author) => b.authors.some((other) => normalizeBookText(author) === normalizeBookText(other))))
}

export function nextSeriesBook(books: Book[], book: Book) {
  if (book.series?.position === undefined) return undefined
  return books.filter((candidate) => sameSeries(book, candidate) && candidate.series!.position !== undefined && candidate.series!.position! > book.series!.position!)
    .sort((a, b) => a.series!.position! - b.series!.position!)[0]
}

export function matchesCatalogBook(book: Pick<Book, 'title' | 'authors' | 'isbn13' | 'isbn10' | 'googleBooksId' | 'openLibraryKey'>, candidate: Partial<Book>) {
  return Boolean((book.isbn13 && book.isbn13 === candidate.isbn13) || (book.isbn10 && book.isbn10 === candidate.isbn10)
    || (book.googleBooksId && book.googleBooksId === candidate.googleBooksId) || (book.openLibraryKey && book.openLibraryKey === candidate.openLibraryKey)
    || (normalizeBookText(book.title) === normalizeBookText(candidate.title ?? '') && book.authors.some((author) => candidate.authors?.some((other) => normalizeBookText(author) === normalizeBookText(other)))))
}
