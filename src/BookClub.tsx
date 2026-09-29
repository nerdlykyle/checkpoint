import {
  BookCheck, BookMarked, BookOpen, Check, ChevronDown, ExternalLink, Headphones, Library, MessageCircle,
  Minus, Plus, Search, Star, ThumbsDown, ThumbsUp, X, RefreshCw, Trash2, ArrowUp, ArrowDown, Users,
} from 'lucide-react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { searchBooks, type BookSearchResult } from './lib/bookSearch'
import type { Book, BookComment, BookShelf, Member } from './types'
import { applyClubBookAction, clubBookQueue, isBookPollCandidate, moveClubBook, type ClubBookAction } from './lib/clubBooks'
import BookDiscovery from './BookDiscovery'
import { addDiscoveryBook, type DiscoveryPick } from './lib/bookDiscovery'

export type BookSection = 'home' | 'library' | 'club' | 'poll' | 'discover'
export type BookShelfFilter = BookShelf | 'all'

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
  onOpenAdd: () => void
  onShowMyBooks: () => void
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
      <option value="" disabled>Choose my shelf…</option>
      <option value="to-read">To read</option>
      <option value="reading">Reading</option>
      <option value="read">Read</option>
    </select>
    <ChevronDown size={13} />
  </label>
}

function ChapterModal({ book, current, onClose, onSave }: { book: Book; current: number; onClose: () => void; onSave: (chapter: number) => void }) {
  const [chapter, setChapter] = useState(String(current))
  const stepChapter = (delta: number) => setChapter((value) => String(Math.max(0, Math.min(9999, Number(value) + delta))))
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="modal-card chapter-modal" role="dialog" aria-modal="true" aria-label="Update chapter">
      <div className="modal-title"><div><span className="eyebrow">Reading progress</span><h2>Update chapter</h2><p>{book.title}</p></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
      <label className="chapter-label" htmlFor="chapter-number">Last chapter read</label>
      <div className="chapter-stepper">
        <button type="button" disabled={Number(chapter) === 0} onClick={() => stepChapter(-1)} aria-label="Previous chapter"><Minus size={22} /><span>Previous</span></button>
        <input id="chapter-number" className="chapter-number" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={4} role="spinbutton" aria-valuemin={0} aria-valuemax={9999} aria-valuenow={chapter === '' ? undefined : Number(chapter)} value={chapter}
          onFocus={(event) => event.currentTarget.select()}
          onClick={(event) => event.currentTarget.select()}
          onChange={(event) => { if (/^\d{0,4}$/.test(event.target.value)) setChapter(event.target.value) }}
          onBlur={() => { if (chapter !== '') setChapter(String(Number(chapter))) }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); stepChapter(event.key === 'ArrowUp' ? 1 : -1) }
            if (event.key === 'Enter' && chapter !== '') { event.preventDefault(); onSave(Number(chapter)) }
          }} />
        <button type="button" disabled={Number(chapter) === 9999} onClick={() => stepChapter(1)} aria-label="Next chapter"><Plus size={22} /><span>Next</span></button>
      </div>
      <div className="modal-actions"><button className="button button-secondary" type="button" onClick={onClose}>Cancel</button><button className="button button-primary" type="button" disabled={chapter === ''} onClick={() => onSave(Number(chapter))}><Check size={15} /> Save chapter</button></div>
    </section>
  </div>
}

