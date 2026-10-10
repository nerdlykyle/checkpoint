import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, Film, Library, ListVideo, Pencil, Play, Plus, Search, Trash2, X } from 'lucide-react'
import { useMovieStore } from './lib/movieStore'
import { movieSections, validateMovie, type Movie, type MovieAction, type MovieDraft, type MovieSection } from './lib/movies'
import { MovieCassette, MoviePoster, MovieSleeve } from './MovieArtwork'
import MovieSearch, { MovieCredits } from './MovieSearch'
import type { movieRequest } from './lib/movieSearch'
import type { ConnectionState } from './NavigationSync'
import type { Member } from './types'
import './MovieMode.css'

const navIcons = { home: Film, library: Library, queue: ListVideo, watched: Check }
export function MovieNavigation({ section, onSelect, mobile = false }: { section: MovieSection; onSelect: (section: MovieSection) => void; mobile?: boolean }) {
  return <nav className={mobile ? 'mobile-menu-nav' : 'main-nav'} aria-label="Movie navigation">{Object.entries(movieSections).map(([key, title]) => {
    const value = key as MovieSection, Icon = navIcons[value]
    return <button type="button" key={value} className={value === section ? 'active' : ''} onClick={() => onSelect(value)}>{mobile ? <><span><Icon size={19} /></span><strong>{title}</strong></> : <><Icon size={19} /><span>{title}</span></>}</button>
  })}</nav>
}
type Props = {
  boardId: string; user: string; crew: Member[]; section: MovieSection; onSection: (section: MovieSection) => void
  search: string; showAdd: boolean; onCloseAdd: () => void; onOpenAdd: () => void
  notify: (message: string) => void; boardReady: boolean; onSyncChange?: (state: ConnectionState) => void
  catalogRequest?: typeof movieRequest
}
export default function MovieMode(props: Props) {
  const store = useMovieStore(props.boardId, props.user, props.boardReady)
  const report = props.onSyncChange
  useEffect(() => { report?.(store.connection) }, [store.connection, report])
  useEffect(() => () => report?.('connecting'), [report])
  return <MovieContent {...props} store={store} />
}

