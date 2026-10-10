import { useId, useRef, useState } from 'react'
import './Reviews.css'

/** Mount with an item/user key so drafts never cross accounts or titles. */
export default function ReviewEditor({ saved, disabled = false, onSave }: {
  saved: string; disabled?: boolean; onSave: (text: string) => Promise<void>
}) {
  const id = useId()
  const [draft, setDraft] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const pending = useRef(false)
  const text = draft ?? saved
  const save = async () => {
    if (pending.current || disabled) return
    pending.current = true; setSaving(true); setError(''); setMessage('')
    const value = text.trim()
    try { await onSave(value); setDraft(value); setMessage(value ? 'Review saved.' : 'Review cleared.') }
    catch { setError('Could not save your review. Your text is still here—please retry.') }
    finally { pending.current = false; setSaving(false) }
  }
  return <div className="written-review">
    <label htmlFor={id}>My review</label>
    <textarea id={id} rows={5} maxLength={2000} value={text} disabled={disabled || saving} onChange={event => { setDraft(event.target.value); setMessage(''); setError('') }} placeholder="What did you think? Share your review with the crew…" />
    <small>Shared with your crew · {text.length}/2,000</small>
    <button className="button button-secondary" type="button" disabled={disabled || saving || text.trim() === saved} onClick={() => void save()}>{saving ? 'Saving…' : text.trim() || !saved ? 'Save review' : 'Clear review'}</button>
    {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
  </div>
}
