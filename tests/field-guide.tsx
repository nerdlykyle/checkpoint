// Isolated fixture. Only this test's localStorage is used; no cloud writes.
import {useState} from 'react'
import {createRoot} from 'react-dom/client'
import {FieldGuideView} from '../src/FarFarWestFieldGuide'
import {updateGuideRun,updateGuideUnlocks} from '../src/lib/farFarWestGuide'
import type {GuideRun} from '../src/lib/farFarWestGuide'
import '../src/index.css'
import '../src/App.css'
type FixtureData={runs:Record<string,GuideRun>;unlocks:Record<string,string[]>}
function Fixture(){
  const [user,setUser]=useState('You'),[online,setOnline]=useState(true),[fail,setFail]=useState(false)
  const [data,setData]=useState<FixtureData>(()=>JSON.parse(localStorage.getItem('checkpoint-field-guide-fixture')||'{"runs":{"canyon":{"checked":["sheriff","digging"],"attempt":1}},"unlocks":{}}'))
  function write(next:FixtureData){if(fail)throw new Error('Simulated save failure · nothing changed.');localStorage.setItem('checkpoint-field-guide-fixture',JSON.stringify(next));setData(next)}
  return <main style={{maxWidth:1080,padding:16,margin:'auto'}}><h1>Far Far West · Game Night</h1><details><summary>Isolated test controls</summary><button onClick={()=>setUser(user==='You'?'Friend':'You')}>Switch user ({user})</button><button onClick={()=>setOnline(!online)}>{online?'Go offline':'Reconnect'}</button><button onClick={()=>setFail(!fail)}>{fail?'Restore saves':'Fail saves'}</button></details><FieldGuideView key={user} store={{runs:data.runs,unlocks:data.unlocks[user]||[],ready:online,status:online?'Preview · sample progress':'Offline · read only',error:'',retry:()=>setOnline(true),saveStep:async(map,attempt,step,checked)=>write({...data,runs:{...data.runs,[map]:updateGuideRun(data.runs[map],map,attempt,step,checked)}}),saveUnlock:async(map,checked)=>write({...data,unlocks:{...data.unlocks,[user]:updateGuideUnlocks({checked:data.unlocks[user]},map,checked)}})}}/></main>
}
createRoot(document.getElementById('root')!).render(<Fixture/> )
