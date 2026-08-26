import {
  Bell, BookOpen, Check, ChevronDown, CircleHelp, Clock3, Flag, Gamepad2,
  GripVertical, Heart, LayoutDashboard, Library, ListFilter, MoreHorizontal,
  LogOut, NotebookPen, Plus, Search, Settings, Share2, Sparkles, Trophy, Users, X,
} from 'lucide-react'
import {
  createContext, useContext, useEffect, useMemo, useRef, useState,
  type CSSProperties, type DragEvent, type FormEvent,
} from 'react'
import type { User } from 'firebase/auth'
import './App.css'
import { initialGames, members, statusLabels } from './data'
import type { Game, GameStatus, Member } from './types'
import { firebaseConfigured, signInWithGoogle, signOut, watchAuth } from './lib/firebase'
import { connectBoard, getBoardId, type BoardConnection } from './lib/sharedBoard'

const STORAGE_KEY = 'checkpoint-games-v1'
const DEMO_USER = 'kp'
type View = 'dashboard' | 'library'
type SyncStatus = 'local' | 'connecting' | 'live' | 'error'

const CurrentUserContext = createContext(DEMO_USER)
const MembersContext = createContext<Member[]>(members)

function getStoredGames() {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value ? (JSON.parse(value) as Game[]) : initialGames
  } catch {
    return initialGames
  }
}

function Cover({ game, size = 'medium' }: { game: Game; size?: 'small' | 'medium' | 'large' }) {
  const style = { '--cover-color': game.color, '--cover-accent': game.accent } as CSSProperties
  return (
    <div className={`game-cover cover-${size}`} style={style} aria-hidden="true">
      <span className="cover-orbit" /><span className="cover-mark">{game.coverMark}</span><span className="cover-year">{game.year}</span>
    </div>
  )
}

function Avatar({ id, small = false }: { id: string; small?: boolean }) {
  const activeMembers = useContext(MembersContext)
  const member = activeMembers.find((item) => item.id === id) ?? members.find((item) => item.id === id) ?? members[0]
  return <span className={`avatar ${small ? 'avatar-small' : ''}`} style={{ background: member.color }} title={member.name}>{member.photoUrl ? <img src={member.photoUrl} alt="" /> : member.initials}</span>
}

function VoteButton({ game, onVote, compact = false }: { game: Game; onVote: () => void; compact?: boolean }) {
  const currentUser = useContext(CurrentUserContext)
  const voted = game.votes.includes(currentUser)
  return (
    <button className={`vote-button ${voted ? 'is-voted' : ''} ${compact ? 'is-compact' : ''}`} type="button"
      onClick={(event) => { event.stopPropagation(); onVote() }} aria-label={`${voted ? 'Remove vote from' : 'Vote for'} ${game.title}`}>
      <Heart size={15} fill={voted ? 'currentColor' : 'none'} /><span>{game.votes.length}</span>
    </button>
  )
}

