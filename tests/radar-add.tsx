import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../src/index.css'
import '../src/App.css'
import '../src/GameArtworkCards.css'
import '../src/VisualControls.css'
import RadarAddButton from '../src/RadarAddButton'
function Fixture() {
  const [message,setMessage]=useState('Hover or focus the plus; no cloud writes')
  return <main style={{padding:32,maxWidth:450}}><h1>On the radar</h1><div className="radar-grid"><RadarAddButton onClick={()=>setMessage('Add game activated')} /></div><p role="status">{message}</p></main>
}
createRoot(document.getElementById('root')!).render(<Fixture />)
