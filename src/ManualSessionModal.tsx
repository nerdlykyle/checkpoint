import { useEffect, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import type { Game, Member } from './types'
import { localDateTimeInput, type ManualSessionInput } from './lib/manualSession'
import { MemberPortrait } from './MemberShelfPicker'
import './ManualSessionModal.css'

export default function ManualSessionModal({ games, crew, defaultGameId, onClose, onSave }: {
  games: Game[]; crew: Member[]; defaultGameId?: string; onClose: () => void; onSave: (input: ManualSessionInput) => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [gameId, setGameId] = useState(defaultGameId || games[0]?.id || '')
  const [search, setSearch] = useState('')
  const [startedAt, setStartedAt] = useState(() => localDateTimeInput(new Date(Date.now() - 2 * 60 * 60000)))
  const [hours, setHours] = useState('2'), [minutes, setMinutes] = useState('0')
  const [participants, setParticipants] = useState(crew.map(member => member.id))
  const [note, setNote] = useState(''), [error, setError] = useState('')
  useEffect(() => { dialog.current?.showModal(); dialog.current?.querySelector('input')?.focus() }, [])
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const filtered = games.filter(game => game.id === gameId || game.title.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
  return <dialog ref={dialog} className="manual-session-dialog" aria-labelledby="manual-session-title" onClose={onClose}>
    <form onSubmit={event => { event.preventDefault(); try { onSave({ gameId, startedAt, durationMinutes: Number(hours) * 60 + Number(minutes), participantIds: participants, note }) } catch (error) { setError(error instanceof Error ? error.message : 'Could not save this session.') } }}>
      <header><div><span className="eyebrow">The campaign log</span><h2 id="manual-session-title">Add past session</h2></div><button type="button" className="icon-button" aria-label="Close" onClick={onClose}><X size={20} /></button></header>
      <p>Record a session you already played. This won’t start or interrupt a live timer.</p>
      <label>Find a game<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Type a game title…" /></label>
      <label>Game<select required value={gameId} onChange={event => setGameId(event.target.value)}>{filtered.map(game => <option key={game.id} value={game.id}>{game.title}</option>)}</select></label>
      {!games.length && <p role="alert">Add a game to your library first.</p>}
      <label>Date & start time<input type="datetime-local" required value={startedAt} max={localDateTimeInput(new Date())} onChange={event => setStartedAt(event.target.value)} /></label>
      <small>Times use your device’s time zone: {zone}.</small>
      <fieldset className="manual-session-duration"><legend>Time actually played</legend><div><label>Hours<input type="number" min="0" max="24" step="1" required value={hours} onChange={event => setHours(event.target.value)} /></label><label>Minutes<input type="number" min="0" max="59" step="1" required value={minutes} onChange={event => setMinutes(event.target.value)} /></label></div></fieldset>
      <fieldset className="manual-session-players"><legend>Who played?</legend><div>{crew.map(member => <button type="button" key={member.id} aria-pressed={participants.includes(member.id)} onClick={() => setParticipants(current => current.includes(member.id) ? current.filter(id => id !== member.id) : [...current, member.id])}><MemberPortrait member={member} /><span>{member.name}</span>{participants.includes(member.id) && <Check size={16} />}</button>)}</div></fieldset>
      <label>Session notes <textarea rows={4} maxLength={5000} value={note} onChange={event => setNote(event.target.value)} placeholder="What happened? Discoveries, progress, or where you left off…" /></label>
      {error && <p role="alert" className="manual-session-error">{error}</p>}
      <footer><button type="button" className="button button-secondary" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary" disabled={!gameId || !participants.length}>Save past session</button></footer>
    </form>
  </dialog>
}
