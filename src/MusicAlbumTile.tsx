import { Check, Plus } from 'lucide-react'
import type { Member } from './types'
import { listeningLink, type MusicItem, type MusicService } from './lib/music'
import ArtworkControls from './ArtworkControls'
import MusicServiceLink from './MusicServiceLink'
import VinylSleeve from './VinylSleeve'
import './MusicAlbumTile.css'

export default function MusicAlbumTile({ item, service, source, onOpen, onSave, saved }: {
  item: MusicItem; service: MusicService; source?: Member; onOpen: () => void; onSave?: () => void; saved: boolean
}) {
  return <article className="music-album-tile" data-music-id={item.id}>
    <VinylSleeve item={item}>
    <ArtworkControls title={item.title} source={source} onOpen={onOpen}/>
    <div className="music-album-hover">
      {([service, service === 'spotify' ? 'youtube' : 'spotify'] as MusicService[]).map(value => {
        const link = listeningLink(item, value)
        return <MusicServiceLink key={value} service={value} url={link.url} label={`${link.label}: ${item.title}`} />
      })}
      {onSave && <button type="button" className="icon-button" disabled={saved} aria-label={saved ? `${item.title} is in your library` : `Add ${item.title} to my library`} title={saved ? 'In your library' : 'Add to my library'} onClick={onSave}>{saved ? <Check size={20} /> : <Plus size={20} />}</button>}
    </div>
    </VinylSleeve>
    <div className="music-album-caption-wrap" title={`${item.artists.join(', ')} — ${item.title}`}>
      <span className="music-album-caption"><span className="music-album-artist">{item.artists.join(', ')}</span><strong>{item.title}</strong></span>
    </div>
  </article>
}
