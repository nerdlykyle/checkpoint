// Real library cards with local callbacks; no shared board writes.
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { LibraryCard } from '../src/App'
import type { Game } from '../src/types'
import '../src/index.css'

const initial: Game[] = [
  { id:'qa-cover',title:'Portal 2',steamAppId:620,status:'wishlist',progress:0,votes:[],color:'#30466c',accent:'#8e84d9',platform:'PC',genre:'Puzzle',addedBy:'local-player',coverMark:'P2',note:'' },
  { id:'qa-long',title:'An Exceptionally Long Co-op Game Title Without Artwork',status:'wishlist',progress:0,votes:[],color:'#30466c',accent:'#8e84d9',platform:'PC',genre:'Action · Adventure',addedBy:'local-player',coverMark:'QA',note:'' },
  { id:'qa-third',title:'Half-Life 2',steamAppId:220,status:'wishlist',progress:0,votes:['local-player'],color:'#654229',accent:'#e4a864',platform:'PC',genre:'Action',addedBy:'local-player',coverMark:'HL',note:'',manualOwnership:{nern:true} },
  { id:'qa-fourth',title:'Warframe',steamAppId:230410,status:'wishlist',progress:0,votes:[],color:'#234251',accent:'#91d6e0',platform:'PC',genre:'Action',addedBy:'local-player',coverMark:'WF',note:'' },
  { id:'qa-playing',title:'Portal 2',steamAppId:620,status:'playing',progress:35,votes:[],color:'#30466c',accent:'#8e84d9',platform:'PC',genre:'Puzzle',addedBy:'local-player',coverMark:'P2',note:'' },
]
function Fixture() {
  const [games,setGames]=useState(initial),[message,setMessage]=useState('Isolated game card preview — no cloud writes'),[library,setLibrary]=useState(false)
  return <main style={{maxWidth:960,margin:'auto',padding:16}}><p role="status">{message}</p><button className="button button-secondary" onClick={()=>setLibrary(!library)}>{library?'Show radar':'Show library'}</button><h2>{library?'Game library':'On the radar'}</h2><div className={library?'library-grid':'radar-grid'}>{games.map(game=><LibraryCard key={game.id} game={game} onOpen={()=>setMessage(`Opened ${game.title}`)} onVote={()=>{setGames(old=>old.map(item=>item.id===game.id?{...item,votes:item.votes.length?[]:['local-player']}:item));setMessage('Vote updated')}} onArchive={()=>{setGames(old=>old.map(item=>item.id===game.id?{...item,status:'archived'}:item));setMessage('Archived')}} onRestore={()=>{setGames(old=>old.map(item=>item.id===game.id?{...item,status:'wishlist'}:item));setMessage('Restored')}}/>)}</div></main>
}
createRoot(document.getElementById('root')!).render(<Fixture/> )
