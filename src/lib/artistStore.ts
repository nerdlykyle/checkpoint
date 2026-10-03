import { useEffect, useState } from 'react'
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore'
import { auth, database, firebaseConfigured } from './firebase'
import { makeFavoriteArtist, type ArtistResult, type MusicArtist } from './musicArtists'

export function useArtistStore(board: string, user: string, owner: string, enabled: boolean) {
  const key = `checkpoint-artists-demo:${board}:${owner}`
  const [items,setItems] = useState<MusicArtist[]>([]), [ready,setReady] = useState(false), [error,setError] = useState(''), [retry,setRetry] = useState(0)
  useEffect(() => {
    setReady(false); setItems([]); setError('')
    if (!enabled) return
    if (!firebaseConfigured) {
      try { const saved = JSON.parse(localStorage.getItem(key) || '[]'); setItems(Array.isArray(saved) ? saved : []); setReady(true) } catch { setError('Could not read saved artists on this device.') }
      return
    }
    if (!database || auth?.currentUser?.uid !== user) { setError('Sign in to load favorite artists.'); return }
    return onSnapshot(collection(database,'boards',board,'artistFavorites',owner,'artists'),snapshot => {
      setItems(snapshot.docs.map(entry => entry.data() as MusicArtist)); setReady(true); setError('')
    },() => { setReady(false); setError('Could not sync favorite artists. Check your connection and retry.') })
  },[board,user,owner,enabled,key,retry])
  const save = async (data: ArtistResult, active = true) => {
    if (!ready || owner !== user) throw new Error('Wait for your artist collection to sync before editing.')
    const artist = makeFavoriteArtist(data,active)
    if (firebaseConfigured) {
      if (!database || auth?.currentUser?.uid !== user) throw new Error('Sign in to save favorite artists.')
      await setDoc(doc(database,'boards',board,'artistFavorites',user,'artists',artist.id),artist)
    } else {
      const existing: MusicArtist[] = JSON.parse(localStorage.getItem(key) || '[]')
      const next = [...existing.filter(item => item.id !== artist.id),artist]
      localStorage.setItem(key,JSON.stringify(next)); setItems(next)
    }
  }
  return {items,ready,error,save,retry:()=>setRetry(value=>value+1)}
}
