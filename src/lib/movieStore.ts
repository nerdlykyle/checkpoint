import { useEffect, useRef, useState } from 'react'
import { collection, doc, FieldPath, onSnapshot, runTransaction } from 'firebase/firestore'
import { auth, database, firebaseConfigured } from './firebase'
import { changeMovie, makeMovie, movieId, rateMovie, reviewMovie, validateMovie, type Movie, type MovieAction, type MovieDraft } from './movies'
import type { ConnectionState } from '../NavigationSync'

export function useMovieStore(boardId: string, user: string, enabled: boolean) {
  const key = `checkpoint-movies-demo:${boardId}`
  const [items, setItems] = useState<Movie[]>([])
  const [ready, setReady] = useState(false)
  const [connection, setConnection] = useState<ConnectionState>('connecting')
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const local = useRef(items)
  local.current = items
  useEffect(() => {
    setReady(false); setItems([]); setError(''); setConnection('connecting')
    if (!enabled) return
    if (!firebaseConfigured) {
      try {
        const stored: unknown = JSON.parse(localStorage.getItem(key) || '[]')
        if (!Array.isArray(stored)) throw new Error('Invalid saved movie collection')
        setItems(stored); setReady(true); setConnection('local')
      } catch { setError('Could not read your saved movies. Your stored data has not been replaced.'); setConnection('error') }
      return
    }
    if (!database || auth?.currentUser?.uid !== user) return
    return onSnapshot(collection(database, 'boards', boardId, 'movies'), { includeMetadataChanges: true }, snapshot => {
      setItems(snapshot.docs.map(entry => entry.data() as Movie)); setReady(!snapshot.metadata.fromCache)
      setConnection(snapshot.metadata.fromCache ? 'connecting' : 'live'); setError('')
    }, () => {
      setReady(false); setConnection('error')
      setError('Movies could not sync. Check your connection and retry. Your existing collections are unchanged.')
    })
  }, [boardId, user, enabled, key, revision])

  // All mutations read the latest record. A personal removal never deletes the
  // shared movie, another member’s library, or a group watch.
  const mutate = async (id: string, update: (old: Movie, current: string) => Movie, fields: FieldPath[], initial?: Movie, session?: 'start' | 'finish') => {
    if (!enabled || !ready) throw new Error('Wait for movie sync before making changes.')
    if (!firebaseConfigured) {
      const old = local.current.find(item => item.id === id) || initial
      if (!old) throw new Error('Movie not found. Refresh and try again.')
      const next = update(old, local.current.find(item => item.clubStatus === 'watching')?.id || '')
      const items = local.current.some(item => item.id === id) ? local.current.map(item => item.id === id ? next : item) : [...local.current, next]
      localStorage.setItem(key, JSON.stringify(items)); local.current = items; setItems(items); return
    }
    if (!database || auth?.currentUser?.uid !== user) throw new Error('Please sign in again.')
    await runTransaction(database, async transaction => {
      const itemRef = doc(database!, 'boards', boardId, 'movies', id)
      const stateRef = doc(database!, 'boards', boardId, 'movieState', 'current')
      const [item, state] = await Promise.all([transaction.get(itemRef), transaction.get(stateRef)])
      const old = item.exists() ? item.data() as Movie : initial
      if (!old) throw new Error('Movie not found. Refresh and try again.')
      const updated = update(old, state.data()?.movieId || '')
      // Field paths preserve other members even if their saves race this one.
      // Only brand-new movie records need a full document write.
      if (item.exists()) transaction.set(itemRef, updated, { mergeFields: fields })
      else transaction.set(itemRef, updated)
      if (session) transaction.set(stateRef, { movieId: session === 'start' ? id : '' })
    })
  }
  const add = async (input: MovieDraft) => {
    const draft = validateMovie(input), id = await movieId(draft)
    await mutate(id, old => changeMovie(old, user, 'save', ''), [new FieldPath('libraries', user)], makeMovie(id, draft, user))
    return id
  }
  const edit = (id: string, draft: MovieDraft) => mutate(id, old => ({ ...old, ...validateMovie(draft) }), ['title','year','posterUrl','description'].map(key => new FieldPath(key)))
  const action = (id: string, action: MovieAction) => {
    const fields = action === 'seen' || action === 'unseen' ? [new FieldPath('seenBy',user),new FieldPath('libraries',user)] : action === 'save' || action === 'remove' ? [new FieldPath('libraries',user)] : [new FieldPath('clubStatus'),new FieldPath('queuedAt')]
    return mutate(id, (old, current) => changeMovie(old, user, action, current), fields, undefined, action === 'start' || action === 'finish' ? action : undefined)
  }
  const rate = (id: string, stars: number) => mutate(id, old => rateMovie(old, user, stars), [new FieldPath('ratings',user)])
  const review = (id: string, text: string) => mutate(id, old => reviewMovie(old, user, text), [new FieldPath('reviews', user)])
  return { items, ready, connection, error, add, edit, action, rate, review, retry: () => setRevision(value => value + 1) }
}
