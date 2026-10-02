// Isolated visual checks; never loads or writes the user's board.
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import BookCoverImage from '../src/BookCoverImage'
import '../src/index.css'
import '../src/App.css'
import '../src/BookOrganizer.css'
const base = { title: 'The Great Gatsby', authors: ['F. Scott Fitzgerald'] }
function Fixture() {
  const [retry,setRetry]=useState(0), [replacement,setReplacement]=useState(false)
  return <main style={{padding:20}}><h1>Mobile artwork recovery</h1><p>Isolated fixtures — no cloud writes</p>
    <article><h2>Failed saved URL → ISBN fallback</h2><div className="book-cover"><BookCoverImage book={{...base,coverUrl:'https://covers.openlibrary.org/b/id/0-M.jpg?default=false',isbn13:'9780743273565'}} retry={retry}/></div></article>
    <article><h2>No saved artwork → known work</h2><div className="organized-cover"><BookCoverImage book={{...base,openLibraryKey:'/works/OL468431W'}}/></div></article>
    <article><h2>Replace a broken URL</h2><div className="book-cover"><BookCoverImage book={{title:'Replacement test',authors:[],coverUrl:replacement?'https://covers.openlibrary.org/b/id/8231432-M.jpg?default=false':'https://covers.openlibrary.org/b/id/0-M.jpg?default=false'}}/></div><button onClick={()=>setReplacement(true)}>Use working artwork</button></article>
    <button onClick={()=>setRetry(value=>value+1)}>Retry artwork</button>
  </main>
}
createRoot(document.getElementById('root')!).render(<Fixture/>)
