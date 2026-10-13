import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { LibraryCard, GameDetailsModal, MembersContext, IntegrationsContext } from '../src/App'
import FavoritesFixture from './FavoritesFixture'
import {useFavorites} from '../src/PersonalFavorites'
import MemberShelfPicker from '../src/MemberShelfPicker'
import GameShelf from '../src/GameShelf'
import NavigationSync from '../src/NavigationSync'
import type { Game, Member } from '../src/types'
import '../src/index.css'
import '../src/VisualControls.css'
const common = { status:'wishlist',progress:0,votes:[],color:'#30466c',accent:'#8e84d9',platform:'PC',genre:'Action',addedBy:'local-player',coverMark:'QA',note:'' } as const
const games: Game[] = [
  {...common,id:'base',title:'Portal 2',steamAppId:'620',votes:[],manualOwnership:{a:true,b:true,c:false}},
  {...common,id:'extra1',title:'Extra campaign',steamAppId:'620',contentType:'dlc',parentGameId:'base',votes:[]},
  {...common,id:'extra2',title:'Bonus levels',steamAppId:'620',contentType:'dlc',parentGameId:'base',votes:[]},
  {...common,id:'hl',title:'Half-Life 2',steamAppId:'220',votes:[],manualOwnership:{a:true,b:true,c:true}},
  {...common,id:'warframe',title:'Warframe',steamAppId:'230410',votes:[]},
  {...common,id:'fallback',title:'A Long Game Title With No Cover',votes:[]},
  {...common,id:'archived',title:'Archived Game',status:'archived',votes:[]},
]
const crew: Member[] = ['local-player','b','c'].map((id,i)=>({id,name:['Nern','Vern','Jern'][i],initials:['N','V','J'][i],color:'#635797'}))
const integrations = {boardId:'qa',steam:null,loading:false,error:null,deals:Object.fromEntries(['620','220'].map(id=>[id,{steamAppId:id,title:'Sample game',updatedAt:'2026-10-10',price:29.99,savingsPercent:50,storeName:'Sample store',dealUrl:'https://example.com',retailPrice:59.99}]))}
function Fixture() {
  const [message,setMessage]=useState('Isolated sample shelf — no cloud writes')
  const [selected,setSelected]=useState<Game|null>(null),[favoritesOnly,setFavoritesOnly]=useState(false),[reader,setReader]=useState('local-player')
  const favorites=useFavorites(),shown=favoritesOnly?games.filter(game=>favorites.members[reader]?.games.includes(game.id)):games
  const noop=()=>{}
  return <MembersContext.Provider value={crew}><IntegrationsContext.Provider value={integrations}><main style={{maxWidth:1100,margin:'auto',padding:20}}><p role="status">{message}</p><h1>Game library</h1><div className="filter-tabs"><button onClick={()=>setFavoritesOnly(false)}>All games</button><button onClick={()=>setFavoritesOnly(true)}>Favorites</button></div>{favoritesOnly&&<MemberShelfPicker crew={crew} currentUser="local-player" selected={reader} kind="games" onSelect={setReader}/>}<GameShelf games={shown} allGames={games} kind="library" renderCard={(game,options)=><LibraryCard key={game.id} game={game} onOpen={()=>setSelected(game)} onRestore={()=>setMessage(`Restored: ${game.title}`)} {...options}/>}/><h2>Navigation status samples</h2>{(['live','connecting','error','local'] as const).map(state=><NavigationSync key={state} state={state} label="Music"/>)}</main>{selected&&<GameDetailsModal game={selected} onClose={()=>setSelected(null)} onSave={noop} onVote={noop} onRemove={noop} onChangeGame={noop} onRefreshArtwork={noop} onAddDlc={noop} onOpenPuzzle={noop} onManualOwnershipChange={noop}/>}</IntegrationsContext.Provider></MembersContext.Provider>
}
createRoot(document.getElementById('root')!).render(<FavoritesFixture user="local-player" initial={{b:{games:['hl'],books:[],movies:[]}}}><Fixture/></FavoritesFixture>)
