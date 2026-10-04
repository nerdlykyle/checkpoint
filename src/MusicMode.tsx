import MemberShelfPicker from './MemberShelfPicker'
import FavoriteArtists from './FavoriteArtists'
import { useState, type PointerEvent } from 'react'
import { Music2, Headphones, Library, ListMusic, ThumbsUp, Users, Settings, Heart, GripVertical, ArrowUp, ArrowDown, Shuffle, Plus } from 'lucide-react'
import type { Member } from './types'
import { useMusicStore, type MusicMutation } from './lib/musicStore'
import { makeMusicItem, musicQueue, musicSections, musicShelves, recordListen, saveMusicShelf, voteMusic, type MusicItem, type MusicSection, type MusicShelf } from './lib/music'
import { AddMusic, LogListen, MusicEditor, MusicModal } from './MusicForms'
import type { MusicResult } from './lib/musicSearch'
import MusicDetails, { MusicCover, MusicLinks, MusicVotes } from './MusicDetails'
import CollectionFilters from './CollectionFilters'
import './MusicMode.css'

const navIcons={home:Headphones,library:Library,artists:Heart,club:ListMusic,poll:ThumbsUp,songs:Music2,listeners:Users,settings:Settings}
export function MusicNavigation({section,onSelect,mobile=false}:{section:MusicSection;onSelect:(value:MusicSection)=>void;mobile?:boolean}) {return <nav className={mobile?'mobile-menu-nav':'main-nav'} aria-label="Music navigation">{Object.entries(musicSections).map(([value,label])=>{const Icon=navIcons[value as MusicSection];return <button key={value} className={section===value?'active':''} onClick={()=>onSelect(value as MusicSection)}>{mobile?<><span><Icon size={19}/></span><strong>{label}</strong></>:<><Icon size={19}/><span>{label}</span></>}</button>})}</nav>}
type Props={boardId:string;user:string;crew:Member[];section:MusicSection;onSection:(section:MusicSection)=>void;search:string;showAdd:boolean;onCloseAdd:()=>void;onOpenAdd:()=>void;notify:(message:string)=>void;boardReady:boolean}
export default function MusicMode(props:Props) {const store=useMusicStore(props.boardId,props.user,props.boardReady);return <MusicContent {...props} store={store}/>}
export function MusicContent({boardId,user,crew,section,onSection,search,showAdd,onCloseAdd,onOpenAdd,notify,store}:Props&{store:ReturnType<typeof useMusicStore>}) {
  const {items,ready,service}=store
  const [selectedId,setSelectedId]=useState<string|null>(null),[editingId,setEditingId]=useState<string|null>(null),[logId,setLogId]=useState<string|null>(null)
  const [shelf,setShelf]=useState<MusicShelf|'all'|'favorites'>('all'),[reader,setReader]=useState(user),[genre,setGenre]=useState(''),[tag,setTag]=useState(''),[query,setQuery]=useState(''),[group,setGroup]=useState(false),[kind,setKind]=useState('albums')
  const [moving,setMoving]=useState<string|null>(null),[position,setPosition]=useState('1'),[dragging,setDragging]=useState<string|null>(null),[target,setTarget]=useState<string|null>(null)
  const [busy,setBusy]=useState(false),[error,setError]=useState('')
  const selected=items.find(item=>item.id===selectedId),editing=items.find(item=>item.id===editingId),logging=items.find(item=>item.id===logId)
  const name=(id:string)=>crew.find(member=>member.id===id)?.name||'Listener'
  const run=async(task:()=>Promise<void>,message='Saved')=>{setBusy(true);setError('');try{await task();notify(message);return true}catch(reason){setError(reason instanceof Error?reason.message:'Could not save. Please try again.');return false}finally{setBusy(false)}}
  const update=(id:string,change:MusicMutation)=>store.apply([{id,update:change}])
  const setPersonal=(item:MusicItem,value:MusicShelf)=>run(()=>update(item.id,old=>saveMusicShelf(old,user,value,Math.max(0,...musicQueue(items,user,value).map(entry=>entry.organization[user]?.order||0))+1)),`Moved to ${musicShelves[value]}`)
  const vote=(item:MusicItem,value:'up'|'down')=>run(()=>update(item.id,old=>voteMusic(old,user,value)),'Vote saved')
  const owner=section==='listeners'?reader:user, mine=owner===user
  const owned=[...musicQueue(items,owner),...items.filter(item=>!item.shelves[owner]&&item.favorites.includes(owner))]
  const filtered=owned.filter(item=>(kind==='all'||(kind==='songs'?item.kind==='song':item.kind!=='song'))&&(shelf==='all'||(shelf==='favorites'?item.favorites.includes(owner):item.shelves[owner]===shelf))&&(!genre||(genre==='__none'?!item.genres.length:item.genres.includes(genre)))&&(!tag||item.organization[owner]?.tags?.includes(tag))&&`${item.title} ${item.artists.join(' ')}`.toLowerCase().includes((query||search).toLowerCase().trim()))
  const queue=musicQueue(items,owner,shelf==='all'||shelf==='favorites'?undefined:shelf)
  const canReorder=mine&&shelf!=='all'&&shelf!=='favorites'&&!group
  const move=(id:string,rank:number)=>{
    const ordered=[...queue];const index=ordered.findIndex(item=>item.id===id);if(index<0||!Number.isFinite(rank))return
    const [item]=ordered.splice(index,1);ordered.splice(Math.max(0,Math.min(ordered.length,Math.round(rank)-1)),0,item)
    return run(()=>store.apply(ordered.map((entry,i)=>({id:entry.id,update:old=>({...old,organization:{...old.organization,[user]:{...old.organization[user],order:i+1}}})}))),'Your listening order was saved')
  }
  const pointer=(event:PointerEvent<HTMLButtonElement>,end:boolean)=>{
    if(!dragging)return
    const id=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>('[data-music-id]')?.dataset.musicId
    setTarget(id||null)
    if(end){if(id&&id!==dragging&&filtered.some(item=>item.id===id))move(dragging,queue.findIndex(item=>item.id===id)+1);setDragging(null);setTarget(null)}
    else if(event.clientY>window.innerHeight-80)window.scrollBy(0,16);else if(event.clientY<100)window.scrollBy(0,-16)
  }
  const add=async(data:MusicResult)=>{
    const duplicate=items.find(item=>(data.mbid&&item.mbid===data.mbid)||item.kind===data.kind&&item.title.toLowerCase()===data.title.toLowerCase()&&item.artists.join(',').toLowerCase()===data.artists.join(',').toLowerCase())
    const initial=makeMusicItem(data,user),id=duplicate?.id||initial.id
    const order=Math.max(0,...musicQueue(items,user,'to-listen').map(item=>item.organization[user]?.order||0))+1
    await store.apply([{id,initial:{...initial,id},update:old=>{
      const withLinks={...old,links:{...old.links,spotify:old.links.spotify||data.links?.spotify||'',youtube:old.links.youtube||data.links?.youtube||''}}
      return data.kind==='song'?{...withLinks,sharedBy:old.sharedBy||user}:saveMusicShelf(withLinks,user,old.shelves[user]||'to-listen',order)
    }}]);onCloseAdd();setQuery('');setGenre('');setTag('');if(data.kind==='song')onSection('songs');else{onSection('library');setShelf('all');setKind('albums')};notify(data.kind==='song'?'Song shared with the crew':'Saved to your music')
  }
  const clubAction=(item:MusicItem,action:'queue'|'start'|'finish'|'join'|'leave'|'unqueue')=>run(async()=>{
    if(action==='start'||action==='finish'){await store.clubSession(item.id,action);return}
    await update(item.id,old=>{
      if(action==='queue'){if(old.passedOn||old.kind==='song'||old.club)return old;return {...old,nominated:false,club:{status:'up-next',order:Math.max(0,...items.map(entry=>entry.club?.order||0))+1,participants:[]}}}
      if(action==='unqueue'){if(old.club?.status!=='up-next')return old;const next={...old};delete next.club;return next}
      if(old.club?.status!=='listening')return old
      return {...old,club:{...old.club,participants:action==='join'?[...new Set([...old.club.participants,user])]:old.club.participants.filter(id=>id!==user)}}
    })
  },'Group listening updated')
  const clubQueue=items.filter(item=>item.club?.status==='up-next').sort((a,b)=>a.club!.order-b.club!.order)
  const clubMove=(item:MusicItem,delta:number)=>{const list=[...clubQueue],from=list.findIndex(entry=>entry.id===item.id),to=from+delta;if(to<0||to>=list.length)return;[list[from],list[to]]=[list[to],list[from]];run(()=>store.apply(list.map((entry,index)=>({id:entry.id,update:old=>old.club?.status==='up-next'?{...old,club:{...old.club,order:index+1}}:old}))),'Club queue reordered')}
  const poll=items.filter(item=>item.kind!=='song'&&item.nominated&&!item.passedOn&&!item.club).sort((a,b)=>b.upvotes.length-a.upvotes.length)
  const current=items.find(item=>item.club?.status==='listening')
  const ownListening=items.filter(item=>item.shelves[user]==='listening')
  const card=(item:MusicItem,reordering=false,other=false)=>{
    const rank=queue.findIndex(entry=>entry.id===item.id)+1
    const ratings=Object.values(item.ratings),average=ratings.length?(ratings.reduce((sum,value)=>sum+value.stars,0)/ratings.length).toFixed(1):''
    return <article className={`music-card ${target===item.id?'is-drop-target':''}`} data-music-id={item.id} key={item.id}>
      {reordering&&<button className="music-drag" aria-label={`Drag ${item.title}`} onPointerDown={event=>{event.currentTarget.setPointerCapture(event.pointerId);setDragging(item.id)}} onPointerMove={event=>pointer(event,false)} onPointerUp={event=>pointer(event,true)} onPointerCancel={()=>{setDragging(null);setTarget(null)}}><GripVertical size={20}/></button>}
      <button className="music-cover-button" aria-label={`Open ${item.title}`} onClick={()=>setSelectedId(item.id)}><MusicCover item={item}/></button>
      <div className="music-card-copy"><span className="eyebrow">{reordering?`#${rank} · `:''}{item.kind} {item.year?`· ${item.year}`:''}</span><button className="music-title-button" onClick={()=>setSelectedId(item.id)}>{item.title}</button><p>{item.artists.join(', ')}</p><small>{item.genres.join(' · ')}{average?` · ★ ${average}`:''}</small>{other&&<p>{name(owner)} · {item.shelves[owner]?musicShelves[item.shelves[owner]]:'Favorite'}{item.favorites.includes(owner)?' · ♥ Favorite':''}</p>}{item.kind==='song'&&item.sharedBy&&<p>Shared by {name(item.sharedBy)}</p>}<MusicLinks item={item} service={service}/></div>
      <div className="music-card-actions">{other?<button className="button button-secondary" disabled={!!item.shelves[user]} onClick={()=>setPersonal(item,'to-listen')}>{item.shelves[user]?'On my shelf':'Save to my music'}</button>:<><button className="music-heart" aria-label={`Favorite ${item.title}`} aria-pressed={item.favorites.includes(user)} onClick={()=>run(()=>update(item.id,old=>({...old,favorites:old.favorites.includes(user)?old.favorites.filter(id=>id!==user):[...old.favorites,user]})),'Favorite updated')}><Heart size={18} fill={item.favorites.includes(user)?'currentColor':'none'}/></button><select aria-label={`Shelf for ${item.title}`} value={item.shelves[user]||''} onChange={event=>setPersonal(item,event.target.value as MusicShelf)}><option value="" disabled>Save to my shelf…</option>{Object.entries(musicShelves).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select><button className="button button-secondary" onClick={()=>setLogId(item.id)}>Mark listened</button>{reordering&&<div className="music-order"><button aria-label={`Move ${item.title} up`} disabled={rank===1} onClick={()=>move(item.id,rank-1)}><ArrowUp size={15}/></button><button aria-label={`Move ${item.title} down`} disabled={rank===queue.length} onClick={()=>move(item.id,rank+1)}><ArrowDown size={15}/></button><button onClick={()=>{setMoving(item.id);setPosition(String(rank))}}>Move…</button></div>}</>}{item.nominated&&!item.passedOn&&!item.club&&<MusicVotes item={item} user={user} onVote={value=>vote(item,value)}/>}</div>
    </article>
  }
  const recent=items.filter(item=>Object.keys(item.ratings).length).sort((a,b)=>Math.max(...Object.values(b.ratings).map(value=>Date.parse(value.updatedAt)))-Math.max(...Object.values(a.ratings).map(value=>Date.parse(value.updatedAt))))
  return <div className="page music-page"><div className="page-title-row"><div><span className="eyebrow">Checkpoint Music</span><h1>{section==='home'?"What’re we listenin’ to?":musicSections[section]}</h1><p>Your music, with a shared place to discover and discuss.</p></div><span className="music-sync" role="status">{store.status}</span></div>
    {(store.error||error)&&<div className="music-error" role="alert">{error||store.error}<button onClick={()=>{setError('');store.retry()}}>Retry connection</button></div>}
    {!ready&&<p role="status">Waiting for the crew’s music collection…</p>}
    <fieldset className="music-workspace" disabled={!ready||busy}>
    {section!=='settings'&&section!=='artists'&&<div className="music-page-actions"><button className="button button-primary" onClick={onOpenAdd}><Plus size={16}/>Add music</button></div>}
    {section==='home'?<>
      <FavoriteArtists boardId={boardId} user={user} enabled={ready}/>
      <section className="music-home-section"><h2>Our current group listen</h2>{current?<>{card(current)}<div className="music-inline-actions"><button className="button button-secondary" onClick={()=>clubAction(current,current.club!.participants.includes(user)?'leave':'join')}>{current.club!.participants.includes(user)?'Leave this listen':'Join this listen'}</button><button className="button button-secondary" onClick={()=>clubAction(current,'finish')}>Finish group listen</button><p>{current.club!.participants.map(name).join(', ')||'No listeners joined yet'}</p></div></>:<p className="music-empty">No group listen yet. Nominate an album or choose one from the club queue.</p>}</section>
      <section className="music-home-section"><h2>What I’m listening to</h2>{ownListening.length?ownListening.map(item=>card(item)):<p className="music-empty">Move an album to Listening whenever you’re ready.</p>}</section>
      <section className="music-home-section"><h2>Crew recommendations</h2>{poll.length?poll.slice(0,4).map(item=>card(item)):<p className="music-empty">Open an album and nominate it for our next listen.</p>}</section>
      <section className="music-home-section"><h2>Recently rated by the crew</h2>{recent.length?recent.slice(0,6).map(item=>card(item)):<p className="music-empty">Your ratings and reviews will appear here.</p>}</section>
    </>:section==='artists'?<FavoriteArtists boardId={boardId} user={user} enabled={ready}/>:section==='library'||section==='listeners'?<>
      {section==='listeners'&&<MemberShelfPicker key={user} crew={crew} currentUser={user} selected={reader} kind="music" onSelect={id=>{setReader(id);setGenre('');setTag('');setQuery('')}}/>}
      {!mine&&<p className="music-notice">Browsing {name(owner)}’s collection. Their shelves and order are read-only; save music to manage your own copy.</p>}
      {section==='listeners'&&<FavoriteArtists key={owner} boardId={boardId} user={user} owner={owner} enabled={ready} title={mine?'My favorite artists':`${name(owner)}’s favorite artists`}/>}
      <div className="filter-tabs">{(['all',...Object.keys(musicShelves),'favorites'] as const).map(value=><button key={value} className={shelf===value?'active':''} onClick={()=>setShelf(value as typeof shelf)}>{value==='all'?'Library':value==='favorites'?'Favorites':musicShelves[value as MusicShelf]}</button>)}</div>
      <CollectionFilters activeCount={[query || search, genre, tag, kind !== 'albums'].filter(Boolean).length} groupedBy={group ? 'artist' : undefined}>
      <div className="music-filters"><label>Search<input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Artist or title"/></label><label>Genre<select value={genre} onChange={event=>setGenre(event.target.value)}><option value="">All genres</option>{[...new Set(owned.flatMap(item=>item.genres))].sort().map(value=><option key={value}>{value}</option>)}<option value="__none">Uncategorized</option></select></label><label>Tag<select value={tag} onChange={event=>setTag(event.target.value)}><option value="">All tags</option>{[...new Set(owned.flatMap(item=>item.organization[owner]?.tags||[]))].sort().map(value=><option key={value}>{value}</option>)}</select></label><label>Type<select value={kind} onChange={event=>setKind(event.target.value)}><option value="albums">Albums & EPs</option><option value="songs">Songs</option><option value="all">All music</option></select></label></div>
      <div className="music-inline-actions"><label className="music-checkbox"><input type="checkbox" checked={group} onChange={event=>setGroup(event.target.checked)}/>Group by artist</label><button className="button button-secondary" disabled={!filtered.some(item=>item.shelves[owner]==='to-listen')} onClick={()=>{const choices=filtered.filter(item=>item.shelves[owner]==='to-listen');setSelectedId(choices[Math.floor(Math.random()*choices.length)].id)}}><Shuffle size={15}/>Pick a next listen</button></div>
      </CollectionFilters>
      <p className="music-muted">{canReorder?'Drag the grip, use arrows, or Move to a numbered position. Positions refer to the whole shelf.':'Choose a shelf and turn off artist grouping to arrange your listening order.'}</p>
      {group?[...new Set(filtered.map(item=>item.artists.join(', ')))].map(artist=><details className="music-artist-group" key={artist} open><summary>{artist} · {filtered.filter(item=>item.artists.join(', ')===artist).length} releases</summary>{filtered.filter(item=>item.artists.join(', ')===artist).map(item=>card(item,false,!mine))}</details>):filtered.map(item=>card(item,canReorder,!mine))}
      {!filtered.length&&<p className="music-empty">No music matches this view. Try another shelf, genre, or type.</p>}
    </>:section==='songs'?<><p className="music-muted">A shared feed for individual songs. Add music → Songs, or paste a Spotify/YouTube Music song link.</p>{items.filter(item=>item.kind==='song'&&item.sharedBy).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(item=>card(item))}{!items.some(item=>item.kind==='song'&&item.sharedBy)&&<p className="music-empty">What song should the crew hear?</p>}</>:section==='poll'?<><p className="music-notice">Thumbs are for choosing our next album—not ratings. Three thumbs down closes a nomination; everyone’s personal collection stays intact.</p>{poll.map(item=>card(item))}{!poll.length&&<p className="music-empty">Open an album and nominate it to start the poll.</p>}<details className="music-artist-group"><summary>Passed on by the group</summary>{items.filter(item=>item.passedOn).map(item=>card(item))}</details></>:section==='club'?<>
      <h2>Current group listen</h2>{current?card(current):<p className="music-empty">No current group listen.</p>}<h2>Up next</h2>{clubQueue.map((item,index)=><div className="music-club-entry" key={item.id}>{card(item)}<div className="music-inline-actions"><span>#{index+1}</span><button className="button button-secondary" disabled={index===0} onClick={()=>clubMove(item,-1)}>Move up</button><button className="button button-secondary" disabled={index===clubQueue.length-1} onClick={()=>clubMove(item,1)}>Move down</button><button className="button button-primary" disabled={!!current} onClick={()=>clubAction(item,'start')}>Start group listen</button></div></div>)}{!clubQueue.length&&<p className="music-empty">Open an album and add it to club Up next.</p>}<h2>Previous group listens</h2>{items.filter(item=>item.club?.status==='listened').map(item=>card(item))}
    </>:<section className="music-settings"><h2>Preferred listening service</h2><p>Both links are always available. Your preferred service appears first. No Spotify or YouTube account connection is required.</p><label>Open music with<select value={service} onChange={event=>run(()=>store.saveService(event.target.value as typeof service),'Music preference saved')}><option value="spotify">Spotify</option><option value="youtube">YouTube Music</option></select></label><p className="music-muted">The service icons open a direct album/song link when available; otherwise they search by artist and title. Hover over an icon to see which action it uses. Whether a link opens the installed app depends on your device settings.</p><h3>Listening history</h3><p>Listens are logged manually. Checkpoint does not track playback, minutes, or your streaming-service history.</p></section>}
    </fieldset>
    {selected&&<MusicDetails key={selected.id} item={selected} user={user} crew={crew} service={service} onClose={()=>setSelectedId(null)} onUpdate={change=>update(selected.id,change)} onShelf={value=>setPersonal(selected,value)} onLog={()=>setLogId(selected.id)} onEdit={()=>setEditingId(selected.id)} onVote={value=>vote(selected,value)} onClub={value=>clubAction(selected,value)}/>}
    {editing&&<MusicModal title="Edit music details" onClose={()=>setEditingId(null)}><MusicEditor initial={editing} onClose={()=>setEditingId(null)} onSave={async data=>{await update(editing.id,old=>({...old,title:data.title,artists:data.artists,year:data.year,genres:data.genres||[],description:data.description||'',coverUrl:data.coverUrl,links:{...old.links,spotify:data.links?.spotify||'',youtube:data.links?.youtube||''}}));setEditingId(null);notify('Music details saved')}}/></MusicModal>}
    {logging&&<LogListen item={logging} onClose={()=>setLogId(null)} onSave={async(date,note)=>{const id=crypto.randomUUID();await update(logging.id,old=>recordListen(old,user,date,note,id));setLogId(null);notify('Listen logged. Previous notes and ratings were preserved.')}}/>}
    {showAdd&&<AddMusic boardId={boardId} onClose={onCloseAdd} onSave={add}/>}
    {moving&&<MusicModal title="Move music" onClose={()=>setMoving(null)}><form className="music-form" onSubmit={async event=>{event.preventDefault();if(await move(moving,Number(position)))setMoving(null)}}><label>Position<input autoFocus type="number" required min={1} max={queue.length} value={position} onFocus={event=>event.currentTarget.select()} onChange={event=>setPosition(event.target.value)}/></label><button className="button button-primary">Move music</button></form></MusicModal>}
    <footer className="music-attribution">Metadata: <a href="https://musicbrainz.org" target="_blank" rel="noreferrer">MusicBrainz</a> · Artwork: <a href="https://coverartarchive.org" target="_blank" rel="noreferrer">Cover Art Archive</a>. Metadata can be incomplete; edit details when needed.</footer>
  </div>
}
