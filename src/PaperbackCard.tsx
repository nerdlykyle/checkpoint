import { useContext, useState, type CSSProperties } from 'react'
import { Layers, SlidersHorizontal } from 'lucide-react'
import { CollectionActionContext } from './CollectionActionContext'
import BookCoverImage from './BookCoverImage'
import { usePaperbackCurl } from './usePaperbackCurl'
import { bookChapterBookmark } from './lib/bookChapterBookmark'
import { MemberPortrait } from './MemberShelfPicker'
import { bookmarkColor, bookmarkInk } from './lib/bookmarkColors'
import type { Book, Member } from './types'
import './PaperbackCard.css'

export default function PaperbackCard({ book, user, crew = [], club = false, source, onOpen, onChapter }: { book: Book; user: string; crew?: Member[]; club?: boolean; source?: Member; onOpen: () => void; onChapter?: () => void }) {
  const collection = useContext(CollectionActionContext)
  const [riffling, setRiffling] = useState(false)
  const curl = usePaperbackCurl(book.id)
  const riffle = () => { if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && !curl.play()) setRiffling(true) }
  const chapter = bookChapterBookmark(book, user)
  const color = bookmarkColor(crew.find(member => member.id === user))
  const readers = club ? (book.club?.participantIds || []).flatMap(id => {
    const value = bookChapterBookmark(book, id)
    if (value === null) return []
    const member = crew.find(person => person.id === id) || { id, name: 'Reader', initials: '?', color: '#54458b' }
    return [{ member, chapter: value }]
  }) : []
  const authors = book.authors.join(', ')
  return <article className={`paperback-card${riffling ? ' is-riffling' : ''}`}
    onPointerEnter={event => { if (event.pointerType === 'mouse') riffle() }}>
    <button ref={curl.surface} className="paperback-open" type="button" onClick={onOpen} onFocus={riffle} aria-haspopup="dialog"
      aria-label={`Open ${book.title}${authors ? ` by ${authors}` : ''}${chapter !== null ? `, chapter ${chapter}` : ''}`}
      title="Book details">
      <canvas ref={curl.canvas} className="paperback-curl-canvas" aria-hidden="true" />
      <span className="paperback-pages" aria-hidden="true">{Array.from({ length: 20 }, (_, index) => <span className="paperback-page" key={index} style={{ '--page': index } as CSSProperties} />)}</span>
      <span className="paperback-cover" aria-hidden="true" onAnimationEnd={event => { if (event.target === event.currentTarget) setRiffling(false) }}>
        <span className="paperback-cover-front">
          <span className="paperback-fallback"><strong>{book.title}</strong><span>{authors}</span></span>
          <BookCoverImage book={book} large />
          <span className="paperback-wear" />
        </span>
      </span>
      {!club && chapter !== null && <span className={`paperback-ribbon${String(chapter).length > 3 ? ' paperback-ribbon-long' : ''}`} style={{ backgroundColor: color, color: bookmarkInk(color) }} aria-hidden="true">{chapter}</span>}
    </button>
    <button className="paperback-settings icon-button" type="button" onClick={onOpen} aria-haspopup="dialog" aria-label={`Open details and settings for ${book.title}`} title="Details & settings"><SlidersHorizontal size={20} /></button>
    {source && <span className="paperback-source" title={`Saved from ${source.name}`} aria-label={`Saved from ${source.name}`}><MemberPortrait member={source} /></span>}
    {collection && <button className="paperback-collection icon-button" type="button" data-collection-toggle aria-label={collection.label} title={collection.label} aria-expanded={false} aria-controls={collection.controlsId} onClick={collection.onOpen}><Layers size={21} aria-hidden="true" /></button>}
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
