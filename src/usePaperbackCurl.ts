import { useEffect, useRef } from 'react'
import { createPaperbackCurl, CURL_DURATION } from './lib/paperbackCurl'

export function usePaperbackCurl(bookId: string) {
  const surface = useRef<HTMLButtonElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const stop = useRef<(() => void) | null>(null)
  useEffect(() => () => stop.current?.(), [bookId])
  function play() {
    if (stop.current) return true
    const button = surface.current, output = canvas.current
    const image = button?.querySelector<HTMLImageElement>('.paperback-cover-front img')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!button || !output || !image || reduced.matches) return false
    const draw = createPaperbackCurl(output, image, button.clientWidth, button.clientHeight)
    if (!draw) return false
    const originalSource = image.currentSrc
    let frame = 0
    const finish = () => {
      cancelAnimationFrame(frame)
      button.removeAttribute('data-curl-active')
      reduced.removeEventListener('change', finish)
      window.removeEventListener('resize', finish)
      document.removeEventListener('visibilitychange', finish)
      stop.current = null
    }
    stop.current = finish
    reduced.addEventListener('change', finish)
    window.addEventListener('resize', finish)
    document.addEventListener('visibilitychange', finish)
    const start = performance.now()
    const tick = (now: number) => {
      if (now - start >= CURL_DURATION || !image.isConnected || image.currentSrc !== originalSource) { finish(); return }
      try { draw(now - start); button.setAttribute('data-curl-active', '') }
      catch { finish(); return } // Never leave the real cover hidden after a failed draw.
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return true
  }
  return { surface, canvas, play }
}
