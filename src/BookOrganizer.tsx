import MemberShelfPicker from './MemberShelfPicker'
import { useState } from 'react'
import { ArrowDown, ArrowUp, BookMarked, GripVertical, Plus, Shuffle, SlidersHorizontal } from 'lucide-react'
import type { Book, BookShelf, Member } from './types'
import BookCoverImage from './BookCoverImage'
import CollectionFilters from './CollectionFilters'
import { useLiveReorder } from './useLiveReorder'
import { movePersonalBook, normalizeBookText, personalQueue, sameSeries, shelfNames } from './lib/bookOrganization'
import './BookOrganizer.css'

type Props = {
  books: Book[]; currentUser: string; crew: Member[]; readers?: boolean; shelf: BookShelf | 'all'; search: string
  onShelfFilter: (shelf: BookShelf | 'all') => void; onChange: (books: Book[]) => void
  onOpen: (id: string) => void; onChapter: (id: string) => void; onEdit: (id: string) => void
  onShelf: (book: Book, shelf: BookShelf) => void; onFindSeries: (book: Book) => void
  onRefresh: () => void; refreshing: boolean
}

export function SeriesLabel({ book }: { book: Book }) {
  if (!book.series) return null
  return <span className="series-label">{book.series.name}{book.series.position !== undefined ? ` · Book ${book.series.position}` : ''}{book.series.total ? ` of ${book.series.total}` : ''}</span>
}

