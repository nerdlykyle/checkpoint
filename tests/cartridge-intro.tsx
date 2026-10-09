// Isolated animation fixture: no authentication or shared-board writes.
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import GameCartridge from '../src/GameCartridge'
import type { Game } from '../src/types'
import '../src/index.css'
import '../src/App.css'

// Query mode tests the production preference guard without changing OS settings.
if (new URLSearchParams(location.search).has('reduce')) {
  const nativeMatchMedia = window.matchMedia.bind(window)
  window.matchMedia = query => query === '(prefers-reduced-motion: reduce)'
    ? { matches: true, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true } : nativeMatchMedia(query)
}
const game: Game = { id: 'preview', title: 'Space Marine 2', status: 'playing', progress: 42, votes: [], note: '', color: '#324966', accent: '#8d7eea', platform: 'PC', genre: 'Action', addedBy: 'preview', coverMark: 'SM' }
function Fixture() {
  const [visible, setVisible] = useState(true)
  const [starts, setStarts] = useState(0)
  const [updates, setUpdates] = useState(0)
  return <main style={{ maxWidth: 640, padding: 24, margin: 'auto' }} onAnimationStart={event => { if (event.animationName === 'cartridge-insert') setStarts(count => count + 1) }}>
    <h1>Cartridge load preview</h1>
    <p role="status">Intro starts: {starts} · Live updates: {updates}</p>
    <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
      <button onClick={() => setVisible(value => !value)}>{visible ? 'Leave page' : 'Return to page'}</button>
      <button onClick={() => setUpdates(value => value + 1)}>Simulate live update</button>
    </div>
    {visible && <GameCartridge featured game={game} onOpen={() => setUpdates(value => value + 1)} artwork={<div style={{ position: 'absolute', inset: 0, background: 'url(https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/2183900/library_600x900_2x.jpg) center 25% / cover' }} />} vote={null} ownership="2/3 own" price={null} libraryAction={null} badges={null} />}
  </main>
}
createRoot(document.getElementById('root')!).render(<StrictMode><Fixture /></StrictMode>)
