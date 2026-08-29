import {
  BadgeDollarSign, Bell, BookOpen, BringToFront, CalendarDays, Camera, Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3, Crop, Eraser, ExternalLink,
  FilePlus, Flag, Gamepad2, GripVertical, Heart, ImagePlus, Images, LayoutDashboard, Library, Link2, ListFilter, MoreHorizontal,
  LogOut, Move, NotebookPen, Pencil, Plus, Puzzle, RefreshCw, RotateCcw, Search, SendToBack, Settings, Share2, Sparkles,
  ThumbsDown, ThumbsUp, Trash2, Trophy, Unlink, Users, X, ZoomIn, ZoomOut,
} from 'lucide-react'
import {
  createContext, useContext, useEffect, useMemo, useRef, useState,
  type ClipboardEvent as ReactClipboardEvent, type CSSProperties, type DragEvent, type FormEvent, type PointerEvent as ReactPointerEvent, type RefObject,
} from 'react'
import type { User } from 'firebase/auth'
import './App.css'
import { initialGames, members, statusLabels } from './data'
import type { ContentType, Game, GameDeal, GameNight, GameStatus, Member, Persona, PuzzleBoard, PuzzleImage, PuzzlePage, PuzzlePoint, PuzzleStroke, SteamAchievementSnapshot, SteamCrewSnapshot } from './types'
import { firebaseConfigured, signInWithGoogle, signOut, watchAuth } from './lib/firebase'
import { parseSteamStoreLink, resolveSteamStoreLink, searchGames, type GameSearchResult } from './lib/gameSearch'
import { connectBoard, getBoardId, getExistingPersona, type BoardConnection, type SteamProfile } from './lib/sharedBoard'
import { connectPuzzle, createEmptyPuzzleBoard, createPuzzlePage, normalizePuzzleBoard, type PuzzleConnection } from './lib/sharedPuzzle'
import { gameIntegrationsConfigured, loadGameAchievements, loadSteamCrew, resolveSteamProfile } from './lib/gameIntegrations'
import { loadCheapSharkDeals } from './lib/cheapShark'
import { manualOwnershipFor, ownershipForGame } from './lib/ownership'
import { syncGameNightToGoogleCalendar } from './lib/googleCalendar'

const STORAGE_KEY = 'checkpoint-games-v1'
const GAME_NIGHTS_STORAGE_KEY = 'checkpoint-game-nights-v1'
const DEMO_USER = 'local-player'
const NERN_EMAIL = 'kjsparsons@gmail.com'
const REMNANT_CLEANUP_KEY = 'checkpoint-cleanup-remnant-v1'
const LEGACY_PLACEHOLDER_IDS = new Set([
  'split-fiction', 'clair-obscur', 'monster-hunter', 'remnant-ii', 'sea-of-stars',
  'hades-ii', 'blue-prince', 'silksong', 'it-takes-two',
])
const LEGACY_REMNANT_TITLES = new Set(['remnant', 'remnant ii', 'remnant 2'])
type View = 'dashboard' | 'library' | 'calendar'
type SyncStatus = 'local' | 'connecting' | 'live' | 'error'
type SmartFilter = 'any' | 'everyone-owns' | 'needs-copy' | 'on-sale'

const CurrentUserContext = createContext(DEMO_USER)
const MembersContext = createContext<Member[]>(members)
const GamesContext = createContext<Game[]>([])
const IntegrationsContext = createContext<{
  boardId: string
  steam: SteamCrewSnapshot | null
  deals: Record<string, GameDeal>
  loading: boolean
  error: string | null
}>({ boardId: '', steam: null, deals: {}, loading: false, error: null })

function getStoredGames() {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    const stored = value ? (JSON.parse(value) as Game[]) : initialGames
    return stored.filter((game) => !LEGACY_PLACEHOLDER_IDS.has(game.id))
  } catch {
    return initialGames
  }
}

function getStoredGameNights() {
  try {
    const value = localStorage.getItem(GAME_NIGHTS_STORAGE_KEY)
    return value ? JSON.parse(value) as GameNight[] : []
  } catch {
    return []
  }
}

function localDateValue(date: Date) {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return shifted.toISOString().slice(0, 10)
}

function localTimeValue(date: Date) {
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function dateTimeIso(date: string, time: string) {
  return new Date(`${date}T${time}`).toISOString()
}

function friendlyCalendarError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Google Calendar could not add this game night.'
  if (/has not been used|is disabled|accessnotconfigured/i.test(message)) return 'The Google Calendar API is not enabled for Checkpoint yet.'
  if (/permission|scope|access blocked|unauthorized|401/i.test(message)) return 'Google Calendar permission was not completed for this account.'
  return message
}

function gameNightCalendarState(gameNight: GameNight, crew: Member[]) {
  const responses = crew.map((member) => gameNight.responses[member.id])
  if (responses.some((response) => response?.status === 'declined' && (response.suggestedStartAt || response.suggestedEndAt))) return 'denied'
  if (crew.length && responses.every((response) => response?.status === 'accepted')) return 'approved'
  return 'pending'
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

async function resizePuzzleImage(file: File) {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.')
  if (file.size > 15 * 1024 * 1024) throw new Error('Choose an image smaller than 15 MB.')
  const objectUrl = URL.createObjectURL(file)
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('That image could not be opened.'))
      image.src = objectUrl
    })
    let scale = Math.min(1, 1400 / Math.max(image.naturalWidth, image.naturalHeight))
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
      const context = canvas.getContext('2d')
      if (!context) throw new Error('That image could not be processed.')
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', Math.max(.42, .78 - attempt * .055))
      if (dataUrl.length <= 180000) return { dataUrl, aspectRatio: image.naturalWidth / image.naturalHeight }
      scale *= .82
    }
    throw new Error('That image is too detailed to sync. Try a smaller screenshot.')
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

function formatPlaytime(minutes: number) {
  if (minutes < 60) return minutes ? `${minutes}m` : 'Not played'
  const hours = minutes / 60
  return `${hours >= 10 ? Math.round(hours) : hours.toFixed(1)}h`
}

function DealBadge({ game, compact = false }: { game: Game; compact?: boolean }) {
  const crew = useContext(MembersContext)
  const { deals, steam } = useContext(IntegrationsContext)
  const deal = game.steamAppId ? deals[game.steamAppId] : undefined
  const ownership = ownershipForGame(game, crew, steam)
  if (!deal || ownership.everyoneOwns) return null
  return <a className={`deal-badge ${compact ? 'is-compact' : ''}`} href={deal.dealUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} title={`View ${game.title} at ${deal.storeName}`}><BadgeDollarSign size={compact ? 12 : 14} /><strong>${deal.price.toFixed(2)}</strong><span>{deal.storeName}</span>{deal.savingsPercent >= 1 && <em>−{Math.round(deal.savingsPercent)}%</em>}<ExternalLink size={11} /></a>
}

function OwnershipBadge({ game, compact = false }: { game: Game; compact?: boolean }) {
  const crew = useContext(MembersContext)
  const { steam, loading } = useContext(IntegrationsContext)
  const ownership = ownershipForGame(game, crew, steam)
  if (!ownership.known.length && !game.steamAppId) return null
  if (!ownership.known.length && !ownership.linked.length) return null
  const label = loading && !steam && !ownership.known.length ? 'Checking Steam…' : ownership.everyoneOwns ? 'Everyone owns it' : `${ownership.owners.length}/${crew.length || 3} own`
  return <span className={`ownership-badge ${ownership.everyoneOwns ? 'is-complete' : ''} ${compact ? 'is-compact' : ''}`}><span className="owner-avatars">{ownership.owners.slice(0, 3).map((member) => <Avatar id={member.id} small key={member.id} />)}</span><span>{label}</span></span>
}

function CrewModal({ members: crew, currentUserId, googlePhotoUrl, integrationError, onClose, onSavePhoto, onResolveSteam, onSaveSteam }: {
  members: Member[]
  currentUserId: string
  googlePhotoUrl?: string | null
  integrationError: string | null
  onClose: () => void
  onSavePhoto: (photoUrl: string | null) => Promise<void>
  onResolveSteam: (profile: string) => Promise<SteamProfile>
  onSaveSteam: (profile: SteamProfile | null) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [steamInput, setSteamInput] = useState('')
  const [steamBusy, setSteamBusy] = useState(false)
  const [steamLinkError, setSteamLinkError] = useState<string | null>(null)
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

  async function linkSteam(event: FormEvent) {
    event.preventDefault()
    if (!steamInput.trim()) return
    setSteamBusy(true)
    setSteamLinkError(null)
    try {
      const profile = await onResolveSteam(steamInput.trim())
      await onSaveSteam(profile)
      setSteamInput('')
    } catch (nextError) {
      setSteamLinkError(nextError instanceof Error ? nextError.message : 'That Steam profile could not be linked.')
    } finally {
      setSteamBusy(false)
    }
  }

  async function unlinkSteam() {
    if (!window.confirm('Disconnect your Steam profile from Checkpoint?')) return
    setSteamBusy(true)
    setSteamLinkError(null)
    try { await onSaveSteam(null) }
    catch { setSteamLinkError('Your Steam profile could not be disconnected.') }
    finally { setSteamBusy(false) }
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
        {currentMember && <div className="steam-link-panel"><div className="steam-panel-heading"><span className="steam-mark"><Gamepad2 size={18} /></span><div><strong>Steam connection</strong><span>Ownership, playtime, recent games, and achievements</span></div></div>
          {currentMember.steamId ? <div className="linked-steam-profile">{currentMember.steamAvatarUrl ? <img src={currentMember.steamAvatarUrl} alt="" /> : <span><Gamepad2 size={18} /></span>}<div><strong>{currentMember.steamName || 'Steam profile'}</strong><a href={currentMember.steamProfileUrl} target="_blank" rel="noreferrer">View profile <ExternalLink size={11} /></a></div><button type="button" onClick={unlinkSteam} disabled={steamBusy}><Unlink size={14} /> Disconnect</button></div>
            : <form className="steam-link-form" onSubmit={linkSteam}><label><span>Your Steam profile link</span><div><Link2 size={16} /><input value={steamInput} onChange={(event) => setSteamInput(event.target.value)} placeholder="steamcommunity.com/id/your-name" autoComplete="url" /></div></label><button className="button button-primary" type="submit" disabled={steamBusy || !steamInput.trim()}>{steamBusy ? <RefreshCw className="spin" size={16} /> : <Link2 size={16} />} {steamBusy ? 'Connecting…' : 'Link Steam'}</button></form>}
          <p className="steam-privacy-note">Public Game details enable automatic tracking. Private profiles can set ownership manually inside each game. Checkpoint never receives your Steam password.</p>{(steamLinkError || integrationError) && <p className="profile-image-error">{steamLinkError || integrationError}</p>}
        </div>}
      </section>
    </div>
  )
}

const PUZZLE_COLORS = ['#f8f6ed', '#f2c94c', '#ff6b76', '#6ad8ff', '#8df0a9']
const MAX_PUZZLE_IMAGES = 6
const MAX_PUZZLE_IMAGE_DATA = 650000
type PuzzleTool = 'select' | 'crop' | 'draw' | 'erase'

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value))
}

