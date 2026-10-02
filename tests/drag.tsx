// Development-only interaction harness. No cloud writes.
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { GripVertical } from 'lucide-react'
import { useLiveReorder } from '../src/useLiveReorder'
import '../src/index.css'
import '../src/App.css'
import '../src/BookOrganizer.css'

function Fixture() {
  const [ids,setIds]=useState(['First book','Second book','Third book','Fourth book','Fifth book'])
  const [saves,setSaves]=useState(0)
  const drag=useLiveReorder({ids,onMove:(source,target)=>{setIds(old=>{const next=[...old],from=next.indexOf(source),to=next.indexOf(target);next.splice(to,0,next.splice(from,1)[0]);return next});setSaves(value=>value+1)}})
  const hold=(pointerType:string)=>{
    const list=drag.containerRef.current!, cards=[...list.querySelectorAll<HTMLElement>('[data-reorder-id]')],handle=cards[0].querySelector('button')!
    const start=handle.getBoundingClientRect(),target=cards[2].getBoundingClientRect(),x=start.left+start.width/2,y=start.top+start.height/2
    handle.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:77,isPrimary:true,button:0,clientX:x,clientY:y,pointerType}))
    document.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,cancelable:true,pointerId:77,isPrimary:true,buttons:1,clientX:x+20,clientY:target.top+target.height/2+10,pointerType}))
  }
  return <main style={{padding:16,maxWidth:780,margin:'auto'}}>
    <h1>Live drag QA</h1><p>Isolated cards; hold controls exercise an in-progress pointer gesture.</p>
    <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
      <button onClick={()=>hold('mouse')}>Hold desktop drag</button><button onClick={()=>hold('touch')}>Hold touch drag</button>
      <button onClick={()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))}>Cancel drag</button>
      <button onClick={()=>{const clone=document.querySelector<HTMLElement>('.live-drag-preview');if(!clone)return;const rect=clone.getBoundingClientRect();document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:77,isPrimary:true,clientX:rect.left+32,clientY:rect.top+rect.height/2}))}}>Drop card</button>
    </div>
    <p role="status">Saved moves: {saves}. {drag.announcement}</p>
    <div className="organized-books" ref={drag.containerRef} onClickCapture={drag.onClickCapture}>
      {ids.map((id,index)=><article key={id} className="organized-book" data-reorder-id={id} style={{minHeight:index===1?180:110}}>
        <button className="book-drag-handle" aria-label={`Drag ${id}`} {...drag.handleProps(id)}><GripVertical/></button>
        <div className="organized-cover"><span>{id.slice(0,2)}</span></div><div className="organized-copy"><span>#{index+1}</span><h2>{id}</h2><p>A card with a live drop preview.</p></div>
      </article>)}
    </div>
  </main>
}
createRoot(document.getElementById('root')!).render(<Fixture/>)
