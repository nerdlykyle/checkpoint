// Real component, isolated state: no cloud writes or session creation.
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import CampaignCard from '../src/CampaignCard'
import { campaignArtworkUrls } from '../src/lib/campaignArtwork'
import type { Game } from '../src/types'
import '../src/index.css'
import '../src/App.css'

const game:Game={id:'qa',title:'Warhammer 40,000: Space Marine 2',steamAppId:'2183900',status:'playing',note:'',progress:0,votes:[],color:'#30466c',accent:'#8e84d9',platform:'Steam',genre:'Action · Adventure',year:2024,addedBy:'nern',coverMark:'SM'}
function Fixture(){
 const [note,setNote]=useState(''),[sessionNote,setSessionNote]=useState(''),[expanded,setExpanded]=useState(false),[live,setLive]=useState(false),[variant,setVariant]=useState('normal'),[message,setMessage]=useState('Isolated preview — no cloud writes')
 const urls=variant==='missing'?['/tests/not-found.jpg']:variant==='fallback'?['/tests/not-found.jpg',...campaignArtworkUrls(game,[])]:campaignArtworkUrls(game,[])
 return <main style={{padding:16,maxWidth:1100,margin:'auto'}}><nav style={{display:'flex',flexWrap:'wrap',gap:10,marginBottom:16}}><button onClick={()=>setVariant('normal')}>Normal artwork</button><button onClick={()=>setVariant('fallback')}>Failed first image</button><button onClick={()=>setVariant('missing')}>Missing artwork</button><button onClick={()=>setVariant('empty')}>Empty campaign</button><button onClick={()=>setLive(!live)}>Toggle live session</button></nav><p role="status">{message}</p><div className="dashboard-grid"><CampaignCard game={variant==='empty'?undefined:game} artworkUrls={urls} hours={2} note={live?sessionNote:note} liveNote={live} noteExpanded={expanded} hasActiveSession={live} onToggleNote={()=>setExpanded(!expanded)} onNoteChange={live?setSessionNote:setNote} onSession={()=>setMessage(live?'Open live session':'Start session for Space Marine 2')} onPuzzle={()=>setMessage('Open puzzle board for Space Marine 2')} onDetails={()=>setMessage('Open details for Space Marine 2')} onAdd={()=>setMessage('Open add game')} /><aside className="queue-panel"><h2>Up next</h2><p>Neighboring queue for responsive layout testing.</p></aside></div></main>
}
createRoot(document.getElementById('root')!).render(<Fixture/> )
