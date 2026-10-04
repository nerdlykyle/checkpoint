// Brand glyphs from github.com/simple-icons/simple-icons/tree/develop/icons.
import spotify from './assets/spotify.svg'
import youtube from './assets/youtube-music.svg'
import type { MusicService } from './lib/music'

export default function MusicServiceLink({ service, url, label }: { service: MusicService; url: string; label: string }) {
  return <a className="button button-secondary music-service-link" href={url} target="_blank" rel="noreferrer" aria-label={label} title={label}><img src={service === 'spotify' ? spotify : youtube} alt="" aria-hidden="true" /></a>
}
