import type { User } from 'firebase/auth'
import {
  FieldPath,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore'
import type { Game, Member, Persona } from '../types'
import { database } from './firebase'

export type BoardConnection = {
  save: (games: Game[]) => Promise<void>
  saveProfileImage: (customPhotoUrl: string | null) => Promise<void>
  close: Unsubscribe
}

type StoredMember = {
  name: string
  persona?: Persona
  email: string
  photoUrl: string
  googlePhotoUrl?: string
  customPhotoUrl?: string
  joinedAt: string
}

type BoardData = {
  games?: unknown
  members?: Record<string, StoredMember>
}

export function getBoardId() {
  const match = window.location.hash.match(/(?:^#|&)board=([0-9a-f-]{36})/i)
  if (match) {
    localStorage.setItem('checkpoint-board-id', match[1])
    return match[1]
  }
  const stored = localStorage.getItem('checkpoint-board-id')
  const id = stored && /^[0-9a-f-]{36}$/i.test(stored) ? stored : crypto.randomUUID()
  localStorage.setItem('checkpoint-board-id', id)
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#board=${id}`)
  return id
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
  onRemoteState: (games: Game[], members: Member[]) => void,
): Promise<BoardConnection | null> {
  if (!database) return null
  const boardRef = doc(database, 'boards', boardId)
  let latestMember: StoredMember | undefined
  let snapshot

  try {
    snapshot = await getDoc(boardRef)
  } catch {
    try {
      // This succeeds only when the private board link has not been claimed yet.
      await setDoc(boardRef, {
        games: fallbackGames,
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

  const unsubscribe = onSnapshot(boardRef, (nextSnapshot) => {
    if (!nextSnapshot.exists()) return
    const data = nextSnapshot.data() as BoardData
    latestMember = data.members?.[user.uid]
    if (isGameList(data.games)) onRemoteState(data.games, membersFromData(data))
  })

  return {
    async save(games) {
      await updateDoc(boardRef, { games, updatedAt: serverTimestamp() })
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
    close: unsubscribe,
  }
}
