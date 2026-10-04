import { useEffect, useRef, type ReactNode } from 'react'
import { BookMarked, MessageCircle } from 'lucide-react'
import BookCoverImage from './BookCoverImage'
import type { Book } from './types'
import './ReadingCard.css'

export default function ReadingCard({ book, user, onChapter, onDiscuss, children, club = false, label }: { book: Book; user: string; onChapter?: () => void; onDiscuss: () => void; children?: ReactNode; club?: boolean; label?: string }) {
  const card = useRef<HTMLElement>(null)
  const glass = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const measure = () => {
      if (card.current && glass.current) card.current.style.setProperty('--reading-glass-top', `${glass.current.offsetTop}px`)
    }
    measure()
    const observer = new ResizeObserver(measure)
    if (card.current) observer.observe(card.current)
    if (glass.current) observer.observe(glass.current)
    return () => observer.disconnect()
  }, [book.id])
  return <article className={`reading-hero${club ? ' reading-hero-club' : ''}`} ref={card}>
    <div className="reading-artwork" aria-hidden="true"><BookCoverImage book={book} large cinematic /></div>
    <div className="reading-glass" ref={glass}>
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