function renderPuzzleCanvas(canvas: HTMLCanvasElement, strokes: PuzzleStroke[], preview: PuzzleStroke | null) {
  const bounds = canvas.getBoundingClientRect()
  const width = Math.max(1, bounds.width)
  const height = Math.max(1, bounds.height)
  const ratio = window.devicePixelRatio || 1
  const pixelWidth = Math.round(width * ratio)
  const pixelHeight = Math.round(height * ratio)
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth
    canvas.height = pixelHeight
  }
  const context = canvas.getContext('2d')
  if (!context) return
  context.setTransform(ratio, 0, 0, ratio, 0, 0)
  context.clearRect(0, 0, width, height)
  for (const stroke of preview ? [...strokes, preview] : strokes) {
    if (!stroke.points.length) continue
    context.beginPath()
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.strokeStyle = stroke.color
    context.lineWidth = stroke.width
    context.moveTo(stroke.points[0].x * width, stroke.points[0].y * height)
    for (const point of stroke.points.slice(1)) context.lineTo(point.x * width, point.y * height)
    if (stroke.points.length === 1) context.lineTo(stroke.points[0].x * width + .01, stroke.points[0].y * height + .01)
    context.stroke()
  }
}

function PuzzleCanvas({ strokes, tool, color, width, authorId, onAddStroke, onErase, onInteract }: {
  strokes: PuzzleStroke[]
  tool: 'draw' | 'erase'
  color: string
  width: number
  authorId: string
  onAddStroke: (stroke: PuzzleStroke) => void
  onErase: (point: PuzzlePoint) => void
  onInteract: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const previewPointsRef = useRef<PuzzlePoint[]>([])
  const [previewPoints, setPreviewPoints] = useState<PuzzlePoint[]>([])
  const [canvasSize, setCanvasSize] = useState(0)

  const preview = previewPoints.length ? { id: 'preview', color, width, points: previewPoints, authorId } : null

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    renderPuzzleCanvas(canvas, strokes, preview)
  }, [canvasSize, color, preview, strokes, width])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const observer = new ResizeObserver(() => setCanvasSize((value) => value + 1))
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  function pointFromEvent(event: ReactPointerEvent<HTMLCanvasElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
    }
  }

  function startStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    onInteract()
    drawingRef.current = true
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* Synthetic pointers may not support capture. */ }
    const point = pointFromEvent(event)
    if (tool === 'erase') { onErase(point); return }
    previewPointsRef.current = [point]
    setPreviewPoints([point])
  }

  function continueStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return
    const point = pointFromEvent(event)
    if (tool === 'erase') { onErase(point); return }
    setPreviewPoints((current) => {
      const last = current[current.length - 1]
      if (!last || current.length >= 1200) return current
      if (Math.hypot(point.x - last.x, point.y - last.y) < .002) return current
      const next = [...current, point]
      previewPointsRef.current = next
      return next
    })
  }

  function finishStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return
    drawingRef.current = false
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    } catch { /* The pointer may already have been released. */ }
    const finishedPoints = previewPointsRef.current
    if (tool === 'draw' && finishedPoints.length) {
      onAddStroke({ id: crypto.randomUUID(), color, width, points: finishedPoints, authorId })
    }
    previewPointsRef.current = []
    setPreviewPoints([])
  }

  return <canvas ref={canvasRef} className={`puzzle-canvas tool-${tool}`} aria-label="Shared puzzle drawing canvas"
    onPointerDown={startStroke} onPointerMove={continueStroke} onPointerUp={finishStroke} onPointerCancel={finishStroke} />
}

function PuzzleImageLayer({ image, selected, tool, stageRef, onSelect, onChange }: {
  image: PuzzleImage
  selected: boolean
  tool: PuzzleTool
  stageRef: RefObject<HTMLDivElement | null>
  onSelect: () => void
  onChange: (image: PuzzleImage) => void
}) {
  const gestureRef = useRef<{
    kind: 'move' | 'resize' | 'crop'
    clientX: number
    clientY: number
    image: PuzzleImage
    stageWidth: number
    stageHeight: number
  } | null>(null)

  function startGesture(event: ReactPointerEvent<HTMLElement>, kind: 'move' | 'resize' | 'crop') {
    if (tool !== 'select' && tool !== 'crop') return
    event.preventDefault()
    event.stopPropagation()
    onSelect()
    const bounds = stageRef.current?.getBoundingClientRect()
    if (!bounds) return
    gestureRef.current = {
      kind,
      clientX: event.clientX,
      clientY: event.clientY,
      image,
      stageWidth: Math.max(1, bounds.width),
      stageHeight: Math.max(1, bounds.height),
    }
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* Pointer capture is an enhancement. */ }
  }

  function moveGesture(event: ReactPointerEvent<HTMLElement>) {
    const gesture = gestureRef.current
    if (!gesture) return
    event.preventDefault()
    event.stopPropagation()
    const dx = (event.clientX - gesture.clientX) / gesture.stageWidth
    const dy = (event.clientY - gesture.clientY) / gesture.stageHeight
    if (gesture.kind === 'move') {
      onChange({
        ...gesture.image,
        x: clamp(gesture.image.x + dx, 0, 1 - gesture.image.width),
        y: clamp(gesture.image.y + dy, 0, 1 - gesture.image.height),
      })
    } else if (gesture.kind === 'resize') {
      onChange({
        ...gesture.image,
        width: clamp(gesture.image.width + dx, .1, 1 - gesture.image.x),
        height: clamp(gesture.image.height + dy, .1, 1 - gesture.image.y),
      })
    } else {
      onChange({
        ...gesture.image,
        cropX: clamp(gesture.image.cropX + dx * 3, -1, 1),
        cropY: clamp(gesture.image.cropY + dy * 3, -1, 1),
      })
    }
  }

  function finishGesture(event: ReactPointerEvent<HTMLElement>) {
    if (!gestureRef.current) return
    gestureRef.current = null
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    } catch { /* The pointer may already be released. */ }
  }

  const interactive = tool === 'select' || tool === 'crop'
  const imageStyle = {
    transform: `translate(${image.cropX * 14}%, ${image.cropY * 14}%) scale(${image.cropZoom})`,
  } as CSSProperties
  return (
    <div className={`puzzle-image-layer ${selected ? 'is-selected' : ''} ${tool === 'crop' && selected ? 'is-cropping' : ''}`}
      style={{ left: `${image.x * 100}%`, top: `${image.y * 100}%`, width: `${image.width * 100}%`, height: `${image.height * 100}%` }}
      onPointerDown={(event) => startGesture(event, tool === 'crop' && selected ? 'crop' : 'move')}
      onPointerMove={moveGesture} onPointerUp={finishGesture} onPointerCancel={finishGesture}
      aria-label={`${image.name}${selected ? ', selected' : ''}`}>
      <img src={image.dataUrl} alt="" draggable={false} style={imageStyle} />
      {interactive && selected && tool === 'select' && <button className="puzzle-image-resize" type="button" aria-label={`Resize ${image.name}`}
        onPointerDown={(event) => startGesture(event, 'resize')} onPointerMove={moveGesture} onPointerUp={finishGesture} onPointerCancel={finishGesture} />}
      {interactive && selected && <span className="puzzle-image-label">{tool === 'crop' ? 'Drag image to crop' : image.name}</span>}
    </div>
  )
}