function AddGameModal({ onClose, onAdd }: { onClose: () => void; onAdd: (game: Game) => void }) {
  const currentUser = useContext(CurrentUserContext)
  const [status, setStatus] = useState<GameStatus>('up-next')
  const [color, setColor] = useState('#5d51c8')
  const colors = ['#5d51c8', '#176e87', '#b65f3e', '#486a55', '#8a3556', '#25324f']

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const title = String(form.get('title') ?? '').trim()
    if (!title) return
    const words = title.split(/\s+/)
    const mark = words.length > 1 ? words.slice(0, 2).map((word) => word[0]).join('') : title.slice(0, 2)
    onAdd({
      id: crypto.randomUUID(), title, year: Number(form.get('year')) || new Date().getFullYear(), status,
      progress: status === 'completed' ? 100 : 0, note: String(form.get('note') ?? '').trim(), votes: [],
      color, accent: '#f1c879', platform: String(form.get('platform') ?? 'PC'), addedBy: currentUser,
      genre: String(form.get('genre') ?? '').trim() || 'Game', coverMark: mark.toUpperCase(),
      completedAt: status === 'completed' ? new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : undefined,
    })
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="modal" onMouseDown={(event) => event.stopPropagation()} aria-modal="true" role="dialog">
        <div className="modal-heading">
          <div><span className="eyebrow">Add to Checkpoint</span><h2>What are we playing?</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close"><X size={19} /></button>
        </div>
        <form onSubmit={submit}>
          <label className="field field-full"><span>Game title</span><input name="title" placeholder="Search or enter a title" autoFocus required /></label>
          <div className="form-grid">
            <label className="field"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value as GameStatus)}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="field"><span>Platform</span><select name="platform" defaultValue="PC"><option>PC</option><option>PlayStation</option><option>Xbox</option><option>Switch</option><option>Other</option></select></label>
            <label className="field"><span>Release year</span><input name="year" inputMode="numeric" defaultValue={new Date().getFullYear()} /></label>
            <label className="field"><span>Genre</span><input name="genre" placeholder="Co-op adventure" /></label>
          </div>
          <label className="field field-full"><span>Group note <em>optional</em></span><textarea name="note" placeholder="Why should this be on the list?" rows={3} /></label>
          <fieldset className="color-field"><legend>Cover color</legend><div className="color-options">
            {colors.map((option) => <button key={option} className={`color-option ${color === option ? 'selected' : ''}`} style={{ background: option }} type="button" onClick={() => setColor(option)} aria-label={`Choose ${option}`}>{color === option && <Check size={15} />}</button>)}
          </div></fieldset>
          <div className="modal-actions"><button className="button button-secondary" type="button" onClick={onClose}>Cancel</button><button className="button button-primary" type="submit"><Plus size={17} /> Add game</button></div>
        </form>
      </section>
    </div>
  )
}

function GameDetailsModal({ game, onClose, onSave, onVote }: { game: Game; onClose: () => void; onSave: (updates: Partial<Game>) => void; onVote: () => void }) {
  const [progress, setProgress] = useState(game.progress)
  const [status, setStatus] = useState(game.status)
  const [note, setNote] = useState(game.note)
  function save(event: FormEvent) {
    event.preventDefault()
    onSave({ progress: status === 'completed' ? 100 : progress, status, note,
      completedAt: status === 'completed' ? (game.completedAt ?? new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })) : undefined })
  }
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="modal details-modal" onMouseDown={(event) => event.stopPropagation()} aria-modal="true" role="dialog">
        <div className="details-hero"><Cover game={game} size="large" /><div className="details-title"><span className="status-pill">{statusLabels[game.status]}</span><h2>{game.title}</h2><p>{game.year} · {game.genre} · {game.platform}</p><VoteButton game={game} onVote={onVote} /></div><button className="icon-button details-close" type="button" onClick={onClose} aria-label="Close"><X size={19} /></button></div>
        <form onSubmit={save} className="details-form">
          <div className="form-grid">
            <label className="field"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value as GameStatus)}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="field"><span>Progress · {progress}%</span><input className="range" type="range" min="0" max="100" value={progress} onChange={(event) => setProgress(Number(event.target.value))} /></label>
          </div>
          <label className="field field-full"><span>Shared notes</span><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} placeholder="Where did we leave off?" /></label>
          <div className="modal-actions"><button className="button button-secondary" type="button" onClick={onClose}>Cancel</button><button className="button button-primary" type="submit">Save changes</button></div>
        </form>
      </section>
    </div>
  )
}

function QueueItem({ game, rank, onVote, onOpen, onDragStart, onDrop }: { game: Game; rank: number; onVote: () => void; onOpen: () => void; onDragStart: (event: DragEvent<HTMLDivElement>) => void; onDrop: (event: DragEvent<HTMLDivElement>) => void }) {
  return (
    <div className="queue-item" draggable onDragStart={onDragStart} onDragOver={(event) => event.preventDefault()} onDrop={onDrop} onClick={onOpen}>
      <button className="drag-handle" type="button" aria-label={`Drag ${game.title}`}><GripVertical size={17} /></button><span className="queue-rank">{rank}</span><Cover game={game} size="small" />
      <div className="queue-copy"><strong>{game.title}</strong><span>{game.genre} · {game.platform}</span></div>
      <div className="queue-voters" aria-label={`${game.votes.length} votes`}>{game.votes.slice(0, 3).map((id) => <Avatar id={id} small key={id} />)}</div><VoteButton game={game} onVote={onVote} compact />
    </div>
  )
}

