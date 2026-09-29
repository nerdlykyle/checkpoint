import {
  BookCheck, BookMarked, BookOpen, Check, ChevronDown, ExternalLink, Headphones, Library, MessageCircle,
  Minus, Plus, Search, Star, ThumbsDown, ThumbsUp, X,
} from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { searchBooks, type BookSearchResult } from './lib/bookSearch'
import type { Book, BookComment, BookShelf, Member } from './types'

export type BookSection = 'home' | 'library' | 'poll'
export type BookShelfFilter = BookShelf | 'all' | 'passed'

type Props = {
  books: Book[]
  currentUser: string
  crew: Member[]
  section: BookSection
  shelfFilter: BookShelfFilter
  onShelfFilterChange: (filter: BookShelfFilter) => void
  search: string
  showAdd: boolean
  onCloseAdd: () => void
  onChange: (books: Book[]) => void
  notify: (message: string) => void
}

const shelfLabels: Record<BookShelf, string> = {
  'to-read': 'To read',
  reading: 'Reading',
  read: 'Read',
}

function memberName(crew: Member[], id: string) {
  return crew.find((member) => member.id === id)?.name ?? 'Reader'
}

function coverFallback(title: string) {
  return title.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

function BookCover({ book, large = false }: { book: Book; large?: boolean }) {
  return <div className={`book-cover ${large ? 'is-large' : ''}`}>
    <span>{coverFallback(book.title)}</span>
    {book.coverUrl && <img src={book.coverUrl} alt={`Cover of ${book.title}`} onError={(event) => { event.currentTarget.style.display = 'none' }} />}
  </div>
}

function bookLinks(book: Book) {
  const search = encodeURIComponent(`${book.title} ${book.authors[0] ?? ''}`.trim())
  const isbn = book.isbn13 ?? book.isbn10
  return [
    { label: 'Kindle', icon: <BookOpen size={14} />, href: `https://www.amazon.com/s?k=${encodeURIComponent(isbn ?? `${book.title} kindle`)}` },
    { label: 'Audible', icon: <Headphones size={14} />, href: `https://www.audible.com/search?keywords=${search}` },
    { label: 'Libby / library', icon: <Library size={14} />, href: `https://www.overdrive.com/search?q=${encodeURIComponent(isbn ?? `${book.title} ${book.authors[0] ?? ''}`)}` },
    { label: 'WorldCat', icon: <Search size={14} />, href: isbn ? `https://search.worldcat.org/search?q=bn:${encodeURIComponent(isbn)}` : `https://search.worldcat.org/search?q=${search}` },
    { label: 'Open Library', icon: <ExternalLink size={14} />, href: book.openLibraryKey ? `https://openlibrary.org${book.openLibraryKey}` : `https://openlibrary.org/search?q=${search}` },
  ]
}

function VoteControls({ book, currentUser, onVote }: { book: Book; currentUser: string; onVote: (vote: 'up' | 'down') => void }) {
  return <div className="book-votes" aria-label={`Vote on ${book.title}`}>
    <button className={book.upvotes.includes(currentUser) ? 'active up' : ''} type="button" onClick={(event) => { event.stopPropagation(); onVote('up') }} aria-label="Thumbs up"><ThumbsUp size={14} /><span>{book.upvotes.length}</span></button>
    <button className={book.downvotes.includes(currentUser) ? 'active down' : ''} type="button" onClick={(event) => { event.stopPropagation(); onVote('down') }} aria-label="Thumbs down"><ThumbsDown size={14} /><span>{book.downvotes.length}</span></button>
  </div>
}

function ShelfSelect({ value, onChange }: { value?: BookShelf; onChange: (shelf?: BookShelf) => void }) {
  return <label className="book-shelf-select" onClick={(event) => event.stopPropagation()}>
    <span className="sr-only">Personal shelf</span>
    <select value={value ?? ''} onChange={(event) => onChange((event.target.value || undefined) as BookShelf | undefined)}>
      <option value="">Save to my books…</option>
      <option value="to-read">To read</option>
      <option value="reading">Reading</option>
      <option value="read">Read</option>
    </select>
    <ChevronDown size={13} />
  </label>
}

function ChapterModal({ book, current, onClose, onSave }: { book: Book; current: number; onClose: () => void; onSave: (chapter: number) => void }) {
  const [chapter, setChapter] = useState(current)
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="modal-card chapter-modal" role="dialog" aria-modal="true" aria-label="Update chapter">
      <div className="modal-title"><div><span className="eyebrow">Reading progress</span><h2>Update chapter</h2><p>{book.title}</p></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
      <label className="chapter-value"><span>Last chapter read</span><input type="number" min="0" max="9999" inputMode="numeric" value={chapter} onChange={(event) => setChapter(Math.max(0, Math.min(9999, Number(event.target.value) || 0)))} /></label>
      <div className="chapter-stepper"><button type="button" onClick={() => setChapter((value) => Math.max(0, value - 1))}><Minus size={22} /><span>Previous</span></button><strong>{chapter}</strong><button type="button" onClick={() => setChapter((value) => Math.min(9999, value + 1))}><Plus size={22} /><span>Next</span></button></div>
      <div className="modal-actions"><button className="button button-secondary" type="button" onClick={onClose}>Cancel</button><button className="button button-primary" type="button" onClick={() => onSave(chapter)}><Check size={15} /> Save chapter</button></div>
    </section>
  </div>
}

function AddBookModal({ existing, onClose, onAdd }: { existing: Book[]; onClose: () => void; onAdd: (result: BookSearchResult) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<BookSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) { setResults([]); setError(null); return }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setLoading(true)
      searchBooks(trimmed, controller.signal).then((next) => { setResults(next); setError(next.length ? null : 'No matching books found.') }).catch((reason: unknown) => {
        if (!(reason instanceof DOMException && reason.name === 'AbortError')) setError(reason instanceof Error ? reason.message : 'Book search is unavailable.')
      }).finally(() => setLoading(false))
    }, 320)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [query])
  const add = (result: BookSearchResult) => {
    onAdd(result)
    onClose()
  }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="modal-card add-book-modal" role="dialog" aria-modal="true" aria-label="Add a book">
      <div className="modal-title"><div><span className="eyebrow">Build your shelf</span><h2>Add a book</h2><p>Search by title, author, or ISBN.</p></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
      <label className="book-search-input"><Search size={18} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try The Fifth Season or an ISBN" /></label>
      <div className="book-search-results">
        {loading && <div className="book-search-status">Searching book catalogs…</div>}
        {!loading && error && <div className="book-search-status">{error}</div>}
        {!loading && results.map((result) => {
          const duplicate = existing.some((book) => (result.googleBooksId && book.googleBooksId === result.googleBooksId) || (result.isbn13 && book.isbn13 === result.isbn13))
          return <button type="button" key={result.catalogId} onClick={() => add(result)}><span className="search-result-cover">{result.coverUrl ? <img src={result.coverUrl} alt="" /> : coverFallback(result.title)}</span><span><strong>{result.title}</strong><small>{result.authors.join(', ')}{result.publishedYear ? ` · ${result.publishedYear}` : ''}</small></span><em>{duplicate ? 'Save to my books' : 'Add'}</em></button>
        })}
      </div>
    </section>
  </div>
}

