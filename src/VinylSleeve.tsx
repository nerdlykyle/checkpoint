import { type ReactNode } from 'react'
import SharpArtwork from './SharpArtwork'
import { safeHttpUrl, type MusicItem } from './lib/music'
import './VinylSleeve.css'

/** Artwork and its controls share one moving sleeve; the record stays behind. */
export default function VinylSleeve({ item, children }: { item: MusicItem; children?: ReactNode }) {
  const url = item.coverUrl && safeHttpUrl(item.coverUrl)
  return <div className="vinyl-sleeve-wrap">
    <div className="vinyl-sleeve-record" aria-hidden="true" />
    <div className="vinyl-sleeve">
      <span className="vinyl-sleeve-fallback" aria-hidden="true">{item.title.slice(0, 2).toUpperCase()}</span>
      {url && <SharpArtwork src={url} />}
      <span className="vinyl-sleeve-wear" aria-hidden="true" />
      {children}
    </div>
  </div>
}
