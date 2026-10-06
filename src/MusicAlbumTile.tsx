import { useState } from 'react'
import { Check, Plus } from 'lucide-react'
import type { Member } from './types'
import { listeningLink, safeHttpUrl, type MusicItem, type MusicService } from './lib/music'
import { MemberPortrait } from './MemberShelfPicker'
import MusicServiceLink from './MusicServiceLink'
import './MusicAlbumTile.css'

export default function MusicAlbumTile({ item, service, source, onOpen, onSave, saved }: {
  item: MusicItem; service: MusicService; source?: Member; onOpen: () => void; onSave?: () => void; saved: boolean
}) {
  const [failed, setFailed] = useState('')
  const art = item.coverUrl && safeHttpUrl(item.coverUrl)
  return <article className="music-album-tile" data-music-id={item.id}>
    <div className="music-album-art" aria-hidden="true"><span>{item.title.slice(0, 2).toUpperCase()}</span>{art && art !== failed && <img src={art} alt="" loading="lazy" decoding="async" onError={() => setFailed(art)} />}</div>
    <button type="button" className="music-album-open" aria-label={`Open ${item.title} by ${item.artists.join(', ')}`} title={`${item.artists.join(', ')} — ${item.title}`} onClick={onOpen}>
      <span className="music-album-caption"><span className="music-album-artist">{item.artists.join(', ')}</span><strong>{item.title}</strong></span>
    </button>
    {source && <span className="music-album-source" title={`Saved from ${source.name}`} aria-label={`Saved from ${source.name}`}><MemberPortrait member={source} /></span>}
    <div className="music-album-hover">
      {([service, service === 'spotify' ? 'youtube' : 'spotify'] as MusicService[]).map(value => {
        const link = listeningLink(item, value)
        return <MusicServiceLink key={value} service={value} url={link.url} label={`${link.label}: ${item.title}`} />
      })}
      {onSave && <button type="button" className="icon-button" disabled={saved} aria-label={saved ? `${item.title} is in your library` : `Add ${item.title} to my library`} title={saved ? 'In your library' : 'Add to my library'} onClick={onSave}>{saved ? <Check size={20} /> : <Plus size={20} />}</button>}
    </div>
  </article>
}
