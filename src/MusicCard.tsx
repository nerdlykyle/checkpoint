import { useEffect, useRef, useState, type ReactNode } from 'react'
import { safeHttpUrl, type MusicItem } from './lib/music'
import './MusicCard.css'

// The original and blurred layers always share a URL and crop. Nothing is
// baked into the artwork, so changing a release updates both layers together.
export default function MusicCard({ item, dropTarget, onOpen, tools, children }: {
  item: MusicItem; dropTarget: boolean; onOpen: () => void; tools: ReactNode; children: ReactNode
}) {
  const card = useRef<HTMLElement>(null)
  const glass = useRef<HTMLDivElement>(null)
  const [failedUrl, setFailedUrl] = useState<string>()
  const url = item.coverUrl && safeHttpUrl(item.coverUrl)
  const artwork = url && url !== failedUrl ? url : undefined
  useEffect(() => {
    const measure = () => {
      if (card.current && glass.current) card.current.style.setProperty('--music-glass-top', `${glass.current.offsetTop}px`)
    }
    measure()
    const observer = new ResizeObserver(measure)
    if (card.current) observer.observe(card.current)
    if (glass.current) observer.observe(glass.current)
    return () => observer.disconnect()
  }, [])
  return <article ref={card} className={`music-card music-cinematic${dropTarget ? ' is-drop-target' : ''}`} data-music-id={item.id}>
    <div className="music-card-artwork" aria-hidden="true">
      <span>{item.title.slice(0, 2).toUpperCase()}</span>
      {artwork && <>
        <img src={artwork} alt="" loading="lazy" decoding="async" onError={() => setFailedUrl(artwork)} />
        <div className="music-card-art-blur"><img src={artwork} alt="" loading="lazy" decoding="async" /></div>
      </>}
    </div>
    <button type="button" className="music-artwork-open" aria-label={`Open ${item.title}`} onClick={onOpen} />
    {tools}
    <div className="music-card-glass" ref={glass}>{children}</div>
  </article>
}
