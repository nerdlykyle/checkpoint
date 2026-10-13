import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { collection, doc, onSnapshot, runTransaction } from 'firebase/firestore'
import { Heart } from 'lucide-react'
import { auth, database, firebaseConfigured } from './lib/firebase'
import { emptyFavorites, readFavorites, setPersonalFavorite, type FavoriteKind, type PersonalFavorites } from './lib/personalFavorites'

type FavoritesState = { members: Record<string, PersonalFavorites>; ready: boolean; error: string }
export function usePersonalFavorites(board: string, user: string, enabled: boolean) {
  const scope = `${board}:${user}`, key = `checkpoint-personal-favorites-demo:${board}`
  const [state,setState] = useState<FavoritesState & {scope:string}>({scope,members:{},ready:false,error:''})
  const [revision,setRevision] = useState(0)
  const local = useRef(state.members)
  local.current = state.members
  useEffect(() => {
    setState({scope,members:{},ready:false,error:''})
    if (!enabled) return
    if (!firebaseConfigured) {
      try {
        const saved = JSON.parse(localStorage.getItem(key) || '{}')
        if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw new Error('Invalid favorites')
        const members = Object.fromEntries(Object.entries(saved).map(([id,value])=>[id,readFavorites(value)]))
        local.current = members
        setState({scope,members,ready:true,error:''})
      } catch { setState({scope,members:{},ready:false,error:'Favorites could not load. Your saved data has not been replaced.'}) }
      return
    }
    if (!database || auth?.currentUser?.uid !== user) return
    return onSnapshot(collection(database,'boards',board,'personalFavorites'),{includeMetadataChanges:true},snapshot=>{
      setState({scope,members:Object.fromEntries(snapshot.docs.map(row=>[row.id,readFavorites(row.data())])),ready:!snapshot.metadata.fromCache,error:''})
    },()=>setState(old=>({...old,ready:false,error:'Favorites could not sync. Please retry.'})))
  },[scope,board,user,enabled,key,revision])
  const current: FavoritesState = state.scope === scope ? state : {members:{},ready:false,error:''}
  const save = async (kind: FavoriteKind, id: string, active: boolean) => {
    if (!enabled || !current.ready) throw new Error('Wait for favorites to sync before saving.')
    if (!firebaseConfigured) {
      const members = {...local.current,[user]:setPersonalFavorite(local.current[user] || emptyFavorites(),kind,id,active)}
      localStorage.setItem(key,JSON.stringify(members));local.current=members
      setState({scope,members,ready:true,error:''});return
    }
    if (!database || auth?.currentUser?.uid !== user) throw new Error('Please sign in again.')
    await runTransaction(database,async transaction=>{
      const ref=doc(database!,'boards',board,'personalFavorites',user)
      const saved=await transaction.get(ref)
      transaction.set(ref,setPersonalFavorite(readFavorites(saved.data()),kind,id,active))
    })
  }
  return {...current,user,save,retry:()=>setRevision(value=>value+1)}
}
export const PersonalFavoritesContext = createContext<ReturnType<typeof usePersonalFavorites>>({members:{},ready:false,error:'',user:'',save:async()=>{throw new Error('Favorites are unavailable')},retry:()=>{}})
export const useFavorites = () => useContext(PersonalFavoritesContext)
export function FavoriteButton({kind,id,title}:{kind:FavoriteKind;id:string;title:string}) {
  const store=useFavorites(), active=store.members[store.user]?.[kind].includes(id) || false
  const [busy,setBusy]=useState(false),[error,setError]=useState('')
  return <div className="personal-favorite-control"><button type="button" className="button button-secondary" aria-label={`${active?'Remove':'Add'} ${title} ${active?'from':'to'} my favorites`} aria-pressed={active} disabled={!store.ready||busy} onClick={async()=>{
    setBusy(true);setError('')
    try{await store.save(kind,id,!active)}catch(reason){setError(reason instanceof Error?reason.message:'Could not save favorite.')}finally{setBusy(false)}
  }}><Heart size={18} aria-hidden="true" fill={active?'currentColor':'none'}/>{active?'Favorited':'Favorite'}</button>{error&&<p role="alert">{error}</p>}{store.error&&<p role="alert">{store.error} <button type="button" onClick={store.retry}>Retry favorites</button></p>}</div>
}
export function FavoritesStatus() {
  const store=useFavorites()
  return store.error ? <p role="alert">{store.error} <button className="button" type="button" onClick={store.retry}>Retry favorites</button></p> : !store.ready ? <p role="status">Loading favorites…</p> : null
}
