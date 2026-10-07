import { useState } from 'react'
import { Check } from 'lucide-react'
import { bookmarkColor, bookmarkInk, bookmarkPalette } from './lib/bookmarkColors'
import { MemberPortrait } from './MemberShelfPicker'
import type { Member } from './types'
import './PaperbackCard.css'

export default function BookmarkColorSettings({ member, onSave }: { member: Member; onSave: (color: string) => Promise<void> }) {
  const [color, setColor] = useState(bookmarkColor(member))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const save = async () => {
    setBusy(true); setMessage('')
    try { await onSave(color); setMessage('Bookmark color saved.') }
    catch { setMessage('Could not save your color. Please try again.') }
    finally { setBusy(false) }
  }
  return <section className="bookmark-color-settings">
    <div><h3>Your bookmark color</h3><p>Used on your personal books and club-read bookmark. Synced with your account.</p></div>
    <div className="bookmark-color-options">
      <span className="bookmark-color-preview" style={{ backgroundColor: color, color: bookmarkInk(color) }} aria-label="Bookmark preview, chapter 12"><MemberPortrait member={member} /><strong>12</strong></span>
      <div className="bookmark-color-swatches">{bookmarkPalette.map(value => <button key={value} type="button" className="icon-button" aria-label={`Choose bookmark color ${value}`} aria-pressed={color === value} disabled={busy} onClick={() => { setColor(value); setMessage('') }}><span style={{ backgroundColor: value, color: bookmarkInk(value) }}>{color === value && <Check size={16} />}</span></button>)}</div>
      <label className="bookmark-custom-color">Custom color<input type="color" value={color} disabled={busy} onChange={event => { setColor(event.target.value); setMessage('') }} /></label>
    </div>
    <button className="button button-secondary" disabled={busy || color === bookmarkColor(member)} onClick={() => void save()}>{busy ? 'Saving…' : 'Save bookmark color'}</button>
    <p role="status">{message}</p>
  </section>
}
