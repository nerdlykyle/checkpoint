import {createContext,useCallback,useContext,useMemo,useSyncExternalStore,type ReactNode} from 'react'
import {collection,doc,onSnapshot,setDoc,deleteDoc} from 'firebase/firestore'
import {auth,database,firebaseConfigured} from './lib/firebase'
import {validCustomCover,type CustomBookCover} from './lib/customBookCover'

type Snapshot = {covers:Record<string,CustomBookCover>;ready:boolean;error:string}
const empty:Snapshot={covers:{},ready:false,error:''}
type Entry={value:Snapshot;listeners:Set<()=>void>;stop?:()=>void}
function coverStore(board:string,user:string,enabled:boolean) {
  const entries=new Map<string,Entry>()
  const entry=(owner:string)=>{
    if(!entries.has(owner))entries.set(owner,{value:empty,listeners:new Set()})
    return entries.get(owner)!
  }
  const publish=(row:Entry,value:Snapshot)=>{row.value=value;row.listeners.forEach(fn=>fn())}
  const start=(owner:string)=>{
    const row=entry(owner)
    row.stop?.();row.stop=undefined
    if(!enabled)return
    const key=`checkpoint-book-covers-demo:${board}:${owner}`
    if(!firebaseConfigured) {
      try {
        const covers=JSON.parse(localStorage.getItem(key)||'{}')
        if (!covers || typeof covers!=='object' || Array.isArray(covers) || !Object.values(covers).every(validCustomCover)) throw new Error('Invalid saved covers')
        publish(row,{covers,ready:true,error:''})
      } catch {publish(row,{...row.value,ready:false,error:'Could not read your custom covers. Saved data has not been replaced.'})}
      return
    }
    if(!database || auth?.currentUser?.uid!==user)return
    row.stop=onSnapshot(collection(database,'boards',board,'bookCovers',owner,'covers'),{includeMetadataChanges:true},snapshot=>{
      const covers:Record<string,CustomBookCover>={}
      for(const item of snapshot.docs) {
        const value=item.data()
        if(!validCustomCover(value)){publish(row,{...row.value,ready:false,error:'A saved cover could not be read. Please retry.'});return}
        covers[item.id]=value
      }
      publish(row,{covers,ready:!snapshot.metadata.fromCache,error:''})
    },()=>publish(row,{...row.value,ready:false,error:'Custom covers could not sync. Please retry.'}))
  }
  return {
    user,
    get:(owner:string)=>owner?entry(owner).value:empty,
    subscribe:(owner:string,listener:()=>void)=>{
      if(!owner)return ()=>{}
      const row=entry(owner);row.listeners.add(listener)
      if(row.listeners.size===1)start(owner)
      return ()=>{row.listeners.delete(listener);if(!row.listeners.size){row.stop?.();row.stop=undefined}}
    },
    retry:(owner:string)=>start(owner),
    save:async(bookId:string,cover:CustomBookCover|null)=>{
      if(!enabled || !entry(user).value.ready)throw new Error('Wait for custom covers to sync before saving.')
      if(!bookId || bookId.includes('/') || bookId.length>200 || (cover && !validCustomCover(cover)))throw new Error('Invalid cover.')
      if(firebaseConfigured) {
        if(!database || auth?.currentUser?.uid!==user)throw new Error('Sign in to save your cover.')
        const ref=doc(database,'boards',board,'bookCovers',user,'covers',bookId)
        if(cover)await setDoc(ref,cover);else await deleteDoc(ref)
      } else {
        const row=entry(user),covers={...row.value.covers}
        if(cover)covers[bookId]=cover;else delete covers[bookId]
        // Storage failure must leave the previous image intact.
        localStorage.setItem(`checkpoint-book-covers-demo:${board}:${user}`,JSON.stringify(covers))
        publish(row,{covers,ready:true,error:''})
      }
    },
  }
}
const Context=createContext<ReturnType<typeof coverStore>|null>(null)
export function PersonalBookCovers({board,user,enabled,children}:{board:string;user:string;enabled:boolean;children:ReactNode}) {
  const store=useMemo(()=>coverStore(board,user,enabled),[board,user,enabled])
  return <Context.Provider value={store}>{children}</Context.Provider>
}
export function usePersonalBookCover(bookId?:string,reader?:string) {
  const store=useContext(Context),owner=bookId?(reader||store?.user||''):''
  const subscribe=useCallback((fn:()=>void)=>store?.subscribe(owner,fn)||(()=>{}),[store,owner])
  const get=useCallback(()=>store?.get(owner)||empty,[store,owner])
  const state=useSyncExternalStore(subscribe,get,get)
  return {...state,cover:bookId?state.covers[bookId]:undefined,save:(cover:CustomBookCover|null)=>{
    if(!store || !bookId || owner!==store.user)return Promise.reject(new Error('You can only change your own cover.'))
    return store.save(bookId,cover)
  },retry:()=>store?.retry(owner)}
}
