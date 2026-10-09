import { type ReactNode } from 'react'
import { type MusicItem } from './lib/music'
import ArtworkControls from './ArtworkControls'
import VinylSleeve from './VinylSleeve'
import type { Member } from './types'
import './MusicCard.css'

// Non-current albums retain their actions beside a physical record sleeve.
export default function MusicCard({ item, dropTarget, onOpen, source, children }: {
  item: MusicItem; dropTarget: boolean; onOpen: () => void; source?: Member; children: ReactNode
}) {
  return <article className={`music-card music-sleeve-card${dropTarget ? ' is-drop-target' : ''}`} data-music-id={item.id}>
    <VinylSleeve item={item}><ArtworkControls title={item.title} source={source} onOpen={onOpen}/></VinylSleeve>
    <div className="music-sleeve-content">{children}</div>
  </article>
}
