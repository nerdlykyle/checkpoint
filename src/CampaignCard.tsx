import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown, Clock3, MoreHorizontal, NotebookPen, Play, Plus, Puzzle, Timer } from 'lucide-react'
import type { Game } from './types'
import './CampaignCard.css'

type Props = {
  game?: Game
  artworkUrls: string[]
  hours: number
  note: string
  liveNote: boolean
  noteExpanded: boolean
  hasActiveSession: boolean
  onToggleNote: () => void
  onNoteChange: (note: string) => void
  onSession: () => void
  onPuzzle: () => void
  onDetails: () => void
  onAdd: () => void
}

function CampaignArtwork({ urls }: { urls: string[] }) {
  const [index, setIndex] = useState(0)
  return urls[index] ? <div className="campaign-artwork" aria-hidden="true">
    <img className="campaign-art" src={urls[index]} alt="" fetchPriority="high" onError={() => setIndex(value => value + 1)} />
    <div className="campaign-art-blur"><img className="campaign-art" src={urls[index]} alt="" /></div>
  </div> : null
}

export default function CampaignCard({ game, artworkUrls, hours, note, liveNote, noteExpanded, hasActiveSession, onToggleNote, onNoteChange, onSession, onPuzzle, onDetails, onAdd }: Props) {
  const noteId = useId()
  const headingId = useId()
  const heroRef = useRef<HTMLElement>(null)
  const glassRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const hero = heroRef.current
    const glass = glassRef.current
    if (!hero || !glass) return
    // Anchor the blur to the text, including wrapped titles and expanded notes.
    const measure = () => hero.style.setProperty('--campaign-glass-top', `${glass.offsetTop}px`)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(hero)
    observer.observe(glass)
    return () => observer.disconnect()
  }, [game?.id])
  if (!game) return <section className="campaign-hero campaign-empty" aria-label="Current campaign"><span className="campaign-badge">Current campaign</span><button type="button" onClick={onAdd}><Plus size={24} /><span>Choose a game to start</span></button><p>Ready when you are.</p></section>
  const progress = Math.min(100, Math.max(0, game.progress || 0))
  return <section className="campaign-hero" aria-labelledby={headingId} ref={heroRef}>
    <CampaignArtwork key={artworkUrls.join('|')} urls={artworkUrls} />
    <div className="campaign-art-shade" />
    <header className="campaign-topline"><span className="campaign-badge">Current campaign</span><div><span className="campaign-badge campaign-status"><span /> In progress</span><button className="campaign-menu" type="button" onClick={onDetails} aria-label={`View details for ${game.title}`}><MoreHorizontal size={20} /></button></div></header>
    <div className="campaign-glass" ref={glassRef}>
      {game.contentType === 'dlc' && game.parentGameTitle && <p className="campaign-parent">DLC for {game.parentGameTitle}</p>}
      <h2 id={headingId}>{game.title}</h2>
      <div className="campaign-metadata"><span>{[game.genre, game.platform, game.year].filter(Boolean).join(' · ')}</span><span><Clock3 size={15} />{Math.max(0, hours).toFixed(1).replace('.0', '')} hours logged</span></div>
      <div className="campaign-progress"><div><span>Group progress</span><strong>{progress}%</strong></div><div className="campaign-progress-track" role="progressbar" aria-label="Group progress" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }} /></div></div>
      <div className="campaign-note"><button type="button" className="campaign-note-toggle" onClick={onToggleNote} aria-expanded={noteExpanded} aria-controls={noteId}><NotebookPen size={17} /><span>{liveNote ? 'Live session notes' : 'Shared campaign note'}</span><ChevronDown size={15} /></button><div id={noteId} hidden={!noteExpanded}>{noteExpanded && <textarea aria-label={liveNote ? 'Live session notes' : 'Shared campaign note'} value={note} maxLength={5000} onChange={event => onNoteChange(event.target.value)} placeholder={liveNote ? 'Clues, discoveries, and moments to remember…' : 'Where did we leave off? Add a note for the next session…'} rows={4} autoFocus />}</div>{!noteExpanded && note && <p>{note}</p>}</div>
      <div className="campaign-actions"><button type="button" className="campaign-session" onClick={onSession} aria-label={hasActiveSession ? 'Open live session' : 'Start session'} title={hasActiveSession ? 'Open live session' : 'Start session'}>{hasActiveSession ? <Timer size={21} /> : <Play size={21} />}</button><button type="button" onClick={onPuzzle} aria-label="Open puzzle board" title="Open puzzle board"><Puzzle size={21} /></button></div>
    </div>
  </section>
}
