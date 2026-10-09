import { useState, type ReactNode } from 'react'
import { safeHttpUrl, type MusicItem } from './lib/music'
import './VinylSleeve.css'

/** Physical sleeve styling is independent of the album artwork and its controls. */
export default function VinylSleeve({ item, children }: { item: MusicItem; children?: ReactNode }) {
  const [failedUrl, setFailedUrl] = useState<string>()
  const url = item.coverUrl && safeHttpUrl(item.coverUrl)
  return <div className="vinyl-sleeve-wrap">
    <div className="vinyl-sleeve-record" aria-hidden="true" />
    <div className="vinyl-sleeve" aria-hidden="true">
      <span className="vinyl-sleeve-fallback">{item.title.slice(0, 2).toUpperCase()}</span>
      {url && url !== failedUrl && <img src={url} alt="" loading="lazy" decoding="async" onError={() => setFailedUrl(url)} />}
      <span className="vinyl-sleeve-wear" />
    </div>
    {children}
  </div>
}
