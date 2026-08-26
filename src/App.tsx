import {
  Bell, BookOpen, Camera, Check, ChevronDown, CircleHelp, Clock3, Flag, Gamepad2,
  GripVertical, Heart, LayoutDashboard, Library, ListFilter, MoreHorizontal,
  LogOut, NotebookPen, Plus, Puzzle, Search, Settings, Share2, Sparkles, Trash2, Trophy, Users, X,
} from 'lucide-react'
import {
  createContext, useContext, useEffect, useMemo, useRef, useState,
  type CSSProperties, type DragEvent, type FormEvent,
} from 'react'
import type { User } from 'firebase/auth'
import './App.css'
import { initialGames, members, statusLabels } from './data'
import type { ContentType, Game, GameStatus, Member, Persona } from './types'
import { firebaseConfigured, signInWithGoogle, signOut, watchAuth } from './lib/firebase'
import { searchGames, type GameSearchResult } from './lib/gameSearch'
import { connectBoard, getBoardId, getExistingPersona, type BoardConnection } from './lib/sharedBoard'

const STORAGE_KEY = 'checkpoint-games-v1'
const DEMO_USER = 'local-player'
const NERN_EMAIL = 'kjsparsons@gmail.com'
const REMNANT_CLEANUP_KEY = 'checkpoint-cleanup-remnant-v1'
const LEGACY_PLACEHOLDER_IDS = new Set([
  'split-fiction', 'clair-obscur', 'monster-hunter', 'remnant-ii', 'sea-of-stars',
  'hades-ii', 'blue-prince', 'silksong', 'it-takes-two',
])
const LEGACY_REMNANT_TITLES = new Set(['remnant', 'remnant ii', 'remnant 2'])
type View = 'dashboard' | 'library'
type SyncStatus = 'local' | 'connecting' | 'live' | 'error'

const CurrentUserContext = createContext(DEMO_USER)
const MembersContext = createContext<Member[]>(members)
const GamesContext = createContext<Game[]>([])

function getStoredGames() {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    const stored = value ? (JSON.parse(value) as Game[]) : initialGames
    return stored.filter((game) => !LEGACY_PLACEHOLDER_IDS.has(game.id))
  } catch {
    return initialGames
  }
}

function cleanRemoteGames(games: Game[]) {
  const withoutPlaceholders = games.filter((game) => !LEGACY_PLACEHOLDER_IDS.has(game.id))
  if (localStorage.getItem(REMNANT_CLEANUP_KEY)) return withoutPlaceholders
  const cleaned = withoutPlaceholders.filter((game) => {
    const normalizedTitle = game.title.trim().toLowerCase()
    return game.catalogSource === 'steam' || !LEGACY_REMNANT_TITLES.has(normalizedTitle)
  })
  localStorage.setItem(REMNANT_CLEANUP_KEY, 'done')
  return cleaned
}

function directArtworkUrls(game?: Game) {
  if (!game) return []
  const steamUrls = game.steamAppId ? [
    `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${game.steamAppId}/library_600x900_2x.jpg`,
    `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${game.steamAppId}/library_600x900.jpg`,
    `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${game.steamAppId}/header.jpg`,
  ] : []
  return [...new Set([...steamUrls, game.coverUrl].filter((url): url is string => Boolean(url)))]
}

function gameArtworkUrls(game: Game, games: Game[]) {
  const parentGame = game.contentType === 'dlc' && game.parentGameId
    ? games.find((candidate) => candidate.id === game.parentGameId)
    : undefined
  return [...new Set([...directArtworkUrls(game), ...directArtworkUrls(parentGame)])]
}

async function resizeProfileImage(file: File) {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.')
  if (file.size > 10 * 1024 * 1024) throw new Error('Choose an image smaller than 10 MB.')
  const objectUrl = URL.createObjectURL(file)
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('That image could not be opened.'))
      image.src = objectUrl
    })
    const size = Math.min(256, Math.max(image.naturalWidth, image.naturalHeight))
    const scale = size / Math.max(image.naturalWidth, image.naturalHeight)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('That image could not be processed.')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', .82)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function Cover({ game, size = 'medium' }: { game: Game; size?: 'small' | 'medium' | 'large' }) {
  const games = useContext(GamesContext)
  const style = { '--cover-color': game.color, '--cover-accent': game.accent } as CSSProperties
  const artworkUrls = gameArtworkUrls(game, games)
  return (
    <div className={`game-cover cover-${size}`} style={style} aria-hidden="true">
      <span className="cover-orbit" /><span className="cover-mark">{game.coverMark}</span>
      {artworkUrls[0] && <img className="game-cover-image" src={artworkUrls[0]} alt="" data-art-index="0" onError={(event) => {
        const nextIndex = Number(event.currentTarget.dataset.artIndex ?? '0') + 1
        const nextUrl = artworkUrls[nextIndex]
        if (!nextUrl) { event.currentTarget.style.display = 'none'; return }
        event.currentTarget.dataset.artIndex = String(nextIndex)
        event.currentTarget.src = nextUrl
      }} />}
      {game.year && <span className="cover-year">{game.year}</span>}
    </div>
  )
}