function PuzzleBoardModal({ game, boardId, currentUserId, onClose }: {
  game: Game
  boardId: string
  currentUserId: string
  onClose: () => void
}) {
  const localKey = `checkpoint-puzzle:${boardId}:${game.id}`
  const [board, setBoard] = useState<PuzzleBoard>(() => {
    try {
      const stored = localStorage.getItem(localKey)
      if (stored) return normalizePuzzleBoard(JSON.parse(stored), currentUserId)
    } catch { /* Start with a fresh puzzle board. */ }
    return createEmptyPuzzleBoard(currentUserId)
  })
  const [activePageId, setActivePageId] = useState(board.pages[0].id)
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null)
  const [tool, setTool] = useState<PuzzleTool>('draw')
  const [color, setColor] = useState(PUZZLE_COLORS[1])
  const [brushWidth, setBrushWidth] = useState(4)
  const [hasUsedCanvas, setHasUsedCanvas] = useState(false)
  const [notePanelWidth, setNotePanelWidth] = useState(310)
  const [isResizingNotes, setIsResizingNotes] = useState(false)
  const [sync, setSync] = useState<'connecting' | 'live' | 'saving' | 'local' | 'error'>(firebaseConfigured ? 'connecting' : 'local')
  const [error, setError] = useState<string | null>(null)
  const connectionRef = useRef<PuzzleConnection | null>(null)
  const boardRef = useRef(board)
  const dirtyRef = useRef(false)
  const dirtyRevisionRef = useRef(0)
  const dirtyPageIdsRef = useRef(new Set<string>())
  const deletedPageIdsRef = useRef(new Set<string>())
  const structureDirtyRef = useRef(false)
  const resizingNotesRef = useRef(false)
  const stageRef = useRef<HTMLDivElement>(null)
  const activePage = board.pages.find((page) => page.id === activePageId) ?? board.pages[0]
  const selectedImage = activePage.images.find((image) => image.id === selectedImageId) ?? null

  useEffect(() => {
    const connection = connectPuzzle(boardId, game.id, (remoteBoard) => {
      if (dirtyRef.current) return
      boardRef.current = remoteBoard
      setBoard(remoteBoard)
      setActivePageId((current) => remoteBoard.pages.some((page) => page.id === current) ? current : remoteBoard.pages[0].id)
      try { localStorage.setItem(localKey, JSON.stringify(remoteBoard)) } catch { /* Firestore remains the primary copy. */ }
      setSync('live')
    }, () => setSync('error'))
    connectionRef.current = connection
    setSync(connection ? 'live' : 'local')
    return () => { connection?.close(); connectionRef.current = null }
  }, [boardId, game.id, localKey])

  useEffect(() => {
    boardRef.current = board
    try { localStorage.setItem(localKey, JSON.stringify(board)) } catch { setError('This browser could not keep a local puzzle backup.') }
    if (!dirtyRef.current) return
    const timer = window.setTimeout(() => {
      const connection = connectionRef.current
      if (!connection) { dirtyRef.current = false; setSync('local'); return }
      const savingBoard = board
      const savingRevision = dirtyRevisionRef.current
      const savingOptions = {
        pageIds: [...dirtyPageIdsRef.current],
        deletedPageIds: [...deletedPageIdsRef.current],
        structure: structureDirtyRef.current,
      }
      setSync('saving')
      connection.save(savingBoard, savingOptions).then(() => {
        if (dirtyRevisionRef.current === savingRevision) {
          dirtyRef.current = false
          dirtyPageIdsRef.current.clear()
          deletedPageIdsRef.current.clear()
          structureDirtyRef.current = false
        }
        setSync('live')
      }).catch(() => {
        setSync('error')
        setError('The puzzle is backed up here, but Firebase rejected the live update. Publish the latest Firestore rules.')
      })
    }, 280)
    return () => window.clearTimeout(timer)
  }, [board, localKey])

  function editBoard(change: (current: PuzzleBoard) => PuzzleBoard, pageIds: string[], structure = false, deletedPageIds: string[] = []) {
    setBoard((current) => {
      const next = change(current)
      if (next === current) return current
      dirtyRef.current = true
      dirtyRevisionRef.current += 1
      pageIds.forEach((pageId) => dirtyPageIdsRef.current.add(pageId))
      deletedPageIds.forEach((pageId) => deletedPageIdsRef.current.add(pageId))
      if (structure) structureDirtyRef.current = true
      return { ...next, updatedBy: currentUserId }
    })
  }

  function editActivePage(change: (page: PuzzlePage) => PuzzlePage) {
    editBoard((current) => ({
      ...current,
      pages: current.pages.map((page) => page.id === activePage.id ? change(page) : page),
    }), [activePage.id])
  }

  async function useImages(files: File[]) {
    if (!files.length) return
    setError(null)
    try {
      const remainingSlots = MAX_PUZZLE_IMAGES - activePage.images.length
      if (remainingSlots <= 0) throw new Error(`Each puzzle page can hold up to ${MAX_PUZZLE_IMAGES} images.`)
      const additions: PuzzleImage[] = []
      let imageDataSize = activePage.images.reduce((total, image) => total + image.dataUrl.length, 0)
      for (const file of files.slice(0, remainingSlots)) {
        const { dataUrl, aspectRatio } = await resizePuzzleImage(file)
        if (imageDataSize + dataUrl.length > MAX_PUZZLE_IMAGE_DATA) throw new Error('This page is full. Add another puzzle page for more screenshots.')
        imageDataSize += dataUrl.length
        const width = .52
        const height = clamp(width * (16 / 9) / Math.max(.2, aspectRatio), .2, .78)
        const offset = (activePage.images.length + additions.length) * .035
        additions.push({
          id: crypto.randomUUID(),
          name: file.name || 'Pasted puzzle',
          dataUrl,
          x: clamp(.08 + offset, 0, 1 - width),
          y: clamp(.08 + offset, 0, 1 - height),
          width,
          height,
          cropX: 0,
          cropY: 0,
          cropZoom: 1,
        })
      }
      if (!additions.length) return
      editActivePage((page) => ({ ...page, images: [...page.images, ...additions] }))
      setSelectedImageId(additions[additions.length - 1].id)
      setTool('select')
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'That puzzle image could not be added.')
    }
  }

  function handlePaste(event: ReactClipboardEvent<HTMLElement>) {
    const files = [...event.clipboardData.items]
      .filter((item) => item.type.startsWith('image/'))
      .flatMap((item, index) => {
        const file = item.getAsFile()
        return file ? [new File([file], `Pasted puzzle ${index + 1}.jpg`, { type: file.type })] : []
      })
    if (!files.length) return
    event.preventDefault()
    void useImages(files)
  }

  function eraseAt(point: PuzzlePoint) {
    editActivePage((page) => {
      const strokes = page.strokes.filter((stroke) => !stroke.points.some((candidate) => Math.hypot(candidate.x - point.x, candidate.y - point.y) < .028))
      return strokes.length === page.strokes.length ? page : { ...page, strokes }
    })
  }

  function editSelectedImage(change: (image: PuzzleImage) => PuzzleImage) {
    if (!selectedImage) return
    editActivePage((page) => ({ ...page, images: page.images.map((image) => image.id === selectedImage.id ? change(image) : image) }))
  }

  function removeSelectedImage() {
    if (!selectedImage || !window.confirm(`Remove “${selectedImage.name}”? Your drawing will stay.`)) return
    editActivePage((page) => ({ ...page, images: page.images.filter((image) => image.id !== selectedImage.id) }))
    setSelectedImageId(null)
    setTool('select')
  }

  function moveSelectedImage(direction: 'front' | 'back') {
    if (!selectedImage) return
    editActivePage((page) => {
      const images = page.images.filter((image) => image.id !== selectedImage.id)
      return { ...page, images: direction === 'front' ? [...images, selectedImage] : [selectedImage, ...images] }
    })
  }

  function addPage() {
    if (board.pages.length >= 20) { setError('A game can have up to 20 puzzle pages.'); return }
    const page = createPuzzlePage(`Puzzle ${board.pages.length + 1}`)
    editBoard((current) => ({ ...current, pages: [...current.pages, page] }), [page.id], true)
    setActivePageId(page.id)
    setSelectedImageId(null)
  }

  function renamePage() {
    const title = window.prompt('Puzzle page name', activePage.title)?.trim()
    if (!title || title === activePage.title) return
    editBoard((current) => ({
      ...current,
      pages: current.pages.map((page) => page.id === activePage.id ? { ...page, title: title.slice(0, 80) } : page),
    }), [activePage.id], true)
  }

  function deletePage() {
    if (board.pages.length === 1) { setError('Keep at least one puzzle page.'); return }
    if (!window.confirm(`Delete “${activePage.title}” and everything on that page?`)) return
    const nextPage = board.pages.find((page) => page.id !== activePage.id)
    editBoard((current) => ({ ...current, pages: current.pages.filter((page) => page.id !== activePage.id) }), [], true, [activePage.id])
    setActivePageId(nextPage?.id ?? board.pages[0].id)
    setSelectedImageId(null)
  }

  function resizeNotes(event: ReactPointerEvent<HTMLDivElement>) {
    if (!resizingNotesRef.current) return
    const layout = event.currentTarget.getBoundingClientRect()
    setNotePanelWidth(Math.max(240, Math.min(640, Math.round(layout.right - event.clientX))))
  }

  function stopResizingNotes() {
    if (!resizingNotesRef.current) return
    resizingNotesRef.current = false
    setIsResizingNotes(false)
  }

  const syncLabel = sync === 'live' ? 'Shared live' : sync === 'saving' ? 'Saving…' : sync === 'connecting' ? 'Connecting…' : sync === 'error' ? 'Local backup · sync needs rules' : 'Saved on this device'

  return (
    <div className="modal-backdrop puzzle-backdrop" onMouseDown={onClose}>
      <section className="modal puzzle-modal" onMouseDown={(event) => event.stopPropagation()} onPaste={handlePaste} aria-modal="true" role="dialog" tabIndex={-1}>
        <div className="modal-heading puzzle-heading"><div><span className="eyebrow">{game.title}</span><h2>Puzzle Board</h2><p>Layer screenshots, draw together, and keep a page for every puzzle.</p></div><div className={`puzzle-sync sync-${sync}`}><span />{syncLabel}</div><button className="icon-button" type="button" onClick={onClose} aria-label="Close"><X size={19} /></button></div>
        <div className="puzzle-pages"><div className="puzzle-page-tabs" role="tablist" aria-label="Puzzle pages">{board.pages.map((page) => <button key={page.id} type="button" role="tab" aria-selected={page.id === activePage.id} className={page.id === activePage.id ? 'active' : ''} onClick={() => { setActivePageId(page.id); setSelectedImageId(null) }}><Images size={13} />{page.title}</button>)}</div><button className="puzzle-page-action" type="button" onClick={addPage}><FilePlus size={14} /> New page</button><button className="puzzle-page-icon" type="button" onClick={renamePage} aria-label="Rename current puzzle page"><Pencil size={14} /></button><button className="puzzle-page-icon danger" type="button" onClick={deletePage} aria-label="Delete current puzzle page" disabled={board.pages.length === 1}><Trash2 size={14} /></button></div>
        <div className={`puzzle-layout ${isResizingNotes ? 'is-resizing' : ''}`} style={{ '--puzzle-notes-width': `${notePanelWidth}px` } as CSSProperties} onPointerMove={resizeNotes} onPointerUp={stopResizingNotes} onPointerCancel={stopResizingNotes}>
          <div className="puzzle-workspace">
            <div className="puzzle-toolbar">
              <label className="puzzle-tool upload-tool"><ImagePlus size={16} /> Add images<input type="file" accept="image/*" multiple onChange={(event) => { void useImages([...event.target.files ?? []]); event.currentTarget.value = '' }} /></label>
              <button className={`puzzle-tool ${tool === 'select' ? 'active' : ''}`} type="button" onClick={() => setTool('select')}><Move size={15} /> Arrange</button>
              <button className={`puzzle-tool ${tool === 'crop' ? 'active' : ''}`} type="button" onClick={() => setTool('crop')} disabled={!selectedImage}><Crop size={15} /> Crop</button>
              <button className={`puzzle-tool ${tool === 'draw' ? 'active' : ''}`} type="button" onClick={() => setTool('draw')}><Pencil size={15} /> Draw</button>
              <button className={`puzzle-tool ${tool === 'erase' ? 'active' : ''}`} type="button" onClick={() => setTool('erase')}><Eraser size={15} /> Erase</button>
              <span className="toolbar-divider" />
              {tool === 'crop' && selectedImage ? <div className="puzzle-crop-controls">
                <button type="button" onClick={() => editSelectedImage((image) => ({ ...image, cropZoom: clamp(image.cropZoom - .1, 1, 3) }))} aria-label="Zoom image out" disabled={selectedImage.cropZoom <= 1}><ZoomOut size={14} /></button>
                <input type="range" min="1" max="3" step=".05" value={selectedImage.cropZoom} aria-label="Image crop zoom" onChange={(event) => editSelectedImage((image) => ({ ...image, cropZoom: Number(event.target.value) }))} />
                <button type="button" onClick={() => editSelectedImage((image) => ({ ...image, cropZoom: clamp(image.cropZoom + .1, 1, 3) }))} aria-label="Zoom image in" disabled={selectedImage.cropZoom >= 3}><ZoomIn size={14} /></button>
                <button type="button" onClick={() => editSelectedImage((image) => ({ ...image, cropX: 0, cropY: 0, cropZoom: 1 }))}>Reset</button>
              </div> : <><div className="puzzle-colors" aria-label="Drawing color">{PUZZLE_COLORS.map((option) => <button type="button" key={option} className={color === option ? 'active' : ''} style={{ background: option }} onClick={() => { setColor(option); setTool('draw') }} aria-label={`Use ${option}`} />)}</div><select className="brush-size" value={brushWidth} onChange={(event) => setBrushWidth(Number(event.target.value))} aria-label="Brush size"><option value="2">Thin</option><option value="4">Medium</option><option value="8">Thick</option></select></>}
              <span className="toolbar-spacer" />
              {selectedImage && (tool === 'select' || tool === 'crop') && <><button className="puzzle-icon-tool" type="button" onClick={() => moveSelectedImage('back')} aria-label="Send selected image to back"><SendToBack size={16} /></button><button className="puzzle-icon-tool" type="button" onClick={() => moveSelectedImage('front')} aria-label="Bring selected image to front"><BringToFront size={16} /></button><button className="puzzle-icon-tool danger" type="button" onClick={removeSelectedImage} aria-label="Remove selected image"><Trash2 size={16} /></button></>}
              <button className="puzzle-icon-tool" type="button" onClick={() => editActivePage((page) => ({ ...page, strokes: page.strokes.slice(0, -1) }))} disabled={!activePage.strokes.length} aria-label="Undo last stroke"><RotateCcw size={16} /></button>
              <button className="puzzle-icon-tool danger" type="button" onClick={() => { if (activePage.strokes.length && window.confirm('Clear the shared drawing? Images will stay.')) editActivePage((page) => ({ ...page, strokes: [] })) }} disabled={!activePage.strokes.length} aria-label="Clear drawing"><Eraser size={16} /></button>
            </div>
            <div ref={stageRef} className={`puzzle-stage tool-${tool}`} onPointerDown={() => { if (tool === 'select' || tool === 'crop') setSelectedImageId(null) }}>
              {!activePage.images.length && !activePage.strokes.length && !hasUsedCanvas ? <div className="puzzle-empty"><ImagePlus size={28} /><strong>Add or paste puzzle screenshots</strong><span>Arrange several images, or draw on the blank board.</span></div> : null}
              {activePage.images.map((image) => <PuzzleImageLayer key={image.id} image={image} selected={image.id === selectedImageId} tool={tool} stageRef={stageRef} onSelect={() => setSelectedImageId(image.id)} onChange={(nextImage) => editActivePage((page) => ({ ...page, images: page.images.map((item) => item.id === image.id ? nextImage : item) }))} />)}
              <div className={`puzzle-canvas-layer ${tool === 'draw' || tool === 'erase' ? 'is-active' : ''}`}><PuzzleCanvas strokes={activePage.strokes} tool={tool === 'erase' ? 'erase' : 'draw'} color={color} width={brushWidth} authorId={currentUserId}
                onAddStroke={(stroke) => editActivePage((page) => ({ ...page, strokes: [...page.strokes.slice(-499), stroke] }))}
                onErase={eraseAt} onInteract={() => setHasUsedCanvas(true)} /></div>
            </div>
            <div className="puzzle-image-footer"><span>{activePage.title}</span><span>{activePage.images.length} {activePage.images.length === 1 ? 'image' : 'images'}</span><span>{activePage.strokes.length} {activePage.strokes.length === 1 ? 'stroke' : 'strokes'}</span><em>{selectedImage ? `Selected: ${selectedImage.name}` : tool === 'draw' ? 'Drawings stay when images are added or removed' : 'Tap an image to arrange it'}</em></div>
          </div>
          <div className="puzzle-resizer" role="separator" tabIndex={0} aria-label="Resize shared notes" aria-orientation="vertical" aria-valuemin={240} aria-valuemax={640} aria-valuenow={notePanelWidth}
            onPointerDown={(event) => { event.preventDefault(); resizingNotesRef.current = true; setIsResizingNotes(true); try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* The layout still tracks the drag without capture. */ } }}
            onLostPointerCapture={stopResizingNotes}
            onDoubleClick={() => setNotePanelWidth(310)} onKeyDown={(event) => { if (event.key === 'ArrowLeft') { event.preventDefault(); setNotePanelWidth((value) => Math.min(640, value + 16)) } else if (event.key === 'ArrowRight') { event.preventDefault(); setNotePanelWidth((value) => Math.max(240, value - 16)) } }}><GripVertical size={14} /></div>
          <aside className="puzzle-notes"><div><span className="eyebrow">{activePage.title} · shared notes</span><h3>Work it out together</h3><p>Each puzzle page has its own live notes, images, and drawing.</p></div><textarea value={activePage.note} maxLength={20000} onChange={(event) => editActivePage((page) => ({ ...page, note: event.target.value }))} placeholder="Codes, clues, theories, steps…" /><div className="puzzle-note-footer"><span>{activePage.note.length.toLocaleString()} / 20,000</span><span>Paste images anywhere in this window</span></div>{error && <p className="puzzle-error">{error}</p>}</aside>
        </div>
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
      const steamLink = parseSteamStoreLink(query)
      if (steamLink) {
        resolveSteamStoreLink(query, controller.signal, contentType)
          .then((match) => {
            if (!match) throw new Error('Steam link could not be resolved')
            chooseGame(match)
          })
          .catch((error: unknown) => {
            if (error instanceof DOMException && error.name === 'AbortError') return
            setSearchFailed(true)
          })
          .finally(() => setSearching(false))
        return
      }
      const parentGame = contentType === 'dlc' ? games.find((game) => game.id === parentGameId) : undefined
      const catalogQuery = parentGame ? `${parentGame.title}: ${query}` : query
      searchGames(catalogQuery, controller.signal, contentType)
        .then((matches) => { setResults(matches); setShowResults(true) })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === 'AbortError') return
          setSearchFailed(true)
        })
        .finally(() => setSearching(false))
    }, parseSteamStoreLink(query) ? 80 : 320)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [contentType, games, parentGameId, title, selectedGame])

  function chooseGame(game: GameSearchResult) {
    setSelectedGame(game)
    setTitle(game.title)
    setContentType(game.contentType)
    if (game.contentType === 'game') setParentGameId('')
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
          <label className="field field-full game-search-field"><span>{contentType === 'dlc' ? 'DLC title or Steam link' : 'Game title or Steam link'}</span><input name="title" value={title} onChange={(event) => { setTitle(event.target.value); setSelectedGame(null); setShowResults(true) }} onFocus={() => setShowResults(true)} placeholder={contentType === 'dlc' ? 'Type a DLC title or paste its Steam page' : 'Type a title or paste its Steam store page'} autoComplete="off" autoFocus required />
            {showResults && title.trim().length >= 2 && <div className="game-search-results">
              {searching && <div className="game-search-message">Searching the game catalog…</div>}
              {!searching && searchFailed && <div className="game-search-message">Search is unavailable. You can still enter the title manually.</div>}
              {!searching && !searchFailed && results.map((game) => <button className="game-search-result" type="button" key={game.catalogId} onClick={() => chooseGame(game)}><span className="result-cover"><Gamepad2 size={16} /><img src={game.thumbnailUrl} alt="" data-fallback={game.coverUrl} onError={(event) => { const fallback = event.currentTarget.dataset.fallback; if (fallback && event.currentTarget.src !== fallback) { event.currentTarget.src = fallback; return } event.currentTarget.style.display = 'none' }} /></span><span><strong>{game.title}</strong><small>Steam {game.contentType === 'dlc' ? 'DLC' : 'game'} · artwork included</small></span><Plus size={16} /></button>)}
              {!searching && !searchFailed && !results.length && <div className="game-search-message">No catalog match yet. You can add this title manually.</div>}
            </div>}
            <small className={`catalog-credit ${selectedGame ? 'catalog-selected' : ''}`}>{selectedGame ? <><Check size={11} /> Exact Steam AppID and artwork connected</> : <>Paste a Steam store URL to match the exact edition, or search the <a href="https://github.com/jsnli/SteamAppIDList" target="_blank" rel="noreferrer">Steam catalog</a></>}</small>
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

function ChangeGameModal({ game, onClose, onChange }: { game: Game; onClose: () => void; onChange: (updates: Partial<Game>) => void }) {
  const [title, setTitle] = useState(game.title)
  const [dirty, setDirty] = useState(false)
  const [selectedGame, setSelectedGame] = useState<GameSearchResult | null>(null)
  const [results, setResults] = useState<GameSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchFailed, setSearchFailed] = useState(false)
  const [showResults, setShowResults] = useState(false)

  useEffect(() => {
    const query = title.trim()
    if (!dirty || query.length < 2 || selectedGame?.title === query) {
      setResults([])
      setSearching(false)
      setSearchFailed(false)
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setSearching(true)
      setSearchFailed(false)
      const request = parseSteamStoreLink(query)
        ? resolveSteamStoreLink(query, controller.signal, game.contentType ?? 'game').then((match) => match ? [match] : [])
        : searchGames(query, controller.signal)
      request.then((matches) => { setResults(matches); setShowResults(true) })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === 'AbortError') return
          setSearchFailed(true)
        })
        .finally(() => setSearching(false))
    }, parseSteamStoreLink(query) ? 80 : 320)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [dirty, game.contentType, selectedGame, title])

  function chooseGame(nextGame: GameSearchResult) {
    setSelectedGame(nextGame)
    setTitle(nextGame.title)
    setShowResults(false)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const cleanTitle = title.trim()
    if (!cleanTitle) return
    const catalogGame = selectedGame ?? results.find((result) => result.title.trim().toLowerCase() === cleanTitle.toLowerCase())
    const nextType = catalogGame?.contentType ?? game.contentType ?? 'game'
    const words = cleanTitle.split(/\s+/)
    const coverMark = (words.length > 1 ? words.slice(0, 2).map((word) => word[0]).join('') : cleanTitle.slice(0, 2)).toUpperCase()
    onChange({
      title: cleanTitle,
      year: undefined,
      genre: nextType === 'dlc' ? 'DLC' : 'Game',
      coverMark,
      coverUrl: catalogGame?.coverUrl,
      steamAppId: catalogGame?.steamAppId,
      catalogId: catalogGame?.catalogId,
      catalogSource: catalogGame ? 'steam' : undefined,
      contentType: nextType,
      parentGameId: nextType === 'dlc' ? game.parentGameId : undefined,
      parentGameTitle: nextType === 'dlc' ? game.parentGameTitle : undefined,
      manualOwnership: {},
    })
  }

  return <div className="modal-backdrop" onMouseDown={onClose}><section className="modal change-game-modal" onMouseDown={(event) => event.stopPropagation()} aria-modal="true" role="dialog">
    <div className="modal-heading"><div><span className="eyebrow">Correct the game</span><h2>Change {game.title}</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close"><X size={19} /></button></div>
    <form onSubmit={submit}>
      <label className="field field-full game-search-field"><span>New game title or Steam link</span><input value={title} onChange={(event) => { setTitle(event.target.value); setDirty(true); setSelectedGame(null); setShowResults(true) }} onFocus={() => dirty && setShowResults(true)} placeholder="Type a title or paste its Steam store page" autoComplete="off" autoFocus required />
        {showResults && dirty && title.trim().length >= 2 && <div className="game-search-results">
          {searching && <div className="game-search-message">Searching the game catalog…</div>}
          {!searching && searchFailed && <div className="game-search-message">Search is unavailable. You can still save the title manually.</div>}
          {!searching && !searchFailed && results.map((result) => <button className="game-search-result" type="button" key={result.catalogId} onClick={() => chooseGame(result)}><span className="result-cover"><Gamepad2 size={16} /><img src={result.thumbnailUrl} alt="" data-fallback={result.coverUrl} onError={(event) => { const fallback = event.currentTarget.dataset.fallback; if (fallback && event.currentTarget.src !== fallback) { event.currentTarget.src = fallback; return } event.currentTarget.style.display = 'none' }} /></span><span><strong>{result.title}</strong><small>Steam {result.contentType === 'dlc' ? 'DLC' : 'game'} · artwork included</small></span><Check size={16} /></button>)}
          {!searching && !searchFailed && !results.length && <div className="game-search-message">No catalog match yet. You can still save this title manually.</div>}
        </div>}
        <small className={`catalog-credit ${selectedGame ? 'catalog-selected' : ''}`}>{selectedGame ? <><Check size={11} /> Exact Steam AppID and artwork connected</> : <>Choose a result for correct artwork, or paste the exact Steam store URL.</>}</small>
      </label>
      <div className="change-game-note"><RefreshCw size={16} /><p><strong>Your Checkpoint history stays attached.</strong><span>Status, progress, votes, notes, and puzzle pages remain. Old Steam ownership overrides are cleared for the corrected game.</span></p></div>
      <div className="modal-actions"><button className="button button-secondary" type="button" onClick={onClose}>Cancel</button><button className="button button-primary" type="submit" disabled={!dirty}><Pencil size={16} /> Save corrected game</button></div>
    </form>
  </section></div>
}

