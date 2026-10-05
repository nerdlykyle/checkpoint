// Real library cards with local callbacks; no shared board writes.
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { LibraryCard } from '../src/App'
import type { Game } from '../src/types'
import '../src/index.css'

const initial: Game[] = [
  { id:'qa-cover',title:'Portal 2',steamAppId:620,status:'wishlist',progress:0,votes:[],color:'#30466c',accent:'#8e84d9',platform:'PC',genre:'Puzzle',addedBy:'local-player',coverMark:'P2',note:'' },
  { id:'qa-long',title:'An Exceptionally Long Co-op Game Title Without Artwork',status:'wishlist',progress:0,votes:[],color:'#30466c',accent:'#8e84d9',platform:'PC',genre:'Action · Adventure',addedBy:'local-player',coverMark:'QA',note:'' },
]
function Fixture() {
  const [games,setGames]=useState(initial),[message,setMessage]=useState('Isolated Clean Split preview — no cloud writes')
  return <main style={{maxWidth:960,margin:'auto',padding:16}}><p role="status">{message}</p><h2>On the radar</h2><div className="radar-grid">{games.map(game=><LibraryCard key={game.id} game={game} onOpen={()=>setMessage(`Opened ${game.title}`)} onVote={()=>{setGames(old=>old.map(item=>item.id===game.id?{...item,votes:item.votes.length?[]:['local-player']}:item));setMessage('Vote updated')}} onArchive={()=>{setGames(old=>old.map(item=>item.id===game.id?{...item,status:'archived'}:item));setMessage('Archived')}} onRestore={()=>{setGames(old=>old.map(item=>item.id===game.id?{...item,status:'wishlist'}:item));setMessage('Restored')}}/>)}</div></main>
}
createRoot(document.getElementById('root')!).render(<Fixture/> )
