// Development-only fixture: in-memory records, no production board writes.
import { useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MusicContent, MusicNavigation } from '../src/MusicMode'
import { makeMusicItem, type MusicItem, type MusicSection, type MusicService } from '../src/lib/music'
import type { MusicMutation } from '../src/lib/musicStore'
import type { Member } from '../src/types'
import '../src/index.css'
import '../src/App.css'

const initial: MusicItem[] = [
  makeMusicItem({id:'qa-first',title:'First Light',year:'2024',artists:['The Test Signals'],kind:'album',genres:['Electronic'],tracks:[{id:'track-a',number:'1.1',title:'A New Frequency'},{id:'track-b',number:'1.2',title:'After Midnight'}]},'nern'),
  makeMusicItem({id:'qa-second',title:'Echoes of a Very Long Album Title to Test Responsive Music Cards',year:'2026',artists:['The Test Signals'],kind:'ep',genres:['Rock'],links:{spotify:'https://open.spotify.com/album/0123456789012345678901',youtube:'https://music.youtube.com/playlist?list=OLAK5uy_abcdefghijklmnop'}},'nern'),
  makeMusicItem({id:'qa-third',title:'Quiet Hours',artists:['Example Trio'],kind:'album',genres:['Jazz']},'jern'),
  makeMusicItem({id:'qa-song',title:'Late Train',artists:['Example Trio'],kind:'song'},'vern'),
].map((item,index)=>({...item,...(index===0?{coverUrl:`${location.origin}/tests/music-cover.svg`}:{}),shelves:index<2?{nern:'to-listen',jern:'listening'}:index===2?{jern:'to-listen'}:{},organization:{nern:{order:index+1,...(index===1?{savedFrom:'jern'}:{})}},...(index===1?{nominated:true,downvotes:['jern','vern']}:{}),...(index===3?{sharedBy:'vern'}:{})})) as MusicItem[]
const crew=[{id:'nern',name:'Nern'},{id:'jern',name:'Jern'},{id:'vern',name:'Vern'}] as Member[]
const turntableQA=new URLSearchParams(location.search).has('turntable')
if(turntableQA)initial[0].club={status:'listening',order:0,participants:['nern','jern']}
function Fixture() {
  const [items,setItems]=useState(initial), [section,setSection]=useState<MusicSection>(turntableQA?'home':'library'), [showAdd,setAdd]=useState(false), [service,setService]=useState<MusicService>('spotify'),[message,setMessage]=useState('Isolated music QA — no cloud writes')
  const ref=useRef(items);ref.current=items
  const apply=async(changes:{id:string;update:MusicMutation;initial?:MusicItem}[])=>{let next=ref.current;for(const change of changes){const old=next.find(item=>item.id===change.id)||change.initial;if(!old)throw new Error('Missing fixture record');const updated=change.update(old);next=next.some(item=>item.id===change.id)?next.map(item=>item.id===change.id?updated:item):[...next,updated]}ref.current=next;setItems(next)}
  const store={items,ready:true,status:'Isolated test collection',error:'',service,apply,saveService:async(value:MusicService)=>setService(value),retry:()=>{},clubSession:async(id:string,action:'start'|'finish')=>{if(action==='start'&&ref.current.some(item=>item.id!==id&&item.club?.status==='listening'))throw new Error('Finish the current group listen first.');await apply([{id,update:old=>({...old,nominated:false,club:{status:action==='start'?'listening':'listened',order:0,participants:['nern']}})}])}}
  return <><header style={{padding:16}}><p role="status">{message}</p><MusicNavigation section={section} onSelect={setSection}/></header><MusicContent boardId="qa-music" user="nern" crew={crew} section={section} onSection={setSection} search="" showAdd={showAdd} onCloseAdd={()=>setAdd(false)} onOpenAdd={()=>setAdd(true)} notify={setMessage} boardReady store={store}/></>
}
createRoot(document.getElementById('root')!).render(<Fixture/> )
