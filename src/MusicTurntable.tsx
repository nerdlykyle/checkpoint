import { useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { listeningLink, safeHttpUrl, type MusicItem, type MusicService } from './lib/music'
import MusicServiceLink from './MusicServiceLink'
import './MusicTurntable.css'

/** Decorative club display, not an audio player. Only club selection changes the record. */
export default function MusicTurntable({ item, service, onOpen }: { item: MusicItem; service: MusicService; onOpen: () => void }) {
  const [failedUrl, setFailedUrl] = useState<string>()
  const url = item.coverUrl && safeHttpUrl(item.coverUrl)
  return <article className="music-turntable" data-music-id={item.id} aria-label={`Current group listen: ${item.title}`}>
    <div className="music-turntable-deck">
      <div className="music-turntable-hardware" aria-hidden="true">
        <span className="music-turntable-screw" /><span className="music-turntable-screw is-right" />
        <div className="music-turntable-platter"><div className="music-turntable-record"><div className="music-turntable-label"><span>{item.title.slice(0, 2).toUpperCase()}</span>{url && url !== failedUrl && <img src={url} alt="" decoding="async" onError={() => setFailedUrl(url)} />}</div></div><span className="music-turntable-spindle" /></div>
        <div className="music-turntable-pivot" /><div className="music-turntable-arm"><span className="music-turntable-counterweight" /><span className="music-turntable-headshell" /></div>
        <span className="music-turntable-indicator"><span />CLUB LISTEN</span>
      </div>
      <button type="button" className="icon-button music-turntable-menu" aria-label={`Open menu for ${item.title}`} title={`Details & actions: ${item.title}`} aria-haspopup="dialog" onClick={onOpen}><MoreHorizontal size={21} /></button>
    </div>
    <div className="music-turntable-caption"><div><p>{item.artists.join(', ')}</p><h3>{item.title}</h3></div><div className="music-listening-links">
      {([service, service === 'spotify' ? 'youtube' : 'spotify'] as MusicService[]).map(value => {
        const link = listeningLink(item, value)
        return <MusicServiceLink key={value} service={value} url={link.url} label={`${link.label}: ${item.title}`} />
      })}
    </div></div>
  </article>
}