function Avatar({ id, small = false }: { id: string; small?: boolean }) {
  const activeMembers = useContext(MembersContext)
  const member = activeMembers.find((item) => item.id === id) ?? members.find((item) => item.id === id) ?? { id, name: 'Player', initials: '?', color: '#7568e8', photoUrl: undefined }
  return <span className={`avatar ${small ? 'avatar-small' : ''}`} style={{ background: member.color }} title={member.name}>{member.photoUrl ? <img src={member.photoUrl} alt="" /> : member.initials}</span>
}

function CrewModal({ members: crew, currentUserId, googlePhotoUrl, onClose, onSavePhoto }: {
  members: Member[]
  currentUserId: string
  googlePhotoUrl?: string | null
  onClose: () => void
  onSavePhoto: (photoUrl: string | null) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const currentMember = crew.find((member) => member.id === currentUserId)

  async function saveFile(file?: File) {
    if (!file) return
    setSaving(true)
    setError(null)
    try {
      await onSavePhoto(await resizeProfileImage(file))
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Your profile image could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  async function useGooglePhoto() {
    setSaving(true)
    setError(null)
    try { await onSavePhoto(null) }
    catch { setError('Your Google profile image could not be restored.') }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="modal crew-modal" onMouseDown={(event) => event.stopPropagation()} aria-modal="true" role="dialog">
        <div className="modal-heading"><div><span className="eyebrow">Checkpoint Crew</span><h2>{crew.length} {crew.length === 1 ? 'player' : 'players'} synced</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close"><X size={19} /></button></div>
        <div className="crew-auto-note"><Users size={18} /><div><strong>Joining is automatic</strong><p>Nern, Jern, and Vern appear here as soon as they sign in and choose their crew name.</p></div></div>
        <div className="crew-list">{crew.map((member) => <div className="crew-member" key={member.id}><Avatar id={member.id} /><div><strong>{member.name}</strong><span>{member.id === currentUserId ? 'You · online' : 'Crew member'}</span></div></div>)}</div>
        {currentMember && <div className="profile-image-panel"><div className="profile-image-preview"><Avatar id={currentUserId} /><div><strong>Your profile image</strong><span>{currentMember.customPhotoUrl ? 'Custom image' : googlePhotoUrl ? 'From Google' : 'Crew initials'}</span></div></div><div className="profile-image-actions">
          <label className={`button button-secondary ${saving ? 'is-disabled' : ''}`}><Camera size={16} /> {saving ? 'Saving…' : 'Upload custom'}<input type="file" accept="image/*" disabled={saving} onChange={(event) => { void saveFile(event.target.files?.[0]); event.currentTarget.value = '' }} /></label>
          {googlePhotoUrl && currentMember.customPhotoUrl && <button className="button button-secondary" type="button" onClick={useGooglePhoto} disabled={saving}>Use Google photo</button>}
        </div>{error && <p className="profile-image-error">{error}</p>}</div>}
      </section>
    </div>
  )
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

function AddGameModal({ onClose, onAdd, games, defaultParentId }: { onClose: () => void; onAdd: (game: Game) => void; games: Game[]; defaultParentId?: string }) {
  const currentUser = useContext(CurrentUserContext)
  const [status, setStatus] = useState<GameStatus>(defaultParentId ? 'wishlist' : 'up-next')
  const [contentType, setContentType] = useState<ContentType>(defaultParentId ? 'dlc' : 'game')
  const [parentGameId, setParentGameId] = useState(defaultParentId ?? '')
  const [color, setColor] = useState('#5d51c8')
  const [title, setTitle] = useState('')
  const [selectedGame, setSelectedGame] = useState<GameSearchResult | null>(null)
  const [results, setResults] = useState<GameSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchFailed, setSearchFailed] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const colors = ['#5d51c8', '#176e87', '#b65f3e', '#486a55', '#8a3556', '#25324f']
  const baseGames = games.filter((game) => game.contentType !== 'dlc')

  useEffect(() => {
    const query = title.trim()
    if (query.length < 2 || selectedGame?.title === query) {
      setResults([])
      setSearching(false)
      setSearchFailed(false)
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setSearching(true)
      setSearchFailed(false)
      const parentGame = contentType === 'dlc' ? games.find((game) => game.id === parentGameId) : undefined
      const catalogQuery = parentGame ? `${parentGame.title}: ${query}` : query
      searchGames(catalogQuery, controller.signal, contentType)
        .then((matches) => { setResults(matches); setShowResults(true) })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === 'AbortError') return
          setSearchFailed(true)
        })
        .finally(() => setSearching(false))
    }, 320)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [contentType, games, parentGameId, title, selectedGame])

  function chooseGame(game: GameSearchResult) {
    setSelectedGame(game)
    setTitle(game.title)
    setShowResults(false)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const cleanTitle = title.trim()
    if (!cleanTitle) return
    const catalogGame = selectedGame ?? results.find((game) => game.title.trim().toLowerCase() === cleanTitle.toLowerCase())
    const parentGame = contentType === 'dlc' ? games.find((game) => game.id === parentGameId) : undefined
    const words = cleanTitle.split(/\s+/)
    const mark = words.length > 1 ? words.slice(0, 2).map((word) => word[0]).join('') : cleanTitle.slice(0, 2)
    onAdd({
      id: crypto.randomUUID(), title: cleanTitle, year: Number(form.get('year')) || undefined, status,
      progress: status === 'completed' ? 100 : 0, note: String(form.get('note') ?? '').trim(), votes: [],
      color, accent: '#f1c879', platform: String(form.get('platform') ?? 'PC'), addedBy: currentUser,
      genre: String(form.get('genre') ?? '').trim() || (contentType === 'dlc' ? 'DLC' : 'Game'), coverMark: mark.toUpperCase(), coverUrl: catalogGame?.coverUrl,
      steamAppId: catalogGame?.steamAppId, catalogId: catalogGame?.catalogId,
      catalogSource: catalogGame ? 'steam' : undefined, contentType,
      parentGameId: parentGame?.id, parentGameTitle: parentGame?.title,
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
          <div className="content-type-choice" role="group" aria-label="Content type"><button className={contentType === 'game' ? 'active' : ''} type="button" onClick={() => { setContentType('game'); setParentGameId('') }}><Gamepad2 size={17} /><span><strong>Full game</strong><small>Main campaign</small></span></button><button className={contentType === 'dlc' ? 'active' : ''} type="button" onClick={() => setContentType('dlc')}><Puzzle size={17} /><span><strong>DLC / expansion</strong><small>Track separately</small></span></button></div>
          {contentType === 'dlc' && <label className="field field-full"><span>Base game <em>optional</em></span><select value={parentGameId} onChange={(event) => setParentGameId(event.target.value)}><option value="">Not linked to a tracked game</option>{baseGames.map((game) => <option value={game.id} key={game.id}>{game.title}{game.status === 'completed' ? ' · completed' : ''}</option>)}</select></label>}
          <label className="field field-full game-search-field"><span>{contentType === 'dlc' ? 'DLC title' : 'Game title'}</span><input name="title" value={title} onChange={(event) => { setTitle(event.target.value); setSelectedGame(null); setShowResults(true) }} onFocus={() => setShowResults(true)} placeholder={contentType === 'dlc' ? 'Start typing a Steam DLC' : 'Start typing a Steam game'} autoComplete="off" autoFocus required />
            {showResults && title.trim().length >= 2 && <div className="game-search-results">
              {searching && <div className="game-search-message">Searching the game catalog…</div>}
              {!searching && searchFailed && <div className="game-search-message">Search is unavailable. You can still enter the title manually.</div>}
              {!searching && !searchFailed && results.map((game) => <button className="game-search-result" type="button" key={game.catalogId} onClick={() => chooseGame(game)}><span className="result-cover"><Gamepad2 size={16} /><img src={game.thumbnailUrl} alt="" data-fallback={game.coverUrl} onError={(event) => { const fallback = event.currentTarget.dataset.fallback; if (fallback && event.currentTarget.src !== fallback) { event.currentTarget.src = fallback; return } event.currentTarget.style.display = 'none' }} /></span><span><strong>{game.title}</strong><small>Steam {game.contentType === 'dlc' ? 'DLC' : 'game'} · artwork included</small></span><Plus size={16} /></button>)}
              {!searching && !searchFailed && !results.length && <div className="game-search-message">No catalog match yet. You can add this title manually.</div>}
            </div>}
            <small className={`catalog-credit ${selectedGame ? 'catalog-selected' : ''}`}>{selectedGame ? <><Check size={11} /> Steam artwork connected</> : <>Search uses the <a href="https://github.com/jsnli/SteamAppIDList" target="_blank" rel="noreferrer">Steam AppID catalog</a></>}</small>
          </label>
          <div className="form-grid">
            <label className="field"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value as GameStatus)}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="field"><span>Platform</span><select name="platform" defaultValue="PC"><option>PC</option><option>PlayStation</option><option>Xbox</option><option>Switch</option><option>Other</option></select></label>
            <label className="field"><span>Release year <em>optional</em></span><input name="year" inputMode="numeric" placeholder="2026" /></label>
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

function GameDetailsModal({ game, onClose, onSave, onVote, onRemove, onAddDlc }: { game: Game; onClose: () => void; onSave: (updates: Partial<Game>) => void; onVote: () => void; onRemove: () => void; onAddDlc: () => void }) {
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
        <div className="details-hero"><Cover game={game} size="large" /><div className="details-title"><div className="details-pills"><span className="status-pill">{statusLabels[game.status]}</span>{game.contentType === 'dlc' && <span className="content-pill"><Puzzle size={10} /> DLC</span>}</div><h2>{game.title}</h2><p>{game.contentType === 'dlc' && game.parentGameTitle ? `DLC for ${game.parentGameTitle} · ` : ''}{[game.year, game.genre, game.platform].filter(Boolean).join(' · ')}</p><div className="details-quick-actions"><VoteButton game={game} onVote={onVote} />{game.contentType !== 'dlc' && <button className="add-dlc-button" type="button" onClick={onAddDlc}><Puzzle size={14} /> Add DLC</button>}</div></div><button className="icon-button details-close" type="button" onClick={onClose} aria-label="Close"><X size={19} /></button></div>
        <form onSubmit={save} className="details-form">
          <div className="form-grid">
            <label className="field"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value as GameStatus)}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="field"><span>Progress · {progress}%</span><input className="range" type="range" min="0" max="100" value={progress} onChange={(event) => setProgress(Number(event.target.value))} /></label>
          </div>
          <label className="field field-full"><span>Shared notes</span><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} placeholder="Where did we leave off?" /></label>
          <div className="modal-actions"><button className="button button-danger" type="button" onClick={onRemove}><Trash2 size={16} /> Remove game</button><button className="button button-secondary" type="button" onClick={onClose}>Cancel</button><button className="button button-primary" type="submit">Save changes</button></div>
        </form>
      </section>
    </div>
  )
}

