// Isolated real components with in-memory data; never connects to a shared board.
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import BookClub from '../src/BookClub'
import ModeSwitcher from '../src/ModeSwitcher'
import { MusicLinks } from '../src/MusicDetails'
import { makeMusicItem } from '../src/lib/music'
import type { AppMode, Book, Member } from '../src/types'
import '../src/index.css'
import '../src/App.css'
import '../src/MusicMode.css'

const base = { authors: ['Frank Herbert'], description: 'Isolated UI preview.', addedBy: 'nern', createdAt: '2026-10-04', nominated: false, upvotes: [], downvotes: [], progress: { nern: { lastChapter: 26, updatedAt: '' } }, ratings: {}, comments: [], shelves: { nern: 'reading' as const } }
const initial: Book[] = [
  { ...base, id: 'qa-cover', title: 'Dune', coverUrl: 'https://covers.openlibrary.org/b/isbn/9780441172719-L.jpg', club: { status: 'reading', order: 1, participantIds: ['nern', 'jern', 'vern'] } },
  { ...base, id: 'qa-fallback', title: 'An Exceptionally Long Book Title Without Cover Artwork to Check Wrapping', authors: [], coverUrl: 'https://example.invalid/missing.jpg' },
]
const crew = [{ id: 'nern', name: 'Nern' }, { id: 'jern', name: 'Jern' }, { id: 'vern', name: 'Vern' }] as Member[]
const album = makeMusicItem({ id: 'qa-music', title: 'Test Album', artists: ['Example Artist'], kind: 'album', links: { spotify: 'https://open.spotify.com/album/0123456789012345678901' } }, 'nern')
function Fixture() {
  const [books, setBooks] = useState(initial), [mode, setMode] = useState<AppMode>('books')
  return <main style={{ maxWidth: 1000, margin: 'auto', padding: 16 }}>
    <div style={{ maxWidth: 240, paddingTop: 12 }}><ModeSwitcher mode={mode} onChange={setMode} /></div>
    <MusicLinks item={album} service="spotify" />
    <BookClub books={books} currentUser="nern" crew={crew} section="home" shelfFilter="all" onShelfFilterChange={() => {}} search="" showAdd={false} onCloseAdd={() => {}} onOpenAdd={() => {}} onShowMyBooks={() => {}} onChange={setBooks} notify={() => {}} />
  </main>
}
createRoot(document.getElementById('root')!).render(<Fixture />)
