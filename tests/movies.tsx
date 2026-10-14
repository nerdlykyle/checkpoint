// Isolated local fixture. It does not connect to a production board.
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import FavoritesFixture from './FavoritesFixture'
import { MovieContent, MovieNavigation } from '../src/MovieMode'
import { changeMovie, makeMovie, movieId, rateMovie, reviewMovie, type Movie, type MovieSection } from '../src/lib/movies'
import type { Member } from '../src/types'
import type { movieRequest } from '../src/lib/movieSearch'
import '../src/index.css'
import '../src/App.css'
const draft = {title:'The Last Signal',year:'2026',posterUrl:'',description:'An astronomer follows a mysterious transmission to a coastal town. A fictional film used only for this isolated preview.'}
const initial = await Promise.all(['The Last Signal','Midnight Pines','Golden Hour'].map(async (title,index) => ({...makeMovie(await movieId({...draft,title}),{...draft,title},'owner'),posterUrl:index<2?`${location.origin}/tests/movie-poster.svg`:'',clubStatus:index===0?'watching':'up-next',queuedAt:String(index),libraries:index===0?{owner:true}:index===1?{owner:true,friend:true}:{friend:true},seenBy:index===1?{friend:true}:index===2?{friend:false}:{}} as Movie)))
// Existing catalog movies deliberately have no saved series field. The detail
// mock must hydrate these and stack them without changing either record.
if (new URLSearchParams(location.search).has('series')) {
  for (const [tmdbId,title,year] of [[105,'Back to the Future','1985'],[165,'Back to the Future Part II','1989']] as const) {
    initial.push({...makeMovie(`qa-${tmdbId}`,{...draft,tmdbId,title,year},'owner'),posterUrl:`${location.origin}/tests/movie-poster.svg`,clubStatus:'up-next',queuedAt:year,libraries:{owner:true,friend:true},seenBy:{owner:tmdbId===105}})
  }
}
// Deliberately delayed mock responses exercise stale-result protection, empty
// results and catalog failures without a credential or production API call.
const fixtureCatalog: typeof movieRequest = async <T,>(_board: string, params: Record<string,string>): Promise<T> => {
  await new Promise(resolve => setTimeout(resolve, params.q === 'old' ? 1200 : 80))
  if (params.q === 'outage') throw new Error('Movie search is busy. Wait a moment and try again.')
  if (params.action === 'detail' && ['105','165'].includes(params.id)) return {tmdbId:Number(params.id),collection:{id:264,name:'Back to the Future Collection'}} as T
  const result = {tmdbId:12345,title:'Catalog QA Movie',year:'1999',posterUrl:'https://example.test/qa-poster.jpg',description:'A synopsis supplied by the test catalog.'}
  return (params.action === 'detail' ? result : {items: params.q === 'empty' ? [] : [{...result,title:params.q === 'old' ? 'Stale Result' : result.title}]}) as T
}
function Fixture() {
  const [items,setItems] = useState(initial),[section,setSection] = useState<MovieSection>('home'),[showAdd,setAdd] = useState(false),[message,setMessage] = useState('Isolated movie QA — no cloud writes')
  const store = { items, ready:true, connection:'local' as const,error:'',retry:()=>{},
    add:async(draft:Parameters<typeof makeMovie>[1])=>{const id=await movieId(draft);setItems(old=>old.some(item=>item.id===id)?old.map(item=>item.id===id?changeMovie(item,'owner','save',''):item):[...old,makeMovie(id,draft,'owner')]);return id},
    edit:async(id:string,draft:Parameters<typeof makeMovie>[1])=>{setItems(old=>old.map(item=>item.id===id?{...item,...draft}:item))},
    rate:async(id:string,stars:number)=>{setItems(old=>old.map(item=>item.id===id?rateMovie(item,'owner',stars):item))},
    review:async(id:string,text:string)=>{setItems(old=>old.map(item=>item.id===id?reviewMovie(item,'owner',text):item))},
    action:async(id:string,action:Parameters<typeof changeMovie>[2])=>{setItems(old=>old.map(item=>item.id===id?changeMovie(item,'owner',action,old.find(item=>item.clubStatus==='watching')?.id||''):item))},
  }
  return <><header style={{padding:16}}><p role="status">{message}</p><button aria-label="Add movie" onClick={()=>setAdd(true)}>+</button><MovieNavigation section={section} onSelect={setSection}/></header><MovieContent boardId="qa-movies" user="owner" crew={[{id:'owner',name:'Owner',initials:'O',color:'#7568e8'},{id:'friend',name:'Friend',initials:'F',color:'#358a85'}] as Member[]} section={section} onSection={setSection} search="" showAdd={showAdd} onCloseAdd={()=>setAdd(false)} notify={setMessage} boardReady store={store} catalogRequest={fixtureCatalog}/></>
}
createRoot(document.getElementById('root')!).render(<FavoritesFixture user="owner" initial={{friend:{games:[],books:[],movies:[initial[1].id]}}}><Fixture/></FavoritesFixture>)
