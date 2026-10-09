import type { User } from 'firebase/auth'
import {
  FieldPath,
  doc,
  getDocFromServer,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  runTransaction,
  type Unsubscribe,
} from 'firebase/firestore'
import type { ActivityEntry, AppMode, Book, Game, GameNight, GameSession, Member, Persona, RecommendationFeedback, SteamLinkPreference } from '../types'
import { database } from './firebase'
import { validBookmarkColor } from './bookmarkColors'

export type BoardConnection = {
  saveState: (state: { games: Game[]; books: Book[]; gameNights: GameNight[]; sessions: GameSession[]; activity: ActivityEntry[] }) => Promise<void>
  saveProfileImage: (customPhotoUrl: string | null) => Promise<void>
  saveSteamProfile: (profile: SteamProfile | null) => Promise<void>
  saveSteamLinkPreference: (preference: SteamLinkPreference) => Promise<void>
  savePreferredMode: (mode: AppMode) => Promise<void>
  saveBookmarkColor: (color: string) => Promise<void>
  toggleRecommendationDownvote: (steamAppId: string, title: string, memberId: string) => Promise<void>
  restoreRecommendation: (steamAppId: string) => Promise<void>
  close: Unsubscribe
}

export type SteamProfile = {
  steamId: string
  steamName: string
  steamProfileUrl: string
  steamAvatarUrl: string
}

type StoredMember = {
  name: string
  persona?: Persona
  email: string
  photoUrl: string
  googlePhotoUrl?: string
  customPhotoUrl?: string
  steamId?: string
  steamName?: string
  steamProfileUrl?: string
  steamAvatarUrl?: string
  steamLinkPreference?: SteamLinkPreference
  preferredMode?: AppMode
  bookmarkColor?: string
  joinedAt: string
}

type BoardData = {
  games?: unknown
  books?: unknown
  gameNights?: unknown
  sessions?: unknown
  activity?: unknown
  members?: Record<string, StoredMember>
  removedMembers?: Record<string, boolean>
  recommendationFeedback?: unknown
}

function isBookList(value: unknown): value is Book[] {
  return Array.isArray(value) && value.every((item) => {
    if (!item || typeof item !== 'object') return false
    const book = item as Partial<Book>
    return typeof book.id === 'string'
      && typeof book.title === 'string'
      && Array.isArray(book.authors)
      && Array.isArray(book.upvotes)
      && Array.isArray(book.downvotes)
      && Boolean(book.shelves && typeof book.shelves === 'object')
      && Boolean(book.progress && typeof book.progress === 'object')
      && Boolean(book.ratings && typeof book.ratings === 'object')
      && Array.isArray(book.comments)
  })
}

function recommendationFeedbackFromData(value: unknown): RecommendationFeedback {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value).flatMap(([steamAppId, raw]) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return []
    const entry = raw as { title?: unknown; downvotes?: unknown; excludedAt?: unknown }
    if (typeof entry.title !== 'string' || !Array.isArray(entry.downvotes)) return []
    const downvotes = [...new Set(entry.downvotes.filter((id): id is string => typeof id === 'string'))]
    return [[steamAppId, {
      title: entry.title,
      downvotes,
      excludedAt: typeof entry.excludedAt === 'string' ? entry.excludedAt : downvotes.length > 0 ? '1970-01-01T00:00:00.000Z' : undefined,
    }]]
  }))
}

function isGameNightList(value: unknown): value is GameNight[] {
  return Array.isArray(value) && value.every((item) => {
    if (!item || typeof item !== 'object') return false
    const gameNight = item as Partial<GameNight>
    return typeof gameNight.id === 'string'
      && typeof gameNight.title === 'string'
      && typeof gameNight.startAt === 'string'
      && typeof gameNight.endAt === 'string'
      && typeof gameNight.createdBy === 'string'
      && Boolean(gameNight.responses && typeof gameNight.responses === 'object')
  })
}

function isSessionList(value: unknown): value is GameSession[] {
  return Array.isArray(value) && value.every((item) => {
    if (!item || typeof item !== 'object') return false
    const session = item as Partial<GameSession>
    return typeof session.id === 'string'
      && typeof session.gameId === 'string'
      && typeof session.gameTitle === 'string'
      && typeof session.startedAt === 'string'
      && Array.isArray(session.participantIds)
  })
}

function isActivityList(value: unknown): value is ActivityEntry[] {
  return Array.isArray(value) && value.every((item) => {
    if (!item || typeof item !== 'object') return false
    const entry = item as Partial<ActivityEntry>
    return typeof entry.id === 'string'
      && typeof entry.actorId === 'string'
      && typeof entry.summary === 'string'
      && typeof entry.createdAt === 'string'
  })
}

function readableMedia(data: BoardData): boolean {
  return isGameList(data.games)
    && (data.books === undefined || isBookList(data.books))
    && (data.gameNights === undefined || isGameNightList(data.gameNights))
    && (data.sessions === undefined || isSessionList(data.sessions))
    && (data.activity === undefined || isActivityList(data.activity))
}

