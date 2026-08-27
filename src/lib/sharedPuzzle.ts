import {
  doc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'
import type { PuzzleBoard, PuzzleImage, PuzzlePage, PuzzlePoint, PuzzleStroke } from '../types'
import { database } from './firebase'

export type PuzzleSaveOptions = {
  pageIds: string[]
  deletedPageIds?: string[]
  structure?: boolean
}

export type PuzzleConnection = {
  save: (board: PuzzleBoard, options: PuzzleSaveOptions) => Promise<void>
  close: Unsubscribe
}

type PuzzlePageMeta = Pick<PuzzlePage, 'id' | 'title'>

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value))
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

function imageFromData(value: unknown): PuzzleImage | null {
  if (!value || typeof value !== 'object') return null
  const image = value as Partial<PuzzleImage>
  if (typeof image.id !== 'string' || typeof image.name !== 'string' || typeof image.dataUrl !== 'string') return null
  return {
    id: image.id,
    name: image.name,
    dataUrl: image.dataUrl,
    x: clamp(typeof image.x === 'number' ? image.x : .08, 0, 1),
    y: clamp(typeof image.y === 'number' ? image.y : .08, 0, 1),
    width: clamp(typeof image.width === 'number' ? image.width : .84, .08, 1),
    height: clamp(typeof image.height === 'number' ? image.height : .84, .08, 1),
    cropX: clamp(typeof image.cropX === 'number' ? image.cropX : 0, -1, 1),
    cropY: clamp(typeof image.cropY === 'number' ? image.cropY : 0, -1, 1),
    cropZoom: clamp(typeof image.cropZoom === 'number' ? image.cropZoom : 1, 1, 3),
  }
}

function pageFromData(value: unknown, fallbackId: string, fallbackTitle: string): PuzzlePage | null {
  if (!value || typeof value !== 'object') return null
  const page = value as Partial<PuzzlePage>
  if (typeof page.note !== 'string' || !Array.isArray(page.strokes) || !page.strokes.every(isStroke)) return null
  const images = Array.isArray(page.images) ? page.images.map(imageFromData).filter((image): image is PuzzleImage => Boolean(image)) : []
  return {
    id: typeof page.id === 'string' ? page.id : fallbackId,
    title: typeof page.title === 'string' ? page.title : fallbackTitle,
    note: page.note,
    strokes: page.strokes,
    images,
  }
}

function pageMetaFromData(value: unknown): PuzzlePageMeta | null {
  if (!value || typeof value !== 'object') return null
  const page = value as Partial<PuzzlePageMeta>
  if (typeof page.id !== 'string' || typeof page.title !== 'string') return null
  return { id: page.id, title: page.title }
}

export function createPuzzlePage(title = 'Puzzle 1'): PuzzlePage {
  return { id: crypto.randomUUID(), title, note: '', strokes: [], images: [] }
}

export function createEmptyPuzzleBoard(updatedBy: string): PuzzleBoard {
  return { pages: [createPuzzlePage()], updatedBy }
}

export function normalizePuzzleBoard(value: unknown, updatedBy: string): PuzzleBoard {
  if (!value || typeof value !== 'object') return createEmptyPuzzleBoard(updatedBy)
  const data = value as Record<string, unknown>
  if (Array.isArray(data.pages)) {
    const pages = data.pages
      .map((page, index) => pageFromData(page, `page-${index + 1}`, `Puzzle ${index + 1}`))
      .filter((page): page is PuzzlePage => Boolean(page))
    if (pages.length) return { pages, updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : updatedBy }
  }

  // Version 1 stored one background image and drawing directly on the game doc.
  // Convert it to the first page in memory; it is written to the new page format
  // only after the user makes a change.
  if (typeof data.note === 'string' && Array.isArray(data.strokes) && data.strokes.every(isStroke)) {
    const images: PuzzleImage[] = typeof data.imageDataUrl === 'string' && data.imageDataUrl
      ? [{
          id: 'legacy-image',
          name: typeof data.imageName === 'string' ? data.imageName : 'Puzzle image',
          dataUrl: data.imageDataUrl,
          x: .04,
          y: .04,
          width: .92,
          height: .92,
          cropX: 0,
          cropY: 0,
          cropZoom: 1,
        }]
      : []
    return {
      pages: [{ id: 'main', title: 'Puzzle 1', note: data.note, strokes: data.strokes, images }],
      updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : updatedBy,
    }
  }
  return createEmptyPuzzleBoard(updatedBy)
}

