import { SlidersHorizontal } from 'lucide-react'
import BookCoverImage from './BookCoverImage'
import { bookChapterBookmark } from './lib/bookChapterBookmark'
import type { Book } from './types'
import './PaperbackCard.css'

export default function PaperbackCard({ book, user, onOpen }: { book: Book; user: string; onOpen: () => void }) {
  const chapter = bookChapterBookmark(book, user)
  const authors = book.authors.join(', ')
  return <article className="paperback-card">
    <button className="paperback-open" type="button" onClick={onOpen} aria-haspopup="dialog"
      aria-label={`Open details and settings for ${book.title}${authors ? ` by ${authors}` : ''}${chapter !== null ? `, chapter ${chapter}` : ''}`}
      title="Details & settings">
      <span className="paperback-sheet" aria-hidden="true">
        {book.series && <span className="paperback-series">{book.series.name}{book.series.position ? ` · Book ${book.series.position}` : ''}</span>}
        <strong>{book.title}</strong>
        <span className="paperback-author">{authors}</span>
        <span className="paperback-settings"><SlidersHorizontal size={20} /></span>
      </span>
      <span className="paperback-cover" aria-hidden="true">
        <span className="paperback-cover-front">
          <span className="paperback-fallback"><strong>{book.title}</strong><span>{authors}</span></span>
          <BookCoverImage book={book} large />
        </span>
        <span className="paperback-cover-back" />
      </span>
      {chapter !== null && <span className={`paperback-ribbon${String(chapter).length > 3 ? ' paperback-ribbon-long' : ''}`} aria-hidden="true">{chapter}</span>}
    </button>
  </article>
}
