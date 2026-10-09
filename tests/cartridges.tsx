// Isolated real components. No authentication, persistence, or shared-board writes.
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Heart } from 'lucide-react'
import { LibraryCard } from '../src/App'
import CampaignCard from '../src/CampaignCard'
import type { Game } from '../src/types'
import '../src/index.css'

const art = 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/2183900/library_600x900_2x.jpg'
const base: Game = { id:'preview',title:'Space Marine 2',status:'playing',progress:42,votes:[],note:'Meet at the next checkpoint.',color:'#324966',accent:'#8d7eea',platform:'PC',genre:'Action',addedBy:'preview',coverMark:'SM',coverUrl:art }
const initial: Game[] = [{...base,id:'portal',title:'Portal 2',status:'wishlist',progress:0,steamAppId:'620',coverUrl:undefined},{...base,id:'long',title:'An Exceptionally Long Co-op Game Title Without Artwork',coverUrl:undefined,status:'completed',progress:0},{...base,id:'archive',title:'Archived game',status:'archived'}]
function Fixture() {
  const [games,setGames]=useState(initial),[message,setMessage]=useState('Isolated preview — no cloud writes'),[note,setNote]=useState('Meet at the next checkpoint.'),[expanded,setExpanded]=useState(false),[votes,setVotes]=useState(false)
  const ownership=<span className="ownership-badge is-compact"><span className="owner-avatars">{['N','J'].map(id=><span className="avatar avatar-small" style={{background:'#665788',color:'white'}} key={id}>{id}</span>)}</span><span>2/3 own</span></span>
  const vote=<button className={`vote-button ${votes?'is-voted':''}`} aria-label="Vote for Space Marine 2" onClick={()=>setVotes(!votes)}><Heart size={16} fill={votes?'currentColor':'none'}/>{votes?1:0}</button>
  return <main style={{maxWidth:1300,margin:'auto',padding:16}}>
    <p role="status">{message}</p><div className="dashboard-grid">
      <CampaignCard game={base} artworkUrls={[art]} hours={2} note={note} liveNote={false} noteExpanded={expanded} hasActiveSession={false} onToggleNote={()=>setExpanded(!expanded)} onNoteChange={setNote} onSession={()=>setMessage('Start session')} onPuzzle={()=>setMessage('Open puzzle board')} onDetails={()=>setMessage('Campaign details opened')} onAdd={()=>{}} vote={vote} ownership={ownership} price={<a className="deal-badge is-compact" href="#preview-price"><strong>$23.99</strong><em>−40%</em></a>}/>
      <aside className="queue-panel"><h2>Up next</h2><p>Cartridge preview · local test data only</p></aside></div>
    <h2>On the radar</h2><div className="radar-grid">{games.map(game=><LibraryCard key={game.id} game={game} onOpen={()=>setMessage(`Details: ${game.title}`)} onVote={()=>{setGames(old=>old.map(item=>item.id===game.id?{...item,votes:item.votes.length?[]:['local-player']}:item));setMessage('Vote updated')}} onArchive={()=>{setGames(old=>old.map(item=>item.id===game.id?{...item,status:'archived'}:item));setMessage('Archived')}} onRestore={()=>{setGames(old=>old.map(item=>item.id===game.id?{...item,status:'wishlist'}:item));setMessage('Restored')}}/>)}</div>
  </main>
}
createRoot(document.getElementById('root')!).render(<Fixture/> )
