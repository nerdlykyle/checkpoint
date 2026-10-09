import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { gameCollections } from './lib/gameCollections'
import SharpArtwork from './SharpArtwork'
import type { Game } from './types'
import './GameShelf.css'

type CardOptions = { onActivate?: () => void; expanded?: boolean; extraCount?: number; controlsId?: string }
export default function GameShelf({ games, allGames, kind, limit, renderCard, children }: {
  games: Game[]; allGames: Game[]; kind: 'radar' | 'library'; limit?: number;
  renderCard: (game: Game, options: CardOptions) => ReactNode; children?: ReactNode
}) {
  const groups = gameCollections(games, allGames).slice(0, limit)
  const [selected, setSelected] = useState<string | null>(null)
  const [closing, setClosing] = useState(false)
  const group = groups.find(item => item.game.id === selected && item.extras.length > 0)
  const root = useRef<HTMLDivElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const controlsId = useId()
  const expanded = Boolean(group)
  const close = () => setClosing(true)
  useEffect(() => { if (expanded) closeButton.current?.focus({ preventScroll: true }) }, [expanded])
  useEffect(() => {
    if (!closing) return
    const timer = window.setTimeout(() => {
      const trigger = root.current?.querySelector<HTMLElement>(`[data-game-group="${CSS.escape(selected || '')}"] .game-card-open`)
      setSelected(null); setClosing(false); trigger?.focus({ preventScroll: true })
    }, 320)
    return () => window.clearTimeout(timer)
  }, [closing, selected])
  return <div ref={root} className={`game-shelf${expanded ? ' is-expanded' : ''}${closing ? ' is-closing' : ''}`}
    onKeyDown={event => { if (expanded && event.key === 'Escape') { event.stopPropagation(); close() } }}>
    <div className={`${kind}-grid game-shelf-grid`} inert={expanded && !closing}>
      {groups.map(({ game, extras }) => <div className={`game-shelf-group${extras.length ? ' has-extras' : ''}`} key={game.id} data-game-group={game.id}>
        {extras.length > 0 && <div className="game-shelf-stack" aria-hidden="true">{extras.slice(0, 2).map(extra => {
          const art = extra.coverUrl || (extra.steamAppId ? `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${extra.steamAppId}/library_600x900_2x.jpg` : game.coverUrl)
          return <span key={extra.id}>{art && <SharpArtwork src={art} />}</span>
        })}</div>}
        {renderCard(game, extras.length ? { onActivate: () => { setClosing(false); setSelected(game.id) }, extraCount: extras.length, expanded: false, controlsId } : {})}
      </div>)}
      {children}
    </div>
    {group && <section className="game-shelf-expanded" id={controlsId} aria-label={`${group.game.title} and extra content`}>
      <div className="game-shelf-heading"><strong>{group.game.title} <small>· {group.extras.length} extra {group.extras.length === 1 ? 'item' : 'items'}</small></strong><button className="icon-button" ref={closeButton} type="button" onClick={close} aria-label="Collapse extra content"><X size={20} /></button></div>
      <div className="game-shelf-track">
        {renderCard(group.game, { onActivate: close, expanded: true, extraCount: group.extras.length, controlsId })}
        {group.extras.map(extra => <div key={extra.id} className="game-shelf-extra">{renderCard(extra, {})}</div>)}
      </div>
    </section>}
  </div>
}
