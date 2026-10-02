import type { Book, BookShelf } from '../types.ts'
import type { BookSearchResult } from './bookSearch.ts'
import { normalizeBookText, setPersonalShelf } from './bookOrganization.ts'

export function sameBookWork(a: Pick<Book, 'title' | 'authors'>, b: Pick<Book, 'title' | 'authors'>) {
  return normalizeBookText(a.title) === normalizeBookText(b.title) && a.authors.some(author =>
    normalizeBookText(author) !== 'unknownauthor' && b.authors.some(other => normalizeBookText(author) === normalizeBookText(other)))
}

// A user's selected catalog record wins, even if another edition shares an ISBN.
export function findBookEdition(books: Book[], result: BookSearchResult) {
  if (result.googleBooksId) return books.find(book => book.googleBooksId === result.googleBooksId)
  if (result.openLibraryKey) return books.find(book => book.openLibraryKey === result.openLibraryKey)
  const isbn = (value?: string) => value?.replace(/[\s-]/g, '').toUpperCase()
  return books.find(book => Boolean((result.isbn13 && isbn(book.isbn13) === isbn(result.isbn13)) ||
    (result.isbn10 && isbn(book.isbn10) === isbn(result.isbn10))))
}

export function saveBookEdition(books: Book[], result: BookSearchResult, user: string, shelf: BookShelf, replacingId?: string) {
  const exact = findBookEdition(books, result)
  const source = replacingId ? books.find(book => book.id === replacingId) : books.find(book => sameBookWork(book, result) && book.shelves[user])
    ?? books.find(book => sameBookWork(book, result) && (book.progress[user] || book.ratings[user] || book.readerOrganization?.[user] || book.addedBy === user))
  const target: Book = exact ?? {
    id: crypto.randomUUID(), title: result.title, authors: result.authors, description: result.description,
    coverUrl: result.coverUrl, publishedYear: result.publishedYear, isbn10: result.isbn10, isbn13: result.isbn13,
    googleBooksId: result.googleBooksId, openLibraryKey: result.openLibraryKey, genres: result.genres,
    series: result.series ?? (source && sameBookWork(source, result) ? source.series : undefined),
    addedBy: user, createdAt: new Date().toISOString(), nominated: false, upvotes: [], downvotes: [],
    shelves: {}, progress: {}, ratings: {}, comments: [],
  }
  let updated = books
  if (source && source.id !== target.id) {
    // Keep shared discussions, club choices, and everyone else's data on the original record.
    const shelves = { ...source.shelves }
    delete shelves[user]
    updated = books.map(book => book.id === source.id ? { ...book, shelves } : book)
  }
  const saved: Book = source && source.id !== target.id ? {
    ...target,
    progress: { ...target.progress, ...(target.progress[user] || !source.progress[user] ? {} : { [user]: source.progress[user] }) },
    ratings: { ...target.ratings, ...(target.ratings[user] || !source.ratings[user] ? {} : { [user]: source.ratings[user] }) },
    readerOrganization: { ...target.readerOrganization, [user]: { ...source.readerOrganization?.[user], ...target.readerOrganization?.[user] } },
    // Only a record key is shared; note text remains in this user's protected Firestore path.
    privateNoteIds: { ...target.privateNoteIds, [user]: target.privateNoteIds?.[user] ??
      (exact && (target.shelves[user] || target.progress[user] || target.ratings[user] || target.readerOrganization?.[user] || target.addedBy === user)
        ? target.id : source.privateNoteIds?.[user] ?? source.id) },
  } : target
  updated = exact ? updated.map(book => book.id === saved.id ? saved : book) : [saved, ...updated]
  return { books: setPersonalShelf(updated, user, saved.id, shelf), id: saved.id }
}