function QueueItem({ game, rank, onVote, onOpen, onDragStart, onDrop }: { game: Game; rank: number; onVote: () => void; onOpen: () => void; onDragStart: (event: DragEvent<HTMLDivElement>) => void; onDrop: (event: DragEvent<HTMLDivElement>) => void }) {
  return (
    <div className="queue-item" draggable onDragStart={onDragStart} onDragOver={(event) => event.preventDefault()} onDrop={onDrop} onClick={onOpen}>
      <button className="drag-handle" type="button" aria-label={`Drag ${game.title}`}><GripVertical size={17} /></button><span className="queue-rank">{rank}</span><Cover game={game} size="small" />
      <div className="queue-copy"><strong>{game.title}</strong><span>{game.contentType === 'dlc' && game.parentGameTitle ? `DLC for ${game.parentGameTitle}` : game.genre} · {game.platform}</span></div>
      <div className="queue-voters" aria-label={`${game.votes.length} votes`}>{game.votes.slice(0, 3).map((id) => <Avatar id={id} small key={id} />)}</div><VoteButton game={game} onVote={onVote} compact />
    </div>
  )
}

function LibraryCard({ game, onOpen, onVote }: { game: Game; onOpen: () => void; onVote: () => void }) {
  return (
    <article className="library-card" onClick={onOpen}><Cover game={game} size="medium" /><div className="library-card-copy">
      <div className="library-card-topline"><span className={`status-dot status-${game.status}`} /><span>{statusLabels[game.status]}</span>{game.contentType === 'dlc' && <span className="dlc-card-label"><Puzzle size={9} /> DLC</span>}<button className="more-button" type="button" aria-label="More options"><MoreHorizontal size={17} /></button></div>
      <h3>{game.title}</h3><p>{game.contentType === 'dlc' && game.parentGameTitle ? `DLC for ${game.parentGameTitle}` : game.genre} · {game.platform}</p>
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
    </main>
  )
}

