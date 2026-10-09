import { useId, useState, type ReactNode } from 'react'
import { ChevronDown, MoreHorizontal } from 'lucide-react'
import type { Game } from './types'
import { statusLabels } from './data'
import './GameCartridge.css'

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
}

export default function GameCartridge({ game, artwork, vote, ownership, price, libraryAction, badges, onOpen, featured = false }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [motionPaused, setMotionPaused] = useState(false)
  const summaryId = useId()
  const titleId = useId()
  const progress = game.status === 'completed' ? 100 : Math.min(100, Math.max(0, Number.isFinite(game.progress) ? game.progress : 0))
  return <article className={`game-cartridge${featured ? ' is-featured' : ''}${motionPaused ? ' motion-paused' : ''}${game.status === 'archived' ? ' is-archived' : ''}`} aria-labelledby={titleId} onPointerDown={() => setMotionPaused(true)} onPointerLeave={() => setMotionPaused(false)}>
    <div className="cartridge-stage">
      <div className="cartridge-body">
        <div className="cartridge-shell" aria-hidden="true"><div /><span className="cartridge-seams" /><i /><i /></div>
        <div className="cartridge-label">
          {artwork}
          <button type="button" className="cartridge-art-open" aria-label={`${expanded ? 'Collapse' : 'Expand'} ${game.title} summary`} aria-expanded={expanded} aria-controls={summaryId} onClick={() => setExpanded(value => !value)} />
          <div className="cartridge-glass">
            <span className="cartridge-frost" aria-hidden="true" />
            <div className="cartridge-status"><span className={`status-dot status-${game.status}`} />{statusLabels[game.status]}{badges}</div>
            <div className="cartridge-info-bottom"><div className="cartridge-copy"><h3 id={titleId} title={game.title}>{game.title}</h3></div><div className="cartridge-social">{vote}<div className="cartridge-ownership"><span>{game.platform}</span>{ownership}</div><div className="cartridge-price">{price}</div></div></div>
          </div>
        </div>
        <button className="cartridge-menu" type="button" onClick={onOpen} aria-label={`View details for ${game.title}`} aria-haspopup="dialog" title="Game details"><MoreHorizontal size={20} /></button>
        <div className="cartridge-library-action">{libraryAction}</div>
        <div className="cartridge-progress" role="progressbar" aria-label={`${game.title} completion`} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} title={`${progress}% completed`}><span style={{ width: `${progress}%` }} /></div>
        <ChevronDown className={`cartridge-expand-hint${expanded ? ' is-expanded' : ''}`} size={13} aria-hidden="true" />
      </div>
      <svg className="cartridge-air" viewBox="0 0 300 48" fill="none" aria-hidden="true"><path d="M0 33 C55 33 60 10 106 10 S180 34 216 16 S270 2 300 7" /><path d="M0 43 C55 43 85 25 128 25 S220 40 300 18" /><path d="M0 22 C44 22 52 3 90 3 S170 19 218 7 S270 1 300 3" /></svg>
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
