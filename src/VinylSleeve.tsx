import { useState, type ReactNode } from 'react'
import SharpArtwork from './SharpArtwork'
import { safeHttpUrl, type MusicItem } from './lib/music'
import './VinylSleeve.css'

/** Artwork and its controls share one moving sleeve; the record stays behind. */
export default function VinylSleeve({ item, children }: { item: MusicItem; children?: ReactNode }) {
  const url = item.coverUrl && safeHttpUrl(item.coverUrl)
  const [open, setOpen] = useState(false)
  return <div className={`vinyl-sleeve-wrap${open ? ' is-open' : ''}`}>
    <div className="vinyl-sleeve-record" aria-hidden="true" />
    <div className="vinyl-sleeve">
      <span className="vinyl-sleeve-fallback" aria-hidden="true">{item.title.slice(0, 2).toUpperCase()}</span>
      {url && <SharpArtwork src={url} />}
      <span className="vinyl-sleeve-wear" aria-hidden="true" />
      <button type="button" className="vinyl-sleeve-toggle" aria-label={`${open ? 'Put away' : 'Slide out'} ${item.title} record`} aria-pressed={open} onClick={() => setOpen(value => !value)} />
      {children}
    </div>
  </div>
}
