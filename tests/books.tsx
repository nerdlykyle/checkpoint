// Development-only fixture: in-memory data, no board writes or production build entry.
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import BookClub, { type BookSection, type BookShelfFilter } from '../src/BookClub'
import type { Book, Member } from '../src/types'
import '../src/index.css'
import '../src/App.css'

const base = { authors: ['Example Author'], description: 'A fictional book for isolated UI testing.', addedBy: 'nern', createdAt: '2026-10-01', nominated: false, upvotes: [], downvotes: [], progress: {}, ratings: {}, comments: [], metadataEdited: true }
const initial: Book[] = [
  { ...base, id:'qa-a', title:'The First Signal', series:{name:'Signal Trilogy',position:1,total:3}, genres:['Sci-fi','Horror'], shelves:{nern:'to-read',jern:'read'}, readerOrganization:{nern:{order:1,tags:['Audiobook']}} },
  { ...base, id:'qa-b', title:'The Second Signal', series:{name:'Signal Trilogy',position:2,total:3}, genres:['Sci-fi'], shelves:{nern:'to-read',vern:'reading'}, readerOrganization:{nern:{order:2}}, progress:{vern:{lastChapter:9,updatedAt:''}} },
  { ...base, id:'qa-c', title:'The Haunted Garden', genres:['Horror'], shelves:{nern:'to-read',jern:'reading'}, readerOrganization:{nern:{order:3}}, ratings:{jern:{stars:4,review:'Eerie!',updatedAt:''}} },
  { ...base, id:'qa-d', title:'The Final Signal', series:{name:'Signal Trilogy',position:3,total:3}, genres:['Sci-fi'], shelves:{jern:'to-read'} },
]
const crew = [{id:'nern',name:'Nern'},{id:'jern',name:'Jern'},{id:'vern',name:'Vern'}] as Member[]
function Fixture() {
  const [books,setBooks] = useState(initial)
  const [section,setSection] = useState<BookSection>('library')
  const [shelf,setShelf] = useState<BookShelfFilter>('all')
  const [add,setAdd] = useState(false)
  const [message,setMessage] = useState('Isolated test shelf — no cloud writes')
  return <><nav style={{padding:16,display:'flex',gap:12}}><button onClick={() => setSection('library')}>My books</button><button onClick={() => {setSection('readers');setShelf('all')}}>Readers’ shelves</button><span role="status">{message}</span></nav><BookClub books={books} currentUser="nern" crew={crew} section={section} shelfFilter={shelf} onShelfFilterChange={setShelf} search="" showAdd={add} onCloseAdd={() => setAdd(false)} onOpenAdd={() => setAdd(true)} onShowMyBooks={() => {setSection('library');setShelf('all')}} onChange={setBooks} notify={setMessage}/></>
}
createRoot(document.getElementById('root')!).render(<Fixture />)
