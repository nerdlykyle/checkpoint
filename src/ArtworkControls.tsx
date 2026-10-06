import { useContext } from 'react'
import { Layers, MoreHorizontal } from 'lucide-react'
import { CollectionActionContext } from './CollectionActionContext'
import { MemberPortrait } from './MemberShelfPicker'
import type { Member } from './types'
import './ArtworkControls.css'

/** Explicit entry point: artwork and captions themselves are not buttons. */
export default function ArtworkControls({ title, source, onOpen }: { title: string; source?: Member; onOpen: () => void }) {
  const collection = useContext(CollectionActionContext)
  return <div className="artwork-controls">
    {source && <span className="artwork-source" title={`Saved from ${source.name}`} aria-label={`Saved from ${source.name}`}><MemberPortrait member={source} /></span>}
    {collection ? <button type="button" className="artwork-menu collection-stack-toggle" data-collection-toggle aria-label={collection.label} title={collection.label} aria-expanded={false} aria-controls={collection.controlsId} onClick={collection.onOpen}><Layers size={21} aria-hidden="true" /></button>
      : <button type="button" className="artwork-menu" aria-label={`Open menu for ${title}`} title={`Details & actions: ${title}`} aria-haspopup="dialog" onClick={onOpen}><MoreHorizontal size={21} aria-hidden="true" /></button>}
  </div>
}
