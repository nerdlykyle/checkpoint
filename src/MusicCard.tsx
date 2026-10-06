import { useState, type ReactNode } from 'react'
import { safeHttpUrl, type MusicItem } from './lib/music'
import ArtworkControls from './ArtworkControls'
import type { Member } from './types'
import './MusicCard.css'
import './CardGlass.css'
import './CleanSplitCards.css'

// Glass filters the actual artwork behind the text, not a baked-in image.
export default function MusicCard({ item, dropTarget, onOpen, source, children }: {
  item: MusicItem; dropTarget: boolean; onOpen: () => void; source?: Member; children: ReactNode
}) {
  const [failedUrl, setFailedUrl] = useState<string>()
  const url = item.coverUrl && safeHttpUrl(item.coverUrl)
  const artwork = url && url !== failedUrl ? url : undefined
  return <article className={`music-card music-cinematic music-split-desktop${dropTarget ? ' is-drop-target' : ''}`} data-music-id={item.id}>
    <div className="music-card-artwork" aria-hidden="true">
      <span>{item.title.slice(0, 2).toUpperCase()}</span>
      {artwork && <>
        <img src={artwork} alt="" loading="lazy" decoding="async" onError={() => setFailedUrl(artwork)} />
      </>}
    </div>
    <div className="music-artwork-open" aria-hidden="true" />
    <ArtworkControls title={item.title} source={source} onOpen={onOpen}/>
    <div className="music-card-glass card-glass">{children}</div>
  </article>
}
