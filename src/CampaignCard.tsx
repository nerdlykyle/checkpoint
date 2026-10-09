import { useId, useState, type ReactNode } from 'react'
import { NotebookPen, Play, Plus, Puzzle, Timer } from 'lucide-react'
import GameCartridge from './GameCartridge'
import CampaignNotesDialog from './CampaignNotesDialog'
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
  const headingId = useId()
  if (!game) return <section className="campaign-hero campaign-empty" aria-label="Current campaign"><span className="campaign-badge">Current campaign</span><button type="button" onClick={onAdd}><Plus size={24} /><span>Choose a game to start</span></button><p>Ready when you are.</p></section>
  return <section className="campaign-hero campaign-cartridge" aria-labelledby={headingId}>
    <header className="campaign-cartridge-heading"><span className="eyebrow">Continue playing</span><h2 id={headingId}>Current campaign</h2></header>
    <GameCartridge featured game={{ ...game, hours, note }} onOpen={onDetails} artwork={<CampaignArtwork key={artworkUrls.join('|')} urls={artworkUrls} />} vote={vote} ownership={ownership} price={price} libraryAction={null} badges={game.contentType === 'dlc' ? 'DLC' : null}
      controls={<>
        <button type="button" onClick={onSession} aria-label={hasActiveSession ? 'Open live session' : 'Start session'} title={hasActiveSession ? 'Open live session' : 'Start session'}>{hasActiveSession ? <Timer size={21} /> : <Play size={21} />}</button>
        <button type="button" onClick={onPuzzle} aria-label="Open puzzle board" title="Open puzzle board"><Puzzle size={21} /></button>
        <button type="button" onClick={onToggleNote} aria-label={liveNote ? 'Open live session notes' : 'Open shared campaign note'} title={liveNote ? 'Live session notes' : 'Shared campaign note'} aria-haspopup="dialog"><NotebookPen size={21} /></button>
      </>} />
    {noteExpanded && <CampaignNotesDialog gameTitle={game.title} note={note} liveNote={liveNote} onNoteChange={onNoteChange} onClose={onToggleNote} />}
  </section>
}
