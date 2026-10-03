import { useEffect, useState } from 'react'
import { Heart, Plus, RefreshCw, Search } from 'lucide-react'
import { useArtistStore } from './lib/artistStore'
import { artistServiceLink, artistUrl, type ArtistResult, type MusicArtist } from './lib/musicArtists'
import { musicRequest } from './lib/musicSearch'
import { MusicModal } from './MusicForms'
import './FavoriteArtists.css'

export function ArtistPhoto({ artist }: { artist: ArtistResult }) {
  const [failed,setFailed] = useState('')
  const photo=artistUrl(artist.imageUrl)
  return <span className="artist-photo">{photo && photo !== failed ? <img src={photo} alt="" loading="lazy" onError={()=>setFailed(photo)} /> : <span>{artist.name.split(/\s+/).map(part=>part[0]).slice(0,2).join('')}</span>}</span>
}
export default function FavoriteArtists({ boardId,user,owner=user,enabled,title='Favorite artists' }: {boardId:string;user:string;owner?:string;enabled:boolean;title?:string}) {
  const store=useArtistStore(boardId,user,owner,enabled)
  return <ArtistSection boardId={boardId} mine={user===owner} title={title} store={store}/>
}
export function ArtistSection({boardId,mine,title,store,request=musicRequest}:{boardId:string;mine:boolean;title:string;store:ReturnType<typeof useArtistStore>;request?:typeof musicRequest}) {
  const [adding,setAdding]=useState(false),[query,setQuery]=useState(''),[results,setResults]=useState<ArtistResult[]>([]),[searching,setSearching]=useState(false)
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[selected,setSelected]=useState<MusicArtist|null>(null)
  const favorites=store.items.filter(artist=>artist.active).sort((a,b)=>a.name.localeCompare(b.name))
  useEffect(()=>{
    setResults([]);setError('')
    if(!adding||query.trim().length<2){setSearching(false);return}
    const controller=new AbortController();setSearching(true)
    const timer=setTimeout(async()=>{try{const data=await request<{items:ArtistResult[]}>(boardId,{action:'artist-search',q:query},controller.signal);if(!controller.signal.aborted)setResults(data.items)}catch(error){if(!controller.signal.aborted)setError(error instanceof Error?error.message:'Artist search is unavailable.')}finally{if(!controller.signal.aborted)setSearching(false)}},600)
    return()=>{clearTimeout(timer);controller.abort()}
  },[adding,query,boardId,request])
  const run=async(task:()=>Promise<void>)=>{setBusy(true);setError('');try{await task()}catch(error){setError(error instanceof Error?error.message:'Could not save artists.')}finally{setBusy(false)}}
  const add=(result:ArtistResult)=>run(async()=>{
    const existing=store.items.find(artist=>artist.id===result.id)
    const artist=await request<ArtistResult>(boardId,{action:'artist-detail',id:result.id})
    await store.save({...artist,createdAt:existing?.createdAt});setAdding(false)
  })
  return <section className="favorite-artists">
    <header><div><h2>{title}</h2><p>{mine?'Your favorite bands and solo artists, synced with your account.':'Artists this listener has favorited.'}</p></div>{mine&&<button type="button" className="button button-secondary" disabled={!store.ready||busy} onClick={()=>{setQuery('');setAdding(true)}}><Plus size={16}/>Add artist</button>}</header>
    {store.error&&<p role="alert">{store.error} <button className="text-button" onClick={store.retry}>Retry</button></p>}
    {!store.ready&&!store.error&&<p role="status">Loading favorite artists…</p>}
    {!adding&&error&&<p role="alert">{error}</p>}
    <div className="favorite-artists-grid">{favorites.map(artist=><article key={artist.id}><button className="artist-open" onClick={()=>{setError('');setSelected(artist)}} aria-label={`Open ${artist.name}`}><ArtistPhoto key={artist.updatedAt} artist={artist}/><strong>{artist.name}</strong></button>{mine&&<button type="button" className="artist-heart" disabled={busy} aria-label={`Remove ${artist.name} from favorite artists`} onClick={()=>run(()=>store.save(artist,false))}><Heart size={18} fill="currentColor"/></button>}{artist.imageSource&&<a className="artist-credit-link" href={artist.imageSource} target="_blank" rel="noreferrer">Photo & credits</a>}</article>)}</div>
    {store.ready&&!favorites.length&&<p className="music-empty">{mine?'No favorite artists yet. Search for a band or artist to add your first.':'No favorite artists yet.'}</p>}
    {adding&&<MusicModal title="Add favorite artist" onClose={()=>{if(!busy)setAdding(false)}}><form className="music-form" onSubmit={event=>event.preventDefault()}><label>Artist or band name<input type="search" autoFocus value={query} onChange={event=>setQuery(event.target.value)} placeholder="e.g. Nine Inch Nails" disabled={busy}/></label><p>Choose the correct artist. Photos load when you add them; not every artist has one.</p>{searching&&<p role="status">Searching artists…</p>}{error&&<p role="alert">{error}</p>}<div className="artist-search-results">{results.map(artist=><button key={artist.id} type="button" disabled={busy||store.items.some(item=>item.id===artist.id&&item.active)} onClick={()=>add(artist)}><Search size={18}/><span><strong>{artist.name}</strong><small>{artist.description||'MusicBrainz artist'}</small></span><span>{store.items.some(item=>item.id===artist.id&&item.active)?'Added':'Add'}</span></button>)}</div>{!searching&&query.trim().length>=2&&!results.length&&!error&&<p>No artists found. Try another spelling.</p>}{busy&&<p role="status">Loading artist photo and saving…</p>}</form></MusicModal>}
    {selected&&<MusicModal title={selected.name} onClose={()=>setSelected(null)}><div className="artist-detail"><ArtistPhoto key={selected.updatedAt} artist={selected}/><p>{selected.description}</p><div className="music-listening-links">{(['spotify','youtube'] as const).map(service=>{const link=artistServiceLink(selected,service);return <a key={service} href={link.url} target="_blank" rel="noreferrer">{link.direct?'Open in':'Search'} {service==='spotify'?'Spotify':'YouTube Music'}</a>})}</div>{selected.imageSource&&<p className="artist-image-credit">Photo: {selected.imageCredit||'Wikimedia Commons contributor'} · {selected.imageLicense} <a href={selected.imageSource} target="_blank" rel="noreferrer">Original & credits</a>{selected.imageLicenseUrl&&<> · <a href={selected.imageLicenseUrl} target="_blank" rel="noreferrer">License</a></>}</p>}{mine&&!selected.id.startsWith('manual-')&&<button type="button" className="button button-secondary" disabled={busy} onClick={()=>run(async()=>{const fresh=await request<ArtistResult>(boardId,{action:'artist-detail',id:selected.id,refresh:'1'});const updated={...selected,...fresh,updatedAt:new Date().toISOString()};await store.save(updated,selected.active);setSelected(updated)})}><RefreshCw size={16}/>Refresh artist photo</button>}{error&&<p role="alert">{error}</p>}</div></MusicModal>}
    <small className="artist-source-note">Artist metadata: MusicBrainz · Photos: Wikimedia Commons when available. Initials appear when a photo is unavailable.</small>
  </section>
}
