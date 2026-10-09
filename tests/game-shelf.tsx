import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { LibraryCard } from '../src/App'
import GameShelf from '../src/GameShelf'
import NavigationSync from '../src/NavigationSync'
import type { Game } from '../src/types'
import '../src/index.css'
import '../src/VisualControls.css'
const common = { status:'wishlist',progress:0,votes:[],color:'#30466c',accent:'#8e84d9',platform:'PC',genre:'Action',addedBy:'local-player',coverMark:'QA',note:'' } as const
const games: Game[] = [
  {...common,id:'base',title:'Portal 2',steamAppId:'620',votes:[]},
  {...common,id:'extra1',title:'Extra campaign',steamAppId:'620',contentType:'dlc',parentGameId:'base',votes:[]},
  {...common,id:'extra2',title:'Bonus levels',steamAppId:'620',contentType:'dlc',parentGameId:'base',votes:[]},
  {...common,id:'hl',title:'Half-Life 2',steamAppId:'220',votes:[]},
  {...common,id:'warframe',title:'Warframe',steamAppId:'230410',votes:[]},
  {...common,id:'fallback',title:'A Long Game Title With No Cover',votes:[]},
]
function Fixture() {
  const [message,setMessage]=useState('Isolated sample shelf — no cloud writes')
  return <main style={{maxWidth:1000,margin:'auto',padding:20}}><p role="status">{message}</p><h1>Game library</h1><GameShelf games={games} allGames={games} kind="library" renderCard={(game,options)=><LibraryCard key={game.id} game={game} onOpen={()=>setMessage(`Details: ${game.title}`)} {...options}/>}/><h2>Navigation status samples</h2>{(['live','connecting','error','local'] as const).map(state=><NavigationSync key={state} state={state} label="Music"/>)}</main>
}
createRoot(document.getElementById('root')!).render(<Fixture/> )
