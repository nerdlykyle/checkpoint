import { auth } from './firebase'
import type { MovieDraft } from './movies'
export type MovieResult = MovieDraft & { tmdbId: number }
export async function movieRequest<T>(board: string, params: Record<string,string>, signal?: AbortSignal): Promise<T> {
  if (!auth?.currentUser) throw new Error('Sign in to search the movie catalog. Manual entry is available in the demo.')
  const token = await auth.currentUser.getIdToken()
  signal?.throwIfAborted()
  const base = String(import.meta.env.VITE_CHECKPOINT_API_URL || 'https://checkpoint-game-data.claw8ex.workers.dev').replace(/\/$/, '')
  const response = await fetch(`${base}/movies/catalog?${new URLSearchParams({board,...params})}`, {
    headers: { Accept:'application/json', Authorization:`Bearer ${token}` },
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000),
  })
  let data
  try { data = await response.json() } catch { throw new Error('Movie search is unavailable. Please retry or add manually.') }
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Could not search movies.')
  return data as T
}
