import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Layers } from 'lucide-react'
import { CollectionActionContext } from './CollectionActionContext'
import './CollectionStack.css'

export default function CollectionStack({ title, count, kind, front, behind, children }: {
  title: string; count: number; kind: 'books' | 'releases'; front: ReactNode; behind: ReactNode[]; children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const preview = useRef<HTMLDivElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(false)
  const label = `${title} · ${count} ${kind}`
  useEffect(() => {
    if (wasOpen.current === open) return
    wasOpen.current = open
    if (open) closeButton.current?.focus({ preventScroll: true })
    else preview.current?.querySelector<HTMLButtonElement>('[data-collection-toggle]')?.focus({ preventScroll: true })
  }, [open])
  return <section className={`collection-stack collection-stack-${kind}${open ? ' is-expanded' : ''}`} aria-label={`${title} collection`}>
    <div className="collection-stack-preview" ref={preview} hidden={open}>
      <div className="collection-stack-layers" aria-hidden="true">{behind.slice(0, 2).reverse().map((art, index) => <div className="collection-stack-layer" key={index}>{art}</div>)}</div>
      <CollectionActionContext.Provider value={{label: `Open collection: ${label}`, controlsId: id, onOpen: () => setOpen(true)}}>
        <div className="collection-stack-front">{front}</div>
      </CollectionActionContext.Provider>
    </div>
    <div id={id} className="collection-stack-items" hidden={!open}>{open && <>
      <header className="collection-stack-heading"><div><strong>{title}</strong><small>{count} {kind}</small></div>
        <button ref={closeButton} className="collection-stack-close" type="button" aria-label={`Collapse collection: ${label}`} title={`Collapse collection: ${label}`} aria-expanded={true} aria-controls={id} onClick={() => setOpen(false)}><Layers size={21} aria-hidden="true" /></button>
      </header>
      {children}
    </>}</div>
  </section>
}