function AddBookModal({ existing, onClose, onAdd, replacing }: { existing: Book[]; onClose: () => void; onAdd: (result: BookSearchResult, shelf: BookShelf) => void; replacing?: Book }) {
  const [shelf, setShelf] = useState<BookShelf>('to-read')
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
    onAdd(result, shelf)
    onClose()
  }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="modal-card add-book-modal" role="dialog" aria-modal="true" aria-label={replacing ? 'Change book' : 'Add a book'}>
      <div className="modal-title"><div><span className="eyebrow">{replacing ? 'Correct your selection' : 'Build your shelf'}</span><h2>{replacing ? 'Change book' : 'Add a book'}</h2><p>{replacing ? `Replace ${replacing.title} on your shelf. Your chapter and review move with it. Other readers and shared discussions stay with the original book.` : 'Search by title, author, or ISBN.'}</p></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
      <label className="book-search-input"><Search size={18} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try The Fifth Season or an ISBN" /></label>
      {!replacing && <div className="book-add-destination"><span>Save to my shelf</span><ShelfSelect value={shelf} onChange={(value) => value && setShelf(value)} /><small>To read is your wishlist. Choose Read for books you’ve finished. You can nominate a book for the poll later.</small></div>}
      <div className="book-search-results">
        {loading && <div className="book-search-status">Searching book catalogs…</div>}
        {!loading && error && <div className="book-search-status">{error}</div>}
        {!loading && results.map((result) => {
          const duplicate = existing.some((book) => (result.googleBooksId && book.googleBooksId === result.googleBooksId) || (result.isbn13 && book.isbn13 === result.isbn13))
          return <button type="button" key={result.catalogId} onClick={() => add(result)}><span className="search-result-cover">{result.coverUrl ? <img src={result.coverUrl} alt="" /> : coverFallback(result.title)}</span><span><strong>{result.title}</strong><small>{result.authors.join(', ')}{result.publishedYear ? ` · ${result.publishedYear}` : ''}</small></span><em>{replacing ? 'Use this book' : duplicate ? 'Save to my books' : 'Add'}</em></button>
        })}
      </div>
    </section>
  </div>
}

function BookDetails({ book, currentUser, crew, onClose, onUpdate, onChapter, onChangeBook, onRemove, clubControls }: { book: Book; currentUser: string; crew: Member[]; onClose: () => void; onUpdate: (book: Book) => void; onChapter: () => void; onChangeBook: () => void; onRemove: () => void; clubControls: ReactNode }) {
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
          <section><span className="eyebrow">Group reading</span>{clubControls}</section>
          {book.shelves[currentUser] && <section className="book-manage-actions"><button className="button button-secondary" type="button" onClick={onChangeBook}><RefreshCw size={15} /> Change book</button><button className="button button-danger" type="button" onClick={onRemove}><Trash2 size={15} /> Remove from my books</button></section>}
          {!book.shelves[currentUser] && <button className="button button-primary" type="button" onClick={() => onUpdate({ ...book, shelves: { ...book.shelves, [currentUser]: 'to-read' } })}><Plus size={15} /> Save to my books</button>}
          {!book.club && <section><span className="eyebrow">Next-book poll</span>{book.passedOnAt ? <p className="book-empty-copy">Passed on by the club. This book stays on your personal shelf.</p> : <button className="button button-secondary" type="button" onClick={() => onUpdate({ ...book, nominated: book.nominated === false, upvotes: book.nominated === false ? [...new Set([...book.upvotes, currentUser])] : book.upvotes })}><ThumbsUp size={15} />{book.nominated === false ? 'Nominate for next-book poll' : 'Remove from next-book poll'}</button>}</section>}
          <section><span className="eyebrow">My reading</span><ShelfSelect value={book.shelves[currentUser]} onChange={(shelf) => { const shelves = { ...book.shelves }; if (shelf) shelves[currentUser] = shelf; else delete shelves[currentUser]; onUpdate({ ...book, shelves }) }} />{book.shelves[currentUser] && <button className="chapter-update-button" type="button" onClick={onChapter}><BookMarked size={16} /><span><strong>Chapter {book.progress[currentUser]?.lastChapter ?? 0}</strong><small>Last chapter read</small></span><Plus size={15} /></button>}</section>
          <section><span className="eyebrow">My rating</span><div className="star-picker">{[1,2,3,4,5].map((star) => <button key={star} type="button" className={star <= ownRating ? 'active' : ''} onClick={() => saveRating(star)} aria-label={`${star} stars`}><Star size={21} fill={star <= ownRating ? 'currentColor' : 'none'} /></button>)}</div><textarea className="book-review-input" value={review} onChange={(event) => setReview(event.target.value)} onBlur={saveReview} rows={4} placeholder="Write a short review…" /></section>
          <section><span className="eyebrow">Crew ratings</span><div className="crew-ratings">{crew.map((member) => { const rating = book.ratings[member.id]; return <div key={member.id}><strong>{member.name}</strong><span>{rating ? `${'★'.repeat(rating.stars)}${'☆'.repeat(5-rating.stars)}` : 'Not rated'}</span>{rating?.review && <p>{rating.review}</p>}</div> })}</div></section>
        </aside>
      </div>
    </section>
  </div>
}

