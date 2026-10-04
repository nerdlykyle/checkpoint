import { useEffect, useState } from 'react'
import { X, Search } from 'lucide-react'
import { musicRequest, type MusicResult } from './lib/musicSearch'
import { safeHttpUrl, serviceLink, type MusicItem } from './lib/music'

export function MusicModal({title,onClose,children,actions}:{title:string;onClose:()=>void;children:React.ReactNode;actions?:React.ReactNode}) {
  return <div className="modal-backdrop music-backdrop"><section className="modal-card music-modal" role="dialog" aria-modal="true" aria-label={title}><div className="modal-title"><h2>{title}</h2><div className="music-modal-title-actions">{actions}<button className="icon-button" aria-label="Close" type="button" onClick={onClose}><X size={18}/></button></div></div>{children}</section></div>
}
const csv=(value:string)=>[...new Set(value.split(',').map(part=>part.trim()).filter(Boolean))].slice(0,20)
export function MusicEditor({initial,onSave,onClose,adding=false}:{initial:MusicResult;onSave:(data:MusicResult)=>Promise<void>;onClose:()=>void;adding?:boolean}) {
  const [title,setTitle]=useState(initial.title),[artists,setArtists]=useState(initial.artists.join(', ')),[kind,setKind]=useState(initial.kind)
  const [genres,setGenres]=useState(initial.genres?.join(', ')||''),[year,setYear]=useState(initial.year||'')
  const [spotify,setSpotify]=useState(initial.links?.spotify||''),[youtube,setYoutube]=useState(initial.links?.youtube||'')
  const [cover,setCover]=useState(initial.coverUrl||''),[description,setDescription]=useState(initial.description||'')
  const [error,setError]=useState(''),[saving,setSaving]=useState(false)
  return <form className="music-form" onSubmit={async(event)=>{event.preventDefault();setError('');
    if(!title.trim()||!csv(artists).length){setError('Enter a title and artist.');return}
    if(spotify&&!serviceLink(spotify,'spotify')){setError('Use an https://open.spotify.com/album/… or /track/… link.');return}
    if(youtube&&!serviceLink(youtube,'youtube')){setError('Use a YouTube Music watch or playlist link.');return}
    if(cover&&!safeHttpUrl(cover)){setError('Artwork must use an http or https image link.');return}
    setSaving(true);try{await onSave({...initial,title:title.trim(),artists:csv(artists),kind,genres:csv(genres),year,description,coverUrl:cover? safeHttpUrl(cover):'',links:{...initial.links,spotify:serviceLink(spotify,'spotify')||'',youtube:serviceLink(youtube,'youtube')||''}})}catch(reason){setError(reason instanceof Error?reason.message:'Could not save music.')}finally{setSaving(false)}
  }}>
    <p className="music-muted">{adding?'Confirm the title and artist. Albums/EPs go to your To listen shelf; songs are shared with the crew.':'Metadata and links describe this music for everyone. Personal shelves and reviews stay separate.'}</p>
    <label>Title<input required maxLength={250} value={title} onChange={event=>setTitle(event.target.value)}/></label>
    <label>Artist(s)<input required maxLength={400} value={artists} onChange={event=>setArtists(event.target.value)} placeholder="Separate artists with commas"/></label>
    <div className="music-form-row"><label>Type<select value={kind} disabled={!adding} onChange={event=>setKind(event.target.value as MusicItem['kind'])}><option value="album">Album</option><option value="ep">EP</option><option value="song">Song</option></select></label><label>Release year<input maxLength={4} pattern="[0-9]{4}|^$" value={year} onChange={event=>setYear(event.target.value)}/></label></div>
    <label>Genres<input value={genres} maxLength={500} onChange={event=>setGenres(event.target.value)} placeholder="Rock, Electronic, Jazz…"/></label>
    <label>Spotify link<input type="url" value={spotify} onChange={event=>setSpotify(event.target.value)} placeholder="Optional — otherwise searches Spotify"/></label>
    <label>YouTube Music link<input type="url" value={youtube} onChange={event=>setYoutube(event.target.value)} placeholder="Optional — otherwise searches YouTube Music"/></label>
    <details><summary>Artwork & description</summary><label>Cover image URL<input type="url" value={cover} maxLength={2000} onChange={event=>setCover(event.target.value)}/></label><label>Description<textarea rows={3} maxLength={5000} value={description} onChange={event=>setDescription(event.target.value)}/></label></details>
    {error&&<p role="alert" className="music-error">{error}</p>}
    <div className="modal-actions"><button className="button button-secondary" type="button" disabled={saving} onClick={onClose}>Cancel</button><button className="button button-primary" disabled={saving} type="submit">{saving?'Saving…':adding?kind==='song'?'Share song':'Save to my music':'Save changes'}</button></div>
  </form>
}
export function AddMusic({boardId,onSave,onClose}:{boardId:string;onSave:(data:MusicResult)=>Promise<void>;onClose:()=>void}) {
  const [query,setQuery]=useState(''),[kind,setKind]=useState<'album'|'song'>('album'),[results,setResults]=useState<MusicResult[]>([])
  const [draft,setDraft]=useState<MusicResult|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState('')
  const isLink=/^https?:\/\//i.test(query.trim())
  useEffect(()=>{
    if(query.trim().length<2||isLink){setResults([]);setLoading(false);return}
    const controller=new AbortController()
    const timer=window.setTimeout(()=>{setLoading(true);setError('');musicRequest<{items:MusicResult[]}>(boardId,{action:'search',q:query,kind},controller.signal).then(data=>{if(!controller.signal.aborted)setResults(data.items)}).catch(reason=>{if(!controller.signal.aborted){setResults([]);setError(reason.message)}}).finally(()=>{if(!controller.signal.aborted)setLoading(false)})},700)
    return()=>{window.clearTimeout(timer);controller.abort()}
  },[query,kind,isLink,boardId])
  const choose=async(result:MusicResult)=>{
    setLoading(true);setError('')
    try{const detail=await musicRequest<MusicResult>(boardId,{action:'detail',id:result.mbid!,kind:result.kind==='song'?'song':'album'});setDraft({...result,...detail})}
    catch{setDraft(result)}finally{setLoading(false)}
  }
  return <MusicModal title={draft?'Confirm music':'Add music'} onClose={onClose}>{draft?<MusicEditor key={draft.id} initial={draft} adding onClose={()=>setDraft(null)} onSave={onSave}/>:<>
    <div className="music-form"><label>Find music<input autoFocus aria-label="Find music" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Artist, album, song, or Spotify/YouTube Music link"/></label><label>Search for<select value={kind} onChange={event=>setKind(event.target.value as 'album'|'song')}><option value="album">Albums & EPs</option><option value="song">Songs</option></select></label></div>
    {isLink&&<button className="button button-primary" disabled={loading} type="button" onClick={async()=>{setLoading(true);setError('');try{const result=await musicRequest<Partial<MusicResult>>(boardId,{action:'resolve',url:query.trim()});setDraft({id:`music-${crypto.randomUUID()}`,kind:result.kind||kind,title:result.title||'',artists:result.artists||[],...result} as MusicResult)}catch(reason){setError(reason instanceof Error?reason.message:'Could not resolve this link.')}finally{setLoading(false)}}}>Use this link</button>}
    <div className="music-search-results">{loading?<p role="status">Searching music catalogs…</p>:results.map(result=><button key={result.id} type="button" onClick={()=>choose(result)}><Search size={18}/><span><strong>{result.title}</strong><small>{result.artists.join(', ')} · {result.year||'Year unknown'} · {result.kind.toUpperCase()}</small></span></button>)}</div>
    {error&&<p role="alert" className="music-error">{error}</p>}{!loading&&query.trim().length>=2&&!results.length&&!error&&!isLink&&<p>No matches. Try title and artist, or add it manually.</p>}
    <button className="button button-secondary" type="button" onClick={()=>setDraft({id:`music-${crypto.randomUUID()}`,title:isLink?'':query,artists:[],kind,links:{...(serviceLink(query,'spotify')?{spotify:serviceLink(query,'spotify')}:{}) ,...(serviceLink(query,'youtube')?{youtube:serviceLink(query,'youtube')}:{})}})}>Add manually</button>
    <p className="music-muted">MusicBrainz + Cover Art Archive · Direct links stay attached. You can always correct catalog details.</p>
  </>}</MusicModal>
}

export function LogListen({item,onClose,onSave}:{item:MusicItem;onClose:()=>void;onSave:(date:string,note:string)=>Promise<void>}) {
  const now=new Date(),today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
  const [date,setDate]=useState(today),[note,setNote]=useState(''),[error,setError]=useState(''),[saving,setSaving]=useState(false)
  return <MusicModal title="Log a listen" onClose={onClose}><form className="music-form" onSubmit={async(event)=>{event.preventDefault();setSaving(true);try{await onSave(date,note)}catch(reason){setError(reason instanceof Error?reason.message:'Could not save.')}finally{setSaving(false)}}}><p>{item.title} · Manual listening history, not playback tracking. Listening notes are shared with the crew.</p><label>Date<input type="date" required max={today} value={date} onChange={event=>setDate(event.target.value)}/></label><label>Thoughts about this listen<textarea rows={4} maxLength={1500} value={note} onChange={event=>setNote(event.target.value)}/></label>{error&&<p role="alert">{error}</p>}<div className="modal-actions"><button className="button button-secondary" type="button" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={saving}>Save listen</button></div></form></MusicModal>
}
