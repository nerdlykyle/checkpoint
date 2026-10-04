import { useEffect, useRef, useState } from 'react'
import { artworkKey, bookCoverCandidates, lookupBookArtwork, normalizeBookCover, type ArtworkBook } from './lib/bookArtwork'
import './BookCoverImage.css'

export default function BookCoverImage({ book, large = false, retry = 0, cinematic = false }: { book: ArtworkBook; large?: boolean; retry?: number; cinematic?: boolean }) {
  // Remount the loader when the book or URL changes: failed inline styles must
  // never carry over when a reader replaces a book or retries its artwork.
  return <CoverLoader key={`${artworkKey(book)}:${large}:${retry}`} book={book} large={large} refresh={retry > 0} cinematic={cinematic} />
}

function CoverLoader({ book, large, refresh, cinematic }: { book: ArtworkBook; large: boolean; refresh: boolean; cinematic: boolean }) {
  const [candidates, setCandidates] = useState(() => bookCoverCandidates(book, large))
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(large)
  const [lookedUp, setLookedUp] = useState(false)
  const anchor = useRef<HTMLSpanElement>(null)
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const loadedUrl = useRef<string | undefined>(undefined)
  const url = candidates[index]
  useEffect(() => {
    if (!visible || !url || loadedUrl.current === url) return
    timeout.current = setTimeout(() => setIndex(value => value + 1), 12000)
    return () => clearTimeout(timeout.current)
  }, [visible, url])
  useEffect(() => {
    if (visible || !anchor.current) return
    if (!('IntersectionObserver' in window)) { setVisible(true); return }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect() }
    }, { rootMargin: '150px' })
    observer.observe(anchor.current)
    return () => observer.disconnect()
  }, [visible])
  useEffect(() => {
    if (!visible || url || lookedUp) return
    let active = true
    setLookedUp(true)
    lookupBookArtwork(book, refresh).then(value => {
      const next = normalizeBookCover(value, large)
      if (active && next && !candidates.includes(next)) setCandidates(previous => [...previous, next])
    })
    return () => { active = false }
    // One lookup per mounted book; setLookedUp must not cancel its own request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, url])
  return <><span ref={anchor} aria-hidden="true">{book.title.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()}</span>{visible && url && <><img key={url} src={url} alt={`Cover of ${book.title}`} loading={large ? 'eager' : 'lazy'} decoding="async" referrerPolicy="no-referrer" onError={() => setIndex(value => value + 1)} onLoad={event => { loadedUrl.current = url; clearTimeout(timeout.current); if (event.currentTarget.naturalWidth <= 1 || event.currentTarget.naturalHeight <= 1) setIndex(value => value + 1) }} />{cinematic && <div className="reading-art-blur" aria-hidden="true"><img src={url} alt="" referrerPolicy="no-referrer" /></div>}</>}</>
}