function ClubControls({ book, currentUser, hasCurrentRead, onAction }: { book: Book; currentUser: string; hasCurrentRead: boolean; onAction: (action: ClubBookAction) => void }) {
  const status = book.club?.status
  const joined = book.club?.participantIds.includes(currentUser)
  return <div className="club-book-controls">
    {!status && <button className="button button-secondary" type="button" onClick={() => onAction('queue')}><Plus size={15} /> Add to club Up Next</button>}
    {(!status || status === 'up-next') && <>
      <button className="button button-primary" type="button" disabled={hasCurrentRead} onClick={() => onAction('start')}><BookOpen size={15} /> Start club read</button>
      {hasCurrentRead && <small>Finish the current club read to start another.</small>}
    </>}
    {status === 'up-next' && <button className="text-button" type="button" onClick={() => onAction('unqueue')}>Remove from club queue</button>}
    {status === 'reading' && <>
      <button className="button button-secondary" type="button" onClick={() => onAction(joined ? 'leave' : 'join')}><Users size={15} />{joined ? 'Leave this read' : 'Join this read'}</button>
      <button className="button button-secondary" type="button" onClick={() => onAction('finish')}><BookCheck size={15} /> Finish club read</button>
    </>}
    {status === 'completed' && <p className="book-empty-copy">Club read completed {book.club?.completedAt ? new Date(book.club.completedAt).toLocaleDateString() : ''}. Your personal shelf is managed separately.</p>}
  </div>
}

function BookCard({ book, currentUser, onOpen, onVote, onShelf, onChapter }: { book: Book; currentUser: string; onOpen: () => void; onVote: (vote: 'up' | 'down') => void; onShelf: (shelf?: BookShelf) => void; onChapter: () => void }) {
  const shelf = book.shelves[currentUser]
  return <article className="book-card" onClick={onOpen}>
    <BookCover book={book} />
    <div className="book-card-copy"><span className="book-card-state">{book.passedOnAt ? 'Passed on' : shelf ? shelfLabels[shelf] : 'Club choice'}</span><h3>{book.title}</h3><p>{book.authors.join(', ')}</p><div className="book-card-actions"><ShelfSelect value={shelf} onChange={onShelf} />{shelf === 'reading' && <button className="book-chapter-pill" type="button" onClick={(event) => { event.stopPropagation(); onChapter() }}><BookMarked size={13} /> Ch. {book.progress[currentUser]?.lastChapter ?? 0}</button>}</div></div>
    {isBookPollCandidate(book) && <VoteControls book={book} currentUser={currentUser} onVote={onVote} />}
  </article>
}

