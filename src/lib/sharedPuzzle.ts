import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore'
import type { PuzzleBoard, PuzzlePoint, PuzzleStroke } from '../types'
import { database } from './firebase'

export type PuzzleConnection = {
  save: (board: PuzzleBoard) => Promise<void>
  close: Unsubscribe
}

function isPoint(value: unknown): value is PuzzlePoint {
  return Boolean(value && typeof value === 'object'
    && 'x' in value && typeof value.x === 'number'
    && 'y' in value && typeof value.y === 'number')
}

function isStroke(value: unknown): value is PuzzleStroke {
  return Boolean(value && typeof value === 'object'
    && 'id' in value && typeof value.id === 'string'
    && 'color' in value && typeof value.color === 'string'
    && 'width' in value && typeof value.width === 'number'
    && 'authorId' in value && typeof value.authorId === 'string'
    && 'points' in value && Array.isArray(value.points) && value.points.every(isPoint))
}

function puzzleFromData(value: unknown): PuzzleBoard | null {
  if (!value || typeof value !== 'object') return null
  const data = value as Partial<PuzzleBoard>
  if (typeof data.imageDataUrl !== 'string'
    || typeof data.imageName !== 'string'
    || typeof data.note !== 'string'
    || !Array.isArray(data.strokes)
    || !data.strokes.every(isStroke)) return null
  return {
    imageDataUrl: data.imageDataUrl,
    imageName: data.imageName,
    note: data.note,
    strokes: data.strokes,
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : '',
  }
}

export function connectPuzzle(
  boardId: string,
  gameId: string,
  onRemoteState: (board: PuzzleBoard) => void,
  onError: () => void,
): PuzzleConnection | null {
  if (!database) return null
  const puzzleRef = doc(database, 'boards', boardId, 'puzzles', gameId)
  const close = onSnapshot(puzzleRef, (snapshot) => {
    if (!snapshot.exists()) return
    const board = puzzleFromData(snapshot.data())
    if (board) onRemoteState(board)
  }, onError)

  return {
    async save(board) {
      await setDoc(puzzleRef, {
        imageDataUrl: board.imageDataUrl,
        imageName: board.imageName,
        note: board.note,
        strokes: board.strokes,
        updatedBy: board.updatedBy,
        updatedAt: serverTimestamp(),
      })
    },
    close,
  }
}
