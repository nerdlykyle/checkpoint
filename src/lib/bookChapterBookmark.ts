import type { Book } from '../types'

/** Zero is the legacy “not started” value, not a registered reading chapter. */
export function bookChapterBookmark(book: Pick<Book, 'progress'>, user: string): number | null {
  const chapter = book.progress[user]?.lastChapter
  return typeof chapter === 'number' && Number.isSafeInteger(chapter) && chapter > 0 ? chapter : null
}
