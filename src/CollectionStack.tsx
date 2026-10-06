import { useId, useState, type ReactNode } from 'react'
import { ChevronDown, Layers } from 'lucide-react'
import './CollectionStack.css'

export default function CollectionStack({ title, count, kind, front, behind, children }: {
  title: string; count: number; kind: 'books' | 'releases'; front: ReactNode; behind: ReactNode[]; children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return <section className={`collection-stack collection-stack-${kind}${open ? ' is-expanded' : ''}`} aria-label={`${title} collection`}>
    <div className="collection-stack-preview">
      <div className="collection-stack-layers" aria-hidden="true">{behind.slice(0, 2).reverse().map((art, index) => <div className="collection-stack-layer" key={index}>{art}</div>)}</div>
      <div className="collection-stack-front">{front}</div>
      <button className="collection-stack-toggle" type="button" title={`${title} · ${count} ${kind}`} aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        <Layers size={18} aria-hidden="true" /><span><strong>{title}</strong><small>{count} {kind} · {open ? 'Collapse' : 'View collection'}</small></span><ChevronDown size={18} aria-hidden="true" />
      </button>
    </div>
    {open && <div id={id} className="collection-stack-items">{children}</div>}
  </section>
}
