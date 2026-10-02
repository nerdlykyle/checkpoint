// Isolated UI fixture: all records stay in memory; no production writes.
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import MemberShelfPicker from '../src/MemberShelfPicker'
import ManualSessionModal from '../src/ManualSessionModal'
import { createManualSession } from '../src/lib/manualSession'
import type { Game, GameSession, Member } from '../src/types'
import '../src/index.css'
import '../src/App.css'

const crew:Member[]=Array.from({length:20},(_,index)=>({id:`person-${index}`,name:['Nern','Jern','Vern'][index]||`Friend ${String(index+1).padStart(2,'0')}`,initials:['N','J','V'][index]||`F${index+1}`,color:'#6750ad'}))
const games=[{id:'far',title:'Far Far West',progress:0},{id:'lort',title:'LORT',progress:0}] as Game[]
function Fixture(){
 const [large,setLarge]=useState(false),[selected,setSelected]=useState('person-0'),[modal,setModal]=useState(false),[sessions,setSessions]=useState<GameSession[]>([])
 return <main style={{padding:20,maxWidth:800,margin:'auto'}}><p>Isolated test — no cloud writes</p><button onClick={()=>{setLarge(!large);setSelected('person-0')}}>Use {large?'3':'20'} members</button><MemberShelfPicker key={String(large)} crew={large?crew:crew.slice(0,3)} currentUser="person-0" selected={selected} kind="books" onSelect={setSelected}/><button onClick={()=>setModal(true)}>Add past session</button><div role="status">{sessions.map(session=><p key={session.id}>{session.gameTitle} · {session.participantIds.length} players · {session.note} · Completed: {session.endedAt}</p>)}</div>{modal&&<ManualSessionModal games={games} crew={crew.slice(0,3)} defaultGameId="far" onClose={()=>setModal(false)} onSave={input=>{setSessions([...sessions,createManualSession(input,games,crew,'person-0')]);setModal(false)}}/>}</main>
}
createRoot(document.getElementById('root')!).render(<Fixture/> )
