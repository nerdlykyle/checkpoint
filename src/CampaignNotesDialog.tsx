import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import './CampaignNotesDialog.css'

export default function CampaignNotesDialog({ gameTitle, note, liveNote, onNoteChange, onClose }: {
  gameTitle: string
  note: string
  liveNote: boolean
  onNoteChange: (note: string) => void
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const fieldId = useId()
  const label = liveNote ? 'Live session notes' : 'Shared campaign note'
  useEffect(() => {
    const element = dialog.current
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    element?.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      element?.close()
      document.body.style.overflow = previousOverflow
      if (trigger?.isConnected) trigger.focus({ preventScroll: true })
    }
  }, [])
  return createPortal(<dialog ref={dialog} className="campaign-notes-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose() }} onClick={event => { if (event.target === event.currentTarget) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose() } }}>
    <header><div><span className="eyebrow">{gameTitle}</span><h2 id={titleId}>{label}</h2></div><button type="button" aria-label="Close notes" title="Close notes" onClick={onClose} autoFocus><X size={22} /></button></header>
    <label className="sr-only" htmlFor={fieldId}>{label}</label>
    <textarea id={fieldId} value={note} onChange={event => onNoteChange(event.target.value)} maxLength={5000} placeholder={liveNote ? 'Clues, discoveries, and moments to remember…' : 'Where did we leave off? Add a note for the next session…'} />
    <footer><span>Changes are kept as you type.</span><button type="button" onClick={onClose}>Done</button></footer>
  </dialog>, document.body)
}
