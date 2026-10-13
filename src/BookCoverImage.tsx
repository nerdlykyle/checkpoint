import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { artworkKey, bookArtworkVersion, cachedBookArtwork, resolveBookArtwork, subscribeBookArtwork, type ArtworkBook } from './lib/bookArtwork'
import { probeBookCover } from './lib/bookImageProbe'
import './BookCoverImage.css'

export default function BookCoverImage({ book, large = false, lazy = false, retry = 0, cinematic = false }: { book: ArtworkBook; large?: boolean; lazy?: boolean; retry?: number; cinematic?: boolean }) {
  const key = artworkKey(book)
  const version = useSyncExternalStore(
    useCallback(listener => subscribeBookArtwork(key, listener), [key]),
    useCallback(() => bookArtworkVersion(key), [key]),
  )
  const refreshToken = Math.max(version, retry)
  return <CoverLoader key={`${key}:${large}:${refreshToken}`} book={book} large={large} lazy={lazy} refreshToken={refreshToken} cinematic={cinematic} />
}

function CoverLoader({ book, large, lazy, refreshToken, cinematic }: { book: ArtworkBook; large: boolean; lazy: boolean; refreshToken: number; cinematic: boolean }) {
  const [url, setUrl] = useState<string | undefined>(() => refreshToken ? undefined : cachedBookArtwork(book, large))
  const [visible, setVisible] = useState(large && !lazy)
  const anchor = useRef<HTMLSpanElement>(null)
  // The outer component remounts on any artwork identity change. Keep this
  // request stable when unrelated shelf/progress/metadata updates arrive.
  const source = useRef(book)
  useEffect(() => {
    // Paperback and collection styles hide the initials span. Observe its
    // artwork container instead: hidden initials never intersect the viewport,
    // leaving cold-cache covers (and failed cached covers) waiting forever.
    const artwork = anchor.current?.parentElement
    if (visible || !artwork) return
    if (!('IntersectionObserver' in window)) { setVisible(true); return }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect() }
    }, { rootMargin: '150px' })
    observer.observe(artwork)
    return () => observer.disconnect()
  }, [visible])
  useEffect(() => {
    if (!visible) return
    const controller = new AbortController()
    void resolveBookArtwork(source.current, { large, refreshToken, signal: controller.signal, probe: probeBookCover })
      .then(value => { if (!controller.signal.aborted) setUrl(value) })
      .catch(() => { /* Keep the readable initials if every provider is unavailable. */ })
    return () => controller.abort()
  }, [visible, large, refreshToken])
  return <><span ref={anchor} aria-hidden="true">{book.title.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()}</span>{url && <><img src={url} alt={`Cover of ${book.title}`} loading={lazy ? 'lazy' : 'eager'} decoding="async" referrerPolicy="no-referrer" onError={() => setUrl(undefined)} />{cinematic && <div className="reading-art-blur" aria-hidden="true"><img src={url} alt="" referrerPolicy="no-referrer" /></div>}</>}</>
}
