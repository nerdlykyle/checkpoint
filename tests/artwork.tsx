// Isolated fixture: catalog responses are mocked, cover images are real. No
// Firebase imports, saved shelves, sign-in, or cloud writes. Start Vite with
// VITE_GOOGLE_BOOKS_API_KEY=artwork-fixture (never a real key for this fixture).
import { createRoot } from 'react-dom/client'
import BookCoverImage from '../src/BookCoverImage'
import { refreshBookArtwork } from '../src/lib/bookArtwork'
import '../src/index.css'
import '../src/App.css'

const books = [
  { title: 'Meddling Kids', authors: ['Edgar Cantero'], coverUrl: 'https://covers.openlibrary.org/b/id/8446638-M.jpg?default=false', openLibraryKey: '/works/OL19334534W', recoveredId: 'q5ZnDQAAQBAJ' },
  { title: 'Starter Villain', authors: ['John Scalzi'], coverUrl: 'https://covers.openlibrary.org/b/id/13472546-M.jpg?default=false', openLibraryKey: '/works/OL28851765W', recoveredId: 'AVKBEAAAQBAJ' },
  { title: 'Exit Strategy', authors: ['Martha Wells'], coverUrl: 'https://covers.openlibrary.org/b/id/0-M.jpg?default=false', recoveredId: 'hCBGDwAAQBAJ' },
]
const originalFetch = window.fetch.bind(window)
window.fetch = async (input, init) => {
  const url = new URL(String(input))
  if (url.hostname === 'openlibrary.org') return Response.json({}, { status: 503 })
  if (url.hostname === 'www.googleapis.com' && url.pathname.startsWith('/books/v1/')) {
    const query = url.searchParams.get('q') ?? ''
    const match = books.find(book => query.includes(book.title))
    return Response.json({ items: match ? [{ id: match.recoveredId, volumeInfo: { title: match.title, authors: match.authors, imageLinks: { thumbnail: `https://books.google.com/books/content?id=${match.recoveredId}&printsec=frontcover&img=1&zoom=1&source=gbs_api` } } }] : [] })
  }
  return originalFetch(input, init)
}
function Fixture() {
  return <main style={{ padding: 20, maxWidth: 900, margin: 'auto' }}><h1>Cover recovery check</h1><p>Isolated test: unavailable Open Library metadata, real Google cover images. No shelf writes.</p>
    <button className="button" onClick={() => refreshBookArtwork(books[1])}>Refresh Starter Villain artwork</button>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 20, marginTop: 20 }}>
      {[...books, books[1]].map((book, index) => <article key={index} style={{ display: 'flex', gap: 16, padding: 16, background: '#182025', borderRadius: 16 }}>
        <div className="book-cover is-large"><BookCoverImage book={book} large={index === 3} /></div><div><h2 style={{ fontSize: 20 }}>{book.title}</h2><p>{book.authors[0]}</p><small>{index === 3 ? 'Second instance · detail-size cover' : 'Shelf cover'}</small></div>
      </article>)}
    </div>
  </main>
}
createRoot(document.getElementById('root')!).render(<Fixture />)
