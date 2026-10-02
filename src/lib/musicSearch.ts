import { auth } from './firebase'
import type { MusicItem } from './music'
export async function musicRequest<T>(board:string,parameters:Record<string,string>,signal?:AbortSignal):Promise<T> {
  if(!auth?.currentUser) throw new Error('Sign in to search the catalog. Manual entry is available in the demo.')
  const base=String(import.meta.env.VITE_CHECKPOINT_API_URL || 'https://checkpoint-game-data.claw8ex.workers.dev').replace(/\/$/,'')
  const endpoint=import.meta.env.VITE_MUSIC_CATALOG_URL || `${base}/music/catalog`
  const response=await fetch(`${endpoint}?${new URLSearchParams({board,...parameters})}`,{headers:{Accept:'application/json'},signal:signal?AbortSignal.any([signal,AbortSignal.timeout(45000)]):AbortSignal.timeout(45000)})
  const data=await response.json()
  if(!response.ok) throw new Error(data.error||'Could not load the music catalog.')
  return data as T
}
export type MusicResult = Pick<MusicItem,'id'|'kind'|'title'|'artists'> & Partial<MusicItem>
