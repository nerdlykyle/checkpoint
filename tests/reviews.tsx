import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { GameReviewContent } from '../src/GameReviews'
import { makeGameReview, type GameReview } from '../src/lib/gameReviews'
import '../src/index.css'
import '../src/App.css'
function Fixture() {
  const [reviews,setReviews] = useState<Record<string,GameReview>>({friend:makeGameReview('Loved the co-op puzzles.',4)})
  const [fail,setFail] = useState(false)
  return <main style={{maxWidth:600,margin:'auto'}}><h1>Game review preview</h1><p>Isolated test — no cloud writes</p><label><input type="checkbox" checked={fail} onChange={e=>setFail(e.target.checked)} />Simulate save failure</label><GameReviewContent user="owner" crew={[{id:'owner',name:'Owner',initials:'O',color:'#7568e8'},{id:'friend',name:'Friend',initials:'F',color:'#358a85'}]} reviews={reviews} ready onSave={async update=>{if(fail)throw new Error('Test failure');setReviews(old=>({...old,owner:makeGameReview(update.text??old.owner?.text??'',update.stars??old.owner?.stars??0)}))}} /></main>
}
createRoot(document.getElementById('root')!).render(<Fixture />)
