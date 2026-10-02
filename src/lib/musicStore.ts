import { useEffect, useRef, useState } from 'react'
import { collection, doc, onSnapshot, runTransaction, setDoc } from 'firebase/firestore'
import { auth, database, firebaseConfigured } from './firebase'
import type { MusicItem, MusicService } from './music'

export type MusicMutation = (item: MusicItem) => MusicItem
export function useMusicStore(boardId: string, user: string, enabled = true) {
  const key = `checkpoint-music-demo:${boardId}`
  const [items,setItems] = useState<MusicItem[]>([])
  const [status,setStatus] = useState('Loading music…')
  const [ready,setReady] = useState(false)
  const [error,setError] = useState('')
  const [service,setService] = useState<MusicService>('spotify')
  const [retry,setRetry] = useState(0)
  const local = useRef(items); local.current = items
  useEffect(() => {
    if (!enabled) { setReady(false); setStatus('Waiting for board sync…'); return }
    setReady(false); setItems([]); setError('')
    if (!firebaseConfigured) {
      try { const data = JSON.parse(localStorage.getItem(key) || '[]'); setItems(Array.isArray(data) ? data : []); setService(localStorage.getItem('checkpoint-music-service-demo') === 'youtube' ? 'youtube' : 'spotify') } catch { setItems([]) }
      setReady(true); setStatus('Demo · saved on this device'); return
    }
    if (!database || !auth?.currentUser || auth.currentUser.uid !== user) { setStatus('Sign in to sync music.'); return }
    const stop = onSnapshot(collection(database,'boards',boardId,'music'),(snapshot) => {
      setItems(snapshot.docs.map((entry) => entry.data() as MusicItem)); setReady(true); setError(''); setStatus(snapshot.metadata.fromCache ? 'Music cached · reconnecting…' : 'Music shared live')
    },() => {setReady(false);setStatus('Music sync needs attention');setError('Could not load music. Check your connection and retry; your saved collection has not been replaced.')})
    const stopPreference = onSnapshot(doc(database,'musicPreferences',user),(snapshot) => {setService(snapshot.data()?.service === 'youtube' ? 'youtube' : 'spotify')},() => {setError('Could not load your music preference. You can still use either listening link.')})
    return () => { stop();stopPreference() }
  },[boardId,user,key,enabled,retry])
  const apply = async (changes: { id:string; update:MusicMutation; initial?:MusicItem }[]) => {
    if (!ready) throw new Error('Wait for music sync before making changes.')
    if (changes.length > 400) throw new Error('Reorder fewer than 400 records at a time.')
    if (!firebaseConfigured) {
      let next = local.current
      for (const change of changes) { const old = next.find((item) => item.id === change.id) ?? change.initial; if (!old) throw new Error('This music entry is no longer available.'); const updated=change.update(old); next=next.some((item)=>item.id===change.id)?next.map((item)=>item.id===change.id?updated:item):[...next,updated] }
      localStorage.setItem(key,JSON.stringify(next)); local.current=next;setItems(next);return
    }
    if (!database || auth?.currentUser?.uid !== user) throw new Error('Please sign in again.')
    await runTransaction(database,async (transaction) => {
      const refs=changes.map((change)=>doc(database!,'boards',boardId,'music',change.id))
      const snapshots=await Promise.all(refs.map((ref)=>transaction.get(ref)))
      changes.forEach((change,index)=> {const old=snapshots[index].exists()?snapshots[index].data() as MusicItem:change.initial;if(!old) throw new Error('Music entry not found. Refresh and try again.');transaction.set(refs[index],JSON.parse(JSON.stringify(change.update(old))))})
    })
  }
  const saveService = async (value: MusicService) => {
    if (firebaseConfigured) { if (!database || auth?.currentUser?.uid !== user) throw new Error('Sign in to save your preference.');await setDoc(doc(database,'musicPreferences',user),{service:value}) }
    else localStorage.setItem('checkpoint-music-service-demo',value)
    setService(value)
  }
  const clubSession = async (id:string, action:'start'|'finish') => {
    if (!ready) throw new Error('Wait for music sync.')
    const update = (item:MusicItem):MusicItem => {
      if(item.kind==='song'||item.passedOn) throw new Error('Choose an album or EP that has not been passed on.')
      if(action==='finish'&&item.club?.status!=='listening') throw new Error('This group listen is no longer active.')
      return {...item,nominated:false,club:{status:action==='start'?'listening':'listened',order:item.club?.order??0,participants:action==='start'?[...new Set([...(item.club?.participants??[]),user])]:item.club?.participants??[]}}
    }
    if (!firebaseConfigured) {
      if(action==='start' && local.current.some((item)=>item.club?.status==='listening' && item.id!==id)) throw new Error('Finish the current group listen first.')
      return apply([{id,update}])
    }
    if(!database || auth?.currentUser?.uid!==user) throw new Error('Sign in again.')
    await runTransaction(database,async(transaction)=>{
      const stateRef=doc(database!,'boards',boardId,'musicState','current'),itemRef=doc(database!,'boards',boardId,'music',id)
      const [state,item]=await Promise.all([transaction.get(stateRef),transaction.get(itemRef)])
      if(!item.exists()) throw new Error('This music entry could not be found.')
      if(action==='start' && state.data()?.musicId && state.data()?.musicId!==id) throw new Error('Finish the current group listen first.')
      if(action==='finish' && state.data()?.musicId!==id) throw new Error('This is no longer the current group listen.')
      transaction.set(itemRef,JSON.parse(JSON.stringify(update(item.data() as MusicItem))))
      transaction.set(stateRef,{musicId:action==='start'?id:''})
    })
  }
  return {items,ready,status,error,service,apply,saveService,clubSession,retry:()=>setRetry((value)=>value+1)}
}
