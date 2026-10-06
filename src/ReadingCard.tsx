import { type ReactNode } from 'react'
import { BookCheck, BookMarked, BookX, MessageCircle, Pause } from 'lucide-react'
import BookCoverImage from './BookCoverImage'
import MoreActions from './MoreActions'
import ArtworkControls from './ArtworkControls'
import type { Book, BookShelf, Member } from './types'
import './ReadingCard.css'
import './CardGlass.css'

export default function ReadingCard({ book, user, crew = [], onChapter, onShelf, onDiscuss, children, club = false, label }: { book: Book; user: string; crew?: Member[]; onChapter?: () => void; onShelf?: (shelf: BookShelf) => void; onDiscuss: () => void; children?: ReactNode; club?: boolean; label?: string }) {
  return <article className={`reading-hero${club ? ' reading-hero-club' : ''}`}>
    <div className="reading-artwork" aria-hidden="true"><BookCoverImage book={book} large /></div>
    <ArtworkControls title={book.title} source={crew.find(member=>member.id===book.readerOrganization?.[user]?.savedFrom)} onOpen={onDiscuss}/>
    <div className="reading-glass card-glass">
      <span className="eyebrow">{label ?? (club ? 'Club read' : `Chapter ${book.progress[user]?.lastChapter ?? 0}`)}</span>
      <h2 className="reading-title">{book.title}</h2>
      <p>{book.authors.join(', ')}</p>
      <div className="reading-actions">
        {onChapter && (onShelf ? <MoreActions label={`Update my reading for ${book.title}`} icon={<BookMarked size={21} />} actions={[
          { id: 'chapter', label: 'Update chapter', icon: <BookMarked size={19} />, onSelect: onChapter, opensDialog: true },
          { id: 'finished', label: 'Finished', section: 'My personal shelf', icon: <BookCheck size={19} />, disabled: book.shelves[user] === 'read', onSelect: () => onShelf('read') },
          { id: 'dnf', label: 'DNF (didn’t finish)', section: 'My personal shelf', icon: <BookX size={19} />, disabled: book.shelves[user] === 'dnf', onSelect: () => onShelf('dnf') },
          { id: 'paused', label: 'Paused', section: 'My personal shelf', icon: <Pause size={19} />, disabled: book.shelves[user] === 'paused', onSelect: () => onShelf('paused') },
        ]} /> : <button type="button" onClick={onChapter} aria-label={`Update chapter for ${book.title}`} title="Update chapter"><BookMarked size={21} /></button>)}
        <button type="button" onClick={onDiscuss} aria-label={`Open discussion for ${book.title}`} title="Open discussion"><MessageCircle size={21} /></button>
      </div>
      {children}
    </div>
  </article>
}
