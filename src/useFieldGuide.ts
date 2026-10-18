import { useEffect, useState } from 'react'
import { collection, doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore'
import { auth, database, firebaseConfigured } from './lib/firebase'
import { GUIDE_ID, guideMissions, readGuideRun, readGuideUnlocks, updateGuideRun, updateGuideUnlocks, type GuideRun } from './lib/farFarWestGuide'

export type FieldGuideStore = {
  runs: Record<string,GuideRun>; unlocks: string[]; ready: boolean; status: string; error: string
  saveStep: (map: string, attempt: number, step: string | null, checked: boolean) => Promise<void>
  saveUnlock: (map: string, checked: boolean) => Promise<void>
  retry: () => void
}
type State = { scope: string; runs: Record<string,GuideRun>; unlocks: string[]; runsReady: boolean; unlocksReady: boolean; error: string }
export function useFieldGuide(board: string, user: string, enabled: boolean): FieldGuideStore {
  const scope=`${board}:${user}`
  const [state,setState]=useState<State>({scope,runs:{},unlocks:[],runsReady:false,unlocksReady:false,error:''})
  const [revision,setRevision]=useState(0)
  const localKey=`checkpoint-field-guide-demo:${scope}`
  useEffect(()=>{
    let active=true
    setState({scope,runs:{},unlocks:[],runsReady:false,unlocksReady:false,error:''})
    if (!enabled) return
    if (!firebaseConfigured) {
      try {
        const saved=JSON.parse(localStorage.getItem(localKey)||'{}')
        const runs=Object.fromEntries(guideMissions.map(m=>[m.id,readGuideRun(saved.runs?.[m.id],m.id)]))
        setState({scope,runs,unlocks:readGuideUnlocks(saved),runsReady:true,unlocksReady:true,error:''})
      } catch { setState(old=>({...old,error:'Could not read local guide progress. Saved data has not been replaced.'})) }
      return
    }
    if (!database || auth?.currentUser?.uid!==user) return
    const fail=()=>{if(active)setState(old=>({...old,runsReady:false,unlocksReady:false,error:'Guide sync failed. Your saved progress has not been replaced.'}))}
    const offRuns=onSnapshot(collection(database,'boards',board,'fieldGuides',GUIDE_ID,'maps'),{includeMetadataChanges:true},snapshot=>{
      if (!active) return
      const runs=Object.fromEntries(snapshot.docs.filter(row=>guideMissions.some(m=>m.id===row.id)).map(row=>[row.id,readGuideRun(row.data(),row.id)]))
      setState(old=>({...old,runs,runsReady:!snapshot.metadata.fromCache,error:''}))
    },fail)
    const offUnlocks=onSnapshot(doc(database,'boards',board,'fieldGuides',GUIDE_ID,'unlocks',user),{includeMetadataChanges:true},snapshot=>{
      if(active)setState(old=>({...old,unlocks:readGuideUnlocks(snapshot.data()),unlocksReady:!snapshot.metadata.fromCache,error:''}))
    },fail)
    return ()=>{active=false;offRuns();offUnlocks()}
  },[scope,board,user,enabled,localKey,revision])
  const current=state.scope===scope?state:{scope,runs:{},unlocks:[],runsReady:false,unlocksReady:false,error:''}
  const ready=enabled&&current.runsReady&&current.unlocksReady&&!current.error
  function requireReady() {
    if(!ready) throw new Error('Wait for the guide to reconnect before saving.')
    if(firebaseConfigured&&(!database||auth?.currentUser?.uid!==user)) throw new Error('Your account changed. Reopen Game Night before saving.')
  }
  return {
    runs:current.runs,unlocks:current.unlocks,ready,error:current.error,
    status:current.error?'Sync issue':ready?(firebaseConfigured?'Shared live':'On this device'):'Reconnecting · read only',
    retry:()=>setRevision(value=>value+1),
    saveStep:async(map,attempt,step,checked)=>{
      requireReady()
      if(!firebaseConfigured){
        const saved=JSON.parse(localStorage.getItem(localKey)||'{}')
        const runs={...saved.runs,[map]:updateGuideRun(saved.runs?.[map],map,attempt,step,checked)}
        localStorage.setItem(localKey,JSON.stringify({...saved,runs}));setState(old=>({...old,runs}));return
      }
      await runTransaction(database!,async transaction=>{
        const ref=doc(database!,'boards',board,'fieldGuides',GUIDE_ID,'maps',map)
        const saved=await transaction.get(ref)
        transaction.set(ref,{...updateGuideRun(saved.data(),map,attempt,step,checked),updatedBy:user,updatedAt:serverTimestamp()})
      })
    },
    saveUnlock:async(map,checked)=>{
      requireReady()
      if(!firebaseConfigured){
        const saved=JSON.parse(localStorage.getItem(localKey)||'{}'),unlocks=updateGuideUnlocks(saved,map,checked)
        localStorage.setItem(localKey,JSON.stringify({...saved,checked:unlocks}));setState(old=>({...old,unlocks}));return
      }
      await runTransaction(database!,async transaction=>{
        const ref=doc(database!,'boards',board,'fieldGuides',GUIDE_ID,'unlocks',user),saved=await transaction.get(ref)
        transaction.set(ref,{checked:updateGuideUnlocks(saved.data(),map,checked),updatedAt:serverTimestamp()})
      })
    },
  }
}
