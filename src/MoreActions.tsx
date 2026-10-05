import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { MoreHorizontal, X } from 'lucide-react'
import './MoreActions.css'

export type MoreAction = { id: string; label: string; icon: ReactNode; onSelect: () => void; disabled?: boolean; danger?: boolean; section?: string; opensDialog?: boolean }

/** One action list: anchored popover on desktop, bottom sheet on phones. */
export default function MoreActions({ label, actions, icon = <MoreHorizontal size={21} /> }: { label: string; actions: MoreAction[]; icon?: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ left: 12, top: 12 })
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const restoreFocus = useRef(true)
  const id = useId()
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      if (!trigger.current || !panel.current) return
      const anchor = trigger.current.getBoundingClientRect()
      const width = panel.current.offsetWidth
      const height = panel.current.offsetHeight
      setPosition({ left: Math.max(12, Math.min(anchor.right - width, window.innerWidth - width - 12)), top: Math.max(12, Math.min(anchor.bottom + 8, window.innerHeight - height - 12)) })
    }
    const dialog = panel.current
    const button = trigger.current
    const siblings = [...document.body.children].filter((element): element is HTMLElement => element instanceof HTMLElement && element !== dialog?.parentElement)
    const previousInert = siblings.map(element => element.inert)
    // Portaling also keeps the menu out of clipped/scrolling detail cards.
    siblings.forEach(element => { element.inert = true })
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    place()
    ;(dialog?.querySelector<HTMLButtonElement>('[data-more-action]:not(:disabled)') ?? dialog?.querySelector<HTMLButtonElement>('button'))?.focus()
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('resize', place)
      siblings.forEach((element, index) => { element.inert = previousInert[index] })
      document.body.style.overflow = previousOverflow
      if (restoreFocus.current && button?.isConnected) button.focus()
    }
  }, [open])
  if (!actions.length) return null
  const close = () => { restoreFocus.current = true; setOpen(false) }
  return <>
    <button ref={trigger} type="button" className="more-actions-trigger" aria-label={label} title={label} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined} onClick={event => { event.stopPropagation(); restoreFocus.current = true; setOpen(true) }}>{icon}</button>
    {open && createPortal(<div className="more-actions-backdrop" onMouseDown={event => { event.stopPropagation(); if (event.target === event.currentTarget) close() }} onClick={event => event.stopPropagation()}>
      <div ref={panel} id={id} className="more-actions-panel" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} style={{ '--more-left': `${position.left}px`, '--more-top': `${position.top}px` } as CSSProperties} onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return }
        const buttons = [...(panel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])]
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
        if (event.key === 'Tab' && (event.shiftKey ? index <= 0 : index === buttons.length - 1)) { event.preventDefault(); buttons[event.shiftKey ? buttons.length - 1 : 0]?.focus() }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); buttons[(index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus() }
      }}>
        <div className="more-actions-heading"><h2 id={`${id}-title`}>{label}</h2><button type="button" aria-label="Close actions" onClick={close}><X size={19} /></button></div>
        <div className="more-actions-list">{actions.map((action, index) => <div className="more-actions-group" key={action.id}>
          {action.section && action.section !== actions[index - 1]?.section && <h3>{action.section}</h3>}
          <button type="button" data-more-action className={action.danger ? 'more-action-danger' : ''} disabled={action.disabled} onClick={() => {
            restoreFocus.current = !action.opensDialog
            setOpen(false)
            action.onSelect()
            if (action.opensDialog) requestAnimationFrame(() => {
              const nextDialog = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')].filter(element => element.offsetWidth > 0 && !element.classList.contains('more-actions-panel')).at(-1)
              if (nextDialog && !nextDialog.contains(document.activeElement)) (nextDialog.querySelector<HTMLElement>('input:not(:disabled), textarea:not(:disabled), select:not(:disabled)') ?? nextDialog.querySelector<HTMLButtonElement>('button:not(:disabled)'))?.focus()
            })
          }}>{action.icon}<span>{action.label}</span></button>
        </div>)}</div>
      </div>
    </div>, document.body)}
  </>
}
