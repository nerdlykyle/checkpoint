import {useEffect,useRef,useState} from 'react'
import {createPortal} from 'react-dom'
import {ImagePlus,Link,Search,Upload,X} from 'lucide-react'
import type {Book} from './types'
import {searchBookCatalog,type BookSearchResponse} from './lib/bookSearch'
import {bookCoverCandidates,refreshBookArtwork} from './lib/bookArtwork'
import {catalogCoverUrl,drawCover,encodeCover,importCover,prepareCover,type CoverCrop} from './lib/customBookCover'
import {usePersonalBookCover} from './PersonalBookCovers'
import './BookCoverEditor.css'

type Choice={url:string;title:string;edition:string}
export default function BookCoverEditor({book,onClose,searchCatalog=searchBookCatalog}:{book:Book;onClose:()=>void;searchCatalog?:(query:string,signal?:AbortSignal)=>Promise<BookSearchResponse>}) {
  const store=usePersonalBookCover(book.id)
  const dialog=useRef<HTMLDialogElement>(null),canvas=useRef<HTMLCanvasElement>(null),request=useRef<AbortController|null>(null)
  const [tab,setTab]=useState<'catalog'|'upload'|'url'>('catalog')
  const [query,setQuery]=useState(`${book.title} ${book.authors.join(' ')}`),[url,setUrl]=useState('')
  const [choices,setChoices]=useState<Choice[]>(()=>bookCoverCandidates(book,true).flatMap(url=>{try{return [{url:catalogCoverUrl(url),title:book.title,edition:'Saved catalog identifiers'}]}catch{return []}}))
  const [bitmap,setBitmap]=useState<ImageBitmap|null>(null),[linked,setLinked]=useState(''),[crop,setCrop]=useState<CoverCrop>({zoom:1,x:.5,y:.5})
  const [loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[permission,setPermission]=useState(false),[linkLoaded,setLinkLoaded]=useState(false)
  useEffect(()=>{dialog.current?.showModal();return ()=>{request.current?.abort()}},[])
  useEffect(()=>()=>bitmap?.close(),[bitmap])
  useEffect(()=>{if(canvas.current&&bitmap)drawCover(canvas.current,bitmap,crop)},[bitmap,crop])
  const begin=()=>{request.current?.abort();const controller=new AbortController();request.current=controller;setError('');setNotice('');setLoading(true);return controller}
  const clear=()=>{request.current?.abort();setBitmap(null);setLinked('');setPermission(false);setLoading(false);setError('');setNotice('')}
  const accept=(image:ImageBitmap,controller:AbortController)=>{
    if(controller.signal.aborted){image.close();return}
    setBitmap(image);setLinked('');setCrop({zoom:1,x:.5,y:.5});setPermission(false)
  }
  const find=async()=>{
    const controller=begin()
    try {
      const result=await searchCatalog(query,controller.signal)
      if(controller.signal.aborted)return
      const seen=new Set<string>()
      const next=result.results.flatMap(item=>bookCoverCandidates(item,true).flatMap(value=>{
        try {const url=catalogCoverUrl(value);if(seen.has(url))return [];seen.add(url);return [{url,title:item.title,edition:`${item.authors.join(', ')}${item.publishedYear?` · ${item.publishedYear}`:''}${item.isbn13||item.isbn10?` · ${item.isbn13||item.isbn10}`:''}`}]}catch{return []}
      })).slice(0,24)
      setChoices(next);setNotice(result.warning||(!next.length?'No covers found. Try another title or ISBN, or upload an image.':'Choose the correct edition. Only the artwork will change.'))
    } catch(reason){if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:'Could not search covers. Try again.')}
    finally{if(!controller.signal.aborted)setLoading(false)}
  }
  const load=async(source:File|string,catalog=false)=>{
    const controller=begin();setBitmap(null);setLinked('');setLinkLoaded(false);setPermission(false)
    try {accept(typeof source==='string'?await importCover(source,controller.signal):await prepareCover(source),controller)}
    catch(reason){
      if(controller.signal.aborted)return
      if(catalog&&typeof source==='string'){
        setLinked(catalogCoverUrl(source));setNotice('This catalog blocks copying its image. You can pin the catalog link instead; it still depends on that provider. Upload a permitted copy for independent storage.')
      } else {
        const message=reason instanceof Error && !(reason instanceof TypeError)?reason.message:typeof source==='string'?'The website blocked importing this image.':'This image could not be opened.'
        setError(message+(typeof source==='string'?' If it opens in your browser, download a permitted copy and use Upload image.':''))
      }
    } finally{if(!controller.signal.aborted)setLoading(false)}
  }
  const save=async(reset=false)=>{
    setSaving(true);setError('')
    try {
      if(reset){await store.save(null);refreshBookArtwork(book)}
      else {
        if(!permission)throw new Error('Please confirm you have permission to use this cover.')
        if(!bitmap&&(!linked||!linkLoaded))throw new Error('Choose a working cover first.')
        if(bitmap&&canvas.current)drawCover(canvas.current,bitmap,crop)
        const image=bitmap&&canvas.current?encodeCover(canvas.current):catalogCoverUrl(linked)
        await store.save({kind:bitmap?'image':'catalog',image,updatedAt:new Date().toISOString()})
      }
      onClose()
    }catch(reason){setError(reason instanceof Error?reason.message:'Could not save. Your existing cover is unchanged.')}
    finally{setSaving(false)}
  }
  return createPortal(<dialog ref={dialog} className="book-cover-editor" aria-labelledby="cover-editor-title" onCancel={event=>{event.preventDefault();if(!saving)onClose()}}>
    <header><div><span className="eyebrow">My book cover</span><h2 id="cover-editor-title">Change cover</h2></div><button type="button" className="icon-button" aria-label="Close cover editor" disabled={saving} onClick={onClose}><X size={20}/></button></header>
    <p><strong>{book.title}</strong><br/>{book.authors.join(', ')}</p>
    <p className="cover-editor-help">Changes only your copy. Other members keep their chosen covers. Chapters, reviews and shelves stay unchanged. Automatic refresh won’t replace your selection.</p>
    <div className="filter-tabs" role="group" aria-label="Cover source">{([['catalog','Find another cover',Search],['upload','Upload image',Upload],['url','Paste image URL',Link]] as const).map(([value,label,Icon])=><button type="button" key={value} aria-pressed={tab===value} className={tab===value?'active':''} disabled={saving} onClick={()=>{clear();setTab(value)}}><Icon size={16}/>{label}</button>)}</div>
    <fieldset disabled={saving||loading}>
      {tab==='catalog'?<><form onSubmit={event=>{event.preventDefault();void find()}}><label>Title, author or ISBN<input type="search" value={query} onChange={e=>setQuery(e.target.value)}/></label><button type="submit" className="button" disabled={query.trim().length<2}><Search size={16}/>Find covers</button></form><div className="cover-choice-grid">{choices.map((choice,index)=><button className="cover-choice" type="button" key={choice.url} aria-label={`Preview ${choice.title} cover ${index+1}`} onClick={()=>void load(choice.url,true)}><img src={choice.url} alt={`Cover option ${index+1}`} loading="lazy" referrerPolicy="no-referrer" onError={event=>{event.currentTarget.hidden=true}}/><strong>{choice.title}</strong><small>{choice.edition}</small></button>)}</div></>
      :tab==='upload'?<label className="cover-upload"><ImagePlus size={24}/>Choose a cover image<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>{const file=event.target.files?.[0];if(file)void load(file);event.target.value=''}}/><small>JPEG, PNG or WebP · up to 8 MB. You can crop it before saving.</small></label>
      :<form onSubmit={event=>{event.preventDefault();void load(url)}}><label>Direct HTTPS image URL<input type="url" value={url} onChange={event=>setUrl(event.target.value)} placeholder="https://…/cover.jpg" required/></label><p className="cover-editor-help">Use the image’s address, not a bookstore page. Importing makes a compressed copy when the source permits it.</p><button type="submit" className="button">Import image</button></form>}
    </fieldset>
    {loading&&<p role="status">Loading cover…</p>}
    {notice&&<p role="status" className="cover-editor-help">{notice}</p>}
    {(bitmap||linked)&&<section className="cover-preview"><h3>Preview</h3>{bitmap?<canvas ref={canvas} aria-label="Cropped cover preview"/>:<img src={linked} alt="Selected catalog cover" referrerPolicy="no-referrer" onLoad={()=>setLinkLoaded(true)} onError={()=>{setLinkLoaded(false);setError('This catalog image did not load. Choose another cover or upload an image.')}}/>}
      {bitmap&&<fieldset disabled={saving}><label>Zoom<input type="range" min="1" max="3" step=".01" value={crop.zoom} onChange={event=>setCrop(old=>({...old,zoom:Number(event.target.value)}))}/></label><label>Horizontal position<input type="range" min="0" max="1" step=".01" value={crop.x} onChange={event=>setCrop(old=>({...old,x:Number(event.target.value)}))}/></label><label>Vertical position<input type="range" min="0" max="1" step=".01" value={crop.y} onChange={event=>setCrop(old=>({...old,y:Number(event.target.value)}))}/></label><small>Stored as a compressed 512 × 768 image, without photo metadata.</small></fieldset>}
      <label className="cover-permission"><input type="checkbox" checked={permission} disabled={saving} onChange={event=>setPermission(event.target.checked)}/>I have permission to use this image as a cover.</label>
    </section>}
    {error&&<p role="alert">{error}</p>}{store.error&&<p role="alert">{store.error} <button type="button" onClick={store.retry}>Retry</button></p>}
    {!store.ready&&!store.error&&<p role="status">Waiting for your custom covers to sync…</p>}
    <footer><button type="button" className="button" disabled={!store.cover||!store.ready||saving||loading} onClick={()=>void save(true)}>Reset to catalog cover</button><button type="button" className="button" disabled={saving||loading||!store.ready||!permission||(!bitmap&&(!linked||!linkLoaded))} onClick={()=>void save()}>{saving?'Saving…':'Save my cover'}</button></footer>
  </dialog>,document.body)
}