export const CHECKPOINT_CREW_BOARD_ID = '4b39bba9-4b6a-47ce-bc73-85d1985aad28'

export function getBoardId() {
  localStorage.setItem('checkpoint-board-id', CHECKPOINT_CREW_BOARD_ID)
  const expectedHash = `#board=${CHECKPOINT_CREW_BOARD_ID}`
  const invite = new URLSearchParams(window.location.hash.slice(1))
  if (invite.get('board') === CHECKPOINT_CREW_BOARD_ID && /^[A-Za-z0-9_-]{43}$/.test(invite.get('invite') || '')) return CHECKPOINT_CREW_BOARD_ID
  if (window.location.hash !== expectedHash) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${expectedHash}`)
  }
  return CHECKPOINT_CREW_BOARD_ID
}

function isGameList(value: unknown): value is Game[] {
  return Array.isArray(value) && value.every((item) => {
    if (!item || typeof item !== 'object') return false
    const game = item as Partial<Game>
    return typeof game.id === 'string' && typeof game.title === 'string' && typeof game.status === 'string'
  })
}

function memberFromUser(user: User, persona: string, existing?: StoredMember, customPhotoUrl = existing?.customPhotoUrl ?? ''): StoredMember {
  const googlePhotoUrl = user.photoURL || existing?.googlePhotoUrl || ''
  return {
    ...existing,
    name: existing?.name || persona,
    email: user.email || '',
    photoUrl: customPhotoUrl || googlePhotoUrl,
    googlePhotoUrl,
    customPhotoUrl,
    steamId: existing?.steamId,
    steamName: existing?.steamName,
    steamProfileUrl: existing?.steamProfileUrl,
    steamAvatarUrl: existing?.steamAvatarUrl,
    steamLinkPreference: existing?.steamLinkPreference ?? 'auto',
    preferredMode: existing?.preferredMode ?? 'games',
    bookmarkColor: existing?.bookmarkColor,
    joinedAt: existing?.joinedAt || new Date().toISOString(),
  }
}

function membersFromData(data: BoardData): Member[] {
  return Object.entries(data.members ?? {}).filter(([uid]) => !data.removedMembers?.[uid]).map(([id, member], index) => ({
    id,
    name: member.name,
    initials: member.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
    color: ['#f6a44b', '#ec6f8f', '#69b8ff', '#7bd99a', '#a990e8'][index % 5],
    photoUrl: member.customPhotoUrl || member.googlePhotoUrl || member.photoUrl,
    googlePhotoUrl: member.googlePhotoUrl || member.photoUrl,
    customPhotoUrl: member.customPhotoUrl,
    persona: member.persona,
    steamId: member.steamId,
    steamName: member.steamName,
    steamProfileUrl: member.steamProfileUrl,
    steamAvatarUrl: member.steamAvatarUrl,
    steamLinkPreference: member.steamLinkPreference ?? 'auto',
    preferredMode: member.preferredMode ?? 'games',
    bookmarkColor: member.bookmarkColor,
  }))
}

export async function connectBoard(
  boardId: string,
  user: User,
  persona: string,
  onRemoteState: (games: Game[], books: Book[], members: Member[], gameNights: GameNight[], sessions: GameSession[], activity: ActivityEntry[], recommendationFeedback: RecommendationFeedback) => void,
  onConnectionState?: (state: 'connecting' | 'live' | 'error' | 'denied') => void,
): Promise<BoardConnection | null> {
  if (!database) return null
  const firestore = database
  const boardRef = doc(firestore, 'boards', boardId)
  let latestMember: StoredMember | undefined
  const snapshot = await getDocFromServer(boardRef)
  const initialData = snapshot.data() as BoardData | undefined
  latestMember = initialData?.members?.[user.uid]
  if (!snapshot.exists() || !latestMember || initialData?.removedMembers?.[user.uid]) {
    throw new Error('An invitation is required to join this group.')
  }
  if (!initialData || !readableMedia(initialData) || !isGameList(initialData.games)) throw new Error('The shared library could not be read safely. No data was changed.')
  // Never create/join a board or restore stale local media after a read failure.
  // All existing profiles and media remain attached to their original UID.
  const refreshedMember = memberFromUser(user, persona, latestMember)
  if (latestMember.email !== refreshedMember.email
    || latestMember.googlePhotoUrl !== refreshedMember.googlePhotoUrl
    || latestMember.photoUrl !== refreshedMember.photoUrl) {
    await updateDoc(boardRef, new FieldPath('members', user.uid), refreshedMember, 'updatedAt', serverTimestamp())
  }
  onRemoteState(initialData.games, isBookList(initialData.books) ? initialData.books : [], membersFromData(initialData),
    isGameNightList(initialData.gameNights) ? initialData.gameNights : [], isSessionList(initialData.sessions) ? initialData.sessions : [],
    isActivityList(initialData.activity) ? initialData.activity : [], recommendationFeedbackFromData(initialData.recommendationFeedback))

  const unsubscribe = onSnapshot(boardRef, { includeMetadataChanges: true }, (nextSnapshot) => {
    if (!nextSnapshot.exists()) { onConnectionState?.('error'); return }
    onConnectionState?.(nextSnapshot.metadata.fromCache ? 'connecting' : 'live')
    const data = nextSnapshot.data() as BoardData
    latestMember = data.members?.[user.uid]
    if (!latestMember || data.removedMembers?.[user.uid]) { onConnectionState?.('denied'); return }
    if (!readableMedia(data)) { onConnectionState?.('error'); return }
    if (isGameList(data.games)) onRemoteState(data.games, isBookList(data.books) ? data.books : [], membersFromData(data), isGameNightList(data.gameNights) ? data.gameNights : [], isSessionList(data.sessions) ? data.sessions : [], isActivityList(data.activity) ? data.activity : [], recommendationFeedbackFromData(data.recommendationFeedback))
  }, error => onConnectionState?.(error.code === 'permission-denied' ? 'denied' : 'error'))

  return {
    async saveState({ games, books, gameNights, sessions, activity }) {
      await updateDoc(boardRef, {
        games,
        books,
        gameNights,
        sessions,
        activity: activity.slice(0, 250),
        updatedAt: serverTimestamp(),
      })
    },
    async saveProfileImage(customPhotoUrl) {
      const nextMember = memberFromUser(user, persona, latestMember, customPhotoUrl ?? '')
      await updateDoc(
        boardRef,
        new FieldPath('members', user.uid),
        nextMember,
        'updatedAt',
        serverTimestamp(),
      )
      latestMember = nextMember
    },
    async saveSteamProfile(profile) {
      const nextMember = memberFromUser(user, persona, latestMember)
      nextMember.steamId = profile?.steamId
      nextMember.steamName = profile?.steamName
      nextMember.steamProfileUrl = profile?.steamProfileUrl
      nextMember.steamAvatarUrl = profile?.steamAvatarUrl
      await updateDoc(
        boardRef,
        new FieldPath('members', user.uid),
        nextMember,
        'updatedAt',
        serverTimestamp(),
      )
      latestMember = nextMember
    },
    async saveSteamLinkPreference(preference) {
      const nextMember = memberFromUser(user, persona, latestMember)
      nextMember.steamLinkPreference = preference
      await updateDoc(
        boardRef,
        new FieldPath('members', user.uid),
        nextMember,
        'updatedAt',
        serverTimestamp(),
      )
      latestMember = nextMember
    },
    async saveBookmarkColor(color) {
      if (!validBookmarkColor(color)) throw new Error('Choose a valid bookmark color.')
      const normalized = color.toLowerCase()
      await updateDoc(boardRef, new FieldPath('members', user.uid, 'bookmarkColor'), normalized, 'updatedAt', serverTimestamp())
      if (latestMember) latestMember = { ...latestMember, bookmarkColor: normalized }
    },
    async savePreferredMode(mode) {
      const nextMember = memberFromUser(user, persona, latestMember)
      nextMember.preferredMode = mode
      await updateDoc(
        boardRef,
        new FieldPath('members', user.uid),
        nextMember,
        'updatedAt',
        serverTimestamp(),
      )
      latestMember = nextMember
    },
    async toggleRecommendationDownvote(steamAppId, title, memberId) {
      await runTransaction(firestore, async (transaction) => {
        const currentSnapshot = await transaction.get(boardRef)
        const currentFeedback = recommendationFeedbackFromData((currentSnapshot.data() as BoardData | undefined)?.recommendationFeedback)
        const currentEntry = currentFeedback[steamAppId] ?? { title, downvotes: [] }
        if (currentEntry.excludedAt) return
        const downvotes = currentEntry.downvotes.includes(memberId)
          ? currentEntry.downvotes.filter((id) => id !== memberId)
          : [...currentEntry.downvotes, memberId]
        currentFeedback[steamAppId] = {
          title,
          downvotes,
          excludedAt: downvotes.length >= 1 ? new Date().toISOString() : undefined,
        }
        transaction.update(boardRef, { recommendationFeedback: currentFeedback, updatedAt: serverTimestamp() })
      })
    },
    async restoreRecommendation(steamAppId) {
      await runTransaction(firestore, async (transaction) => {
        const currentSnapshot = await transaction.get(boardRef)
        const currentFeedback = recommendationFeedbackFromData((currentSnapshot.data() as BoardData | undefined)?.recommendationFeedback)
        delete currentFeedback[steamAppId]
        transaction.update(boardRef, { recommendationFeedback: currentFeedback, updatedAt: serverTimestamp() })
      })
    },
    close: unsubscribe,
  }
}