function SteamGamePanel({ game, onManualOwnershipChange }: { game: Game; onManualOwnershipChange: (memberId: string, owned: boolean | undefined) => void }) {
  const crew = useContext(MembersContext)
  const { boardId, steam, deals, loading, error } = useContext(IntegrationsContext)
  const [achievements, setAchievements] = useState<SteamAchievementSnapshot[]>([])
  const [achievementsLoading, setAchievementsLoading] = useState(false)
  const linked = crew.filter((member) => member.steamId)
  const ownership = ownershipForGame(game, crew, steam)
  const deal = game.steamAppId ? deals[game.steamAppId] : undefined

  useEffect(() => {
    if (!game.steamAppId || !linked.length || !gameIntegrationsConfigured) { setAchievements([]); return }
    const controller = new AbortController()
    setAchievementsLoading(true)
    loadGameAchievements(boardId, linked.flatMap((member) => member.steamId ? [member.steamId] : []), game.steamAppId, controller.signal)
      .then(setAchievements)
      .catch(() => setAchievements([]))
      .finally(() => setAchievementsLoading(false))
    return () => controller.abort()
  }, [boardId, game.steamAppId, linked.map((member) => member.steamId).join(',')])

  return <section className="steam-game-panel"><div className="steam-game-heading"><Gamepad2 size={18} /><div><strong>Crew ownership</strong><span>{loading ? 'Refreshing Steam…' : 'Set manually or use Steam when available'}</span></div>{ownership.everyoneOwns && <span className="everyone-owns-pill"><Check size={12} /> Everyone owns it</span>}</div>
    <div className="steam-crew-rows">{crew.map((member) => {
      const manual = manualOwnershipFor(game, member.id)
      const steamRecord = game.steamAppId && member.steamId ? steam?.ownership[game.steamAppId]?.[member.steamId] : undefined
      const achievement = member.steamId ? achievements.find((item) => item.steamId === member.steamId) : undefined
      const player = member.steamId ? steam?.players.find((item) => item.steamId === member.steamId) : undefined
      const isPrivate = Boolean(member.steamId && steam?.privateSteamIds.includes(member.steamId))
      const detail = typeof manual === 'boolean'
        ? manual ? 'Marked as owned manually' : 'Marked as not owned manually'
        : !game.steamAppId ? 'Ownership not set'
          : !member.steamId ? 'Steam not linked · choose manually'
            : isPrivate ? 'Steam Game details are private · choose manually'
              : !steamRecord ? loading ? 'Checking Steam library…' : 'Ownership not set'
                : steamRecord.owned ? `${formatPlaytime(steamRecord.playtimeMinutes)} played${steamRecord.lastPlayedAt ? ` · last played ${new Date(steamRecord.lastPlayedAt * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}` : 'Doesn’t own this · from Steam'
      return <div className="steam-crew-row" key={member.id}><Avatar id={member.id} /><div><strong>{member.name}</strong><span>{detail}</span>{player?.currentGameAppId === game.steamAppId && <em><span /> Playing now</em>}{steamRecord?.owned && <small className="steam-row-stat">{achievementsLoading && !achievement ? 'Achievements…' : achievement?.total ? `${achievement.unlocked}/${achievement.total} achievements` : 'No achievement data'}</small>}</div><label className={`manual-ownership-control ${typeof manual === 'boolean' ? 'is-manual' : ''}`}><span>Ownership</span><select aria-label={`${member.name} ownership`} value={typeof manual !== 'boolean' ? 'automatic' : manual ? 'owned' : 'not-owned'} onChange={(event) => onManualOwnershipChange(member.id, event.target.value === 'automatic' ? undefined : event.target.value === 'owned')}><option value="automatic">{steamRecord ? 'Use Steam' : 'Not set'}</option><option value="owned">Owns it</option><option value="not-owned">Doesn’t own it</option></select></label></div>
    })}</div>
    {deal && !ownership.everyoneOwns && <a className="details-deal" href={deal.dealUrl} target="_blank" rel="noreferrer"><span className="deal-icon"><BadgeDollarSign size={20} /></span><div><span>Lowest Steam-key price</span><strong>${deal.price.toFixed(2)} at {deal.storeName}</strong><small>{deal.savingsPercent >= 1 ? `${Math.round(deal.savingsPercent)}% off · ` : ''}Prices supplied by CheapShark</small></div><ExternalLink size={17} /></a>}
    <p className="steam-panel-message">Manual choices override Steam and sync for the whole crew.</p>{error && <p className="steam-panel-message is-error">{error}</p>}
  </section>
}

function GameDetailsModal({ game, onClose, onSave, onVote, onRemove, onChangeGame, onAddDlc, onOpenPuzzle, onManualOwnershipChange }: { game: Game; onClose: () => void; onSave: (updates: Partial<Game>) => void; onVote: () => void; onRemove: () => void; onChangeGame: () => void; onAddDlc: () => void; onOpenPuzzle: () => void; onManualOwnershipChange: (memberId: string, owned: boolean | undefined) => void }) {
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
        <div className="details-hero"><Cover game={game} size="large" /><div className="details-title"><div className="details-pills"><span className="status-pill">{statusLabels[game.status]}</span>{game.contentType === 'dlc' && <span className="content-pill"><Puzzle size={10} /> DLC</span>}</div><h2>{game.title}</h2><p>{game.contentType === 'dlc' && game.parentGameTitle ? `DLC for ${game.parentGameTitle} · ` : ''}{[game.year, game.genre, game.platform].filter(Boolean).join(' · ')}</p><div className="details-quick-actions"><VoteButton game={game} onVote={onVote} /><button className="change-game-button" type="button" onClick={onChangeGame}><RefreshCw size={14} /> Change game</button><button className="mobile-remove-game" type="button" onClick={onRemove}><Trash2 size={14} /> Remove game</button>{game.steamAppId && <a className="steam-store-button" href={`steam://store/${game.steamAppId}`}><Gamepad2 size={14} /> Open in Steam</a>}<button className="puzzle-board-button" type="button" onClick={onOpenPuzzle}><Pencil size={14} /> Puzzle Board</button>{game.contentType !== 'dlc' && <button className="add-dlc-button" type="button" onClick={onAddDlc}><Puzzle size={14} /> Add DLC</button>}</div></div><button className="icon-button details-close" type="button" onClick={onClose} aria-label="Close"><X size={19} /></button></div>
        <form onSubmit={save} className="details-form">
          <div className="form-grid">
            <label className="field"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value as GameStatus)}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="field"><span>Progress · {progress}%</span><input className="range" type="range" min="0" max="100" value={progress} onChange={(event) => setProgress(Number(event.target.value))} /></label>
          </div>
          <label className="field field-full"><span>Shared notes</span><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} placeholder="Where did we leave off?" /></label>
          <SteamGamePanel game={game} onManualOwnershipChange={onManualOwnershipChange} />
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
      <div className="queue-integrations"><OwnershipBadge game={game} compact /><DealBadge game={game} compact /></div><div className="queue-voters" aria-label={`${game.votes.length} votes`}>{game.votes.slice(0, 3).map((id) => <Avatar id={id} small key={id} />)}</div><VoteButton game={game} onVote={onVote} compact />
    </div>
  )
}