function LibraryCard({ game, onOpen, onVote }: { game: Game; onOpen: () => void; onVote: () => void }) {
  return (
    <article className="library-card" onClick={onOpen}><Cover game={game} size="medium" /><div className="library-card-copy">
      <div className="library-card-topline"><span className={`status-dot status-${game.status}`} /><span>{statusLabels[game.status]}</span><button className="more-button" type="button" aria-label="More options"><MoreHorizontal size={17} /></button></div>
      <h3>{game.title}</h3><p>{game.genre} · {game.platform}</p>
      {game.status === 'playing' ? <div className="mini-progress"><span style={{ width: `${game.progress}%` }} /></div> : <div className="library-card-footer"><span>Added by <Avatar id={game.addedBy} small /></span><VoteButton game={game} onVote={onVote} compact /></div>}
    </div></article>
  )
}

function SignInScreen({ loading, error, onSignIn }: { loading: boolean; error: string | null; onSignIn: () => void }) {
  return (
    <main className="sign-in-screen">
      <div className="sign-in-glow" />
      <section className="sign-in-card">
        <div className="sign-in-brand"><span className="brand-mark"><Flag size={22} fill="currentColor" /></span><strong>checkpoint</strong></div>
        <span className="eyebrow">The game plan, together</span>
        <h1>Your crew’s next adventure starts here.</h1>
        <p>Track the current campaign, rank what’s next, vote on favorites, and keep everyone in sync from any browser.</p>
        <button className="google-button" type="button" onClick={onSignIn} disabled={loading}>
          <span className="google-g">G</span>{loading ? 'Opening Google…' : 'Continue with Google'}
        </button>
        {error && <p className="sign-in-error">{error}</p>}
        <small>Only people with this private Checkpoint link can join the board.</small>
      </section>
      <div className="sign-in-preview" aria-hidden="true">
        <span className="preview-rank">1</span><div className="preview-cover">33</div><div><strong>Clair Obscur</strong><span>Up next · 4 votes</span></div>
      </div>
    </main>
  )
}

function LoadingScreen() {
  return <main className="loading-screen"><span className="brand-mark"><Flag size={21} fill="currentColor" /></span><strong>Opening Checkpoint…</strong></main>
}

