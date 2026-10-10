import { useEffect, useRef, useState } from 'react'
import { collection, doc, onSnapshot, runTransaction } from 'firebase/firestore'
import { Star } from 'lucide-react'
import { auth, database, firebaseConfigured } from './lib/firebase'
import { makeGameReview, type GameReview } from './lib/gameReviews'
import type { Member } from './types'
import ReviewEditor from './ReviewEditor'

export function GameReviewContent({ user, crew, reviews, ready, onSave }: {
  user: string; crew: Member[]; reviews: Record<string, GameReview>; ready: boolean
  onSave: (update: { text?: string; stars?: number }) => Promise<void>
}) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const pending = useRef(false)
  const own = reviews[user]
  const save = async (update: { text?: string; stars?: number }) => {
    if (pending.current) throw new Error('A save is already in progress.')
    pending.current = true; setBusy(true)
    try { await onSave(update) } finally { pending.current = false; setBusy(false) }
  }
  return <section className="game-reviews"><h3>My rating & review</h3>
    <div className="game-review-stars" role="group" aria-label="Your game rating">{[1,2,3,4,5].map(stars => <button type="button" className="icon-button" key={stars} aria-label={`Rate ${stars} stars`} aria-pressed={own?.stars === stars} disabled={!ready || busy} onClick={async () => {
      setError(''); try { await save({ stars: own?.stars === stars ? 0 : stars }) } catch { setError('Could not save your rating. Please retry.') }
    }}><Star size={22} fill={stars <= (own?.stars || 0) ? 'currentColor' : 'none'} /></button>)}</div>
    <small>Stars are optional. Tap your selected star again to clear it.</small>
    {error && <p role="alert">{error}</p>}
    <ReviewEditor key={user} saved={own?.text || ''} disabled={!ready || busy} onSave={text => save({ text })} />
    <h3>Crew ratings & reviews</h3>
    {crew.map(member => { const review = reviews[member.id]; return <article className="game-crew-review" key={member.id}><strong>{member.name}{member.id === user ? ' (you)' : ''}</strong><small>{review?.stars ? `${review.stars}/5 stars` : 'Not rated'}</small>{review?.text && <p className="crew-review-text">{review.text}</p>}</article> })}
  </section>
}

export default function GameReviews({ boardId, gameId, user, crew }: { boardId: string; gameId: string; user: string; crew: Member[] }) {
  const [reviews, setReviews] = useState<Record<string, GameReview>>({})
  const [ready, setReady] = useState(false), [error, setError] = useState(''), [revision, setRevision] = useState(0)
  const local = useRef(reviews); local.current = reviews
  const key = `checkpoint-game-reviews:${boardId}:${gameId}`
  useEffect(() => {
    setReady(false); setReviews({}); setError('')
    if (!firebaseConfigured) {
      try { const data = JSON.parse(localStorage.getItem(key) || '{}'); if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error(); setReviews(data); setReady(true) }
      catch { setError('Could not load reviews. Saved data has not been replaced.') }
      return
    }
    if (!database || auth?.currentUser?.uid !== user) { setError('Sign in to read and write reviews.'); return }
    return onSnapshot(collection(database, 'boards', boardId, 'gameReviews', gameId, 'members'), {includeMetadataChanges:true}, snapshot => {
      setReviews(Object.fromEntries(snapshot.docs.map(entry => [entry.id, entry.data() as GameReview])))
      setReady(!snapshot.metadata.fromCache); setError('')
    }, () => { setReady(false); setError('Could not load reviews. Check your connection and retry.') })
  }, [boardId, gameId, user, key, revision])
  const save = async (update: { text?: string; stars?: number }) => {
    if (!ready) throw new Error('Wait for review sync.')
    const change = (old?: GameReview) => makeGameReview(update.text ?? old?.text ?? '', update.stars ?? old?.stars ?? 0)
    if (!firebaseConfigured) {
      const next = { ...local.current, [user]: change(local.current[user]) }
      localStorage.setItem(key, JSON.stringify(next)); local.current = next; setReviews(next); return
    }
    if (!database || auth?.currentUser?.uid !== user) throw new Error('Sign in again.')
    await runTransaction(database, async transaction => {
      const ref = doc(database!, 'boards', boardId, 'gameReviews', gameId, 'members', user)
      const old = await transaction.get(ref)
      transaction.set(ref, change(old.data() as GameReview | undefined))
    })
  }
  return <>{error && <p role="alert">{error} <button type="button" className="button" onClick={() => setRevision(value => value + 1)}>Retry reviews</button></p>}
    <GameReviewContent user={user} crew={crew} reviews={reviews} ready={ready} onSave={save} />
  </>
}
