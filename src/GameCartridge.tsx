import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { ChevronDown, MoreHorizontal, Wind } from 'lucide-react'
import type { Game } from './types'
import { statusLabels } from './data'
import './GameCartridge.css'

// In-memory only: navigation and live updates don't replay it, but refresh does.
let pageIntroPlayed = false

type Props = {
  game: Game
  artwork: ReactNode
  vote: ReactNode
  ownership: ReactNode
  price: ReactNode
  libraryAction: ReactNode
  badges: ReactNode
  onOpen: () => void
  featured?: boolean
  controls?: ReactNode
}

export default function GameCartridge({ game, artwork, vote, ownership, price, libraryAction, badges, onOpen, featured = false, controls }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [introInterrupted, setIntroInterrupted] = useState(false)
  const [pageIntro, setPageIntro] = useState(false)
  const cartridgeRef = useRef<HTMLElement>(null)
  const replayFrame = useRef<number | undefined>(undefined)
  useEffect(() => () => { if (replayFrame.current !== undefined) cancelAnimationFrame(replayFrame.current) }, [])
  useEffect(() => {
    if (pageIntroPlayed || introInterrupted || !cartridgeRef.current) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (reducedMotion.matches) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const clearTimer = () => { clearTimeout(timer); timer = undefined }
    const observer = new IntersectionObserver(entries => {
      const visible = entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= 0.4)
      if (!visible) { clearTimer(); return }
      if (timer !== undefined || pageIntroPlayed) return
      timer = setTimeout(() => {
        if (pageIntroPlayed || reducedMotion.matches) return
        pageIntroPlayed = true
        setPageIntro(true)
        observer.disconnect()
      }, 450)
    }, { threshold: 0.4 })
    observer.observe(cartridgeRef.current)
    const stopForPreference = () => {
      if (reducedMotion.matches) {
        clearTimer()
        observer.disconnect()
        setPageIntro(false)
      }
    }
    reducedMotion.addEventListener('change', stopForPreference)
    return () => {
      clearTimer()
      observer.disconnect()
      reducedMotion.removeEventListener('change', stopForPreference)
    }
  }, [introInterrupted])
  const stopIntro = () => {
    if (replayFrame.current !== undefined) cancelAnimationFrame(replayFrame.current)
    pageIntroPlayed = true
    setIntroInterrupted(true)
    setPageIntro(false)
  }
  const replayIntro = () => {
    stopIntro()
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // Leave one painted frame without the class so repeated taps/Enter restart it.
    replayFrame.current = requestAnimationFrame(() => {
      replayFrame.current = requestAnimationFrame(() => {
        replayFrame.current = undefined
        setPageIntro(true)
      })
    })
  }
  const summaryId = useId()
  const progress = game.status === 'completed' ? 100 : Math.min(100, Math.max(0, Number.isFinite(game.progress) ? game.progress : 0))
  return <article ref={cartridgeRef} className={`game-cartridge${featured ? ' is-featured' : ''}${pageIntro ? ' is-page-intro' : ''}${game.status === 'archived' ? ' is-archived' : ''}`} aria-label={game.title} onPointerDown={stopIntro} onFocusCapture={stopIntro}>
    <div className="cartridge-stage">
      <div className="cartridge-body" onAnimationEnd={event => { if (event.target === event.currentTarget && event.animationName === 'cartridge-insert') setPageIntro(false) }}>
        <div className="cartridge-shell" aria-hidden="true"><div /><span className="cartridge-seams" /><i /><i /></div>
        <div className="cartridge-label">
          {artwork}
          <button type="button" className="cartridge-art-open" aria-label={`${expanded ? 'Collapse' : 'Expand'} ${game.title} summary`} aria-expanded={expanded} aria-controls={summaryId} onClick={() => setExpanded(value => !value)} />
          {game.status !== 'playing' && <div className="cartridge-glass">
            <span className="cartridge-frost" aria-hidden="true">{[0, .5, 1, 2, 3.5, 5, 8, 12].map((blur, index) => <span key={index} style={{ '--blur': `${blur}px`, '--band': index } as CSSProperties} />)}</span>
            <div className="cartridge-status"><span className={`status-dot status-${game.status}`} />{statusLabels[game.status]}{badges}</div>
            <div className="cartridge-info-bottom"><div className="cartridge-social">{vote}<div className="cartridge-ownership"><span>{game.platform}</span>{ownership}</div><div className="cartridge-price">{price}</div></div></div>
          </div>}
        </div>
        <div className="cartridge-controls"><button className="cartridge-menu" type="button" onClick={onOpen} aria-label={`View details for ${game.title}`} aria-haspopup="dialog" title="Game details"><MoreHorizontal size={20} /></button>{controls}</div>
        <div className="cartridge-library-action">{libraryAction}</div>
        <button className="cartridge-replay" type="button" onClick={replayIntro} aria-label="Replay cartridge air animation" title="Replay air animation"><Wind size={16} strokeWidth={1.5} aria-hidden="true" /></button>
        <div className="cartridge-progress" role="progressbar" aria-label={`${game.title} completion`} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} title={`${progress}% completed`}><span style={{ width: `${progress}%` }} /></div>
        <ChevronDown className={`cartridge-expand-hint${expanded ? ' is-expanded' : ''}`} size={13} aria-hidden="true" />
      </div>
      <div className="cartridge-air" aria-hidden="true">{Array.from({ length: 7 }, (_, index) => <span className="cartridge-puff" key={index} style={{ '--puff-order': index, left: `${index * 12}%` } as CSSProperties} />)}</div>
    </div>
    <div className="cartridge-summary" id={summaryId} hidden={!expanded}>
      <h4>{game.title}</h4>
      <p>{[game.contentType === 'dlc' && game.parentGameTitle ? `DLC for ${game.parentGameTitle}` : game.genre, game.platform, game.year].filter(Boolean).join(' · ')}</p>
      <strong>{progress}% completed{game.hours ? ` · ${game.hours} hours logged` : ''}</strong>
      {game.note && <p className="cartridge-note">{game.note}</p>}
      <button type="button" onClick={onOpen} aria-label={`Open full details for ${game.title}`} title="Game details"><MoreHorizontal size={20} /></button>
    </div>
  </article>
}
