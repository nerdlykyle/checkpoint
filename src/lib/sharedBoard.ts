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
import type { Game, Member } from '../types'
import { database } from './firebase'

export type BoardConnection = {
  save: (games: Game[]) => Promise<void>
  close: Unsubscribe
}

type StoredMember = {
  name: string
  email: string
  photoUrl: string
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

function memberFromUser(user: User): StoredMember {
  return {
    name: user.displayName || 'Checkpoint player',
    email: user.email || '',
    photoUrl: user.photoURL || '',
    joinedAt: new Date().toISOString(),
  }
}

function membersFromData(data: BoardData): Member[] {
  return Object.entries(data.members ?? {}).map(([id, member], index) => ({
    id,
    name: member.name,
    initials: member.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
    color: ['#f6a44b', '#ec6f8f', '#69b8ff', '#7bd99a', '#a990e8'][index % 5],
    photoUrl: member.photoUrl,
  }))
}

export async function connectBoard(
  boardId: string,
  user: User,
  fallbackGames: Game[],
  onRemoteState: (games: Game[], members: Member[]) => void,
): Promise<BoardConnection | null> {
  if (!database) return null
  const boardRef = doc(database, 'boards', boardId)
  let snapshot

  try {
    snapshot = await getDoc(boardRef)
  } catch {
    try {
      // This succeeds only when the private board link has not been claimed yet.
      await setDoc(boardRef, {
        games: fallbackGames,
        ownerUid: user.uid,
        members: { [user.uid]: memberFromUser(user) },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    } catch {
      // Otherwise, the signed-in visitor may join the existing board only as themselves.
      await updateDoc(
        boardRef,
        new FieldPath('members', user.uid),
        memberFromUser(user),
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
      members: { [user.uid]: memberFromUser(user) },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  } else {
    const data = snapshot.data() as BoardData
    if (!data.members?.[user.uid]) {
      await updateDoc(
        boardRef,
        new FieldPath('members', user.uid),
        memberFromUser(user),
        'updatedAt',
        serverTimestamp(),
      )
    }
  }

  const unsubscribe = onSnapshot(boardRef, (nextSnapshot) => {
    if (!nextSnapshot.exists()) return
    const data = nextSnapshot.data() as BoardData
    if (isGameList(data.games)) onRemoteState(data.games, membersFromData(data))
  })

  return {
    async save(games) {
      await updateDoc(boardRef, { games, updatedAt: serverTimestamp() })
    },
    close: unsubscribe,
  }
}
