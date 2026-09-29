import type { Book } from '../types'

export type ClubBookAction = 'queue' | 'start' | 'join' | 'leave' | 'finish' | 'unqueue'

export function isBookPollCandidate(book: Book) {
  return book.nominated !== false && !book.passedOnAt && !book.club
}

export function clubBookQueue(books: Book[]) {
  return books.filter((book) => book.club?.status === 'up-next')
    .sort((a, b) => (a.club?.order ?? 0) - (b.club?.order ?? 0) || a.id.localeCompare(b.id))
}

// Group transitions deliberately leave personal shelves alone except for the
// reader explicitly starting or joining a read.
export function applyClubBookAction(books: Book[], bookId: string, userId: string, action: ClubBookAction, now = new Date().toISOString()): Book[] {
  const book = books.find((item) => item.id === bookId)
  if (!book) return books
  if (action === 'start' && books.some((item) => item.club?.status === 'reading')) return books
  if ((action === 'join' || action === 'leave' || action === 'finish') && book.club?.status !== 'reading') return books
  if (action === 'queue' && book.club) return books
  if (action === 'start' && book.club && book.club.status !== 'up-next') return books
  if (action === 'unqueue' && book.club?.status !== 'up-next') return books
  return books.map((item) => {
    if (item.id !== bookId) return item
    if (action === 'queue') return {
      ...item, nominated: false, passedOnAt: undefined,
      club: { status: 'up-next', order: Math.max(0, ...clubBookQueue(books).map((queued) => queued.club!.order)) + 1, participantIds: [] },
    }
    if (action === 'start') return {
      ...item, nominated: false, passedOnAt: undefined,
      club: { status: 'reading', order: item.club?.order ?? 0, participantIds: [userId], startedAt: now },
      shelves: { ...item.shelves, [userId]: 'reading' },
    }
    if (action === 'join') return {
      ...item, club: { ...item.club!, participantIds: [...new Set([...item.club!.participantIds, userId])] },
      shelves: { ...item.shelves, [userId]: 'reading' },
    }
    if (action === 'leave') return {
      ...item, club: { ...item.club!, participantIds: item.club!.participantIds.filter((id) => id !== userId) },
    }
    if (action === 'finish') return {
      ...item, club: { ...item.club!, status: 'completed', completedAt: now },
    }
    return { ...item, club: undefined, nominated: false }
  })
}

export function moveClubBook(books: Book[], bookId: string, direction: -1 | 1): Book[] {
  const queue = clubBookQueue(books)
  const from = queue.findIndex((book) => book.id === bookId)
  const to = from + direction
  if (from < 0 || to < 0 || to >= queue.length) return books
  const [moved] = queue.splice(from, 1)
  queue.splice(to, 0, moved)
  const ranks = new Map(queue.map((book, index) => [book.id, index + 1]))
  return books.map((book) => ranks.has(book.id) && book.club
    ? { ...book, club: { ...book.club, order: ranks.get(book.id)! } } : book)
}
