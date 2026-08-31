import type { User } from 'firebase/auth'
import {
  FieldPath,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  runTransaction,
  type Unsubscribe,
} from 'firebase/firestore'
import type { ActivityEntry, Game, GameNight, GameSession, Member, Persona, RecommendationFeedback } from '../types'
import { database } from './firebase'

export type BoardConnection = {
  save: (games: Game[]) => Promise<void>
  saveGameNights: (gameNights: GameNight[]) => Promise<void>
  saveSessions: (sessions: GameSession[]) => Promise<void>
  saveActivity: (activity: ActivityEntry[]) => Promise<void>
  saveProfileImage: (customPhotoUrl: string | null) => Promise<void>
  saveSteamProfile: (profile: SteamProfile | null) => Promise<void>
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
  joinedAt: string
}

type BoardData = {
  games?: unknown
  gameNights?: unknown
  sessions?: unknown
  activity?: unknown
  members?: Record<string, StoredMember>
  recommendationFeedback?: unknown
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
      excludedAt: typeof entry.excludedAt === 'string' ? entry.excludedAt : undefined,
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

export const CHECKPOINT_CREW_BOARD_ID = '4b39bba9-4b6a-47ce-bc73-85d1985aad28'

export function getBoardId() {
  localStorage.setItem('checkpoint-board-id', CHECKPOINT_CREW_BOARD_ID)
  const expectedHash = `#board=${CHECKPOINT_CREW_BOARD_ID}`
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

function memberFromUser(user: User, persona: Persona, existing?: StoredMember, customPhotoUrl = existing?.customPhotoUrl ?? ''): StoredMember {
  const googlePhotoUrl = user.photoURL || existing?.googlePhotoUrl || ''
  return {
    name: persona,
    persona,
    email: user.email || '',
    photoUrl: customPhotoUrl || googlePhotoUrl,
    googlePhotoUrl,
    customPhotoUrl,
    steamId: existing?.steamId,
    steamName: existing?.steamName,
    steamProfileUrl: existing?.steamProfileUrl,
    steamAvatarUrl: existing?.steamAvatarUrl,
    joinedAt: existing?.joinedAt || new Date().toISOString(),
  }
}

function membersFromData(data: BoardData): Member[] {
  return Object.entries(data.members ?? {}).map(([id, member], index) => ({
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
  }))
}

function isPersona(value: unknown): value is Persona {
  return value === 'Nern' || value === 'Jern' || value === 'Vern'
}

export async function getExistingPersona(boardId: string, user: User): Promise<Persona | null> {
  if (!database) return null
  try {
    const snapshot = await getDoc(doc(database, 'boards', boardId))
    const persona = (snapshot.data() as BoardData | undefined)?.members?.[user.uid]?.persona
    return isPersona(persona) ? persona : null
  } catch {
    return null
  }
}

export async function connectBoard(
  boardId: string,
  user: User,
  persona: Persona,
  fallbackGames: Game[],
  fallbackGameNights: GameNight[],
  fallbackSessions: GameSession[],
  fallbackActivity: ActivityEntry[],
  onRemoteState: (games: Game[], members: Member[], gameNights: GameNight[], sessions: GameSession[], activity: ActivityEntry[], recommendationFeedback: RecommendationFeedback) => void,
): Promise<BoardConnection | null> {
  if (!database) return null
  const firestore = database
  const boardRef = doc(firestore, 'boards', boardId)
  let latestMember: StoredMember | undefined
  let snapshot

  try {
    snapshot = await getDoc(boardRef)
  } catch {
    try {
      // This succeeds only when the private board link has not been claimed yet.
      await setDoc(boardRef, {
        games: fallbackGames,
        gameNights: fallbackGameNights,
        sessions: fallbackSessions,
        activity: fallbackActivity,
        ownerUid: user.uid,
        members: { [user.uid]: memberFromUser(user, persona) },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    } catch {
      // Otherwise, the signed-in visitor may join the existing board only as themselves.
      await updateDoc(
        boardRef,
        new FieldPath('members', user.uid),
        memberFromUser(user, persona),
        'updatedAt',
        serverTimestamp(),
      )
    }
    snapshot = await getDoc(boardRef)
  }

  if (!snapshot.exists()) {
    await setDoc(boardRef, {
      games: fallbackGames,
      gameNights: fallbackGameNights,
      sessions: fallbackSessions,
      activity: fallbackActivity,
      ownerUid: user.uid,
      members: { [user.uid]: memberFromUser(user, persona) },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  } else {
    const data = snapshot.data() as BoardData
    latestMember = data.members?.[user.uid]
    const refreshedMember = memberFromUser(user, persona, latestMember)
    if (!latestMember
      || latestMember.persona !== persona
      || latestMember.email !== refreshedMember.email
      || latestMember.googlePhotoUrl !== refreshedMember.googlePhotoUrl
      || latestMember.photoUrl !== refreshedMember.photoUrl) {
      await updateDoc(
        boardRef,
        new FieldPath('members', user.uid),
        refreshedMember,
        'updatedAt',
        serverTimestamp(),
      )
    }
  }

  // Hydrate from Firestore before reporting the connection as live. This keeps a
  // blank cache on a new device from racing the first cloud snapshot and
  // replacing the crew's library. If the original board was empty but the
  // existing desktop still has games, migrate that local library once.
  snapshot = await getDoc(boardRef)
  if (snapshot.exists()) {
    const initialData = snapshot.data() as BoardData
    latestMember = initialData.members?.[user.uid]
    if (isGameList(initialData.games)) {
      const initialGames = initialData.games.length || !fallbackGames.length ? initialData.games : fallbackGames
      const initialGameNights = isGameNightList(initialData.gameNights)
        ? initialData.gameNights
        : fallbackGameNights
      const initialSessions = isSessionList(initialData.sessions) ? initialData.sessions : fallbackSessions
      const initialActivity = isActivityList(initialData.activity) ? initialData.activity : fallbackActivity
      if (initialGames === fallbackGames) {
        await updateDoc(boardRef, { games: fallbackGames, updatedAt: serverTimestamp() })
      }
      if (!isGameNightList(initialData.gameNights)) {
        // Older deployments do not have this field yet. Hydrate the rest of the
        // board even if its matching rules update has not reached Firebase.
        await updateDoc(boardRef, { gameNights: fallbackGameNights, updatedAt: serverTimestamp() }).catch(() => undefined)
      }
      if (!isSessionList(initialData.sessions)) await updateDoc(boardRef, { sessions: fallbackSessions, updatedAt: serverTimestamp() }).catch(() => undefined)
      if (!isActivityList(initialData.activity)) await updateDoc(boardRef, { activity: fallbackActivity, updatedAt: serverTimestamp() }).catch(() => undefined)
      onRemoteState(initialGames, membersFromData({ ...initialData, games: initialGames }), initialGameNights, initialSessions, initialActivity, recommendationFeedbackFromData(initialData.recommendationFeedback))
    }
  }

  const unsubscribe = onSnapshot(boardRef, (nextSnapshot) => {
    if (!nextSnapshot.exists()) return
    const data = nextSnapshot.data() as BoardData
    latestMember = data.members?.[user.uid]
    if (isGameList(data.games)) onRemoteState(data.games, membersFromData(data), isGameNightList(data.gameNights) ? data.gameNights : [], isSessionList(data.sessions) ? data.sessions : [], isActivityList(data.activity) ? data.activity : [], recommendationFeedbackFromData(data.recommendationFeedback))
  })

  return {
    async save(games) {
      await updateDoc(boardRef, { games, updatedAt: serverTimestamp() })
    },
    async saveGameNights(gameNights) {
      await updateDoc(boardRef, { gameNights, updatedAt: serverTimestamp() })
    },
    async saveSessions(sessions) {
      await updateDoc(boardRef, { sessions, updatedAt: serverTimestamp() })
    },
    async saveActivity(activity) {
      await updateDoc(boardRef, { activity: activity.slice(0, 250), updatedAt: serverTimestamp() })
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
          excludedAt: downvotes.length >= 2 ? new Date().toISOString() : undefined,
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
