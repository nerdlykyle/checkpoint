import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const source = readFileSync(new URL('../src/GameCartridge.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/GameCartridge.css', import.meta.url), 'utf8')
test('cartridges separate disclosure, details, and social actions', () => {
  assert.match(source, /aria-expanded={expanded} aria-controls={summaryId}/)
  assert.match(source, /id={summaryId} hidden={!expanded}/)
  assert.match(source, /onClick={onOpen}[^>]*aria-haspopup="dialog"/)
  assert.match(source, /cartridge-social">{vote}<div className="cartridge-ownership"><span>{game.platform}<\/span>{ownership}<\/div><div className="cartridge-price">{price}/)
  assert.doesNotMatch(source, /Added by|Replay animation/)
})
test('completion is clamped and completed games always show a full gradient', () => {
  assert.match(source, /game.status === 'completed' \? 100 : Math.min\(100, Math.max\(0, Number.isFinite/)
  assert.match(source, /role="progressbar"[^>]*aria-valuenow={progress}/)
  assert.match(css, /linear-gradient\(90deg,#8973f6,#67bcda,#88e5bb\)/)
})
test('air travels across 75%, is single-play hover only, and clicks stop motion', () => {
  assert.match(css, /cartridge-air \{[^}]*width:75%/)
  assert.match(css, /@media\(hover:hover\) and \(pointer:fine\) and \(prefers-reduced-motion:no-preference\)/)
  assert.match(source, /onPointerDown={\(\) => setMotionPaused\(true\)}/)
  assert.doesNotMatch(css, /infinite/)
  assert.match(css, /stroke-dashoffset:75/)
  assert.match(css, /stroke-dashoffset:-320/)
})
test('glass shares the label clip and overscans its side and lower edges', () => {
  assert.match(css, /cartridge-label \{[^}]*overflow:hidden/)
  assert.match(css, /cartridge-frost \{[^}]*inset:-28px -3px -3px/)
  assert.match(css, /prefers-reduced-transparency:reduce/)
})
test('campaign uses the shared cartridge with a larger featured size and keeps session controls', () => {
  const campaign = readFileSync(new URL('../src/CampaignCard.tsx', import.meta.url), 'utf8')
  assert.match(campaign, /<GameCartridge featured/)
  assert.match(campaign, /onClick={onSession}/)
  assert.match(campaign, /onClick={onPuzzle}/)
  assert.match(campaign, /onNoteChange\(event.target.value\)/)
})
test('radar and library retain split game-case cards rather than cartridges', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
  const library = app.slice(app.indexOf('export function LibraryCard'), app.indexOf('function RecommendationCard'))
  assert.match(library, /library-card clean-split game-case/)
  assert.doesNotMatch(library, /GameCartridge|Added by/)
  assert.match(library, /<OwnershipBadge game={game} compact \/><DealBadge game={game} compact \/>/)
  const split = readFileSync(new URL('../src/CleanSplitCards.css', import.meta.url), 'utf8')
  assert.match(split, /aspect-ratio:135 \/ 171/)
})