export default function BookClub({ books, currentUser, crew, section, shelfFilter, onShelfFilterChange, search, showAdd, onCloseAdd, onOpenAdd, onShowMyBooks, onChange, notify }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const addFromDiscovery = (pick: DiscoveryPick, action: 'shelf' | 'nominate') => {
    const updated = addDiscoveryBook(books, pick, currentUser, action)
    if (updated === books) return
    onChange(updated)
    notify(action === 'shelf' ? `${pick.title} added to your To read shelf` : `${pick.title} nominated for our next-book poll`)
  }
  const currentClubBook = books.find((book) => book.club?.status === 'reading')
  const clubQueue = clubBookQueue(books)
  const completedClubBooks = books.filter((book) => book.club?.status === 'completed').sort((a, b) => (b.club?.completedAt ?? '').localeCompare(a.club?.completedAt ?? ''))
  const [clubTab, setClubTab] = useState<'up-next' | 'reading' | 'completed' | 'passed'>('up-next')
  const clubAction = (book: Book, action: ClubBookAction) => {
    if (action === 'finish' && !window.confirm(`Finish the club read of ${book.title}? Everyone can mark their own copy Read whenever they finish.`)) return
    onChange(applyClubBookAction(books, book.id, currentUser, action))
    if (action === 'queue') setClubTab('up-next')
    const messages: Record<ClubBookAction, string> = { queue: 'Added to the club’s Up Next', start: 'Club read started — others can join', join: 'You joined this club read', leave: 'You left this club read', finish: 'Club read completed', unqueue: 'Removed from the club queue' }
    notify(messages[action])
  }
  const clubControls = (book: Book) => <ClubControls book={book} currentUser={currentUser} hasCurrentRead={Boolean(currentClubBook)} onAction={(action) => clubAction(book, action)} />
  const [changingId, setChangingId] = useState<string | null>(null)
  const changingBook = books.find((book) => book.id === changingId)
  const [chapterBookId, setChapterBookId] = useState<string | null>(null)
  const selected = books.find((book) => book.id === selectedId)
  const chapterBook = books.find((book) => book.id === chapterBookId)
  const removeBook = (book: Book) => {
    if (!window.confirm(`Remove ${book.title} from your personal shelves? Your chapter and review will be kept if you add it again. Other readers and the club poll are unchanged.`)) return
    const shelves = { ...book.shelves }
    delete shelves[currentUser]
    onChange(books.map((item) => item.id === book.id ? { ...item, shelves } : item))
    setSelectedId(null)
    notify(`${book.title} removed from your books`)
  }
  const changeBook = (result: BookSearchResult) => {
    if (!changingBook) return
    const duplicate = books.find((book) => (result.googleBooksId && book.googleBooksId === result.googleBooksId) || (result.isbn13 && book.isbn13 === result.isbn13) || (book.title.toLowerCase() === result.title.toLowerCase() && book.authors[0] === result.authors[0]))
    if (duplicate?.id === changingBook.id) { setChangingId(null); setSelectedId(changingBook.id); return }
    if (duplicate?.shelves[currentUser] && !window.confirm(`${duplicate.title} is already on your shelf. Combine them? Its existing chapter and rating will be kept.`)) return
    const shelves = { ...changingBook.shelves }
    const progress = { ...changingBook.progress }
    const ratings = { ...changingBook.ratings }
    delete shelves[currentUser]
    delete progress[currentUser]
    delete ratings[currentUser]
    const replacement: Book = duplicate ?? {
      id: crypto.randomUUID(), title: result.title, authors: result.authors, description: result.description,
      coverUrl: result.coverUrl, publishedYear: result.publishedYear, isbn10: result.isbn10, isbn13: result.isbn13,
      googleBooksId: result.googleBooksId, openLibraryKey: result.openLibraryKey,
      addedBy: currentUser, createdAt: new Date().toISOString(), nominated: false,
      upvotes: [], downvotes: [], shelves: {}, progress: {}, ratings: {}, comments: [],
    }
    const corrected: Book = {
      ...replacement,
      shelves: { ...replacement.shelves, [currentUser]: replacement.shelves[currentUser] ?? changingBook.shelves[currentUser] ?? 'to-read' },
      progress: { ...replacement.progress, ...(replacement.progress[currentUser] || !changingBook.progress[currentUser] ? {} : { [currentUser]: changingBook.progress[currentUser] }) },
      ratings: { ...replacement.ratings, ...(replacement.ratings[currentUser] || !changingBook.ratings[currentUser] ? {} : { [currentUser]: changingBook.ratings[currentUser] }) },
    }
    const updated = books.map((book) => book.id === changingBook.id ? { ...book, shelves, progress, ratings } : book.id === corrected.id ? corrected : book)
    onChange(duplicate ? updated : [corrected, ...updated])
    setChangingId(null)
    setSelectedId(corrected.id)
    notify(`Book changed to ${corrected.title}`)
  }
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
  const addBook = (result: BookSearchResult, shelf: BookShelf) => {
    const duplicate = books.find((book) => (result.googleBooksId && book.googleBooksId === result.googleBooksId) || (result.isbn13 && book.isbn13 === result.isbn13) || book.title.toLowerCase() === result.title.toLowerCase() && book.authors[0] === result.authors[0])
    if (duplicate) {
      setShelf(duplicate, shelf)
      onShowMyBooks()
      return
    }
    const book: Book = { id: crypto.randomUUID(), title: result.title, authors: result.authors, description: result.description, coverUrl: result.coverUrl, publishedYear: result.publishedYear, isbn10: result.isbn10, isbn13: result.isbn13, googleBooksId: result.googleBooksId, openLibraryKey: result.openLibraryKey, addedBy: currentUser, createdAt: new Date().toISOString(), nominated: false, upvotes: [], downvotes: [], shelves: { [currentUser]: shelf }, progress: {}, ratings: {}, comments: [] }
    onChange([book, ...books]); onShowMyBooks(); notify(`${book.title} added to ${shelfLabels[shelf]}`)
  }
  const query = search.trim().toLowerCase()
  const myBooks = books.filter((book) => book.shelves[currentUser])
  const filtered = books.filter((book) => {
    if (query && !`${book.title} ${book.authors.join(' ')}`.toLowerCase().includes(query)) return false
    if (shelfFilter !== 'all') return book.shelves[currentUser] === shelfFilter
    return Boolean(book.shelves[currentUser])
  })
  const reading = myBooks.filter((book) => book.shelves[currentUser] === 'reading')
  const poll = books.filter(isBookPollCandidate).sort((a, b) => b.upvotes.length - a.upvotes.length || a.downvotes.length - b.downvotes.length)
  const averageRating = (book: Book) => { const values = Object.values(book.ratings); return values.length ? values.reduce((sum, item) => sum + item.stars, 0) / values.length : 0 }
  const currentClubReadPanel = <section className="book-reading-section">
    <div className="section-heading"><div><span className="eyebrow">Reading together</span><h2>Our current club read</h2></div><Users size={21} /></div>
    {currentClubBook ? <article className="current-book-card club-current-card">
      <BookCover book={currentClubBook} large />
      <div><span className="eyebrow">Club read</span><h2>{currentClubBook.title}</h2><p>{currentClubBook.authors.join(', ')}</p>
        <ul className="club-reader-progress">{currentClubBook.club!.participantIds.map((id) => <li key={id}><strong>{memberName(crew, id)}</strong><span>Chapter {currentClubBook.progress[id]?.lastChapter ?? 0}</span></li>)}</ul>
        {!currentClubBook.club!.participantIds.length && <p>No readers joined yet.</p>}
        <div className="current-book-actions"><button className="button button-secondary" type="button" onClick={() => setSelectedId(currentClubBook.id)}>Open discussion</button>{currentClubBook.club!.participantIds.includes(currentUser) && <button className="button button-primary" type="button" onClick={() => setChapterBookId(currentClubBook.id)}>Update my chapter</button>}</div>
        {clubControls(currentClubBook)}
      </div>
    </article> : <div className="book-empty-panel"><Users size={28} /><h2>No club read yet</h2><p>Open a book in the poll or your shelves and choose Start club read.</p></div>}
  </section>
  const clubList = clubTab === 'up-next' ? clubQueue : clubTab === 'completed' ? completedClubBooks : books.filter((book) => book.passedOnAt && !book.club)
  return <div className="page book-club-page">
    <div className="book-library-actions"><button className="button button-primary" type="button" onClick={onOpenAdd}><Plus size={16} /> Add to my books</button></div>
    <div className="page-title-row book-page-title"><div><span className="eyebrow">Checkpoint Book Club</span><h1>{section === 'home' ? "What're we reading?" : section === 'library' ? 'My books' : section === 'club' ? 'Club books' : section === 'discover' ? 'Discover books' : 'Choose our next book'}</h1><p>{section === 'home' ? 'Personal reading progress with a shared place to vote and discuss.' : section === 'library' ? 'Your to-read, reading, and finished shelves stay yours.' : section === 'club' ? 'Our shared queue and club reads. Everyone manages their own shelves.' : section === 'discover' ? 'Find your next read without changing your personal shelves or our club plans.' : 'A no never removes someone else’s book. Three no votes close the club poll.'}</p></div></div>
    {section === 'discover' ? <BookDiscovery books={books} currentUser={currentUser} onAdd={addFromDiscovery} onOpenBook={setSelectedId} /> : section === 'home' ? <>
      {currentClubReadPanel}
      <section className="book-reading-section"><div className="section-heading"><div><span className="eyebrow">Pick up where you left off</span><h2>What I’m reading</h2></div><span className="book-section-count">{reading.length}</span></div>{reading.length ? <div className="book-reading-grid">{reading.map((book) => <article className="current-book-card" key={book.id}><BookCover book={book} large /><div><span className="eyebrow">Chapter {book.progress[currentUser]?.lastChapter ?? 0}</span><h2>{book.title}</h2><p>{book.authors.join(', ')}</p><div className="current-book-actions"><button className="button button-primary" type="button" onClick={() => setChapterBookId(book.id)}><BookMarked size={16} /> Update chapter</button><button className="button button-secondary" type="button" onClick={() => setSelectedId(book.id)}>Open discussion</button></div></div></article>)}</div> : <div className="book-empty-panel"><BookOpen size={28} /><h2>Nothing in progress</h2><p>Add a book or move one from To read when you begin.</p></div>}</section>
      <section className="book-home-poll"><div className="section-heading"><div><span className="eyebrow">The club shelf</span><h2>Leading the next-book poll</h2></div><span className="book-section-count">{poll.length}</span></div><div className="book-grid">{poll.slice(0, 4).map((book) => <BookCard key={book.id} book={book} currentUser={currentUser} onOpen={() => setSelectedId(book.id)} onVote={(direction) => vote(book, direction)} onShelf={(shelf) => setShelf(book, shelf)} onChapter={() => setChapterBookId(book.id)} />)}</div></section>
      <section className="book-stats"><div><BookMarked size={19} /><strong>{myBooks.filter((book) => book.shelves[currentUser] === 'to-read').length}</strong><span>To read</span></div><div><BookOpen size={19} /><strong>{reading.length}</strong><span>Reading</span></div><div><BookCheck size={19} /><strong>{myBooks.filter((book) => book.shelves[currentUser] === 'read').length}</strong><span>Finished</span></div><div><MessageCircle size={19} /><strong>{books.reduce((sum, book) => sum + book.comments.length, 0)}</strong><span>Comments</span></div></section>
    </> : section === 'club' ? <>
      <div className="filter-tabs book-filter-tabs">{([['up-next','Up Next'],['reading','Current Club Read'],['completed','Completed Club Reads'],['passed','Passed On']] as const).map(([value,label]) => <button key={value} type="button" className={clubTab === value ? 'active' : ''} onClick={() => setClubTab(value)}>{label}<span>{value === 'up-next' ? clubQueue.length : value === 'reading' ? Number(Boolean(currentClubBook)) : value === 'completed' ? completedClubBooks.length : books.filter((book) => book.passedOnAt && !book.club).length}</span></button>)}</div>
      {clubTab === 'reading' ? currentClubReadPanel : <div className="club-book-list">
        {clubTab === 'up-next' && <p className="book-empty-copy">The group’s to-read queue. Use the arrows to change the reading order.</p>}
        {clubList.length ? clubList.map((book, index) => <article className="club-queue-card" key={book.id}>
          <BookCover book={book} />
          <div className="club-queue-copy"><span className="eyebrow">{clubTab === 'up-next' ? `#${index + 1} · Club Up Next` : clubTab === 'completed' ? 'Completed club read' : 'Passed on by the club'}</span>
            <button type="button" className="club-book-title" onClick={() => setSelectedId(book.id)}>{book.title}</button><p>{book.authors.join(', ')}</p>
            {clubTab === 'completed' && <p>{book.club?.participantIds.map((id) => memberName(crew,id)).join(', ')}</p>}
            <div className="current-book-actions"><button className="button button-secondary" type="button" onClick={() => setSelectedId(book.id)}>Details & discussion</button></div>
            {clubTab !== 'passed' && clubControls(book)}
          </div>
          {clubTab === 'up-next' && <div className="club-queue-order"><button type="button" disabled={index === 0} aria-label={`Move ${book.title} up`} onClick={() => onChange(moveClubBook(books, book.id, -1))}><ArrowUp size={19} /></button><button type="button" disabled={index === clubQueue.length - 1} aria-label={`Move ${book.title} down`} onClick={() => onChange(moveClubBook(books, book.id, 1))}><ArrowDown size={19} /></button></div>}
        </article>) : <div className="book-empty-panel"><Library size={28} /><h2>{clubTab === 'up-next' ? 'No books in the club queue' : clubTab === 'completed' ? 'No completed club reads yet' : 'No passed-on books'}</h2><p>{clubTab === 'up-next' ? 'Open a nominated book and choose Add to club Up Next.' : 'Your personal shelves are managed in My Books.'}</p></div>}
      </div>}
    </> : section === 'library' ? <>
      <div className="filter-tabs book-filter-tabs">{([['all','All mine'],['to-read','To read'],['reading','Reading'],['read','Read']] as const).map(([value,label]) => <button className={shelfFilter === value ? 'active' : ''} type="button" key={value} onClick={() => onShelfFilterChange(value)}>{label}<span>{value === 'all' ? myBooks.length : myBooks.filter((book) => book.shelves[currentUser] === value).length}</span></button>)}</div>
      {filtered.length ? <div className="book-grid">{filtered.map((book) => <BookCard key={book.id} book={book} currentUser={currentUser} onOpen={() => setSelectedId(book.id)} onVote={(direction) => vote(book, direction)} onShelf={(shelf) => setShelf(book, shelf)} onChapter={() => setChapterBookId(book.id)} />)}</div> : <div className="book-empty-panel"><Search size={28} /><h2>No books here yet</h2><p>Add one with the plus button, or try another shelf.</p></div>}
    </> : <>
      <div className="book-poll-explainer"><div><ThumbsUp size={18} /><span><strong>Read together when there’s interest</strong><small>One or two readers can still choose a book.</small></span></div><div><ThumbsDown size={18} /><span><strong>Three no votes closes the poll</strong><small>Personal shelves and discussions are never deleted.</small></span></div></div>
      {poll.length ? <div className="book-poll-list">{poll.map((book, index) => <article key={book.id} onClick={() => setSelectedId(book.id)}><span className="book-poll-rank">#{index + 1}</span><BookCover book={book} /><div><h3>{book.title}</h3><p>{book.authors.join(', ')}</p><small>{averageRating(book) ? `★ ${averageRating(book).toFixed(1)} · ` : ''}{book.comments.length} comment{book.comments.length === 1 ? '' : 's'}</small></div><div className="book-poll-members"><span>{book.upvotes.map((id) => memberName(crew,id)).join(', ') || 'No yes votes yet'}</span><small>{book.downvotes.length}/3 no votes</small></div><VoteControls book={book} currentUser={currentUser} onVote={(direction) => vote(book, direction)} /></article>)}</div> : <div className="book-empty-panel"><BookOpen size={28} /><h2>The poll is empty</h2><p>Nominate a book from My Books to suggest it to the club.</p></div>}
    </>}
    {showAdd && <AddBookModal existing={books} onClose={onCloseAdd} onAdd={addBook} />}
    {selected && <BookDetails key={selected.id} book={selected} currentUser={currentUser} crew={crew} onClose={() => setSelectedId(null)} onUpdate={mutate} onChapter={() => setChapterBookId(selected.id)} onChangeBook={() => { setChangingId(selected.id); setSelectedId(null) }} onRemove={() => removeBook(selected)} clubControls={clubControls(selected)} />}
    {changingBook && <AddBookModal existing={books} replacing={changingBook} onClose={() => setChangingId(null)} onAdd={changeBook} />}
    {chapterBook && <ChapterModal book={chapterBook} current={chapterBook.progress[currentUser]?.lastChapter ?? 0} onClose={() => setChapterBookId(null)} onSave={(chapter) => updateChapter(chapterBook, chapter)} />}
  </div>
}