function LibraryCard({ game, onOpen, onVote }: { game: Game; onOpen: () => void; onVote: () => void }) {
  return (
    <article className="library-card" onClick={onOpen}><Cover game={game} size="medium" /><div className="library-card-copy">
      <div className="library-card-topline"><span className={`status-dot status-${game.status}`} /><span>{statusLabels[game.status]}</span>{game.contentType === 'dlc' && <span className="dlc-card-label"><Puzzle size={9} /> DLC</span>}<button className="more-button" type="button" aria-label="More options"><MoreHorizontal size={17} /></button></div>
      <h3>{game.title}</h3><p>{game.contentType === 'dlc' && game.parentGameTitle ? `DLC for ${game.parentGameTitle}` : game.genre} · {game.platform}</p>
      <div className="card-integrations"><OwnershipBadge game={game} compact /><DealBadge game={game} compact /></div>
      {game.status === 'playing' ? <div className="mini-progress"><span style={{ width: `${game.progress}%` }} /></div> : <div className="library-card-footer"><span>Added by <Avatar id={game.addedBy} small /></span><VoteButton game={game} onVote={onVote} compact /></div>}
    </div></article>
  )
}

function ScheduleGameNightModal({ games, defaultDate, onClose, onSchedule }: { games: Game[]; defaultDate?: string; onClose: () => void; onSchedule: (night: Omit<GameNight, 'id' | 'createdBy' | 'createdAt' | 'responses'>) => void }) {
  const initialStart = new Date()
  initialStart.setDate(initialStart.getDate() + (initialStart.getDay() === 5 ? 7 : (12 - initialStart.getDay()) % 7))
  initialStart.setHours(19, 0, 0, 0)
  const initialEnd = new Date(initialStart.getTime() + 3 * 60 * 60 * 1000)
  const [title, setTitle] = useState('Game Night')
  const [gameQuery, setGameQuery] = useState(() => games.find((game) => game.status === 'playing')?.title ?? '')
  const [date, setDate] = useState(defaultDate || localDateValue(initialStart))
  const [startTime, setStartTime] = useState(localTimeValue(initialStart))
  const [endTime, setEndTime] = useState(localTimeValue(initialEnd))
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    const startAt = dateTimeIso(date, startTime)
    const endAt = dateTimeIso(date, endTime)
    if (new Date(endAt) <= new Date(startAt)) {
      setError('End time needs to be later than the start time.')
      return
    }
    const selectedTitle = gameQuery.trim()
    const game = games.find((item) => item.title.localeCompare(selectedTitle, undefined, { sensitivity: 'accent' }) === 0)
    onSchedule({ title: title.trim() || 'Game Night', gameId: game?.id, gameTitle: game?.title || selectedTitle || undefined, startAt, endAt, note: note.trim() })
  }

  return <div className="modal-backdrop" onMouseDown={onClose}><section className="modal schedule-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
    <div className="modal-heading"><div><span className="eyebrow">Roll call</span><h2>Schedule a game night</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close"><X size={19} /></button></div>
    <form onSubmit={submit}>
      <label className="field field-full"><span>Event name</span><input value={title} maxLength={80} onChange={(event) => setTitle(event.target.value)} required /></label>
      <label className="field field-full"><span>Game <em>optional · type to search</em></span><input list="checkpoint-game-night-games" value={gameQuery} maxLength={140} onChange={(event) => setGameQuery(event.target.value)} placeholder="Start typing a game title or decide later" /><datalist id="checkpoint-game-night-games">{games.map((game) => <option key={game.id} value={game.title}>{statusLabels[game.status]}</option>)}</datalist></label>
      <div className="form-grid"><label className="field"><span>Day</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label><label className="field"><span>Starts</span><input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} required /></label><label className="field"><span>Ends</span><input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} required /></label></div>
      <label className="field field-full"><span>Details <em>optional</em></span><textarea rows={3} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Voice channel, what to bring, or the plan for the night…" /></label>
      {error && <p className="calendar-form-error">{error}</p>}
      <div className="modal-actions"><button className="button button-secondary" type="button" onClick={onClose}>Cancel</button><button className="button button-primary" type="submit"><CalendarDays size={17} /> Schedule</button></div>
    </form>
  </section></div>
}

