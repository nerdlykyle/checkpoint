// Real detail component, in-memory callbacks only. No shared board writes.
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { GameDetailsModal } from '../src/App'
import type { Game } from '../src/types'
import '../src/index.css'

const initial: Game = { id:'qa-game', title:'Example co-op game', status:'wishlist', note:'Preserve this note', progress:25, votes:[], color:'#30466c', accent:'#8e84d9', platform:'PC', genre:'Action', addedBy:'local-player', coverMark:'QA' }
function Fixture() {
  const [game,setGame]=useState(initial),[open,setOpen]=useState(true),[message,setMessage]=useState('No cloud writes')
  return <main><p role="status">{message}</p><button onClick={()=>setOpen(true)}>Open game</button>{open&&<GameDetailsModal game={game} onClose={()=>setOpen(false)} onSave={updates=>{setGame({...game,...updates});setMessage('Changes saved')}} onVote={()=>setMessage('Vote clicked')} onRemove={()=>setMessage('Remove game requested')} onChangeGame={()=>setMessage('Change game requested')} onRefreshArtwork={()=>setMessage('Artwork refresh requested')} onAddDlc={()=>setMessage('Add DLC requested')} onOpenPuzzle={()=>setMessage('Puzzle board requested')} onManualOwnershipChange={()=>setMessage('Ownership updated')}/>}</main>
}
createRoot(document.getElementById('root')!).render(<Fixture/>)
