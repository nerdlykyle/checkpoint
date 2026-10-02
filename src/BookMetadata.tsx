import { useEffect, useState } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, database } from './lib/firebase'
import type { Book } from './types'
import { X } from 'lucide-react'

export function PrivateBookNote({ bookId, kind = 'books' }: { bookId: string; kind?: 'books' | 'music' }) {
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState('')
  const [status, setStatus] = useState('Loading private note…')
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    const uid = auth?.currentUser?.uid
    if (!database || !uid) { setStatus('Sign in to save a private note.'); return }
    getDoc(doc(database, 'readerNotes', uid, kind, bookId)).then((snapshot) => {
      if (!active) return
      const text = snapshot.data()?.note ?? ''
      setNote(text); setSaved(text); setStatus('Only you can read this note.'); setReady(true)
    }).catch(() => { if (active) setStatus('Could not load your private note. Close and reopen this item to retry.') })
    return () => { active = false }
  }, [bookId, kind])
  const save = async () => {
    if (!database || !auth?.currentUser || !ready) return
    setSaving(true)
    setError('')
    try {
      await setDoc(doc(database, 'readerNotes', auth.currentUser.uid, kind, bookId), { note, updatedAt: new Date().toISOString() })
      setSaved(note); setStatus('Private note saved. Only you can read it.')
    } catch { setError('Could not save. Your text is still here—please try again.') }
    finally { setSaving(false) }
  }
  return <section className="private-book-note"><span className="eyebrow">My private note</span><p className="book-empty-copy">Why did I save this {kind === 'music' ? 'music' : 'book'}?</p><textarea aria-label="My private note" rows={4} maxLength={4000} value={note} disabled={!ready || saving} onChange={(event) => setNote(event.target.value)} placeholder="A recommendation, a reminder, or something to remember…" /><p role="status">{error || (note !== saved ? 'Unsaved changes. Save before closing.' : status)}</p><button className="button button-secondary" type="button" disabled={!ready || saving || note === saved} onClick={save}>{saving ? 'Saving…' : 'Save private note'}</button></section>
}

export default function BookMetadata({ book, currentUser, onClose, onSave }: { book: Book; currentUser: string; onClose: () => void; onSave: (book: Book) => void }) {
  const [name, setName] = useState(book.series?.name ?? '')
  const [position, setPosition] = useState(String(book.series?.position ?? ''))
  const [total, setTotal] = useState(String(book.series?.total ?? ''))
  const [genres, setGenres] = useState(book.genres?.join(', ') ?? '')
  const [tags, setTags] = useState(book.readerOrganization?.[currentUser]?.tags?.join(', ') ?? '')
  const list = (value: string) => [...new Set(value.split(',').map((text) => text.trim()).filter(Boolean))].slice(0, 20)
  return <div className="modal-backdrop"><form className="modal-card book-metadata-modal" role="dialog" aria-modal="true" aria-label="Edit book organization" onSubmit={(event) => {
    event.preventDefault()
    onSave({ ...book, metadataEdited: true, genres: list(genres), series: name.trim() ? { name: name.trim(), ...(position ? { position: Number(position) } : {}), ...(total ? { total: Number(total) } : {}) } : undefined,
      readerOrganization: { ...book.readerOrganization, [currentUser]: { ...book.readerOrganization?.[currentUser], tags: list(tags) } } })
  }}>
    <div className="modal-title"><div><span className="eyebrow">Organize your books</span><h2>Series & genres</h2><p>{book.title}</p></div><button type="button" className="icon-button" aria-label="Close" onClick={onClose}><X size={18} /></button></div>
    <p className="book-empty-copy">Series and genres describe the book for everyone. Tags belong to your shelf. Catalog refreshes won’t overwrite your corrections.</p>
    <label>Series name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={150} placeholder="Leave blank for a standalone" /></label>
    <div className="book-metadata-numbers"><label>Book number<input type="number" min="0" max="9999" step="0.1" value={position} onChange={(event) => setPosition(event.target.value)} placeholder="e.g. 2 or 2.5" /></label><label>Books in series<input type="number" min={Math.max(1, Math.ceil(Number(position)))} max="9999" value={total} onChange={(event) => setTotal(event.target.value)} placeholder="If known" /></label></div>
    <label>Genres<input value={genres} onChange={(event) => setGenres(event.target.value)} maxLength={500} placeholder="Sci-fi, Horror" /></label>
    <label>My tags<input value={tags} onChange={(event) => setTags(event.target.value)} maxLength={500} placeholder="Short read, Audiobook, Recommended by Jern" /></label>
    <small>Separate genres and tags with commas.</small>
    <div className="modal-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancel</button><button className="button button-primary" type="submit">Save organization</button></div>
  </form></div>
}