export function connectPuzzle(
  boardId: string,
  gameId: string,
  onRemoteState: (board: PuzzleBoard) => void,
  onError: () => void,
): PuzzleConnection | null {
  if (!database) return null
  const firestore = database
  const puzzleRef = doc(firestore, 'boards', boardId, 'puzzles', gameId)
  let modern = false
  let closed = false
  let generation = 0
  let pageUnsubscribes: Unsubscribe[] = []

  function closePages() {
    pageUnsubscribes.forEach((unsubscribe) => unsubscribe())
    pageUnsubscribes = []
  }

  function watchPages(meta: PuzzlePageMeta[], updatedBy: string) {
    generation += 1
    const watchGeneration = generation
    closePages()
    const pageData = new Map<string, PuzzlePage>()
    const loaded = new Set<string>()
    const emit = () => {
      if (closed || watchGeneration !== generation || loaded.size !== meta.length) return
      onRemoteState({
        pages: meta.map((item) => pageData.get(item.id) ?? { ...item, note: '', strokes: [], images: [] }),
        updatedBy,
      })
    }
    for (const item of meta) {
      const pageRef = doc(firestore, 'boards', boardId, 'puzzles', gameId, 'pages', item.id)
      pageUnsubscribes.push(onSnapshot(pageRef, (snapshot) => {
        const page = snapshot.exists() ? pageFromData(snapshot.data(), item.id, item.title) : null
        pageData.set(item.id, page ? { ...page, id: item.id, title: item.title } : { ...item, note: '', strokes: [], images: [] })
        loaded.add(item.id)
        emit()
      }, onError))
    }
  }

  const closeRoot = onSnapshot(puzzleRef, (snapshot) => {
    if (!snapshot.exists()) return
    const data = snapshot.data() as Record<string, unknown>
    const meta = Array.isArray(data.pages)
      ? data.pages.map(pageMetaFromData).filter((page): page is PuzzlePageMeta => Boolean(page)).slice(0, 20)
      : []
    if (data.version === 2 && meta.length) {
      modern = true
      watchPages(meta, typeof data.updatedBy === 'string' ? data.updatedBy : '')
      return
    }
    modern = false
    closePages()
    onRemoteState(normalizePuzzleBoard(data, typeof data.updatedBy === 'string' ? data.updatedBy : ''))
  }, onError)

  return {
    async save(board, options) {
      const batch = writeBatch(firestore)
      const writeStructure = Boolean(options.structure || !modern)
      const pageIds = new Set(options.pageIds)
      if (!modern) board.pages.forEach((page) => pageIds.add(page.id))
      if (writeStructure) {
        batch.set(puzzleRef, {
          version: 2,
          pages: board.pages.slice(0, 20).map(({ id, title }) => ({ id, title })),
          updatedBy: board.updatedBy,
          updatedAt: serverTimestamp(),
        })
      }
      for (const page of board.pages) {
        if (!pageIds.has(page.id)) continue
        const pageRef = doc(firestore, 'boards', boardId, 'puzzles', gameId, 'pages', page.id)
        batch.set(pageRef, {
          title: page.title,
          note: page.note,
          strokes: page.strokes,
          images: page.images,
          updatedBy: board.updatedBy,
          updatedAt: serverTimestamp(),
        })
      }
      for (const pageId of options.deletedPageIds ?? []) {
        batch.delete(doc(firestore, 'boards', boardId, 'puzzles', gameId, 'pages', pageId))
      }
      await batch.commit()
      if (writeStructure) modern = true
    },
    close() {
      closed = true
      generation += 1
      closePages()
      closeRoot()
    },
  }
}