function SuggestTimeModal({ gameNight, onClose, onSuggest }: { gameNight: GameNight; onClose: () => void; onSuggest: (startAt: string, endAt: string) => void }) {
  const currentStart = new Date(gameNight.startAt)
  const currentEnd = new Date(gameNight.endAt)
  const [date, setDate] = useState(localDateValue(currentStart))
  const [startTime, setStartTime] = useState(localTimeValue(currentStart))
  const [endTime, setEndTime] = useState(localTimeValue(currentEnd))
  const [error, setError] = useState('')
  function submit(event: FormEvent) {
    event.preventDefault()
    const startAt = dateTimeIso(date, startTime)
    const endAt = dateTimeIso(date, endTime)
    if (startAt === gameNight.startAt && endAt === gameNight.endAt) { setError('Suggest a different day or time.'); return }
    if (new Date(endAt) <= new Date(startAt)) { setError('End time needs to be later than the start time.'); return }
    onSuggest(startAt, endAt)
  }
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="modal suggestion-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
    <div className="modal-heading"><div><span className="eyebrow">Can’t make it?</span><h2>Suggest a new time</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close"><X size={19} /></button></div>
    <p className="suggestion-intro">Your thumbs-down will be shared with the crew along with this alternative.</p>
    <form onSubmit={submit}><div className="form-grid"><label className="field"><span>Better day</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label><label className="field"><span>Starts</span><input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} required /></label><label className="field"><span>Ends</span><input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} required /></label></div>
      {error && <p className="calendar-form-error">{error}</p>}<div className="modal-actions"><button className="button button-secondary" type="button" onClick={onClose}>Cancel</button><button className="button button-primary" type="submit"><SendToBack size={16} /> Share suggestion</button></div></form>
  </section></div>
}