export function MovieContent({ boardId, user, crew, section, onSection, search, showAdd, onCloseAdd, onOpenAdd, notify, store, catalogRequest }: Props & { store: ReturnType<typeof useMovieStore> }) {
  const [addDraft, setAddDraft] = useState<MovieDraft | null>(null)
  useEffect(() => { if (!showAdd) setAddDraft(null) }, [showAdd])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [library, setLibrary] = useState<'mine' | 'crew'>('mine')
  const selected = store.items.find(item => item.id === selectedId)
  const current = store.items.find(item => item.clubStatus === 'watching')
  const queue = store.items.filter(item => item.clubStatus === 'up-next').sort((a, b) => a.queuedAt.localeCompare(b.queuedAt) || a.id.localeCompare(b.id))
  const shown = (section === 'queue' ? queue : store.items.filter(item => section === 'watched' ? item.clubStatus === 'watched' : library === 'crew' || item.libraries[user]))
    .filter(item => `${item.title} ${item.year}`.toLowerCase().includes((search || query).trim().toLowerCase()))
  const open = (id: string) => { setSelectedId(id); setEditing(false); setError('') }
  const close = () => { if (!pending.current) { setSelectedId(null); setEditing(false); setError('') } }
  const run = async (action: MovieAction) => {
    if (!selected || pending.current) return
    pending.current = true; setBusy(true); setError('')
    try { await store.action(selected.id, action); notify(action === 'remove' ? 'Removed from your movies. The crew’s copy is unchanged.' : 'Movies updated') }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save. Please try again.') }
    finally { pending.current = false; setBusy(false) }
  }
  const shelf = (items: Movie[]) => <div className="movie-shelf">{items.map(item => <MovieSleeve key={item.id} movie={item} onOpen={() => open(item.id)} />)}</div>
  const empty = (text: string) => <div className="movie-empty"><Film size={28} /><p>{text}</p><button type="button" className="button" disabled={!store.ready} onClick={onOpenAdd}><Plus size={18} />Add movie</button></div>
  return <div className="page movie-page">
    <div className="page-title-row"><div><span className="eyebrow">Checkpoint Movies</span><h1>{section === 'home' ? 'What’re we watching?' : movieSections[section]}</h1><p>Movie night together. A shelf worth sharing.</p></div><button type="button" className="button" disabled={!store.ready} onClick={onOpenAdd}><Plus size={18} />Add movie</button></div>
    {store.error && <div className="movie-error" role="alert">{store.error}<button className="button" type="button" onClick={store.retry}>Retry connection</button></div>}
    {!store.ready && !store.error && <p role="status">Connecting to the movie collection…</p>}
    {section === 'home' ? <>
      <section className="movie-home-feature"><div className="section-heading"><div><span className="eyebrow">Tonight’s feature</span><h2>Our current group watch</h2></div></div>
        {current ? <MovieCassette key={current.id} movie={current} onOpen={() => open(current.id)} /> : store.ready && empty('No group watch yet. Add a movie, then choose Start group watch in its details.')}
      </section>
      <section><div className="section-heading"><h2>Up next</h2><button type="button" className="button" onClick={() => onSection('queue')}>View all</button></div>{queue.length ? shelf(queue.slice(0, 6)) : store.ready && <p className="movie-muted">The queue is empty. Add movies from their three-dot details menu.</p>}</section>
      <section><div className="section-heading"><h2>My movies</h2><button type="button" className="button" onClick={() => onSection('library')}>Browse library</button></div>{shelf(store.items.filter(item => item.libraries[user]).slice(0, 6))}</section>
    </> : <>
      {section === 'library' && <div className="filter-tabs">{(['mine', 'crew'] as const).map(value => <button type="button" key={value} className={value === library ? 'active' : ''} aria-pressed={value === library} onClick={() => setLibrary(value)}>{value === 'mine' ? 'My library' : 'Crew collection'}</button>)}</div>}
      <label className="movie-search"><Search size={18} /><span className="sr-only">Filter movies</span><input type="search" placeholder="Find a movie on this shelf" value={query} onChange={event => setQuery(event.target.value)} /></label>
      {shown.length ? shelf(shown) : store.ready && empty(search || query ? 'No movies match this search.' : 'No movies on this shelf yet.')}
    </>}
    <MovieCredits />
    {showAdd && <MovieDialog title={addDraft ? 'Confirm movie' : 'Add movie'} onClose={onCloseAdd}>{addDraft ? <MovieEditor initial={addDraft} adding onCancel={() => setAddDraft(null)} onSave={async draft => { await store.add(draft); onCloseAdd(); setLibrary('mine'); setQuery(''); onSection('library'); notify('Movie saved to your library') }} /> : <MovieSearch boardId={boardId} onChoose={setAddDraft} request={catalogRequest} />}</MovieDialog>}
    {selected && <MovieDialog title={editing ? 'Edit movie' : selected.title} onClose={close}>
      {editing ? <MovieEditor key={selected.id} initial={selected} onCancel={() => setEditing(false)} onSave={async draft => { await store.edit(selected.id, draft); setEditing(false); notify('Movie details saved') }} /> : <>
        <div className="movie-detail-intro"><div className="movie-detail-poster"><MoviePoster movie={selected} /></div><div><span className="eyebrow">{selected.clubStatus === 'watching' ? 'Current group watch' : selected.clubStatus === 'up-next' ? 'Club up next' : selected.clubStatus === 'watched' ? 'Watched together' : 'Crew collection'}</span><h3>{selected.title}</h3><p>{selected.year}</p><small>Added by {crew.find(member => member.id === selected.addedBy)?.name || 'a crew member'}</small></div></div>
        <section className="movie-detail-synopsis"><h3>Synopsis</h3><p>{selected.description || 'No synopsis yet. Use Edit movie to add one.'}</p></section>
        {selected.tmdbId && <a href={`https://www.themoviedb.org/movie/${selected.tmdbId}`} target="_blank" rel="noreferrer">Movie details on TMDB</a>}
        <div className="movie-detail-actions">
          <button type="button" className="icon-button" title="Edit movie" aria-label="Edit movie" disabled={busy || !store.ready} onClick={() => setEditing(true)}><Pencil size={20} /></button>
          <button type="button" className="icon-button" title={selected.libraries[user] ? 'Remove from my library' : 'Save to my library'} aria-label={selected.libraries[user] ? 'Remove from my library' : 'Save to my library'} disabled={busy || !store.ready} onClick={() => void run(selected.libraries[user] ? 'remove' : 'save')}>{selected.libraries[user] ? <Trash2 size={20} /> : <Plus size={20} />}</button>
          {selected.clubStatus !== 'watching' && <button type="button" className="button" disabled={busy || !store.ready} onClick={() => void run(selected.clubStatus === 'up-next' ? 'unqueue' : 'queue')}><ListVideo size={18} />{selected.clubStatus === 'up-next' ? 'Remove from Up next' : 'Add to Up next'}</button>}
          <button type="button" className="button" disabled={busy || !store.ready || Boolean(current && current.id !== selected.id)} onClick={() => void run(selected.clubStatus === 'watching' ? 'finish' : 'start')}>{selected.clubStatus === 'watching' ? <Check size={18} /> : <Play size={18} />}{selected.clubStatus === 'watching' ? 'Finish group watch' : 'Start group watch'}</button>
        </div>
        {current && current.id !== selected.id && <p className="movie-muted">Finish “{current.title}” before starting another group watch.</p>}
        {busy && <p role="status">Saving…</p>}{error && <p className="movie-error" role="alert">{error}</p>}
      </>}
    </MovieDialog>}
  </div>
}

function MovieDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null), label = useId()
  useEffect(() => {
    const dialog = ref.current, trigger = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    dialog?.showModal(); document.body.style.overflow = 'hidden'
    return () => { dialog?.close(); document.body.style.overflow = overflow; if (trigger?.isConnected) trigger.focus({ preventScroll: true }) }
  }, [])
  return createPortal(<dialog ref={ref} className="movie-dialog" aria-labelledby={label} onCancel={event => { event.preventDefault(); onClose() }}><header><h2 id={label}>{title}</h2><button autoFocus type="button" className="icon-button" aria-label="Close movie details" onClick={onClose}><X size={22} /></button></header><div className="movie-dialog-body">{children}</div></dialog>, document.body)
}

function MovieEditor({ initial, onSave, onCancel, adding = false }: { initial?: MovieDraft; onSave: (draft: MovieDraft) => Promise<void>; onCancel: () => void; adding?: boolean }) {
  const [draft, setDraft] = useState<MovieDraft>(initial || { title: '', year: '', posterUrl: '', description: '' })
  const [saving, setSaving] = useState(false), [error, setError] = useState('')
  const update = (key: keyof MovieDraft, value: string) => setDraft(old => ({ ...old, [key]: value }))
  return <form className="movie-editor" onSubmit={async event => { event.preventDefault(); if (saving) return; setError(''); setSaving(true); try { await onSave(validateMovie(draft)) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save this movie.') } finally { setSaving(false) } }}>
    <p className="movie-muted">{adding ? initial?.tmdbId ? 'Confirm the movie and artwork from TMDB before saving.' : 'Add a movie manually with an optional artwork link.' : 'Movie details are shared with the crew.'}</p>
    <label>Movie title<input required maxLength={250} value={draft.title} onChange={event => update('title', event.target.value)} /></label>
    <label>Release year<input inputMode="numeric" pattern="[0-9]{4}|^$" maxLength={4} value={draft.year} onChange={event => update('year', event.target.value)} /></label>
    <label>Artwork URL<input type="url" placeholder="https://…" maxLength={2000} value={draft.posterUrl} onChange={event => update('posterUrl', event.target.value)} /></label>
    <label>Synopsis<textarea rows={5} maxLength={5000} value={draft.description} onChange={event => update('description', event.target.value)} /></label>
    {error && <p className="movie-error" role="alert">{error}</p>}
    <div className="movie-detail-actions"><button type="button" className="button" disabled={saving} onClick={onCancel}>Cancel</button><button className="button" disabled={saving} type="submit">{saving ? 'Saving…' : 'Save movie'}</button></div>
  </form>
}
