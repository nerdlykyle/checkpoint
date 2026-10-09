import { useId, useState, type ReactNode } from 'react'
import { ChevronDown, Clock3, NotebookPen, Play, Plus, Puzzle, Timer } from 'lucide-react'
import GameCartridge from './GameCartridge'
import type { Game } from './types'
import './CampaignCard.css'
import './CardGlass.css'

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
  vote?: ReactNode
  ownership?: ReactNode
  price?: ReactNode
}

function CampaignArtwork({ urls }: { urls: string[] }) {
  const [index, setIndex] = useState(0)
  return urls[index] ? <div className="campaign-artwork" aria-hidden="true">
    <img className="campaign-art" src={urls[index]} alt="" fetchPriority="high" onError={() => setIndex(value => value + 1)} />
  </div> : null
}

export default function CampaignCard({ game, artworkUrls, hours, note, liveNote, noteExpanded, hasActiveSession, onToggleNote, onNoteChange, onSession, onPuzzle, onDetails, onAdd, vote, ownership, price }: Props) {
  const noteId = useId()
  const headingId = useId()
  if (!game) return <section className="campaign-hero campaign-empty" aria-label="Current campaign"><span className="campaign-badge">Current campaign</span><button type="button" onClick={onAdd}><Plus size={24} /><span>Choose a game to start</span></button><p>Ready when you are.</p></section>
  const progress = Math.min(100, Math.max(0, game.progress || 0))
  return <section className="campaign-hero campaign-cartridge" aria-labelledby={headingId}>
    <header className="campaign-cartridge-heading"><span className="eyebrow">Continue playing</span><h2 id={headingId}>Current campaign</h2></header>
    <GameCartridge featured game={game} onOpen={onDetails} artwork={<CampaignArtwork key={artworkUrls.join('|')} urls={artworkUrls} />} vote={vote} ownership={ownership} price={price} libraryAction={null} badges={game.contentType === 'dlc' ? 'DLC' : null} />
    <div className="campaign-cartridge-tools">
      <div className="campaign-metadata"><span>Group progress · {progress}%</span><span><Clock3 size={15} />{Math.max(0, hours).toFixed(1).replace('.0', '')} hours logged</span></div>
      <div className="campaign-note"><button type="button" className="campaign-note-toggle" onClick={onToggleNote} aria-expanded={noteExpanded} aria-controls={noteId}><NotebookPen size={17} /><span>{liveNote ? 'Live session notes' : 'Shared campaign note'}</span><ChevronDown size={15} /></button><div id={noteId} hidden={!noteExpanded}>{noteExpanded && <textarea aria-label={liveNote ? 'Live session notes' : 'Shared campaign note'} value={note} maxLength={5000} onChange={event => onNoteChange(event.target.value)} placeholder={liveNote ? 'Clues, discoveries, and moments to remember…' : 'Where did we leave off? Add a note for the next session…'} rows={4} autoFocus />}</div>{!noteExpanded && note && <p>{note}</p>}</div>
      <div className="campaign-actions"><button type="button" className="campaign-session" onClick={onSession} aria-label={hasActiveSession ? 'Open live session' : 'Start session'} title={hasActiveSession ? 'Open live session' : 'Start session'}>{hasActiveSession ? <Timer size={21} /> : <Play size={21} />}</button><button type="button" onClick={onPuzzle} aria-label="Open puzzle board" title="Open puzzle board"><Puzzle size={21} /></button></div>
    </div>
  </section>
}
