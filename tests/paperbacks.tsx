// In-memory book home fixture. No sign-in or shared-board mutations.
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import BookClub from '../src/BookClub'
import BookmarkColorSettings from '../src/BookmarkColorSettings'
import type { Book, Member } from '../src/types'
import '../src/index.css'
import '../src/App.css'
import '../src/VisualControls.css'

const base = { description: 'Isolated layout fixture.', addedBy: 'nern', createdAt: '2026-10-07', nominated: false, upvotes: [], downvotes: [], ratings: {}, comments: [], metadataEdited: true, shelves: { nern: 'reading' as const, jern: 'reading' as const } }
const initial: Book[] = [
  { ...base, id: 'paper-chapter', title: 'Starter Villain', authors: ['John Scalzi'], googleBooksId: 'AVKBEAAAQBAJ', coverUrl: 'https://books.google.com/books/content?id=AVKBEAAAQBAJ&printsec=frontcover&img=1&zoom=1&source=gbs_api', progress: { nern: { lastChapter: 26, updatedAt: '' }, jern: { lastChapter: 4, updatedAt: '' } } },
  { ...base, id: 'paper-empty', title: 'Meddling Kids', authors: ['Edgar Cantero'], googleBooksId: 'q5ZnDQAAQBAJ', coverUrl: 'https://books.google.com/books/content?id=q5ZnDQAAQBAJ&printsec=frontcover&img=1&zoom=1&source=gbs_api', progress: {} },
  { ...base, id: 'paper-fallback', title: 'An Exceptionally Long Book Title Without Cover Artwork', authors: ['An Author With a Long Name', 'Another Author'], series: { name: 'An Unusually Long Series Name', position: 3 }, progress: { nern: { lastChapter: 0, updatedAt: '' } } },
]
initial[0].club = { status: 'reading', order: 0, participantIds: ['nern', 'jern', 'vern'] }
initial[0].progress.vern = { lastChapter: 9, updatedAt: '' }
const initialCrew = [{ id: 'nern', name: 'Nern' }, { id: 'jern', name: 'Jern' }, { id: 'vern', name: 'Vern' }] as Member[]
function Fixture() {
  const [crew, setCrew] = useState(initialCrew)
  const [books, setBooks] = useState(initial), [user, setUser] = useState('nern'), [message, setMessage] = useState('Isolated preview — no shared-board writes')
  return <><nav style={{ padding: 16, display: 'flex', gap: 12 }}><button className="button" onClick={() => setUser(user === 'nern' ? 'jern' : 'nern')}>Switch reader ({user})</button><span role="status">{message}</span></nav><BookClub books={books} currentUser={user} crew={crew} section="home" shelfFilter="all" onShelfFilterChange={() => {}} search="" showAdd={false} onCloseAdd={() => {}} onOpenAdd={() => {}} onShowMyBooks={() => {}} onChange={setBooks} notify={setMessage} /><div style={{ padding: 24 }}><BookmarkColorSettings key={user} member={crew.find(member => member.id === user)!} onSave={async color => { setCrew(current => current.map(member => member.id === user ? { ...member, bookmarkColor: color } : member)) }} /></div></>
}
createRoot(document.getElementById('root')!).render(<Fixture />)
