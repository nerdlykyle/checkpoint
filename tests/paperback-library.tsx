// Isolated, in-memory shelves. Never changes the shared board.
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import BookClub from '../src/BookClub'
import type { Book, BookShelf, Member } from '../src/types'
import '../src/index.css'
import '../src/App.css'
import '../src/VisualControls.css'

const common = { description: 'Paperback library preview.', addedBy: 'nern', createdAt: '2026-10-07', nominated: false, upvotes: [], downvotes: [], ratings: {}, comments: [], metadataEdited: true, genres: ['Fantasy'], progress: {} }
const books: Book[] = [
  { ...common, id:'starter', title:'Starter Villain', authors:['John Scalzi'], googleBooksId:'AVKBEAAAQBAJ', coverUrl:'https://books.google.com/books/content?id=AVKBEAAAQBAJ&printsec=frontcover&img=1&zoom=1&source=gbs_api', shelves:{nern:'reading'}, progress:{nern:{lastChapter:26,updatedAt:''}} },
  { ...common, id:'meddling', title:'Meddling Kids', authors:['Edgar Cantero'], googleBooksId:'q5ZnDQAAQBAJ', coverUrl:'https://books.google.com/books/content?id=q5ZnDQAAQBAJ&printsec=frontcover&img=1&zoom=1&source=gbs_api', shelves:{nern:'to-read'}, readerOrganization:{nern:{order:1,savedFrom:'jern'}} },
  ...(['to-read','to-read','read','paused','dnf'] as BookShelf[]).map((shelf,index)=>({ ...common, id:`sample-${index}`, title:['The First Voyage','The Last Voyage','A Finished Book','A Paused Book','An Unfinished Book'][index], authors:['Preview Author'], shelves:{nern:shelf}, ...(index<2 ? {series:{name:'Voyages',position:index+1}, readerOrganization:{nern:{order:index+2}}} : {}) })),
]
const crew = [{id:'nern',name:'Nern',initials:'N',color:'#8473ed'}, {id:'jern',name:'Jern',initials:'J',color:'#32b5a2'}] as Member[]
function Fixture() {
  const [items,setItems] = useState(books), [shelf,setShelf] = useState<BookShelf|'all'>('all'), [message,setMessage] = useState('Isolated preview — sample books only')
  return <><p role="status" style={{padding:16}}>{message}</p><BookClub books={items} currentUser="nern" crew={crew} section="library" shelfFilter={shelf} onShelfFilterChange={setShelf} search="" showAdd={false} onCloseAdd={()=>{}} onOpenAdd={()=>{}} onShowMyBooks={()=>{}} onChange={setItems} notify={setMessage}/></>
}
createRoot(document.getElementById('root')!).render(<Fixture/> )