function App() {
  const [games, setGames] = useState<Game[]>(getStoredGames)
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(!firebaseConfigured)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [groupMembers, setGroupMembers] = useState<Member[]>(members)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(firebaseConfigured ? 'connecting' : 'local')
  const [view, setView] = useState<View>('dashboard')
  const [showAdd, setShowAdd] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [libraryFilter, setLibraryFilter] = useState<GameStatus | 'all'>('all')
  const [toast, setToast] = useState<string | null>(null)
  const [boardId] = useState(getBoardId)
  const connectionRef = useRef<BoardConnection | null>(null)
  const lastSyncedRef = useRef('')
  const initialGamesRef = useRef(games)

  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(games)), [games])
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(null), 2200); return () => window.clearTimeout(timer) }, [toast])
  useEffect(() => watchAuth((nextUser) => { setUser(nextUser); setAuthReady(true) }), [])
  useEffect(() => {
    if (!firebaseConfigured || !user) return
    let active = true
    connectBoard(boardId, user, initialGamesRef.current, (remoteGames, remoteMembers) => {
      if (!active) return
      lastSyncedRef.current = JSON.stringify(remoteGames)
      setGames(remoteGames)
      setGroupMembers(remoteMembers)
    }).then((connection) => {
      if (!active) { connection?.close(); return }
      connectionRef.current = connection
      setSyncStatus(connection ? 'live' : 'local')
    }).catch(() => { if (active) setSyncStatus('error') })
    return () => { active = false; connectionRef.current?.close(); connectionRef.current = null }
  }, [boardId, user])
  useEffect(() => {
    if (syncStatus !== 'live' || !connectionRef.current) return
    const serialized = JSON.stringify(games)
    if (serialized === lastSyncedRef.current) return
    const timer = window.setTimeout(() => {
      connectionRef.current?.save(games).then(() => {
        lastSyncedRef.current = serialized
      }).catch(() => setSyncStatus('error'))
    }, 350)
    return () => window.clearTimeout(timer)
  }, [games, syncStatus])

  const currentUser = user?.uid ?? DEMO_USER
  const playing = games.find((game) => game.status === 'playing')
  const upNext = games.filter((game) => game.status === 'up-next')
  const selected = games.find((game) => game.id === selectedId)
  const filteredGames = useMemo(() => games.filter((game) => (libraryFilter === 'all' || game.status === libraryFilter) && game.title.toLowerCase().includes(search.toLowerCase())), [games, libraryFilter, search])
  const flash = (message: string) => setToast(message)
  function vote(gameId: string) { setGames((current) => current.map((game) => game.id !== gameId ? game : { ...game, votes: game.votes.includes(currentUser) ? game.votes.filter((id) => id !== currentUser) : [...game.votes, currentUser] })) }
  function addGame(game: Game) { setGames((current) => [...current, game]); setShowAdd(false); flash(`${game.title} added to ${statusLabels[game.status]}`) }
  function updateGame(gameId: string, updates: Partial<Game>) { setGames((current) => current.map((game) => game.id === gameId ? { ...game, ...updates } : game)); setSelectedId(null); flash('Checkpoint updated') }
  function reorderQueue(sourceId: string, targetId: string) {
    if (sourceId === targetId) return
    setGames((current) => { const queue = current.filter((game) => game.status === 'up-next'); const from = queue.findIndex((game) => game.id === sourceId); const to = queue.findIndex((game) => game.id === targetId); if (from < 0 || to < 0) return current; const [moved] = queue.splice(from, 1); queue.splice(to, 0, moved); let index = 0; return current.map((game) => game.status === 'up-next' ? queue[index++] : game) })
    flash('Queue reordered')
  }
  function resetDemo() { if (!window.confirm('Reset Checkpoint to the original demo games?')) return; setGames(initialGames); localStorage.removeItem(STORAGE_KEY); flash('Demo data restored') }
  async function handleSignIn() {
    setAuthBusy(true)
    setAuthError(null)
    try { await signInWithGoogle() }
    catch { setAuthError('Google sign-in did not finish. Please try again.') }
    finally { setAuthBusy(false) }
  }
  async function copyBoardLink() {
    try { await navigator.clipboard.writeText(window.location.href); flash('Private board link copied') }
    catch { flash('Copy the current address to invite your group') }
  }

  if (firebaseConfigured && !authReady) return <LoadingScreen />
  if (firebaseConfigured && !user) return <SignInScreen loading={authBusy} error={authError} onSignIn={handleSignIn} />

  const syncLabel = syncStatus === 'live' ? 'Shared live' : syncStatus === 'connecting' ? 'Connecting…' : syncStatus === 'error' ? 'Sync needs attention' : 'Saved on this device'

  return (
    <CurrentUserContext.Provider value={currentUser}>
    <MembersContext.Provider value={groupMembers}>
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" type="button" onClick={() => setView('dashboard')}><span className="brand-mark"><Flag size={21} fill="currentColor" /></span><span>checkpoint</span></button>
        <div className="server-switcher"><div className="server-icon"><Gamepad2 size={18} /></div><div><strong>Friday Night Crew</strong><span>{groupMembers.length} {groupMembers.length === 1 ? 'player' : 'players'}</span></div><ChevronDown size={16} /></div>
        <nav className="main-nav" aria-label="Main navigation">
          <button className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}><LayoutDashboard size={19} /><span>Home</span></button>
          <button className={view === 'library' ? 'active' : ''} onClick={() => setView('library')}><Library size={19} /><span>Game library</span><b>{games.length}</b></button>
          <button onClick={() => { setView('library'); setLibraryFilter('up-next') }}><BookOpen size={19} /><span>Up next</span><b>{upNext.length}</b></button>
          <button onClick={() => flash(`${groupMembers.length} players have joined this private board`)}><Users size={19} /><span>Players</span></button>
        </nav>
        <div className="sidebar-section"><span className="sidebar-label">Quick filters</span>
          <button onClick={() => { setView('library'); setLibraryFilter('playing') }}><span className="nav-dot purple" />Playing</button>
          <button onClick={() => { setView('library'); setLibraryFilter('maybe') }}><span className="nav-dot amber" />Maybe</button>
          <button onClick={() => { setView('library'); setLibraryFilter('wishlist') }}><span className="nav-dot pink" />Wishlist</button>
          <button onClick={() => { setView('library'); setLibraryFilter('completed') }}><span className="nav-dot green" />Completed</button>
        </div>
        <div className="sidebar-bottom">{firebaseConfigured ? <button onClick={() => signOut()}><LogOut size={18} /><span>Sign out</span></button> : <button onClick={resetDemo}><Settings size={18} /><span>Reset demo</span></button>}<button onClick={() => flash('Tip: drag games in Up next to reorder them')}><CircleHelp size={18} /><span>Help & tips</span></button><div className="profile-row"><Avatar id={currentUser} /><div><strong>{user?.displayName?.split(' ')[0] ?? 'Kyle'}</strong><span>Online</span></div><MoreHorizontal size={17} /></div></div>
      </aside>

      <main className="main-area">
        <header className="topbar"><div className="mobile-brand"><span className="brand-mark"><Flag size={18} fill="currentColor" /></span>checkpoint</div>
          <label className="search-box"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} onFocus={() => setView('library')} placeholder="Search your games" /><kbd>⌘ K</kbd></label>
          <div className="topbar-actions"><button className="icon-button notification" type="button" onClick={() => flash('You’re all caught up')} aria-label="Notifications"><Bell size={19} /><span /></button><div className="member-stack">{groupMembers.map((member) => <Avatar id={member.id} small key={member.id} />)}</div><button className="button button-primary add-button" type="button" onClick={() => setShowAdd(true)}><Plus size={18} /><span>Add game</span></button></div>
        </header>

        {view === 'dashboard' ? <div className="page dashboard-page">
          <div className="page-title-row"><div><span className="eyebrow">Wednesday, August 26</span><h1>Good evening, crew.</h1><p>One campaign in progress, and a very competitive queue.</p></div><button className={`sync-chip sync-${syncStatus}`} onClick={copyBoardLink} type="button"><span /><strong>{syncLabel}</strong>{syncStatus === 'live' && <Share2 size={13} />}</button></div>
          <section className="dashboard-grid">
            <div className="now-playing-panel"><div className="section-heading inverse"><div><span className="eyebrow">Continue playing</span><h2>Current campaign</h2></div><button className="ghost-icon" onClick={() => playing && setSelectedId(playing.id)}><MoreHorizontal size={20} /></button></div>
              {playing ? <div className="playing-content"><Cover game={playing} size="large" /><div className="playing-copy"><div className="live-pill"><span /> In progress</div><h2>{playing.title}</h2><p className="playing-meta">{playing.genre} <i /> {playing.platform} <i /> {playing.year}</p>
                <div className="progress-block"><div><span>Group progress</span><strong>{playing.progress}%</strong></div><div className="progress-track"><span style={{ width: `${playing.progress}%` }} /></div></div>
                <div className="session-note"><NotebookPen size={18} /><div><span>Last session note</span><p>{playing.note}</p></div></div>
                <div className="playing-actions"><button className="button button-light" onClick={() => setSelectedId(playing.id)}><Sparkles size={17} /> Update progress</button><button className="button button-dark-ghost" onClick={() => setSelectedId(playing.id)}>View details</button></div>
              </div></div> : <button className="empty-playing" onClick={() => setShowAdd(true)}><Plus size={24} /> Choose a game to start</button>}
              <div className="playing-footer"><div className="member-stack inverse-stack">{groupMembers.map((member) => <Avatar id={member.id} small key={member.id} />)}</div><span>Everyone is playing</span><div className="footer-spacer" /><Clock3 size={16} /><span>{playing?.hours ?? 0} hours logged</span></div>
            </div>
            <div className="queue-panel"><div className="section-heading"><div><span className="eyebrow">The shortlist</span><h2>Up next</h2></div><button className="text-button" onClick={() => { setView('library'); setLibraryFilter('up-next') }}>View all</button></div><p className="queue-hint"><GripVertical size={14} /> Drag to set the official play order. Votes stay separate.</p><div className="queue-list">
              {upNext.slice(0, 4).map((game, index) => <QueueItem game={game} rank={index + 1} key={game.id} onVote={() => vote(game.id)} onOpen={() => setSelectedId(game.id)} onDragStart={(event) => event.dataTransfer.setData('text/plain', game.id)} onDrop={(event) => reorderQueue(event.dataTransfer.getData('text/plain'), game.id)} />)}
              </div><button className="queue-add" type="button" onClick={() => setShowAdd(true)}><Plus size={17} /> Add another contender</button></div>
          </section>
          <section className="lower-section"><div className="section-heading"><div><span className="eyebrow">Worth a look</span><h2>On the radar</h2></div><button className="filter-button" onClick={() => setView('library')}><ListFilter size={16} /> Browse library</button></div><div className="radar-grid">
            {games.filter((game) => game.status === 'maybe' || game.status === 'wishlist').slice(0, 4).map((game) => <LibraryCard game={game} key={game.id} onOpen={() => setSelectedId(game.id)} onVote={() => vote(game.id)} />)}
            <button className="radar-add" type="button" onClick={() => setShowAdd(true)}><span><Plus size={21} /></span><strong>Add to the radar</strong><small>Suggest something new</small></button>
          </div></section>
          <section className="stats-strip"><div><span className="stat-icon purple-bg"><Gamepad2 size={20} /></span><p><strong>{games.length}</strong><span>Games tracked</span></p></div><div><span className="stat-icon amber-bg"><Heart size={20} /></span><p><strong>{games.reduce((sum, game) => sum + game.votes.length, 0)}</strong><span>Votes cast</span></p></div><div><span className="stat-icon green-bg"><Trophy size={20} /></span><p><strong>{games.filter((game) => game.status === 'completed').length}</strong><span>Games finished</span></p></div><div><span className="stat-icon blue-bg"><Users size={20} /></span><p><strong>{groupMembers.length}</strong><span>Players synced</span></p></div></section>
        </div> : <div className="page library-page">
          <div className="page-title-row library-title-row"><div><span className="eyebrow">The collection</span><h1>Game library</h1><p>Every campaign, contender, and completed adventure in one place.</p></div><button className="button button-primary" onClick={() => setShowAdd(true)}><Plus size={18} /> Add game</button></div>
          <div className="filter-tabs">{([['all', 'All games'], ...Object.entries(statusLabels)] as [GameStatus | 'all', string][]).map(([value, label]) => <button key={value} className={libraryFilter === value ? 'active' : ''} onClick={() => setLibraryFilter(value)}>{label}<span>{value === 'all' ? games.length : games.filter((game) => game.status === value).length}</span></button>)}</div>
          {filteredGames.length ? <div className="library-grid">{filteredGames.map((game) => <LibraryCard game={game} key={game.id} onOpen={() => setSelectedId(game.id)} onVote={() => vote(game.id)} />)}</div> : <div className="empty-state"><Search size={28} /><h2>No games found</h2><p>Try another search or add a new game.</p><button className="button button-primary" onClick={() => setShowAdd(true)}>Add game</button></div>}
        </div>}
        <nav className="mobile-nav" aria-label="Mobile navigation"><button className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}><LayoutDashboard size={20} /><span>Home</span></button><button className={view === 'library' ? 'active' : ''} onClick={() => setView('library')}><Library size={20} /><span>Library</span></button><button className="mobile-add" onClick={() => setShowAdd(true)}><Plus size={23} /></button><button onClick={() => { setView('library'); setLibraryFilter('up-next') }}><BookOpen size={20} /><span>Queue</span></button><button onClick={() => flash(`${groupMembers.length} players have joined this board`)}><Users size={20} /><span>Players</span></button></nav>
      </main>
      {showAdd && <AddGameModal onClose={() => setShowAdd(false)} onAdd={addGame} />}
      {selected && <GameDetailsModal game={selected} onClose={() => setSelectedId(null)} onVote={() => vote(selected.id)} onSave={(updates) => updateGame(selected.id, updates)} />}
      {toast && <div className="toast"><Check size={17} /> {toast}</div>}
    </div>
    </MembersContext.Provider>
    </CurrentUserContext.Provider>
  )
}
export default App
