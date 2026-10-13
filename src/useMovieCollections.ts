import { useEffect, useState } from 'react'
import { movieRequest, type MovieResult } from './lib/movieSearch'
import { loadMovieCollections, movieCollectionCache, type MovieCollections } from './lib/movieCollections'
import type { Movie } from './lib/movies'

export function useMovieCollections(items: Movie[], board: string, user: string, ready: boolean, request = movieRequest) {
  const scope = `${board}:${user}`
  const ids = [...new Set(items.flatMap(item => item.tmdbId ? [item.tmdbId] : []))].sort((a,b) => a-b).join(',')
  const [state, setState] = useState<{ scope: string; metadata: MovieCollections; failed: boolean }>({ scope, metadata: {}, failed: false })
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setState({ scope, metadata: {}, failed: false })
    if (!ready || !ids) return () => controller.abort()
    let storage: Storage | undefined
    try { storage = localStorage } catch { /* Private browsing may disable storage. */ }
    void loadMovieCollections(ids.split(',').map(Number), (id, signal) => request<MovieResult>(board, { action: 'detail', id: String(id) }, signal), controller.signal,
      (id, collection) => { if (!controller.signal.aborted) setState(old => ({ ...old, metadata: { ...old.metadata, [id]: collection } })) }, movieCollectionCache(storage))
      .then(failed => { if (!controller.signal.aborted) setState(old => ({ ...old, failed: failed.length > 0 })) })
    return () => controller.abort()
  }, [scope, board, ids, ready, request, revision])
  return { metadata: state.scope === scope ? state.metadata : {}, failed: state.scope === scope && state.failed, retry: () => setRevision(value => value + 1) }
}
