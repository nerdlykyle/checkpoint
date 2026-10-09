import { useState } from 'react'
import { artworkSources } from './lib/sharpArtwork'

/** Desktop gets a full-size source; phones keep their existing source and cost. */
export default function SharpArtwork({ src, alt = '' }: { src: string; alt?: string }) {
  return <Artwork key={src} src={src} alt={alt} />
}
function Artwork({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState<string[]>([])
  const urls = artworkSources(src)
  if (!urls) return null
  const original = !failed.includes(urls.original) ? urls.original : undefined
  const sharp = !failed.includes(urls.sharp) ? urls.sharp : undefined
  if (!original && !sharp) return null
  return <picture className="sharp-artwork">
    {sharp && sharp !== original && <source media="(min-width: 701px)" srcSet={sharp} />}
    <img src={original || sharp} alt={alt} loading="lazy" decoding="async" onError={event => {
      const failedUrl = event.currentTarget.currentSrc || event.currentTarget.src
      setFailed(previous => [...new Set([...previous, failedUrl])])
    }} />
  </picture>
}