function GameNightCard({ gameNight, currentUserId, crew, syncing, onAccept, onDecline, onSyncCalendar }: { gameNight: GameNight; currentUserId: string; crew: Member[]; syncing: boolean; onAccept: () => void; onDecline: () => void; onSyncCalendar: () => void }) {
  const response = gameNight.responses[currentUserId]
  const start = new Date(gameNight.startAt)
  const end = new Date(gameNight.endAt)
  return <article className="game-night-card">
    <div className="game-night-date"><strong>{start.toLocaleDateString('en-US', { month: 'short' })}</strong><span>{start.getDate()}</span></div>
    <div className="game-night-main"><span className="game-night-time">{start.toLocaleDateString('en-US', { weekday: 'long' })} · {start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}–{end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span><h3>{gameNight.title}</h3>{gameNight.gameTitle && <p className="game-night-game"><Gamepad2 size={13} /> {gameNight.gameTitle}</p>}{gameNight.note && <p className="game-night-note">{gameNight.note}</p>}
      <div className="game-night-responses">{crew.map((member) => { const answer = gameNight.responses[member.id]; return <span className={answer ? `is-${answer.status}` : ''} title={`${member.name}: ${answer?.status ?? 'No response'}`} key={member.id}><Avatar id={member.id} small />{answer?.status === 'accepted' ? <ThumbsUp size={10} /> : answer?.status === 'declined' ? <ThumbsDown size={10} /> : null}</span> })}</div>
      {Object.entries(gameNight.responses).map(([memberId, answer]) => answer.status === 'declined' && answer.suggestedStartAt ? <div className="time-suggestion" key={memberId}><ThumbsDown size={13} /><span><strong>{crew.find((member) => member.id === memberId)?.name ?? 'A player'} suggested</strong>{new Date(answer.suggestedStartAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at {new Date(answer.suggestedStartAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span></div> : null)}
    </div>
    <div className="rsvp-actions"><span>Your RSVP</span><div><button className={response?.status === 'accepted' ? 'active accept' : 'accept'} type="button" onClick={onAccept} disabled={syncing} aria-label="Accept game night in Checkpoint"><ThumbsUp size={17} /></button><button className={response?.status === 'declined' ? 'active decline' : 'decline'} type="button" onClick={onDecline} disabled={syncing} aria-label="Decline and suggest a new time"><ThumbsDown size={17} /></button></div>{syncing ? <small>Connecting Google…</small> : response?.calendarSyncedAt ? <small className="calendar-synced"><Check size={11} /> In Google Calendar</small> : response?.status === 'accepted' ? <button className="calendar-retry" type="button" onClick={onSyncCalendar}>Add to Google Calendar <em>optional</em></button> : null}</div>
  </article>
}

function CalendarPage({ gameNights, crew, currentUserId, syncingId, calendarError, sharedSyncError, onSchedule, onAccept, onDecline, onSyncCalendar }: { gameNights: GameNight[]; crew: Member[]; currentUserId: string; syncingId: string | null; calendarError: string | null; sharedSyncError: boolean; onSchedule: (date?: string) => void; onAccept: (night: GameNight) => void; onDecline: (night: GameNight) => void; onSyncCalendar: (night: GameNight) => void }) {
  const [visibleMonth, setVisibleMonth] = useState(() => { const date = new Date(); date.setDate(1); date.setHours(0, 0, 0, 0); return date })
  const monthStart = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1)
  const gridStart = new Date(monthStart)
  gridStart.setDate(1 - monthStart.getDay())
  const days = Array.from({ length: 42 }, (_, index) => { const date = new Date(gridStart); date.setDate(gridStart.getDate() + index); return date })
  const upcoming = [...gameNights].filter((night) => new Date(night.endAt) >= new Date()).sort((a, b) => a.startAt.localeCompare(b.startAt))
  return <div className="page calendar-page">
    <div className="page-title-row calendar-title-row"><div><span className="eyebrow">Get the crew together</span><h1>Game night calendar</h1><p>Propose a night and RSVP in Checkpoint, with optional personal Google Calendar copies.</p></div><button className="button button-primary" type="button" onClick={() => onSchedule()}><Plus size={18} /> Schedule game night</button></div>
    {(calendarError || sharedSyncError) && <div className="calendar-alert" role="alert"><CircleHelp size={19} /><div><strong>Calendar setup needs attention</strong>{sharedSyncError && <p>Your game night is saved on this device, but Firebase rejected the shared-calendar update.</p>}{calendarError && <p>{calendarError} Your Checkpoint RSVP is still saved.</p>}</div></div>}
    <section className="calendar-shell"><div className="calendar-toolbar"><h2>{visibleMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2><div><button type="button" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))} aria-label="Previous month"><ChevronLeft size={18} /></button><button type="button" onClick={() => { const now = new Date(); setVisibleMonth(new Date(now.getFullYear(), now.getMonth(), 1)) }}>Today</button><button type="button" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))} aria-label="Next month"><ChevronRight size={18} /></button></div></div><div className="calendar-legend" aria-label="Game night approval legend"><span className="pending"><Gamepad2 size={14} fill="none" /> Awaiting votes</span><span className="approved"><Gamepad2 size={14} fill="none" /> Everyone approved</span><span className="denied"><Gamepad2 size={14} fill="none" /> New time suggested</span></div>
      <div className="calendar-weekdays">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{days.map((day) => { const key = localDateValue(day); const dayEvents = gameNights.filter((night) => localDateValue(new Date(night.startAt)) === key); const today = key === localDateValue(new Date()); return <div className={`${day.getMonth() !== visibleMonth.getMonth() ? 'outside' : ''} ${today ? 'today' : ''}`} key={key}><button className="calendar-day-hitbox" type="button" onClick={() => onSchedule(key)} aria-label={`Schedule a game night on ${day.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`} /><span className="calendar-day-number">{day.getDate()}</span><div className="calendar-event-markers">{dayEvents.slice(0, 3).map((night) => { const state = gameNightCalendarState(night, crew); return <button className={`calendar-event calendar-event-${state}`} type="button" key={night.id} title={`${night.gameTitle || night.title} · ${state}`} aria-label={`${night.gameTitle || night.title}: ${state}`} onClick={() => document.getElementById(`night-${night.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}><Gamepad2 size={17} fill="none" /><span>{new Date(night.startAt).toLocaleTimeString('en-US', { hour: 'numeric' })} · {night.gameTitle || night.title}</span></button> })}</div>{dayEvents.length > 3 && <small>+{dayEvents.length - 3} more</small>}</div> })}</div></section>
    <section className="upcoming-nights"><div className="section-heading"><div><span className="eyebrow">Ready check</span><h2>Upcoming game nights</h2></div></div>{upcoming.length ? <div className="game-night-list">{upcoming.map((night) => <div id={`night-${night.id}`} key={night.id}><GameNightCard gameNight={night} currentUserId={currentUserId} crew={crew} syncing={syncingId === night.id} onAccept={() => onAccept(night)} onDecline={() => onDecline(night)} onSyncCalendar={() => onSyncCalendar(night)} /></div>)}</div> : <div className="calendar-empty"><CalendarDays size={30} /><h3>No game nights scheduled</h3><p>Pick a day and let the crew vote on it.</p><button className="button button-primary" type="button" onClick={() => onSchedule()}>Schedule the first one</button></div>}</section>
  </div>
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
  const [gameNights, setGameNights] = useState<GameNight[]>(getStoredGameNights)
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
  const [showSchedule, setShowSchedule] = useState(false)
  const [scheduleDate, setScheduleDate] = useState<string | undefined>()
  const [declineNightId, setDeclineNightId] = useState<string | null>(null)
  const [calendarSyncingId, setCalendarSyncingId] = useState<string | null>(null)
  const [calendarError, setCalendarError] = useState<string | null>(null)
  const [puzzleGameId, setPuzzleGameId] = useState<string | null>(null)
  const [expandedCampaignNoteId, setExpandedCampaignNoteId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [changeGameId, setChangeGameId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [libraryFilter, setLibraryFilter] = useState<GameStatus | 'all'>('all')
  const [smartFilter, setSmartFilter] = useState<SmartFilter>('any')
  const [steamSnapshot, setSteamSnapshot] = useState<SteamCrewSnapshot | null>(null)
  const [gameDeals, setGameDeals] = useState<Record<string, GameDeal>>({})
  const [steamLoading, setSteamLoading] = useState(false)
  const [pricesLoading, setPricesLoading] = useState(false)
  const [steamError, setSteamError] = useState<string | null>(null)
  const [priceError, setPriceError] = useState<string | null>(null)
  const [priceRefreshTick, setPriceRefreshTick] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const [boardId] = useState(getBoardId)
  const connectionRef = useRef<BoardConnection | null>(null)
  const lastSyncedRef = useRef('')
  const lastSyncedGameNightsRef = useRef('')
  const initialGamesRef = useRef(games)
  const initialGameNightsRef = useRef(gameNights)

  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(games)), [games])
  useEffect(() => localStorage.setItem(GAME_NIGHTS_STORAGE_KEY, JSON.stringify(gameNights)), [gameNights])
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(null), 5000); return () => window.clearTimeout(timer) }, [toast])
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
    connectBoard(boardId, user, persona, initialGamesRef.current, initialGameNightsRef.current, (remoteGames, remoteMembers, remoteGameNights) => {
      if (!active) return
      lastSyncedRef.current = JSON.stringify(remoteGames)
      lastSyncedGameNightsRef.current = JSON.stringify(remoteGameNights)
      setGames(cleanRemoteGames(remoteGames))
      setGameNights((current) => {
        const merged = new Map(remoteGameNights.map((night) => [night.id, night]))
        // Keep locally created nights until Firebase confirms them. Google
        // reauthentication can reconnect the board before that write finishes.
        current.forEach((night) => { if (!merged.has(night.id)) merged.set(night.id, night) })
        return [...merged.values()]
      })
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
  useEffect(() => {
    if (syncStatus !== 'live' || !connectionRef.current) return
    const serialized = JSON.stringify(gameNights)
    if (serialized === lastSyncedGameNightsRef.current) return
    const timer = window.setTimeout(() => {
      connectionRef.current?.saveGameNights(gameNights).then(() => {
        lastSyncedGameNightsRef.current = serialized
      }).catch(() => setSyncStatus('error'))
    }, 350)
    return () => window.clearTimeout(timer)
  }, [gameNights, syncStatus])

  const trackedAppIds = useMemo(() => [...new Set(games.flatMap((game) => game.steamAppId ? [game.steamAppId] : []))], [games])
  const priceAppIds = useMemo(() => [...new Set(games.flatMap((game) => game.steamAppId && game.status !== 'completed' ? [game.steamAppId] : []))].slice(0, 40), [games])
  const linkedSteamIds = useMemo(() => [...new Set(groupMembers.flatMap((member) => member.steamId ? [member.steamId] : []))], [groupMembers])

  useEffect(() => {
    if (!gameIntegrationsConfigured || !linkedSteamIds.length || !trackedAppIds.length) {
      setSteamSnapshot(null)
      setSteamLoading(false)
      setSteamError(null)
      return
    }
    const controller = new AbortController()
    let active = true
    setSteamLoading(true)
    setSteamError(null)
    loadSteamCrew(boardId, linkedSteamIds, trackedAppIds, controller.signal).then((snapshot) => {
      if (active) setSteamSnapshot(snapshot)
    }).catch((error: unknown) => {
      if (active && !(error instanceof DOMException && error.name === 'AbortError')) setSteamError(error instanceof Error ? error.message : 'Steam tracking is unavailable.')
    }).finally(() => { if (active) setSteamLoading(false) })
    return () => { active = false; controller.abort() }
  }, [boardId, linkedSteamIds.join(','), trackedAppIds.join(',')])

  useEffect(() => {
    if (!priceAppIds.length) { setGameDeals({}); return }
    const controller = new AbortController()
    let active = true
    setPricesLoading(true)
    setPriceError(null)
    loadCheapSharkDeals(priceAppIds, controller.signal).then((deals) => {
      if (active) setGameDeals(Object.fromEntries(deals.map((deal) => [deal.steamAppId, deal])))
    }).catch((error: unknown) => {
      if (active && !(error instanceof DOMException && error.name === 'AbortError')) setPriceError('Current game prices could not be refreshed.')
    }).finally(() => { if (active) setPricesLoading(false) })
    return () => { active = false; controller.abort() }
  }, [priceAppIds.join(','), priceRefreshTick])

  useEffect(() => {
    const timer = window.setInterval(() => setPriceRefreshTick((value) => value + 1), 5 * 60 * 1000)
    return () => window.clearInterval(timer)
  }, [])

  const integrationsLoading = steamLoading || pricesLoading
  const integrationError = steamError || priceError

  const currentUser = user?.uid ?? DEMO_USER
  const playing = games.find((game) => game.status === 'playing')
  const upNext = games.filter((game) => game.status === 'up-next')
  const selected = games.find((game) => game.id === selectedId)
  const changeGame = games.find((game) => game.id === changeGameId)
  const puzzleGame = games.find((game) => game.id === puzzleGameId)
  const filteredGames = useMemo(() => games.filter((game) => {
    if ((libraryFilter !== 'all' && game.status !== libraryFilter) || !game.title.toLowerCase().includes(search.toLowerCase())) return false
    const ownership = ownershipForGame(game, groupMembers, steamSnapshot)
    if (smartFilter === 'everyone-owns') return ownership.everyoneOwns
    if (smartFilter === 'needs-copy') return ownership.missing.length > 0
    if (smartFilter === 'on-sale') return Boolean(game.steamAppId && gameDeals[game.steamAppId]?.savingsPercent >= 1)
    return true
  }), [gameDeals, games, groupMembers, libraryFilter, search, smartFilter, steamSnapshot])
  const flash = (message: string) => setToast(message)
  function vote(gameId: string) { setGames((current) => current.map((game) => game.id !== gameId ? game : { ...game, votes: game.votes.includes(currentUser) ? game.votes.filter((id) => id !== currentUser) : [...game.votes, currentUser] })) }
  function openAddGame(parent?: Game) { setAddParentId(parent?.id); setSelectedId(null); setShowAdd(true) }
  function closeAddGame() { setShowAdd(false); setAddParentId(undefined) }
  function addGame(game: Game) { setGames((current) => [...current, game]); closeAddGame(); flash(`${game.title} added to ${statusLabels[game.status]}`) }
  function updateGame(gameId: string, updates: Partial<Game>) { setGames((current) => current.map((game) => game.id === gameId ? { ...game, ...updates } : game)); setSelectedId(null); flash('Checkpoint updated') }
  function replaceGame(gameId: string, updates: Partial<Game>) {
    setGames((current) => current.map((game) => game.id === gameId
      ? { ...game, ...updates }
      : game.parentGameId === gameId && updates.title ? { ...game, parentGameTitle: updates.title } : game))
    if (updates.title) setGameNights((current) => current.map((night) => night.gameId === gameId ? { ...night, gameTitle: updates.title } : night))
    setChangeGameId(null)
    flash(`${updates.title || 'Game'} corrected without losing its Checkpoint history`)
  }
  function updateManualOwnership(gameId: string, memberId: string, owned: boolean | undefined) {
    setGames((current) => current.map((game) => {
      if (game.id !== gameId) return game
      const manualOwnership = { ...game.manualOwnership }
      if (typeof owned === 'boolean') manualOwnership[memberId] = owned
      else delete manualOwnership[memberId]
      return { ...game, manualOwnership }
    }))
    flash(typeof owned === 'boolean' ? 'Manual ownership saved' : 'Steam ownership restored')
  }
  function removeGame(game: Game) {
    if (!window.confirm(`Remove ${game.title} from the shared library? This cannot be undone.`)) return
    setGames((current) => current.filter((item) => item.id !== game.id))
    setSelectedId(null)
    flash(`${game.title} removed`)
  }
  function acceptGameNight(gameNight: GameNight) {
    const respondedAt = new Date().toISOString()
    const priorResponse = gameNight.responses[currentUser]
    setGameNights((current) => current.map((night) => night.id === gameNight.id ? { ...night, responses: { ...night.responses, [currentUser]: { ...priorResponse, status: 'accepted', respondedAt, suggestedStartAt: undefined, suggestedEndAt: undefined } } } : night))
    flash('Game night accepted in Checkpoint')
  }
  async function syncGameNightToPersonalCalendar(gameNight: GameNight) {
    const priorResponse = gameNight.responses[currentUser]
    setCalendarSyncingId(gameNight.id)
    setCalendarError(null)
    try {
      const result = await syncGameNightToGoogleCalendar(gameNight, priorResponse?.googleEventId)
      setGameNights((current) => current.map((night) => night.id === gameNight.id ? { ...night, responses: { ...night.responses, [currentUser]: { ...night.responses[currentUser], status: 'accepted', respondedAt: night.responses[currentUser]?.respondedAt || new Date().toISOString(), googleEventId: result.id, calendarSyncedAt: new Date().toISOString(), suggestedStartAt: undefined, suggestedEndAt: undefined } } } : night))
      flash(priorResponse?.googleEventId ? 'Game night updated in Google Calendar' : 'Added to your Google Calendar')
    } catch (error) {
      const message = friendlyCalendarError(error)
      setCalendarError(message)
      flash(message)
    } finally {
      setCalendarSyncingId(null)
    }
  }
  function declineGameNight(gameNightId: string, suggestedStartAt: string, suggestedEndAt: string) {
    setGameNights((current) => current.map((night) => night.id === gameNightId ? { ...night, responses: { ...night.responses, [currentUser]: { ...night.responses[currentUser], status: 'declined', respondedAt: new Date().toISOString(), suggestedStartAt, suggestedEndAt } } } : night))
    setDeclineNightId(null)
    flash('Thumbs-down and new time shared with the crew')
  }
  function scheduleGameNight(draft: Omit<GameNight, 'id' | 'createdBy' | 'createdAt' | 'responses'>) {
    const now = new Date().toISOString()
    const gameNight: GameNight = { ...draft, id: crypto.randomUUID(), createdBy: currentUser, createdAt: now, responses: { [currentUser]: { status: 'accepted', respondedAt: now } } }
    setGameNights((current) => [...current, gameNight])
    setShowSchedule(false)
    setScheduleDate(undefined)
    setView('calendar')
    flash('Game night scheduled in Checkpoint')
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

  async function saveSteamProfile(profile: SteamProfile | null) {
    if (!connectionRef.current) throw new Error('The shared board is still connecting.')
    await connectionRef.current.saveSteamProfile(profile)
    setGroupMembers((current) => current.map((member) => member.id === currentUser ? {
      ...member,
      steamId: profile?.steamId,
      steamName: profile?.steamName,
      steamProfileUrl: profile?.steamProfileUrl,
      steamAvatarUrl: profile?.steamAvatarUrl,
    } : member))
    if (!profile) setSteamSnapshot(null)
    flash(profile ? `${profile.steamName} linked to Steam` : 'Steam profile disconnected')
  }

  async function resolveSteamLink(profile: string) {
    if (!gameIntegrationsConfigured) throw new Error('Steam linking is not configured yet.')
    return resolveSteamProfile(boardId, profile)
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
    <IntegrationsContext.Provider value={{ boardId, steam: steamSnapshot, deals: gameDeals, loading: integrationsLoading, error: integrationError }}>
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" type="button" onClick={() => setView('dashboard')}><span className="brand-mark"><Flag size={21} fill="currentColor" /></span><span>checkpoint</span></button>
        <button className="server-switcher" type="button" onClick={() => setShowCrew(true)}><div className="server-icon"><Gamepad2 size={18} /></div><div><strong>Checkpoint Crew</strong><span>{groupMembers.length} {groupMembers.length === 1 ? 'player' : 'players'}</span></div><ChevronDown size={16} /></button>
        <nav className="main-nav" aria-label="Main navigation">
          <button className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}><LayoutDashboard size={19} /><span>Home</span></button>
          <button className={view === 'library' && libraryFilter === 'all' ? 'active' : ''} onClick={() => { setView('library'); setLibraryFilter('all') }}><Library size={19} /><span>Game library</span><b>{games.length}</b></button>
          <button className={view === 'library' && libraryFilter === 'up-next' ? 'active' : ''} onClick={() => { setView('library'); setLibraryFilter('up-next') }}><BookOpen size={19} /><span>Up next</span><b>{upNext.length}</b></button>
          <button className={view === 'calendar' ? 'active' : ''} onClick={() => setView('calendar')}><CalendarDays size={19} /><span>Calendar</span><b>{gameNights.length}</b></button>
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
          <div className="topbar-actions"><button className="icon-button notification" type="button" onClick={() => flash('You’re all caught up')} aria-label="Notifications"><Bell size={19} /><span /></button><button className="member-stack member-stack-button" type="button" onClick={() => setShowCrew(true)} aria-label="Open Checkpoint Crew">{groupMembers.map((member) => <Avatar id={member.id} small key={member.id} />)}</button><button className="button button-primary add-button" type="button" onClick={() => openAddGame()} aria-label="Add game"><Plus size={18} /><span>Add game</span></button></div>
        </header>

        {view === 'dashboard' ? <div className="page dashboard-page">
          <div className="page-title-row"><div><span className="eyebrow">{todayLabel}</span><h1>Good evening, crew.</h1><p>{dashboardSummary}</p></div><button className={`sync-chip sync-${syncStatus}`} onClick={copyBoardLink} type="button"><span /><strong>{syncLabel}</strong>{syncStatus === 'live' && <Share2 size={13} />}</button></div>
          <section className="dashboard-grid">
            <div className="now-playing-panel"><div className="section-heading inverse"><div><span className="eyebrow">Continue playing</span><h2>Current campaign</h2></div><button className="ghost-icon" onClick={() => playing && setSelectedId(playing.id)}><MoreHorizontal size={20} /></button></div>
              {playing ? <div className="playing-content"><Cover game={playing} size="large" /><div className="playing-copy"><div className="live-pill"><span /> In progress</div><h2>{playing.title}</h2><p className="playing-meta">{playing.contentType === 'dlc' && playing.parentGameTitle ? `DLC for ${playing.parentGameTitle} · ` : ''}{[playing.genre, playing.platform, playing.year].filter(Boolean).join(' · ')}</p>
                <div className="progress-block"><div><span>Group progress</span><strong>{playing.progress}%</strong></div><div className="progress-track"><span style={{ width: `${playing.progress}%` }} /></div></div>
                <div className={`session-note ${expandedCampaignNoteId === playing.id ? 'is-open' : ''}`}><NotebookPen size={18} /><div><button className="session-note-toggle" type="button" onClick={() => setExpandedCampaignNoteId((current) => current === playing.id ? null : playing.id)} aria-expanded={expandedCampaignNoteId === playing.id}><span>Shared campaign note</span><ChevronDown size={14} /></button>{expandedCampaignNoteId === playing.id ? <textarea value={playing.note} maxLength={5000} onChange={(event) => { const note = event.target.value; setGames((current) => current.map((game) => game.id === playing.id ? { ...game, note } : game)) }} placeholder="Where did we leave off? Add clues, plans, or the next objective…" rows={4} autoFocus /> : <p>{playing.note || 'Add a shared note for the next session…'}</p>}</div></div>
                <div className="playing-actions"><button className="button button-light" onClick={() => setSelectedId(playing.id)}><Sparkles size={17} /> Update progress</button><button className="button campaign-puzzle-button" type="button" onClick={() => setPuzzleGameId(playing.id)}><Puzzle size={16} /> Puzzle Board</button><button className="button button-dark-ghost" onClick={() => setSelectedId(playing.id)}>View details</button></div>
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
        </div> : view === 'library' ? <div className="page library-page">
          <div className="page-title-row library-title-row"><div><span className="eyebrow">The collection</span><h1>Game library</h1><p>Every campaign, DLC, contender, and completed adventure in one place.</p></div><button className="button button-primary" onClick={() => openAddGame()}><Plus size={18} /> Add game</button></div>
          <div className="filter-tabs">{([['all', 'All games'], ...Object.entries(statusLabels)] as [GameStatus | 'all', string][]).map(([value, label]) => <button key={value} className={libraryFilter === value ? 'active' : ''} onClick={() => setLibraryFilter(value)}>{label}<span>{value === 'all' ? games.length : games.filter((game) => game.status === value).length}</span></button>)}</div>
          <div className="smart-filters"><span><ListFilter size={14} /> Steam & prices</span>{([['any', 'Any ownership'], ['everyone-owns', 'Everyone owns'], ['needs-copy', 'Someone needs it'], ['on-sale', 'On sale']] as [SmartFilter, string][]).map(([value, label]) => <button type="button" key={value} className={smartFilter === value ? 'active' : ''} onClick={() => setSmartFilter(value)}>{label}</button>)}{integrationsLoading && <RefreshCw className="spin" size={14} />}</div>
          {filteredGames.length ? <div className="library-grid">{filteredGames.map((game) => <LibraryCard game={game} key={game.id} onOpen={() => setSelectedId(game.id)} onVote={() => vote(game.id)} />)}</div> : <div className="empty-state"><Search size={28} /><h2>No games found</h2><p>Try another search or add a new game.</p><button className="button button-primary" onClick={() => openAddGame()}>Add game</button></div>}
        </div> : <CalendarPage gameNights={gameNights} crew={groupMembers} currentUserId={currentUser} syncingId={calendarSyncingId} calendarError={calendarError} sharedSyncError={syncStatus === 'error'} onSchedule={(date) => { setScheduleDate(date); setShowSchedule(true) }} onAccept={acceptGameNight} onDecline={(night) => setDeclineNightId(night.id)} onSyncCalendar={syncGameNightToPersonalCalendar} />}
        <nav className="mobile-nav" aria-label="Mobile navigation"><button className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}><LayoutDashboard size={20} /><span>Home</span></button><button className={view === 'library' && libraryFilter === 'all' ? 'active' : ''} onClick={() => { setView('library'); setLibraryFilter('all') }}><Library size={20} /><span>Library</span></button><button className="mobile-add" onClick={() => openAddGame()}><Plus size={23} /></button><button className={view === 'library' && libraryFilter === 'up-next' ? 'active' : ''} onClick={() => { setView('library'); setLibraryFilter('up-next') }}><BookOpen size={20} /><span>Queue</span></button><button className={view === 'calendar' ? 'active' : ''} onClick={() => setView('calendar')}><CalendarDays size={20} /><span>Calendar</span></button></nav>
      </main>
      {showAdd && <AddGameModal onClose={closeAddGame} onAdd={addGame} games={games} defaultParentId={addParentId} />}
      {showSchedule && <ScheduleGameNightModal games={games} defaultDate={scheduleDate} onClose={() => { setShowSchedule(false); setScheduleDate(undefined) }} onSchedule={scheduleGameNight} />}
      {declineNightId && gameNights.find((night) => night.id === declineNightId) && <SuggestTimeModal gameNight={gameNights.find((night) => night.id === declineNightId)!} onClose={() => setDeclineNightId(null)} onSuggest={(startAt, endAt) => declineGameNight(declineNightId, startAt, endAt)} />}
      {showCrew && <CrewModal members={groupMembers} currentUserId={currentUser} googlePhotoUrl={user?.photoURL} integrationError={integrationError} onClose={() => setShowCrew(false)} onSavePhoto={saveProfileImage} onResolveSteam={resolveSteamLink} onSaveSteam={saveSteamProfile} />}
      {selected && <GameDetailsModal game={selected} onClose={() => setSelectedId(null)} onVote={() => vote(selected.id)} onSave={(updates) => updateGame(selected.id, updates)} onRemove={() => removeGame(selected)} onChangeGame={() => { setChangeGameId(selected.id); setSelectedId(null) }} onAddDlc={() => openAddGame(selected)} onOpenPuzzle={() => { setPuzzleGameId(selected.id); setSelectedId(null) }} onManualOwnershipChange={(memberId, owned) => updateManualOwnership(selected.id, memberId, owned)} />}
      {changeGame && <ChangeGameModal game={changeGame} onClose={() => setChangeGameId(null)} onChange={(updates) => replaceGame(changeGame.id, updates)} />}
      {puzzleGame && <PuzzleBoardModal game={puzzleGame} boardId={boardId} currentUserId={currentUser} onClose={() => setPuzzleGameId(null)} />}
      {toast && <div className="toast"><Check size={17} /> {toast}</div>}
    </div>
    </IntegrationsContext.Provider>
    </GamesContext.Provider>
    </MembersContext.Provider>
    </CurrentUserContext.Provider>
  )
}
export default App
