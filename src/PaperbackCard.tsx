import { SlidersHorizontal } from 'lucide-react'
import BookCoverImage from './BookCoverImage'
import { bookChapterBookmark } from './lib/bookChapterBookmark'
import { MemberPortrait } from './MemberShelfPicker'
import { bookmarkColor, bookmarkInk } from './lib/bookmarkColors'
import type { Book, Member } from './types'
import './PaperbackCard.css'

export default function PaperbackCard({ book, user, crew = [], club = false, onOpen, onChapter }: { book: Book; user: string; crew?: Member[]; club?: boolean; onOpen: () => void; onChapter?: () => void }) {
  const chapter = bookChapterBookmark(book, user)
  const color = bookmarkColor(crew.find(member => member.id === user))
  const readers = club ? (book.club?.participantIds || []).flatMap(id => {
    const value = bookChapterBookmark(book, id)
    if (value === null) return []
    const member = crew.find(person => person.id === id) || { id, name: 'Reader', initials: '?', color: '#54458b' }
    return [{ member, chapter: value }]
  }) : []
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
      {!club && chapter !== null && <span className={`paperback-ribbon${String(chapter).length > 3 ? ' paperback-ribbon-long' : ''}`} style={{ backgroundColor: color, color: bookmarkInk(color) }} aria-hidden="true">{chapter}</span>}
    </button>
    {club && <div className="club-bookmarks" aria-label="Readers’ bookmarks">{readers.map(({ member, chapter: value }) => {
      const own = member.id === user && Boolean(onChapter)
      const label = `${member.name}: chapter ${value}${own ? '. Update your chapter' : ''}`
      const ribbonColor = bookmarkColor(member)
      const content = <span className="club-bookmark-ribbon" style={{ backgroundColor: ribbonColor, color: bookmarkInk(ribbonColor) }}><MemberPortrait member={member} /><strong>{value}</strong></span>
      return own ? <button type="button" className="club-bookmark" key={member.id} title={label} aria-label={label} aria-haspopup="dialog" onClick={onChapter}>{content}</button>
        : <span className="club-bookmark" key={member.id} title={label} aria-label={label}>{content}</span>
    })}</div>}
  </article>
}
