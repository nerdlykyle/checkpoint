import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { BookOpen, ChevronDown, ExternalLink, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react'
import { emptyRun, GUIDE_SOURCE, guideMissions, type GuideImage } from './lib/farFarWestGuide'
import { useFieldGuide, type FieldGuideStore } from './useFieldGuide'
import './FarFarWestFieldGuide.css'

const imageUrl=(image:GuideImage)=>`${import.meta.env.BASE_URL}guides/far-far-west/${image.file}.jpg`
function GuideDialog({title,onClose,children,kind}:{title:string;onClose:()=>void;children:ReactNode;kind:string}) {
  const dialog=useRef<HTMLDialogElement>(null)
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow
    dialog.current?.showModal();document.body.style.overflow='hidden'
    return ()=>{document.body.style.overflow=overflow;dialog.current?.close();previous?.focus()}
  },[])
  return createPortal(<dialog ref={dialog} className={`field-guide-dialog ${kind}`} aria-label={title} onCancel={event=>{event.preventDefault();onClose()}}>
    <header><h2>{title}</h2><button type="button" autoFocus className="fg-icon" aria-label="Close" onClick={onClose}><X size={20}/></button></header>{children}
  </dialog>,document.body)
}
function GuideLightbox({image,onClose}:{image:GuideImage;onClose:()=>void}) {
  const [zoom,setZoom]=useState(1),stage=useRef<HTMLDivElement>(null)
  const pointers=useRef(new Map<number,{x:number;y:number}>()),lastDistance=useRef(0),zoomRef=useRef(1)
  const resize=(value:number)=>{zoomRef.current=Math.max(1,Math.min(4,value));setZoom(zoomRef.current)}
  function move(event:PointerEvent<HTMLDivElement>) {
    const previous=pointers.current.get(event.pointerId)
    if(!previous)return
    pointers.current.set(event.pointerId,{x:event.clientX,y:event.clientY})
    const points=[...pointers.current.values()]
    if(points.length===2){
      const distance=Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y)
      if(lastDistance.current)resize(zoomRef.current*distance/lastDistance.current)
      lastDistance.current=distance
    }else if(stage.current){stage.current.scrollLeft-=event.clientX-previous.x;stage.current.scrollTop-=event.clientY-previous.y}
  }
  return <GuideDialog title={image.label} onClose={onClose} kind="fg-lightbox">
    <div ref={stage} className="fg-image-stage" tabIndex={0} role="region" aria-label="Zoomed image; use arrow keys or drag to pan" onPointerDown={event=>{
      pointers.current.set(event.pointerId,{x:event.clientX,y:event.clientY});event.currentTarget.setPointerCapture(event.pointerId)
      const points=[...pointers.current.values()];lastDistance.current=points.length===2?Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y):0
    }} onPointerMove={move} onPointerUp={event=>{pointers.current.delete(event.pointerId);lastDistance.current=0}} onPointerCancel={event=>{pointers.current.delete(event.pointerId);lastDistance.current=0}}>
      <img src={imageUrl(image)} alt={image.label} draggable={false} style={{width:`${zoom*100}%`}}/>
    </div>
    <footer><span>Pinch to zoom · drag to move</span><div><button type="button" className="fg-icon" aria-label="Zoom out" disabled={zoom<=1} onClick={()=>resize(zoom-.5)}><ZoomOut size={20}/></button><button type="button" className="fg-zoom-reset" aria-label="Reset image zoom" onClick={()=>resize(1)}>{Math.round(zoom*100)}%</button><button type="button" className="fg-icon" aria-label="Zoom in" disabled={zoom>=4} onClick={()=>resize(zoom+.5)}><ZoomIn size={20}/></button></div></footer>
  </GuideDialog>
}
function GuidePicture({image,onOpen,small=false}:{image:GuideImage;onOpen:(image:GuideImage)=>void;small?:boolean}) {
  const [failed,setFailed]=useState(false)
  return <button type="button" className={`fg-picture${small?' fg-thumbnail':''}`} aria-label={`Enlarge ${image.label}`} onClick={()=>onOpen(image)}>
    {failed?<span>Image unavailable · view source guide</span>:<img src={imageUrl(image)} width="1280" height="720" alt={image.label} loading="lazy" decoding="async" onError={()=>setFailed(true)}/>}
    <span className="fg-picture-label">{!small&&image.label}<ZoomIn size={16}/></span>
  </button>
}
// Exported presentation component allows isolated UI testing without cloud writes.
export function FieldGuideView({store}:{store:FieldGuideStore}) {
  const [tab,setTab]=useState<'run'|'unlocks'>('run'),[open,setOpen]=useState<string|null>('canyon')
  const [image,setImage]=useState<GuideImage|null>(null),[reset,setReset]=useState<{map:string;attempt:number}|null>(null)
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('')
  const locked=busy||!store.ready
  async function save(action:()=>Promise<void>,success:string) {
    setBusy(true);setError('');setMessage('Saving…')
    try{await action();setMessage(success);return true}catch(reason){setError(reason instanceof Error?reason.message:'Could not save. Please try again.');setMessage('');return false}finally{setBusy(false)}
  }
  return <section className="field-guide" aria-labelledby="field-guide-title">
    <header className="fg-heading"><h2 id="field-guide-title"><BookOpen size={22}/> Field guide</h2><a href={GUIDE_SOURCE} target="_blank" rel="noreferrer" className="fg-icon" aria-label="Open original Far Far West guide" title="Original guide"><ExternalLink size={18}/></a></header>
    <div className="fg-tabs" role="group" aria-label="Guide progress type"><button type="button" aria-pressed={tab==='run'} onClick={()=>setTab('run')}>Run checklist</button><button type="button" aria-pressed={tab==='unlocks'} onClick={()=>setTab('unlocks')}>My unlocks</button></div>
    <div className="fg-scope"><span>{tab==='run'?'Crew progress · kept between game nights':'Your rewards · separate from the crew checklist'}</span><span className="fg-sync"><i className={store.error?'error':store.ready?'live':'connecting'}/>{store.status}</span></div>
    {store.error&&<p role="alert" className="fg-error">{store.error} <button type="button" onClick={store.retry}>Retry</button></p>}
    {error&&<p role="alert" className="fg-error">{error}</p>}
    <div className="fg-save-status" role="status" aria-live="polite">{message}</div>
    {tab==='run'?<div className="fg-missions">{guideMissions.map(mission=>{
      const run=store.runs[mission.id]||emptyRun(),expanded=open===mission.id
      return <div className="fg-mission" key={mission.id}>
        <button type="button" className="fg-map-toggle" aria-expanded={expanded} aria-controls={`fg-map-${mission.id}`} onClick={()=>setOpen(expanded?null:mission.id)}>
          <ChevronDown size={18} className={expanded?'expanded':''}/><span><strong>{mission.map}</strong><small>{mission.title}</small></span><span className="fg-count" aria-label={`${run.checked.length} of ${mission.steps.length} steps complete`}>{run.checked.length}/{mission.steps.length}</span>
        </button>
        {expanded&&<div className="fg-map-content" id={`fg-map-${mission.id}`}>
          <progress value={run.checked.length} max={mission.steps.length} aria-label={`${mission.map} checklist progress`}/>
          <div className="fg-map-layout"><div className="fg-map-visual"><GuidePicture image={mission.overview} onOpen={setImage}/>{mission.note&&<p>{mission.note}</p>}</div>
            <div className="fg-steps">{mission.steps.map(step=><div className="fg-step" key={step.id}>
              <label><input type="checkbox" disabled={locked} checked={run.checked.includes(step.id)} onChange={event=>{const checked=event.target.checked;void save(()=>store.saveStep(mission.id,run.attempt,step.id,checked),checked?'Step saved':'Step unchecked')}}/><span><strong>{step.title}</strong>{step.hint&&<small>{step.hint}</small>}</span></label>
              {step.image&&<GuidePicture image={step.image} onOpen={setImage} small/>}
            </div>)}</div>
          </div>
          <div className="fg-attempt"><span>Attempt {run.attempt}</span><button type="button" disabled={locked||run.checked.length===0} onClick={()=>{setError('');setReset({map:mission.id,attempt:run.attempt})}}><RotateCcw size={15}/> New attempt</button></div>
        </div>}
      </div>
    })}</div>:<div className="fg-unlocks">{guideMissions.map(mission=><label key={mission.id}><input type="checkbox" disabled={locked} checked={store.unlocks.includes(mission.id)} onChange={event=>{const checked=event.target.checked;void save(()=>store.saveUnlock(mission.id,checked),checked?'Your unlock saved':'Unlock unchecked')}}/><span><strong>{mission.reward}</strong><small>{mission.map}</small></span></label>)}</div>}
    <footer className="fg-credit">Images & guide: <a href={GUIDE_SOURCE} target="_blank" rel="noreferrer">Far Far West Guides / The Posse</a><span>May 29, 2026 · Six missions from this guide; patches may change locations.</span></footer>
    {image&&<GuideLightbox image={image} onClose={()=>setImage(null)}/>}
    {reset&&<GuideDialog title="Start a new attempt?" kind="fg-confirm" onClose={()=>{if(!busy)setReset(null)}}><p>This clears the crew’s {guideMissions.find(m=>m.id===reset.map)?.map} checklist. Other maps and everyone’s personal unlocks stay unchanged.</p><div className="fg-confirm-actions"><button type="button" disabled={busy} onClick={()=>setReset(null)}>Cancel</button><button type="button" disabled={locked} onClick={async()=>{if(await save(()=>store.saveStep(reset.map,reset.attempt,null,false),'New attempt started'))setReset(null)}}>Start new attempt</button></div>{error&&<p role="alert">{error}</p>}</GuideDialog>}
  </section>
}
export default function FarFarWestFieldGuide({boardId,user}:{boardId:string;user:string}) {
  const store=useFieldGuide(boardId,user,true)
  return <FieldGuideView store={store}/>
}
