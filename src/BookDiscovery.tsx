import { BookOpen, Check, ExternalLink, Plus, RefreshCw, Search, ThumbsUp, Video } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Book } from './types'
import { discoveryPickLabel, findDiscoveryBook, loadBookDiscovery, type BookDiscoveryFeed, type DiscoveryPick } from './lib/bookDiscovery'
import './BookDiscovery.css'

type Props = {
  books: Book[]
  currentUser: string
  onAdd: (pick: DiscoveryPick, action: 'shelf' | 'nominate') => void
  onOpenBook: (id: string) => void
}

const shelves = { 'to-read': 'To read', reading: 'Reading', read: 'Read' }
const monthLabel = (month: string) => new Date(`${month}-01T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })

export default function BookDiscovery({ books, currentUser, onAdd, onOpenBook }: Props) {
  const [feed, setFeed] = useState<BookDiscoveryFeed | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [year, setYear] = useState('all')
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    loadBookDiscovery(controller.signal).then(setFeed).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Unable to load book discovery.')
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [attempt])
  const picks = [...(feed?.picks ?? [])].sort((a, b) => b.month.localeCompare(a.month))
  const latestMonth = picks[0]?.month ?? ''
  const filtered = picks.filter((pick) => (year === 'all' || pick.month.startsWith(year)) && `${pick.title} ${pick.authors.join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()))
  const stale = feed && Date.now() - Date.parse(feed.lastCheckedAt) > 3 * 24 * 60 * 60 * 1000
  return <section className="book-discovery" aria-label="Book discovery">
    <div className="filter-tabs book-filter-tabs"><button type="button" className="active" aria-pressed="true">Jeselnik Book Club <span>{picks.length}</span></button></div>
    <div className="discovery-intro"><div><span className="eyebrow">A different reading list</span><h2>Anthony Jeselnik’s Book Club</h2><p>Monthly picks from Anthony’s official club. Explore on your own, or nominate a book for our next-book poll. These are not our group’s reading assignments.</p></div><a className="button button-secondary" href="https://anthonyjeselnik.com/the-jeselnik-book-club" target="_blank" rel="noreferrer">Official club <ExternalLink size={15} /></a></div>
    <div className="discovery-refresh"><span>{feed ? `Last successful check: ${new Date(feed.lastCheckedAt).toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} Central` : 'Loading the saved collection…'} · Scheduled daily at noon Central</span><button type="button" className="text-button" disabled={loading} onClick={() => setAttempt((value) => value + 1)}><RefreshCw size={14} className={loading ? 'spin' : ''} /> Reload list</button></div>
    {stale && <p className="discovery-notice" role="status">The latest source check is overdue. Showing the last saved picks; your shelves are unaffected.</p>}
    {error && <p className="discovery-notice" role="alert">{error}</p>}
    {loading && !feed && <p role="status">Loading Jeselnik’s monthly picks…</p>}
    {feed && <>
      <div className="discovery-filters"><label className="book-search-input"><Search size={17} /><input aria-label="Search Jeselnik picks" placeholder="Search titles or authors" value={query} onChange={(event) => setQuery(event.target.value)} /></label><label><span className="sr-only">Pick year</span><select aria-label="Pick year" value={year} onChange={(event) => setYear(event.target.value)}><option value="all">All years</option>{[...new Set(picks.map((pick) => pick.month.slice(0, 4)))].map((value) => <option key={value}>{value}</option>)}</select></label></div>
      <div className="discovery-grid">{filtered.map((pick) => {
        const book = findDiscoveryBook(books, pick)
        const shelf = book?.shelves[currentUser]
        const nominated = book && book.nominated !== false && !book.passedOnAt && !book.club
        const pollDisabled = Boolean(nominated || book?.passedOnAt || book?.club)
        const search = encodeURIComponent(`${pick.title} ${pick.authors.join(' ')}`)
        return <article className={`discovery-card ${pick.month === latestMonth ? 'is-featured' : ''}`} key={pick.id}>
          <div className="discovery-book-heading"><div className="book-cover"><span>{pick.title.split(/\s+/).slice(0, 2).map((word) => word[0]).join('')}</span>{pick.coverUrl && <img loading="lazy" src={pick.coverUrl} alt={`Cover of ${pick.title}`} onError={(event) => { event.currentTarget.style.display = 'none' }} />}</div><div><span className="eyebrow">{discoveryPickLabel(pick, latestMonth)}</span><time dateTime={pick.month}>{monthLabel(pick.month)}</time><h3>{pick.title}</h3><p>{pick.authors.join(', ')}</p>{shelf && <span className="discovery-shelf"><Check size={13} /> On my shelf · {shelves[shelf]}</span>}</div></div>
          <details className="discovery-synopsis"><summary>Synopsis</summary><p>{pick.description || 'A synopsis is not available for this edition. Open its catalog page for more information.'}</p>{pick.metadataUrl && <a href={pick.metadataUrl} target="_blank" rel="noreferrer">Book details & source <ExternalLink size={12} /></a>}</details>
          <div className="book-link-row discovery-links"><a href={pick.bookshopUrl} target="_blank" rel="noreferrer">Bookshop <ExternalLink size={12} /></a><a href={`https://www.amazon.com/s?k=${search}+kindle`} target="_blank" rel="noreferrer">Kindle</a><a href={`https://www.audible.com/search?keywords=${search}`} target="_blank" rel="noreferrer">Audible</a><a href={`https://www.overdrive.com/search?q=${search}`} target="_blank" rel="noreferrer">Libby / library</a></div>
          {pick.discussionUrl && <a className="discovery-discussion" href={pick.discussionUrl} target="_blank" rel="noreferrer"><Video size={16} /> Watch discussion <span>May contain spoilers</span></a>}
          <div className="discovery-actions"><button type="button" className="button button-primary" onClick={() => shelf && book ? onOpenBook(book.id) : onAdd(pick, 'shelf')}>{shelf ? <BookOpen size={15} /> : <Plus size={15} />}{shelf ? 'Open my book' : 'Add to my shelf'}</button><button type="button" className="button button-secondary" disabled={pollDisabled} onClick={() => onAdd(pick, 'nominate')}><ThumbsUp size={15} />{book?.passedOnAt ? 'Passed on by our club' : book?.club ? 'Already in club books' : nominated ? 'In next-book poll' : 'Nominate for our poll'}</button></div>
        </article>
      })}</div>
      {!filtered.length && <div className="book-empty-panel"><Search size={24} /><h3>No matching picks</h3><p>Try another author, title, or year.</p></div>}
    </>}
  </section>
}
