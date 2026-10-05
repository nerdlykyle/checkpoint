// Local-only comparison. No auth, board reads, writes, or production style changes.
import { useState, type CSSProperties } from 'react'
import { createRoot } from 'react-dom/client'
import { BookOpen, ArrowUp, ArrowDown, Ellipsis } from 'lucide-react'
import ReadingCard from '../src/ReadingCard'
import type { Book } from '../src/types'
import '../src/index.css'
import '../src/App.css'
import './glass-comparison.css'

const book: Book = { id:'glass-preview', title:'Dune', authors:['Frank Herbert'], coverUrl:'https://covers.openlibrary.org/b/isbn/9780441172719-L.jpg', description:'', addedBy:'nern', createdAt:'2026-10-04', nominated:false, upvotes:[], downvotes:[], progress:{}, ratings:{}, comments:[], shelves:{} }
function Preview() {
  const [blur,setBlur]=useState(16),[tint,setTint]=useState(45),[message,setMessage]=useState('Preview only — adjustments here are never saved to your board.')
  const previewAction=()=>setMessage('Controls remain clickable. No changes are saved in this preview.')
  return <main className="glass-comparison">
    <h1>Book card glass tuning</h1>
    <div className="glass-tuning">
      <label>New blur: {blur}px<input aria-label="New blur" type="range" min="8" max="32" value={blur} onChange={event=>setBlur(Number(event.target.value))}/></label>
      <label>New navy tint: {tint}%<input aria-label="New navy tint" type="range" min="25" max="85" value={tint} onChange={event=>setTint(Number(event.target.value))}/></label>
    </div>
    <div className="glass-comparison-grid">
      {['Approved','Adjustable glass'].map((variant,index)=><section key={variant} className={index?'glass-trial':''} style={{'--trial-blur':`${blur}px`,'--trial-tint':tint/100} as CSSProperties}>
        <h2 className="comparison-label">{variant}</h2>
        <p className="comparison-setting">{index?`${blur}px backdrop blur · ${tint}% navy tint`:'16px backdrop blur · 45% navy tint'}</p>
        <ReadingCard book={book} user="nern" club label="#1 · Club Up Next" onDiscuss={previewAction}>
          <div className="club-book-controls club-queue-toolbar">
            <button className="button button-primary" onClick={previewAction}><BookOpen size={15}/><span>Start club read</span></button>
            <button className="club-queue-move" aria-label={`Move up (${variant})`} disabled><ArrowUp size={19}/></button>
            <button className="club-queue-move" aria-label={`Move down (${variant})`} onClick={previewAction}><ArrowDown size={19}/></button>
            <button className="more-actions-trigger" aria-label={`More actions (${variant})`} onClick={previewAction}><Ellipsis size={19}/></button>
          </div>
        </ReadingCard>
      </section>)}
    </div>
    <p role="status">{message}</p>
  </main>
}
createRoot(document.getElementById('root')!).render(<Preview/> )