function PersonaScreen({ user, onChoose }: { user: User; onChoose: (persona: Persona) => void }) {
  return (
    <main className="sign-in-screen identity-screen">
      <div className="sign-in-glow" />
      <section className="sign-in-card identity-card">
        <div className="sign-in-brand"><span className="brand-mark"><Flag size={22} fill="currentColor" /></span><strong>checkpoint</strong></div>
        <span className="eyebrow">One last checkpoint</span>
        <h1>Who are you?</h1>
        <p>You’re signed in as {user.email}. Pick your crew name so votes and games stay attached to you.</p>
        <div className="identity-options">
          {(['Jern', 'Vern'] as Persona[]).map((name) => <button key={name} type="button" onClick={() => onChoose(name)}><span>{name[0]}</span><strong>{name}</strong><small>Play as {name}</small></button>)}
        </div>
        <button className="identity-sign-out" type="button" onClick={() => signOut()}>Use a different Google account</button>
      </section>
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
  const [persona, setPersona] = useState<Persona | null>(firebaseConfigured ? null : 'Nern')
  const [personaReady, setPersonaReady] = useState(!firebaseConfigured)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [groupMembers, setGroupMembers] = useState<Member[]>(members)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(firebaseConfigured ? 'connecting' : 'local')
  const [view, setView] = useState<View>('dashboard')
  const [showAdd, setShowAdd] = useState(false)
  const [addParentId, setAddParentId] = useState<string | undefined>()
  const [showCrew, setShowCrew] = useState(false)
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
    let active = true
    if (!firebaseConfigured) {
      setPersona('Nern')
      setPersonaReady(true)
      return
    }
    if (!user) {
      setPersona(null)
      setPersonaReady(true)
      return
    }
    setPersonaReady(false)
    if (user.email?.toLowerCase() === NERN_EMAIL) {
      setPersona('Nern')
      localStorage.setItem(`checkpoint-persona:${user.uid}`, 'Nern')
      setPersonaReady(true)
      return
    }
    const stored = localStorage.getItem(`checkpoint-persona:${user.uid}`)
    getExistingPersona(boardId, user).then((existing) => {
      if (!active) return
      const resolved = existing ?? (stored === 'Jern' || stored === 'Vern' ? stored : null)
      setPersona(resolved)
      setPersonaReady(true)
    })
    return () => { active = false }
  }, [boardId, user])
  useEffect(() => {
    if (!firebaseConfigured || !user || !persona) return
    let active = true
    setSyncStatus('connecting')
    setGroupMembers((current) => {
      const optimisticMember: Member = { id: user.uid, name: persona, persona, initials: persona[0], color: '#a990e8', photoUrl: user.photoURL || undefined, googlePhotoUrl: user.photoURL || undefined }
      return current.some((member) => member.id === user.uid) ? current.map((member) => member.id === user.uid ? { ...member, ...optimisticMember } : member) : [...current, optimisticMember]
    })
    connectBoard(boardId, user, persona, initialGamesRef.current, (remoteGames, remoteMembers) => {
      if (!active) return
      lastSyncedRef.current = JSON.stringify(remoteGames)
      setGames(cleanRemoteGames(remoteGames))
      setGroupMembers(remoteMembers)
    }).then((connection) => {
      if (!active) { connection?.close(); return }
      connectionRef.current = connection
      setSyncStatus(connection ? 'live' : 'local')
    }).catch(() => { if (active) setSyncStatus('error') })
    return () => { active = false; connectionRef.current?.close(); connectionRef.current = null }
  }, [boardId, persona, user])
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
  function openAddGame(parent?: Game) { setAddParentId(parent?.id); setSelectedId(null); setShowAdd(true) }
  function closeAddGame() { setShowAdd(false); setAddParentId(undefined) }
  function addGame(game: Game) { setGames((current) => [...current, game]); closeAddGame(); flash(`${game.title} added to ${statusLabels[game.status]}`) }
  function updateGame(gameId: string, updates: Partial<Game>) { setGames((current) => current.map((game) => game.id === gameId ? { ...game, ...updates } : game)); setSelectedId(null); flash('Checkpoint updated') }
  function removeGame(game: Game) {
    if (!window.confirm(`Remove ${game.title} from the shared library? This cannot be undone.`)) return
    setGames((current) => current.filter((item) => item.id !== game.id))
    setSelectedId(null)
    flash(`${game.title} removed`)
  }
  function reorderQueue(sourceId: string, targetId: string) {
    if (sourceId === targetId) return
    setGames((current) => { const queue = current.filter((game) => game.status === 'up-next'); const from = queue.findIndex((game) => game.id === sourceId); const to = queue.findIndex((game) => game.id === targetId); if (from < 0 || to < 0) return current; const [moved] = queue.splice(from, 1); queue.splice(to, 0, moved); let index = 0; return current.map((game) => game.status === 'up-next' ? queue[index++] : game) })
    flash('Queue reordered')
  }
  function resetLocalBoard() { if (!window.confirm('Clear every game saved on this device?')) return; setGames([]); localStorage.removeItem(STORAGE_KEY); flash('Local board cleared') }
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

  async function saveProfileImage(customPhotoUrl: string | null) {
    if (!connectionRef.current) throw new Error('The shared board is still connecting.')
    await connectionRef.current.saveProfileImage(customPhotoUrl)
    const resolvedPhotoUrl = customPhotoUrl || user?.photoURL || undefined
    setGroupMembers((current) => current.map((member) => member.id === currentUser ? { ...member, photoUrl: resolvedPhotoUrl, customPhotoUrl: customPhotoUrl || undefined, googlePhotoUrl: user?.photoURL || member.googlePhotoUrl } : member))
    flash(customPhotoUrl ? 'Custom profile image saved' : 'Google profile image restored')
  }

  function choosePersona(nextPersona: Persona) {
    if (!user) return
    localStorage.setItem(`checkpoint-persona:${user.uid}`, nextPersona)
    setPersona(nextPersona)
  }

  if (firebaseConfigured && !authReady) return <LoadingScreen />
  if (firebaseConfigured && !user) return <SignInScreen loading={authBusy} error={authError} onSignIn={handleSignIn} />
  if (firebaseConfigured && user && !personaReady) return <LoadingScreen />
  if (firebaseConfigured && user && !persona) return <PersonaScreen user={user} onChoose={choosePersona} />

  const syncLabel = syncStatus === 'live' ? 'Shared live' : syncStatus === 'connecting' ? 'Connecting…' : syncStatus === 'error' ? 'Sync needs attention' : 'Saved on this device'
  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const dashboardSummary = playing ? 'Your current campaign and the crew’s ranked queue.' : 'Start with a game, then build the crew’s ranked queue.'

  return (
    <CurrentUserContext.Provider value={currentUser}>
    <MembersContext.Provider value={groupMembers}>
    <GamesContext.Provider value={games}>
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" type="button" onClick={() => setView('dashboard')}><span className="brand-mark"><Flag size={21} fill="currentColor" /></span><span>checkpoint</span></button>
        <button className="server-switcher" type="button" onClick={() => setShowCrew(true)}><div className="server-icon"><Gamepad2 size={18} /></div><div><strong>Checkpoint Crew</strong><span>{groupMembers.length} {groupMembers.length === 1 ? 'player' : 'players'}</span></div><ChevronDown size={16} /></button>
        <nav className="main-nav" aria-label="Main navigation">
          <button className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}><LayoutDashboard size={19} /><span>Home</span></button>
          <button className={view === 'library' ? 'active' : ''} onClick={() => setView('library')}><Library size={19} /><span>Game library</span><b>{games.length}</b></button>
          <button onClick={() => { setView('library'); setLibraryFilter('up-next') }}><BookOpen size={19} /><span>Up next</span><b>{upNext.length}</b></button>
          <button onClick={() => setShowCrew(true)}><Users size={19} /><span>Players</span></button>
        </nav>
        <div className="sidebar-section"><span className="sidebar-label">Quick filters</span>
          <button onClick={() => { setView('library'); setLibraryFilter('playing') }}><span className="nav-dot purple" />Playing</button>
          <button onClick={() => { setView('library'); setLibraryFilter('maybe') }}><span className="nav-dot amber" />Maybe</button>
          <button onClick={() => { setView('library'); setLibraryFilter('wishlist') }}><span className="nav-dot pink" />Wishlist</button>
          <button onClick={() => { setView('library'); setLibraryFilter('completed') }}><span className="nav-dot green" />Completed</button>
        </div>
        <div className="sidebar-bottom">{firebaseConfigured ? <button onClick={() => signOut()}><LogOut size={18} /><span>Sign out</span></button> : <button onClick={resetLocalBoard}><Settings size={18} /><span>Clear board</span></button>}<button onClick={() => flash('Tip: drag games in Up next to reorder them')}><CircleHelp size={18} /><span>Help & tips</span></button><div className="profile-row"><Avatar id={currentUser} /><div><strong>{persona ?? 'Player'}</strong><span>Online</span></div><MoreHorizontal size={17} /></div></div>
      </aside>

      <main className="main-area">
        <header className="topbar"><div className="mobile-brand"><span className="brand-mark"><Flag size={18} fill="currentColor" /></span>checkpoint</div>
          <label className="search-box"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} onFocus={() => setView('library')} placeholder="Search your games" /><kbd>⌘ K</kbd></label>
          <div className="topbar-actions"><button className="icon-button notification" type="button" onClick={() => flash('You’re all caught up')} aria-label="Notifications"><Bell size={19} /><span /></button><button className="member-stack member-stack-button" type="button" onClick={() => setShowCrew(true)} aria-label="Open Checkpoint Crew">{groupMembers.map((member) => <Avatar id={member.id} small key={member.id} />)}</button><button className="button button-primary add-button" type="button" onClick={() => openAddGame()}><Plus size={18} /><span>Add game</span></button></div>
        </header>

        {view === 'dashboard' ? <div className="page dashboard-page">
          <div className="page-title-row"><div><span className="eyebrow">{todayLabel}</span><h1>Good evening, crew.</h1><p>{dashboardSummary}</p></div><button className={`sync-chip sync-${syncStatus}`} onClick={copyBoardLink} type="button"><span /><strong>{syncLabel}</strong>{syncStatus === 'live' && <Share2 size={13} />}</button></div>
          <section className="dashboard-grid">
            <div className="now-playing-panel"><div className="section-heading inverse"><div><span className="eyebrow">Continue playing</span><h2>Current campaign</h2></div><button className="ghost-icon" onClick={() => playing && setSelectedId(playing.id)}><MoreHorizontal size={20} /></button></div>
              {playing ? <div className="playing-content"><Cover game={playing} size="large" /><div className="playing-copy"><div className="live-pill"><span /> In progress</div><h2>{playing.title}</h2><p className="playing-meta">{playing.contentType === 'dlc' && playing.parentGameTitle ? `DLC for ${playing.parentGameTitle} · ` : ''}{[playing.genre, playing.platform, playing.year].filter(Boolean).join(' · ')}</p>
                <div className="progress-block"><div><span>Group progress</span><strong>{playing.progress}%</strong></div><div className="progress-track"><span style={{ width: `${playing.progress}%` }} /></div></div>
                <div className="session-note"><NotebookPen size={18} /><div><span>Last session note</span><p>{playing.note}</p></div></div>
                <div className="playing-actions"><button className="button button-light" onClick={() => setSelectedId(playing.id)}><Sparkles size={17} /> Update progress</button><button className="button button-dark-ghost" onClick={() => setSelectedId(playing.id)}>View details</button></div>
              </div></div> : <button className="empty-playing" onClick={() => openAddGame()}><Plus size={24} /> Choose a game to start</button>}
              <div className="playing-footer"><div className="member-stack inverse-stack">{groupMembers.map((member) => <Avatar id={member.id} small key={member.id} />)}</div><span>{playing ? 'Crew campaign' : 'Ready when you are'}</span><div className="footer-spacer" />{playing && <><Clock3 size={16} /><span>{playing.hours ?? 0} hours logged</span></>}</div>
            </div>
            <div className="queue-panel"><div className="section-heading"><div><span className="eyebrow">The shortlist</span><h2>Up next</h2></div><button className="text-button" onClick={() => { setView('library'); setLibraryFilter('up-next') }}>View all</button></div><p className="queue-hint"><GripVertical size={14} /> Drag to set the official play order. Votes stay separate.</p><div className="queue-list">
              {upNext.slice(0, 4).map((game, index) => <QueueItem game={game} rank={index + 1} key={game.id} onVote={() => vote(game.id)} onOpen={() => setSelectedId(game.id)} onDragStart={(event) => event.dataTransfer.setData('text/plain', game.id)} onDrop={(event) => reorderQueue(event.dataTransfer.getData('text/plain'), game.id)} />)}
              </div><button className="queue-add" type="button" onClick={() => openAddGame()}><Plus size={17} /> Add another contender</button></div>
          </section>
          <section className="lower-section"><div className="section-heading"><div><span className="eyebrow">Worth a look</span><h2>On the radar</h2></div><button className="filter-button" onClick={() => setView('library')}><ListFilter size={16} /> Browse library</button></div><div className="radar-grid">
            {games.filter((game) => game.status === 'maybe' || game.status === 'wishlist').slice(0, 4).map((game) => <LibraryCard game={game} key={game.id} onOpen={() => setSelectedId(game.id)} onVote={() => vote(game.id)} />)}
            <button className="radar-add" type="button" onClick={() => openAddGame()}><span><Plus size={21} /></span><strong>Add to the radar</strong><small>Suggest something new</small></button>
          </div></section>
          <section className="stats-strip"><div><span className="stat-icon purple-bg"><Gamepad2 size={20} /></span><p><strong>{games.length}</strong><span>Games tracked</span></p></div><div><span className="stat-icon amber-bg"><Heart size={20} /></span><p><strong>{games.reduce((sum, game) => sum + game.votes.length, 0)}</strong><span>Votes cast</span></p></div><div><span className="stat-icon green-bg"><Trophy size={20} /></span><p><strong>{games.filter((game) => game.status === 'completed').length}</strong><span>Games finished</span></p></div><div><span className="stat-icon blue-bg"><Users size={20} /></span><p><strong>{groupMembers.length}</strong><span>Players synced</span></p></div></section>
        </div> : <div className="page library-page">
          <div className="page-title-row library-title-row"><div><span className="eyebrow">The collection</span><h1>Game library</h1><p>Every campaign, DLC, contender, and completed adventure in one place.</p></div><button className="button button-primary" onClick={() => openAddGame()}><Plus size={18} /> Add game</button></div>
          <div className="filter-tabs">{([['all', 'All games'], ...Object.entries(statusLabels)] as [GameStatus | 'all', string][]).map(([value, label]) => <button key={value} className={libraryFilter === value ? 'active' : ''} onClick={() => setLibraryFilter(value)}>{label}<span>{value === 'all' ? games.length : games.filter((game) => game.status === value).length}</span></button>)}</div>
          {filteredGames.length ? <div className="library-grid">{filteredGames.map((game) => <LibraryCard game={game} key={game.id} onOpen={() => setSelectedId(game.id)} onVote={() => vote(game.id)} />)}</div> : <div className="empty-state"><Search size={28} /><h2>No games found</h2><p>Try another search or add a new game.</p><button className="button button-primary" onClick={() => openAddGame()}>Add game</button></div>}
        </div>}
        <nav className="mobile-nav" aria-label="Mobile navigation"><button className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}><LayoutDashboard size={20} /><span>Home</span></button><button className={view === 'library' ? 'active' : ''} onClick={() => setView('library')}><Library size={20} /><span>Library</span></button><button className="mobile-add" onClick={() => openAddGame()}><Plus size={23} /></button><button onClick={() => { setView('library'); setLibraryFilter('up-next') }}><BookOpen size={20} /><span>Queue</span></button><button onClick={() => setShowCrew(true)}><Users size={20} /><span>Players</span></button></nav>
      </main>
      {showAdd && <AddGameModal onClose={closeAddGame} onAdd={addGame} games={games} defaultParentId={addParentId} />}
      {showCrew && <CrewModal members={groupMembers} currentUserId={currentUser} googlePhotoUrl={user?.photoURL} onClose={() => setShowCrew(false)} onSavePhoto={saveProfileImage} />}
      {selected && <GameDetailsModal game={selected} onClose={() => setSelectedId(null)} onVote={() => vote(selected.id)} onSave={(updates) => updateGame(selected.id, updates)} onRemove={() => removeGame(selected)} onAddDlc={() => openAddGame(selected)} />}
      {toast && <div className="toast"><Check size={17} /> {toast}</div>}
    </div>
    </GamesContext.Provider>
    </MembersContext.Provider>
    </CurrentUserContext.Provider>
  )
}
export default App
