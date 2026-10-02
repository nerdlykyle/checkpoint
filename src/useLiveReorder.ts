import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react'
import { dragDestination, dragOffsets, dragScrollSpeed } from './lib/dragLayout'
import './LiveReorder.css'

function scrollParent(element: HTMLElement): HTMLElement {
  for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(parent).overflowY) && parent.scrollHeight > parent.clientHeight) return parent
  }
  return document.scrollingElement as HTMLElement
}

export function useLiveReorder({ ids, enabled = true, onMove }: { ids: string[]; enabled?: boolean; onMove: (source: string, target: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const latest = useRef({ ids, enabled, onMove }); latest.current = { ids, enabled, onMove }
  const cancel = useRef<(() => void) | undefined>(undefined)
  const suppressClickUntil = useRef(0)
  const [announcement, setAnnouncement] = useState('')
  const identity = JSON.stringify(ids)
  // A remote reorder, filter change, resize, or unmount must cancel, not save a
  // stale drop against different records.
  useEffect(() => () => cancel.current?.(), [identity, enabled])

  const start = (id: string, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!latest.current.enabled || !event.isPrimary || event.button !== 0 || !containerRef.current) return
    cancel.current?.()
    const container = containerRef.current
    const cards = [...container.querySelectorAll<HTMLElement>('[data-reorder-id]')]
    const source = cards.findIndex(card => card.dataset.reorderId === id)
    if (source < 0 || cards.length < 2) return
    event.preventDefault(); event.stopPropagation()
    const handle = event.currentTarget, pointerId = event.pointerId
    handle.focus({ preventScroll: true })
    try { handle.setPointerCapture(pointerId) } catch { /* Document listeners still track it. */ }
    const first = cards[source].getBoundingClientRect()
    const startX = event.clientX, startY = event.clientY
    let x = startX, y = startY, target = source, active = false, ended = false, frame = 0
    let clone: HTMLElement | undefined
    const scroller = scrollParent(container)
    const isPage = scroller === document.scrollingElement
    const original = cards.map(card => ({ transform: card.style.transform, transition: card.style.transition, willChange: card.style.willChange }))
    // Measure stable layout positions once. Scroll offsets are applied on each
    // frame, so CSS transitions cannot feed back into hit-testing.
    const rects = cards.map(card => { const rect = card.getBoundingClientRect(); return { top: rect.top, height: rect.height } })
    const initialContainerTop = container.getBoundingClientRect().top
    const initialOwnScroll = container.scrollTop
    const validPoint = () => {
      const rect = container.getBoundingClientRect()
      return x >= rect.left - 40 && x <= rect.right + 40 && y >= Math.max(0, rect.top - 80) && y <= Math.min(innerHeight, rect.bottom + 80)
    }
    const paint = () => {
      const drift = container.getBoundingClientRect().top - initialContainerTop - (container.scrollTop - initialOwnScroll)
      const current = rects.map(rect => ({ ...rect, top: rect.top + drift }))
      const next = dragDestination(current, source, y - (startY - first.top) + first.height / 2)
      if (next !== target) { target = next; setAnnouncement(`Drop at position ${target + 1} of ${cards.length} shown items.`) }
      const offsets = dragOffsets(current, source, target)
      cards.forEach((card, index) => { card.style.transform = `translateY(${offsets[index]}px)` })
      if (clone) {
        const left = Math.max(4, Math.min(innerWidth - first.width - 4, x - (startX - first.left)))
        clone.style.transform = `translate3d(${left}px, ${y - (startY - first.top)}px, 0)`
        clone.classList.toggle('is-outside-list', !validPoint())
      }
    }
    const tick = () => {
      if (ended || !active) return
      const bounds = isPage ? { top: 0, bottom: innerHeight } : scroller.getBoundingClientRect()
      const speed = dragScrollSpeed(y, Math.max(0, bounds.top), Math.min(innerHeight, bounds.bottom))
      if (validPoint() && speed) scroller.scrollTop += speed
      paint()
      frame = requestAnimationFrame(tick)
    }
    const activate = () => {
      active = true
      clone = cards[source].cloneNode(true) as HTMLElement
      clone.removeAttribute('id'); clone.removeAttribute('data-reorder-id')
      clone.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'))
      clone.setAttribute('aria-hidden', 'true'); clone.inert = true
      clone.classList.add('live-drag-preview')
      Object.assign(clone.style, { width: `${first.width}px`, height: `${first.height}px`, font: getComputedStyle(cards[source]).font })
      document.body.append(clone)
      cards[source].classList.add('live-drag-source')
      container.classList.add('live-reorder-active')
      document.documentElement.classList.add('live-reorder-grabbing')
      cards.forEach(card => {
        card.style.transition = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'none' : 'transform 160ms ease'
        card.style.willChange = 'transform'
      })
      setAnnouncement('Card picked up. Drag to reorder; Escape cancels.')
      paint(); frame = requestAnimationFrame(tick)
    }
    const finish = (save: boolean) => {
      if (ended) return
      ended = true; cancelAnimationFrame(frame)
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', up)
      document.removeEventListener('pointercancel', abort)
      document.removeEventListener('keydown', key)
      window.removeEventListener('blur', abort)
      window.removeEventListener('resize', abort)
      handle.removeEventListener('lostpointercapture', abort)
      cancel.current = undefined
      if (active) {
        suppressClickUntil.current = Date.now() + 400
        clone?.remove()
        cards.forEach((card, index) => { Object.assign(card.style, original[index]); card.classList.remove('live-drag-source') })
        container.classList.remove('live-reorder-active')
        document.documentElement.classList.remove('live-reorder-grabbing')
        if (save && validPoint() && source !== target) {
          latest.current.onMove(id, cards[target].dataset.reorderId!)
          setAnnouncement(`Moved to position ${target + 1} of the shown items.`)
        } else setAnnouncement(save ? 'Order unchanged.' : 'Drag cancelled. Order unchanged.')
      }
      try { if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId) } catch { /* Handle may have unmounted. */ }
    }
    const move = (next: PointerEvent) => {
      if (next.pointerId !== pointerId) return
      x = next.clientX; y = next.clientY
      if (!active && Math.hypot(x - startX, y - startY) >= 6) activate()
      if (active) next.preventDefault()
    }
    const up = (next: PointerEvent) => { if (next.pointerId === pointerId) { x = next.clientX; y = next.clientY; if (active) paint(); finish(true) } }
    const abort = () => finish(false)
    const key = (next: KeyboardEvent) => { if (next.key === 'Escape') { next.preventDefault(); finish(false) } }
    cancel.current = abort
    document.addEventListener('pointermove', move, { passive: false })
    document.addEventListener('pointerup', up)
    document.addEventListener('pointercancel', abort)
    document.addEventListener('keydown', key)
    window.addEventListener('blur', abort)
    window.addEventListener('resize', abort)
    handle.addEventListener('lostpointercapture', abort)
  }
  const handleProps = (id: string) => ({
    onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => start(id, event),
    onClick: (event: ReactMouseEvent<HTMLButtonElement>) => event.stopPropagation(),
    onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (cancel.current || !latest.current.enabled || !['ArrowUp', 'ArrowDown'].includes(event.key)) return
      event.preventDefault(); event.stopPropagation()
      const index = latest.current.ids.indexOf(id), next = index + (event.key === 'ArrowUp' ? -1 : 1)
      if (index < 0 || next < 0 || next >= latest.current.ids.length) return
      latest.current.onMove(id, latest.current.ids[next])
      setAnnouncement(`Moved to position ${next + 1}.`)
    },
  })
  const onClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (Date.now() < suppressClickUntil.current) { event.preventDefault(); event.stopPropagation() }
  }
  return { containerRef, handleProps, onClickCapture, announcement }
}
