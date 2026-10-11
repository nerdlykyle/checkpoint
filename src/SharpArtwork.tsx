import { useState } from 'react'
import { artworkSources } from './lib/sharpArtwork'
import { musicArtworkSources } from './lib/musicArtwork'

/** Responsive cached album art; full-size desktop game art with original fallbacks. */
export default function SharpArtwork({ src, alt = '', eager = false }: { src: string; alt?: string; eager?: boolean }) {
  return <Artwork key={src} src={src} alt={alt} eager={eager} />
}
function Artwork({ src, alt, eager }: { src: string; alt: string; eager: boolean }) {
  const [failed, setFailed] = useState<string[]>([])
  const urls = artworkSources(src)
  const music = musicArtworkSources(src, import.meta.env.VITE_CHECKPOINT_API_URL || 'https://checkpoint-game-data.claw8ex.workers.dev')
  if (!urls) return null
  const original = !failed.includes(urls.original) ? urls.original : undefined
  const sharp = !failed.includes(urls.sharp) ? urls.sharp : undefined
  if (!original && !sharp) return null
  if (music && !music.some(source => failed.includes(source.url))) return <picture className="sharp-artwork">
    <img src={music[1].url} srcSet={music.map(source => `${source.url} ${source.size}w`).join(', ')} sizes="(max-width: 700px) 30vw, (max-width: 1200px) 24vw, 310px" alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" onError={event => { const failedUrl = event.currentTarget.currentSrc || event.currentTarget.src; setFailed(previous => [...previous, failedUrl]) }} />
  </picture>
  return <picture className="sharp-artwork">
    {sharp && sharp !== original && <source media="(min-width: 701px)" srcSet={sharp} />}
    <img src={original || sharp} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" onError={event => {
      const failedUrl = event.currentTarget.currentSrc || event.currentTarget.src
      setFailed(previous => [...new Set([...previous, failedUrl])])
    }} />
  </picture>
}
