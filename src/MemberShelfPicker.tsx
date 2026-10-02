import { useRef, useState } from 'react'
import { Check, Search, Users, X } from 'lucide-react'
import type { Member } from './types'
import './MemberShelfPicker.css'

export function MemberPortrait({ member }: { member: Member }) {
  const [failed, setFailed] = useState('')
  const photo = member.photoUrl || member.customPhotoUrl || member.googlePhotoUrl
  return <span className="member-portrait" style={{ background: member.color || '#54458b' }}>{photo && photo !== failed
    ? <img src={photo} alt="" onError={() => setFailed(photo)} />
    : member.initials || member.name.split(/\s+/).map(part => part[0]).slice(0, 2).join('')}</span>
}

export default function MemberShelfPicker({ crew, currentUser, selected, kind, onSelect }: {
  crew: Member[]; currentUser: string; selected: string; kind: 'books' | 'music'; onSelect: (id: string) => void
}) {
  const key = `checkpoint:recent-shelves:${kind}:${currentUser}`
  const [recent, setRecent] = useState<string[]>(() => {
    try { const saved: unknown = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string').slice(0, 20) : [] } catch { return [] }
  })
  const [query, setQuery] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)
  const people = crew.some(member => member.id === currentUser) ? crew : [{ id: currentUser, name: 'You', initials: 'Y', color: '#7568e8' }, ...crew]
  const byId = new Map(people.map(member => [member.id, member]))
  const priority = [...new Set([currentUser, selected, ...recent, ...people.map(member => member.id)])].filter(id => byId.has(id))
  const quick = (people.length <= 3 ? [currentUser, ...people.filter(member => member.id !== currentUser).map(member => member.id)] : priority.slice(0, 3)).map(id => byId.get(id)!)
  const normalize = (text: string) => text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase()
  const sorted = [...people].sort((a, b) => {
    const rank = (id: string) => id === currentUser ? -1 : recent.includes(id) ? recent.indexOf(id) : 100
    return rank(a.id) - rank(b.id) || a.name.localeCompare(b.name)
  }).filter(member => normalize(`${member.name} ${member.id === currentUser ? 'you my' : ''}`).includes(normalize(query.trim())))
  const choose = (id: string) => {
    const next = [id, ...recent.filter(value => value !== id)].slice(0, 20)
    setRecent(next)
    try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* Storage is optional. */ }
    onSelect(id); dialog.current?.close()
  }
  const name = byId.get(selected)?.name || 'Member'
  return <section className="member-shelf-picker" aria-label={`Choose whose ${kind} to browse`}>
    <h2>{selected === currentUser ? `My ${kind}` : `${name}’s ${kind}`}</h2>
    <div className="member-shelf-quick">{quick.map(member => <button type="button" key={member.id} className="member-shelf-choice" aria-pressed={selected === member.id} aria-label={`View ${member.id === currentUser ? 'my' : `${member.name}’s`} ${kind}`} onClick={() => choose(member.id)}><MemberPortrait member={member} /><span>{member.id === currentUser ? 'You' : member.name}</span></button>)}
      {people.length > 3 && <button type="button" className="member-shelf-all" onClick={() => { setQuery(''); dialog.current?.showModal(); dialog.current?.querySelector('input')?.focus() }}><Users size={20} /><span>All members · {people.length}</span></button>}
    </div>
    <dialog ref={dialog} className="member-shelf-dialog" aria-label={`Browse members’ ${kind}`} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close() }}>
      <div className="member-shelf-dialog-content"><header><h2>Whose {kind}?</h2><button className="icon-button" type="button" aria-label="Close member picker" onClick={() => dialog.current?.close()}><X size={20} /></button></header>
        <label className="member-shelf-search"><Search size={18} /><input autoFocus type="search" aria-label="Search members" placeholder="Find a member…" value={query} onChange={event => setQuery(event.target.value)} /></label>
        <p>Recent members first, then everyone else.</p>
        <div className="member-shelf-results">{sorted.map(member => <button type="button" key={member.id} aria-pressed={selected === member.id} onClick={() => choose(member.id)}><MemberPortrait member={member} /><span>{member.name}{member.id === currentUser ? ' (You)' : ''}</span>{selected === member.id && <Check size={18} />}</button>)}{!sorted.length && <p role="status">No members match “{query}”.</p>}</div>
      </div>
    </dialog>
  </section>
}