function BookDetails({ book, currentUser, crew, onClose, onUpdate, onChapter }: { book: Book; currentUser: string; crew: Member[]; onClose: () => void; onUpdate: (book: Book) => void; onChapter: () => void }) {
  const [comment, setComment] = useState('')
  const [spoiler, setSpoiler] = useState(false)
  const [openSpoilers, setOpenSpoilers] = useState<string[]>([])
  const [review, setReview] = useState(book.ratings[currentUser]?.review ?? '')
  const ownRating = book.ratings[currentUser]?.stars ?? 0
  const average = Object.values(book.ratings).length ? Object.values(book.ratings).reduce((sum, rating) => sum + rating.stars, 0) / Object.values(book.ratings).length : 0
  const saveRating = (stars: number) => onUpdate({ ...book, ratings: { ...book.ratings, [currentUser]: { stars, review, updatedAt: new Date().toISOString() } } })
  const saveReview = () => {
    if (!ownRating && !review.trim()) return
    onUpdate({ ...book, ratings: { ...book.ratings, [currentUser]: { stars: ownRating || 1, review: review.trim(), updatedAt: new Date().toISOString() } } })
  }
  const addComment = (event: FormEvent) => {
    event.preventDefault()
    if (!comment.trim()) return
    const next: BookComment = { id: crypto.randomUUID(), authorId: currentUser, text: comment.trim(), spoiler, createdAt: new Date().toISOString() }
    onUpdate({ ...book, comments: [...book.comments, next] })
    setComment(''); setSpoiler(false)
  }
  return <div className="modal-backdrop book-detail-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="modal-card book-detail-modal" role="dialog" aria-modal="true" aria-label={book.title}>
      <button className="icon-button book-detail-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
      <div className="book-detail-hero"><BookCover book={book} large /><div><span className="eyebrow">{book.passedOnAt ? 'Passed on by the club' : 'Checkpoint Book Club'}</span><h2>{book.title}</h2><p className="book-authors">{book.authors.join(', ')}{book.publishedYear ? ` · ${book.publishedYear}` : ''}</p><div className="book-detail-rating"><Star size={15} fill={average ? 'currentColor' : 'none'} /><strong>{average ? average.toFixed(1) : 'No ratings'}</strong><span>{Object.keys(book.ratings).length ? `from ${Object.keys(book.ratings).length} reader${Object.keys(book.ratings).length === 1 ? '' : 's'}` : ''}</span></div><div className="book-link-row">{bookLinks(book).map((link) => <a key={link.label} href={link.href} target="_blank" rel="noreferrer">{link.icon}{link.label}</a>)}</div></div></div>
      <div className="book-detail-columns">
        <div className="book-detail-main">
          <section><span className="eyebrow">Synopsis</span><p className="book-description">{book.description || 'No synopsis was provided by the book catalog.'}</p></section>
          <section><div className="book-section-title"><div><span className="eyebrow">Shared discussion</span><h3>Comments</h3></div><MessageCircle size={18} /></div>
            <div className="book-comments">{book.comments.length ? book.comments.map((item) => {
              const hidden = item.spoiler && !openSpoilers.includes(item.id)
              return <article key={item.id} className={hidden ? 'is-spoiler' : ''}><div><strong>{memberName(crew, item.authorId)}</strong><time>{new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</time>{item.spoiler && <span>Spoiler</span>}</div>{hidden ? <button type="button" onClick={() => setOpenSpoilers((current) => [...current, item.id])}>Tap to reveal spoiler</button> : <p>{item.text}</p>}</article>
            }) : <p className="book-empty-copy">No comments yet. Start the discussion.</p>}</div>
            <form className="book-comment-form" onSubmit={addComment}><textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={3} maxLength={3000} placeholder="Share a thought, question, or favorite passage…" /><div><label><input type="checkbox" checked={spoiler} onChange={(event) => setSpoiler(event.target.checked)} /> Mark as spoiler</label><button className="button button-primary" type="submit" disabled={!comment.trim()}>Post comment</button></div></form>
          </section>
        </div>
        <aside className="book-detail-aside">
          <section><span className="eyebrow">My reading</span><ShelfSelect value={book.shelves[currentUser]} onChange={(shelf) => { const shelves = { ...book.shelves }; if (shelf) shelves[currentUser] = shelf; else delete shelves[currentUser]; onUpdate({ ...book, shelves }) }} />{book.shelves[currentUser] && <button className="chapter-update-button" type="button" onClick={onChapter}><BookMarked size={16} /><span><strong>Chapter {book.progress[currentUser]?.lastChapter ?? 0}</strong><small>Last chapter read</small></span><Plus size={15} /></button>}</section>
          <section><span className="eyebrow">My rating</span><div className="star-picker">{[1,2,3,4,5].map((star) => <button key={star} type="button" className={star <= ownRating ? 'active' : ''} onClick={() => saveRating(star)} aria-label={`${star} stars`}><Star size={21} fill={star <= ownRating ? 'currentColor' : 'none'} /></button>)}</div><textarea className="book-review-input" value={review} onChange={(event) => setReview(event.target.value)} onBlur={saveReview} rows={4} placeholder="Write a short review…" /></section>
          <section><span className="eyebrow">Crew ratings</span><div className="crew-ratings">{crew.map((member) => { const rating = book.ratings[member.id]; return <div key={member.id}><strong>{member.name}</strong><span>{rating ? `${'★'.repeat(rating.stars)}${'☆'.repeat(5-rating.stars)}` : 'Not rated'}</span>{rating?.review && <p>{rating.review}</p>}</div> })}</div></section>
        </aside>
      </div>
    </section>
  </div>
}

function BookCard({ book, currentUser, onOpen, onVote, onShelf, onChapter }: { book: Book; currentUser: string; onOpen: () => void; onVote: (vote: 'up' | 'down') => void; onShelf: (shelf?: BookShelf) => void; onChapter: () => void }) {
  const shelf = book.shelves[currentUser]
  return <article className="book-card" onClick={onOpen}>
    <BookCover book={book} />
    <div className="book-card-copy"><span className="book-card-state">{book.passedOnAt ? 'Passed on' : shelf ? shelfLabels[shelf] : 'Club choice'}</span><h3>{book.title}</h3><p>{book.authors.join(', ')}</p><div className="book-card-actions"><ShelfSelect value={shelf} onChange={onShelf} />{shelf === 'reading' && <button className="book-chapter-pill" type="button" onClick={(event) => { event.stopPropagation(); onChapter() }}><BookMarked size={13} /> Ch. {book.progress[currentUser]?.lastChapter ?? 0}</button>}</div></div>
    <VoteControls book={book} currentUser={currentUser} onVote={onVote} />
  </article>
}

export default function BookClub({ books, currentUser, crew, section, shelfFilter, onShelfFilterChange, search, showAdd, onCloseAdd, onChange, notify }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [chapterBookId, setChapterBookId] = useState<string | null>(null)
  const selected = books.find((book) => book.id === selectedId)
  const chapterBook = books.find((book) => book.id === chapterBookId)
  const mutate = (book: Book) => onChange(books.map((item) => item.id === book.id ? book : item))
  const setShelf = (book: Book, shelf?: BookShelf) => {
    const shelves = { ...book.shelves }
    if (shelf) shelves[currentUser] = shelf
    else delete shelves[currentUser]
    mutate({ ...book, shelves })
    notify(shelf ? `${book.title} moved to ${shelfLabels[shelf]}` : `${book.title} removed from your shelves`)
  }
  const vote = (book: Book, direction: 'up' | 'down') => {
    const upvotes = book.upvotes.filter((id) => id !== currentUser)
    const downvotes = book.downvotes.filter((id) => id !== currentUser)
    if (direction === 'up' && !book.upvotes.includes(currentUser)) upvotes.push(currentUser)
    if (direction === 'down' && !book.downvotes.includes(currentUser)) downvotes.push(currentUser)
    const passedOnAt = downvotes.length >= 3 ? book.passedOnAt ?? new Date().toISOString() : undefined
    mutate({ ...book, upvotes, downvotes, passedOnAt })
    notify(passedOnAt ? `${book.title} moved to Passed On by unanimous vote` : 'Book vote updated')
  }
  const updateChapter = (book: Book, chapter: number) => {
    mutate({ ...book, progress: { ...book.progress, [currentUser]: { lastChapter: chapter, updatedAt: new Date().toISOString() } }, shelves: { ...book.shelves, [currentUser]: book.shelves[currentUser] ?? 'reading' } })
    setChapterBookId(null)
    notify(`Chapter ${chapter} saved for ${book.title}`)
  }
  const addBook = (result: BookSearchResult) => {
    const duplicate = books.find((book) => (result.googleBooksId && book.googleBooksId === result.googleBooksId) || (result.isbn13 && book.isbn13 === result.isbn13) || book.title.toLowerCase() === result.title.toLowerCase() && book.authors[0] === result.authors[0])
    if (duplicate) {
      setShelf(duplicate, duplicate.shelves[currentUser] ?? 'to-read')
      setSelectedId(duplicate.id)
      return
    }
    const book: Book = { id: crypto.randomUUID(), title: result.title, authors: result.authors, description: result.description, coverUrl: result.coverUrl, publishedYear: result.publishedYear, isbn10: result.isbn10, isbn13: result.isbn13, googleBooksId: result.googleBooksId, openLibraryKey: result.openLibraryKey, addedBy: currentUser, createdAt: new Date().toISOString(), upvotes: [currentUser], downvotes: [], shelves: { [currentUser]: 'to-read' }, progress: {}, ratings: {}, comments: [] }
    onChange([book, ...books]); notify(`${book.title} added to your shelf and the club poll`)
  }
  const query = search.trim().toLowerCase()
  const myBooks = books.filter((book) => book.shelves[currentUser])
  const filtered = books.filter((book) => {
    if (query && !`${book.title} ${book.authors.join(' ')}`.toLowerCase().includes(query)) return false
    if (shelfFilter === 'passed') return Boolean(book.passedOnAt)
    if (shelfFilter !== 'all') return book.shelves[currentUser] === shelfFilter
    return Boolean(book.shelves[currentUser]) && !book.passedOnAt
  })
  const reading = myBooks.filter((book) => book.shelves[currentUser] === 'reading')
  const poll = books.filter((book) => !book.passedOnAt).sort((a, b) => b.upvotes.length - a.upvotes.length || a.downvotes.length - b.downvotes.length)
  const averageRating = (book: Book) => { const values = Object.values(book.ratings); return values.length ? values.reduce((sum, item) => sum + item.stars, 0) / values.length : 0 }
  return <div className="page book-club-page">
    <div className="page-title-row book-page-title"><div><span className="eyebrow">Checkpoint Book Club</span><h1>{section === 'home' ? "What're we reading?" : section === 'library' ? 'My books' : 'Choose our next book'}</h1><p>{section === 'home' ? 'Personal reading progress with a shared place to vote and discuss.' : section === 'library' ? 'Your to-read, reading, and finished shelves stay yours.' : 'A no never removes someone else’s book. Three no votes close the club poll.'}</p></div></div>
    {section === 'home' ? <>
      <section className="book-reading-section"><div className="section-heading"><div><span className="eyebrow">Pick up where you left off</span><h2>Currently reading</h2></div><span className="book-section-count">{reading.length}</span></div>{reading.length ? <div className="book-reading-grid">{reading.map((book) => <article className="current-book-card" key={book.id}><BookCover book={book} large /><div><span className="eyebrow">Chapter {book.progress[currentUser]?.lastChapter ?? 0}</span><h2>{book.title}</h2><p>{book.authors.join(', ')}</p><div className="current-book-actions"><button className="button button-primary" type="button" onClick={() => setChapterBookId(book.id)}><BookMarked size={16} /> Update chapter</button><button className="button button-secondary" type="button" onClick={() => setSelectedId(book.id)}>Open discussion</button></div></div></article>)}</div> : <div className="book-empty-panel"><BookOpen size={28} /><h2>Nothing in progress</h2><p>Add a book or move one from To read when you begin.</p></div>}</section>
      <section className="book-home-poll"><div className="section-heading"><div><span className="eyebrow">The club shelf</span><h2>Leading the next-book poll</h2></div><span className="book-section-count">{poll.length}</span></div><div className="book-grid">{poll.slice(0, 4).map((book) => <BookCard key={book.id} book={book} currentUser={currentUser} onOpen={() => setSelectedId(book.id)} onVote={(direction) => vote(book, direction)} onShelf={(shelf) => setShelf(book, shelf)} onChapter={() => setChapterBookId(book.id)} />)}</div></section>
      <section className="book-stats"><div><BookMarked size={19} /><strong>{myBooks.filter((book) => book.shelves[currentUser] === 'to-read').length}</strong><span>To read</span></div><div><BookOpen size={19} /><strong>{reading.length}</strong><span>Reading</span></div><div><BookCheck size={19} /><strong>{myBooks.filter((book) => book.shelves[currentUser] === 'read').length}</strong><span>Finished</span></div><div><MessageCircle size={19} /><strong>{books.reduce((sum, book) => sum + book.comments.length, 0)}</strong><span>Comments</span></div></section>
    </> : section === 'library' ? <>
      <div className="filter-tabs book-filter-tabs">{([['all','All mine'],['to-read','To read'],['reading','Reading'],['read','Read'],['passed','Passed on']] as const).map(([value,label]) => <button className={shelfFilter === value ? 'active' : ''} type="button" key={value} onClick={() => onShelfFilterChange(value)}>{label}<span>{value === 'all' ? myBooks.length : value === 'passed' ? books.filter((book) => book.passedOnAt).length : myBooks.filter((book) => book.shelves[currentUser] === value).length}</span></button>)}</div>
      {filtered.length ? <div className="book-grid">{filtered.map((book) => <BookCard key={book.id} book={book} currentUser={currentUser} onOpen={() => setSelectedId(book.id)} onVote={(direction) => vote(book, direction)} onShelf={(shelf) => setShelf(book, shelf)} onChapter={() => setChapterBookId(book.id)} />)}</div> : <div className="book-empty-panel"><Search size={28} /><h2>No books here yet</h2><p>Add one with the plus button, or try another shelf.</p></div>}
    </> : <>
      <div className="book-poll-explainer"><div><ThumbsUp size={18} /><span><strong>Read together when there’s interest</strong><small>One or two readers can still choose a book.</small></span></div><div><ThumbsDown size={18} /><span><strong>Three no votes closes the poll</strong><small>Personal shelves and discussions are never deleted.</small></span></div></div>
      {poll.length ? <div className="book-poll-list">{poll.map((book, index) => <article key={book.id} onClick={() => setSelectedId(book.id)}><span className="book-poll-rank">#{index + 1}</span><BookCover book={book} /><div><h3>{book.title}</h3><p>{book.authors.join(', ')}</p><small>{averageRating(book) ? `★ ${averageRating(book).toFixed(1)} · ` : ''}{book.comments.length} comment{book.comments.length === 1 ? '' : 's'}</small></div><div className="book-poll-members"><span>{book.upvotes.map((id) => memberName(crew,id)).join(', ') || 'No yes votes yet'}</span><small>{book.downvotes.length}/3 no votes</small></div><VoteControls book={book} currentUser={currentUser} onVote={(direction) => vote(book, direction)} /></article>)}</div> : <div className="book-empty-panel"><BookOpen size={28} /><h2>The poll is empty</h2><p>Add a book to start choosing what to read next.</p></div>}
    </>}
    {showAdd && <AddBookModal existing={books} onClose={onCloseAdd} onAdd={addBook} />}
    {selected && <BookDetails book={selected} currentUser={currentUser} crew={crew} onClose={() => setSelectedId(null)} onUpdate={mutate} onChapter={() => setChapterBookId(selected.id)} />}
    {chapterBook && <ChapterModal book={chapterBook} current={chapterBook.progress[currentUser]?.lastChapter ?? 0} onClose={() => setChapterBookId(null)} onSave={(chapter) => updateChapter(chapterBook, chapter)} />}
  </div>
}
