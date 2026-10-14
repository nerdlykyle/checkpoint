// Isolated local-only data. Does not use a production board.
import {useState} from 'react'
import {createRoot} from 'react-dom/client'
import {PersonalBookCovers} from '../src/PersonalBookCovers'
import BookCoverEditor from '../src/BookCoverEditor'
import BookCoverImage from '../src/BookCoverImage'
import {refreshBookArtwork} from '../src/lib/bookArtwork'
import type {Book} from '../src/types'
import '../src/index.css'
import '../src/App.css'
const book:Book={id:'qa-cover',title:'The Sample Book',authors:['Example Author'],description:'Fixture only',addedBy:'owner',createdAt:'',nominated:false,upvotes:[],downvotes:[],shelves:{owner:'reading',friend:'read'},progress:{owner:{lastChapter:12,updatedAt:''}},ratings:{},comments:[]}
function Fixture(){
  const [editor,setEditor]=useState(false),[user,setUser]=useState('owner')
  const catalog=async()=>({results:[{catalogId:'fixture',source:'open-library' as const,title:'A matching edition',authors:['Example Author'],description:'',coverUrl:'https://covers.openlibrary.org/b/isbn/9780425082058-L.jpg',publishedYear:1985}]})
  return <PersonalBookCovers key={user} board="qa-personal-cover-editor" user={user} enabled><main style={{padding:24,maxWidth:800,margin:'auto'}}><h1>Personal covers</h1><p>Isolated test · signed in as {user} · chapter 12 remains unchanged</p><button onClick={()=>{setEditor(false);setUser(user==='owner'?'friend':'owner')}}>Switch test member</button><button onClick={()=>setEditor(true)}>Change my cover</button><button onClick={()=>refreshBookArtwork(book)}>Refresh catalog artwork</button><div style={{display:'flex',gap:24}}>{['owner','friend'].map(owner=><section key={owner}><h2>{owner}’s copy</h2><div className="book-cover is-large"><BookCoverImage book={book} owner={owner} large/></div></section>)}</div>{editor&&<BookCoverEditor book={book} searchCatalog={catalog} onClose={()=>setEditor(false)}/>}</main></PersonalBookCovers>
}
createRoot(document.getElementById('root')!).render(<Fixture/> )