export default function BookOrganizer({ books, currentUser, crew, readers, shelf, search, onShelfFilter, onChange, onOpen, onChapter, onEdit, onShelf, onFindSeries, onRefresh, refreshing }: Props) {
  const [reader, setReader] = useState(currentUser)
  const [genre, setGenre] = useState('')
  const [tag, setTag] = useState('')
  const [query, setQuery] = useState('')
  const [groupSeries, setGroupSeries] = useState(shelf === 'all')
  const [sort, setSort] = useState('order')
  const [moving, setMoving] = useState<string | null>(null)
  const [position, setPosition] = useState('1')
  const [announcement, setAnnouncement] = useState('')
  const owner = readers ? reader : currentUser
  const mine = owner === currentUser
  const owned = personalQueue(books, owner)
  const ownerName = crew.find((member) => member.id === owner)?.name ?? 'Reader'
  const genres = [...new Set(owned.flatMap((book) => book.genres ?? []))].sort()
  const tags = [...new Set(owned.flatMap((book) => book.readerOrganization?.[owner]?.tags ?? []))].sort()
  const visible = owned.filter((book) => (shelf === 'all' || book.shelves[owner] === shelf)
    && (genre === '' || (genre === '__none' ? !book.genres?.length : book.genres?.includes(genre)))
    && (!tag || book.readerOrganization?.[owner]?.tags?.includes(tag))
    && `${book.title} ${book.authors.join(' ')} ${book.series?.name ?? ''}`.toLowerCase().includes((query || search).trim().toLowerCase()))
  if (sort === 'title') visible.sort((a, b) => a.title.localeCompare(b.title))
  if (sort === 'author') visible.sort((a, b) => a.authors.join().localeCompare(b.authors.join()))
  if (sort === 'newest') visible.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const canReorder = mine && shelf !== 'all' && sort === 'order' && !groupSeries
  const queue = personalQueue(books, owner, shelf === 'all' ? undefined : shelf)
  const move = (id: string, rank: number) => {
    if (!mine) return
    onChange(movePersonalBook(books, currentUser, id, rank))
    setAnnouncement('Your reading order was updated.')
  }
  const drag = useLiveReorder({ ids: visible.map(book => book.id), enabled: canReorder,
    onMove: (id, target) => move(id, queue.findIndex(book => book.id === target) + 1) })
  const card = (book: Book) => {
    const rank = queue.findIndex((item) => item.id === book.id) + 1
    return <article key={book.id} data-shelf-book={book.id} data-reorder-id={book.id} className="organized-book">
      {canReorder && <button type="button" className="book-drag-handle" aria-label={`Drag ${book.title} to reorder; use arrow buttons or Move for keyboard control`} {...drag.handleProps(book.id)}><GripVertical size={20} /></button>}
      <button className="organized-cover" type="button" onClick={() => onOpen(book.id)} aria-label={`Open ${book.title}`}><BookCoverImage book={book} /></button>
      <div className="organized-copy"><span className="eyebrow">{sort === 'order' && shelf !== 'all' && !groupSeries ? `#${rank} · ` : ''}{shelfNames[book.shelves[owner]]}</span><button className="organized-title" type="button" onClick={() => onOpen(book.id)}>{book.title}</button><p>{book.authors.join(', ')}</p><SeriesLabel book={book} />
        <div className="book-tag-list">{book.genres?.map((value) => <button type="button" key={value} onClick={() => setGenre(value)}>{value}</button>)}{book.readerOrganization?.[owner]?.tags?.map((value) => <button type="button" className="personal-tag" key={value} onClick={() => setTag(value)}>#{value}</button>)}</div>
        {!mine && <p>{ownerName} · Chapter {book.progress[owner]?.lastChapter ?? 0}{book.ratings[owner]?.stars ? ` · ${book.ratings[owner].stars}/5 stars` : ''}</p>}
      </div>
      <div className="organized-actions">{mine ? <>
        <select aria-label={`Shelf for ${book.title}`} value={book.shelves[currentUser]} onChange={(event) => onShelf(book, event.target.value as BookShelf)}>{Object.entries(shelfNames).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>
        <div className="organized-action-row"><button type="button" onClick={() => onEdit(book.id)} aria-label={`Organize ${book.title}`}><SlidersHorizontal size={15} />Organize</button>{book.shelves[currentUser] === 'reading' && <button type="button" onClick={() => onChapter(book.id)}><BookMarked size={15} />Ch. {book.progress[currentUser]?.lastChapter ?? 0}</button>}</div>
        {canReorder && <div className="organized-action-row"><button type="button" disabled={rank === 1} aria-label={`Move ${book.title} up`} onClick={() => move(book.id, rank - 1)}><ArrowUp size={15} /></button><button type="button" disabled={rank === queue.length} aria-label={`Move ${book.title} down`} onClick={() => move(book.id, rank + 1)}><ArrowDown size={15} /></button><button type="button" onClick={() => { setMoving(book.id); setPosition(String(rank)) }}>Move…</button></div>}
        {book.shelves[currentUser] === 'to-read' && <button type="button" onClick={() => { move(book.id, 1); setSort('order'); setGroupSeries(false); onShelfFilter('to-read') }}>Read next</button>}
      </> : <button type="button" disabled={Boolean(book.shelves[currentUser])} onClick={() => onShelf(book, 'to-read')}><Plus size={15} />{book.shelves[currentUser] ? 'On my shelf' : 'Save to my books'}</button>}</div>
    </article>
  }
  const groups: Book[][] = []
  for (const book of visible) {
    const group = book.series ? groups.find((items) => sameSeries(items[0], book)) : undefined
    if (group) group.push(book); else groups.push([book])
  }
  return <section className="book-organizer" aria-label="Personal book shelves">
    {readers && <MemberShelfPicker key={currentUser} crew={crew} currentUser={currentUser} selected={reader} kind="books" onSelect={id => { setReader(id); setGenre(''); setTag(''); setQuery('') }} />}
    {!mine && <p className="reader-view-notice">Browsing {ownerName}’s library. Their shelves and reading order are read-only. Save a book to manage your own copy.</p>}
    <div className="filter-tabs book-filter-tabs">{(['all', ...Object.keys(shelfNames)] as (BookShelf | 'all')[]).map((value) => <button key={value} className={shelf === value ? 'active' : ''} type="button" onClick={() => { onShelfFilter(value); setGroupSeries(value === 'all') }}>{value === 'all' ? 'Library' : shelfNames[value]}<span>{value === 'all' ? owned.length : owned.filter((book) => book.shelves[owner] === value).length}</span></button>)}</div>
    <CollectionFilters activeCount={[query || search, genre, tag, sort !== 'order'].filter(Boolean).length} groupedBy={groupSeries ? 'series' : undefined}>
    <div className="book-organizer-toolbar">
      <label>Search<input type="search" placeholder="Title, author, or series" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <label>Genre<select value={genre} onChange={(event) => setGenre(event.target.value)}><option value="">All genres</option>{genres.map((value) => <option key={value}>{value}</option>)}<option value="__none">Uncategorized</option></select></label>
      <label>Tag<select value={tag} onChange={(event) => setTag(event.target.value)}><option value="">All tags</option>{tags.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>Sort<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="order">Reading order</option><option value="title">Title</option><option value="author">Author</option><option value="newest">Recently added</option></select></label>
    </div>
    <div className="book-organizer-options"><label><input type="checkbox" checked={groupSeries} onChange={(event) => setGroupSeries(event.target.checked)} /> Group by series</label>{mine && <button type="button" disabled={refreshing || !owned.length} onClick={onRefresh}>{refreshing ? 'Checking catalogs…' : 'Refresh series & genres'}</button>}<button type="button" disabled={!visible.some((book) => book.shelves[owner] === 'to-read')} onClick={() => { const choices = visible.filter((book) => book.shelves[owner] === 'to-read'); onOpen(choices[Math.floor(Math.random() * choices.length)].id) }}><Shuffle size={15} />Pick {mine ? 'my' : 'a'} next read</button>{(genre || tag || query) && <button type="button" onClick={() => { setGenre(''); setTag(''); setQuery('') }}>Clear filters</button>}</div>
    </CollectionFilters>
    <p className="book-organizer-hint">{groupSeries ? 'Series order is separate from your personal reading queue. Missing books aren’t added automatically.' : canReorder ? 'Drag the grip, use arrows, or choose Move to set a position. Positions refer to the full shelf, even when filtered.' : mine ? 'Choose a shelf and Reading order to arrange books. Turn off series grouping to mix books from different series.' : 'Ratings and discussion remain shared. Private notes are never shown here.'}</p>
    <p className="sr-only" role="status">{announcement}</p>
    <p className="sr-only" role="status">{drag.announcement}</p>
    <div className="organized-books" ref={drag.containerRef} onClickCapture={drag.onClickCapture}>{groupSeries ? groups.map((items) => {
      const first = items[0]
      if (!first.series) return card(first)
      const allSeries = owned.filter((book) => sameSeries(first, book))
      const ordered = [...items].sort((a, b) => (a.series?.position ?? Infinity) - (b.series?.position ?? Infinity))
      return <details className="book-series-collection" key={`${normalizeBookText(first.series.name)}-${first.id}`} open><summary><strong>{first.series.name}</strong><span>{allSeries.length} on shelf · {allSeries.filter((book) => book.shelves[owner] === 'read').length} finished · {items.length} shown</span></summary><div className="series-books">{ordered.map(card)}</div><button className="button button-secondary" type="button" onClick={() => onFindSeries(first)}>Find other books in this series</button></details>
    }) : visible.map(card)}</div>
    {!visible.length && <div className="book-empty-panel"><h2>No books on this shelf</h2><p>Try another shelf or clear your filters. New books can be added with the plus button.</p></div>}
    {moving && <div className="modal-backdrop"><form className="modal-card book-move-modal" role="dialog" aria-modal="true" aria-label="Move book" onSubmit={(event) => { event.preventDefault(); move(moving, Number(position)); setMoving(null) }}><h2>Move to position</h2><p>{books.find((book) => book.id === moving)?.title}</p><label>Position in this shelf<input autoFocus type="number" min="1" max={queue.length} required value={position} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setPosition(event.target.value)} /></label><div className="modal-actions"><button className="button button-secondary" type="button" onClick={() => setMoving(null)}>Cancel</button><button className="button button-primary" type="submit">Move book</button></div></form></div>}
  </section>
}
