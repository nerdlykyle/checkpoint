// Isolated local fixture. It does not connect to a production board.
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MovieContent, MovieNavigation } from '../src/MovieMode'
import { changeMovie, makeMovie, movieId, type Movie, type MovieSection } from '../src/lib/movies'
import type { Member } from '../src/types'
import type { movieRequest } from '../src/lib/movieSearch'
import '../src/index.css'
import '../src/App.css'
const draft = {title:'The Last Signal',year:'2026',posterUrl:'',description:'An astronomer follows a mysterious transmission to a coastal town. A fictional film used only for this isolated preview.'}
const initial = await Promise.all(['The Last Signal','Midnight Pines','Golden Hour'].map(async (title,index) => ({...makeMovie(await movieId({...draft,title}),{...draft,title},'owner'),posterUrl:index<2?`${location.origin}/tests/movie-poster.svg`:'',clubStatus:index===0?'watching':'up-next',queuedAt:String(index)} as Movie)))
// Deliberately delayed mock responses exercise stale-result protection, empty
// results and catalog failures without a credential or production API call.
const fixtureCatalog: typeof movieRequest = async <T,>(_board: string, params: Record<string,string>): Promise<T> => {
  await new Promise(resolve => setTimeout(resolve, params.q === 'old' ? 1200 : 80))
  if (params.q === 'outage') throw new Error('Movie search is busy. Wait a moment and try again.')
  const result = {tmdbId:12345,title:'Catalog QA Movie',year:'1999',posterUrl:'https://example.test/qa-poster.jpg',description:'A synopsis supplied by the test catalog.'}
  return (params.action === 'detail' ? result : {items: params.q === 'empty' ? [] : [{...result,title:params.q === 'old' ? 'Stale Result' : result.title}]}) as T
}
function Fixture() {
  const [items,setItems] = useState(initial),[section,setSection] = useState<MovieSection>('home'),[showAdd,setAdd] = useState(false),[message,setMessage] = useState('Isolated movie QA — no cloud writes')
  const store = { items, ready:true, connection:'local' as const,error:'',retry:()=>{},
    add:async(draft:Parameters<typeof makeMovie>[1])=>{const id=await movieId(draft);setItems(old=>old.some(item=>item.id===id)?old.map(item=>item.id===id?changeMovie(item,'owner','save',''):item):[...old,makeMovie(id,draft,'owner')]);return id},
    edit:async(id:string,draft:Parameters<typeof makeMovie>[1])=>{setItems(old=>old.map(item=>item.id===id?{...item,...draft}:item))},
    action:async(id:string,action:Parameters<typeof changeMovie>[2])=>{setItems(old=>old.map(item=>item.id===id?changeMovie(item,'owner',action,old.find(item=>item.clubStatus==='watching')?.id||''):item))},
  }
  return <><header style={{padding:16}}><p role="status">{message}</p><MovieNavigation section={section} onSelect={setSection}/></header><MovieContent boardId="qa-movies" user="owner" crew={[{id:'owner',name:'Owner'}] as Member[]} section={section} onSection={setSection} search="" showAdd={showAdd} onCloseAdd={()=>setAdd(false)} onOpenAdd={()=>setAdd(true)} notify={setMessage} boardReady store={store} catalogRequest={fixtureCatalog}/></>
}
createRoot(document.getElementById('root')!).render(<Fixture/> )
