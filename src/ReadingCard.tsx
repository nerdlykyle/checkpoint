import { type ReactNode } from 'react'
import { BookMarked, MessageCircle } from 'lucide-react'
import BookCoverImage from './BookCoverImage'
import type { Book } from './types'
import './ReadingCard.css'
import './CardGlass.css'

export default function ReadingCard({ book, user, onChapter, onDiscuss, children, club = false, label }: { book: Book; user: string; onChapter?: () => void; onDiscuss: () => void; children?: ReactNode; club?: boolean; label?: string }) {
  return <article className={`reading-hero${club ? ' reading-hero-club' : ''}`}>
    <div className="reading-artwork" aria-hidden="true"><BookCoverImage book={book} large /></div>
    <div className="reading-glass card-glass">
      <span className="eyebrow">{label ?? (club ? 'Club read' : `Chapter ${book.progress[user]?.lastChapter ?? 0}`)}</span>
      <h2><button className="reading-title" type="button" onClick={onDiscuss}>{book.title}</button></h2>
      <p>{book.authors.join(', ')}</p>
      <div className="reading-actions">
        {onChapter && <button type="button" onClick={onChapter} aria-label={`Update chapter for ${book.title}`} title="Update chapter"><BookMarked size={21} /></button>}
        <button type="button" onClick={onDiscuss} aria-label={`Open discussion for ${book.title}`} title="Open discussion"><MessageCircle size={21} /></button>
      </div>
      {children}
    </div>
  </article>
}
