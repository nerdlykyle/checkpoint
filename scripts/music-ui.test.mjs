import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('collections use an in-art icon with a tooltip and fan rear cards around their lower edge', () => {
  const controls = readFileSync(new URL('../src/ArtworkControls.tsx', import.meta.url), 'utf8')
  const stack = readFileSync(new URL('../src/CollectionStack.tsx', import.meta.url), 'utf8')
  const css = readFileSync(new URL('../src/CollectionStack.css', import.meta.url), 'utf8')
  assert.match(controls, /title={collection.label}/)
  assert.match(controls, /aria-controls={collection.controlsId}/)
  assert.ok(controls.includes('<Layers size={21}'))
  assert.match(stack, /CollectionActionContext.Provider/)
  assert.match(stack, /focus\(\{ preventScroll: true \}\)/)
  assert.doesNotMatch(stack, /View collection|ChevronDown/)
  assert.match(css, /transform-origin:50% 95%/)
  assert.match(css, /rotate\(4deg\)/)
  assert.match(css, /rotate\(-4deg\)/)
})

test('book and music artwork use explicit menu buttons, not whole-art click targets', () => {
  for (const file of ['MusicAlbumTile', 'MusicCard', 'ReadingCard', 'BookOrganizer']) {
    const source = readFileSync(new URL('../src/' + file + '.tsx', import.meta.url), 'utf8')
    assert.match(source, /<ArtworkControls/)
    assert.doesNotMatch(source, /<button[^>]*className="(?:music-album-open|music-artwork-open|organized-cover|organized-title|reading-title)"/)
  }
  const controls = readFileSync(new URL('../src/ArtworkControls.tsx', import.meta.url), 'utf8')
  assert.match(controls, /aria-haspopup="dialog"/)
  assert.match(controls, /onClick={onOpen}/)
  assert.ok(controls.indexOf('artwork-source') < controls.indexOf('artwork-menu'))
})

test('global accent fills exclude artwork hit areas on hover and press', () => {
  const css = readFileSync(new URL('../src/VisualControls.css', import.meta.url), 'utf8')
  const fills = [...css.matchAll(/([^{}]+)\{[^{}]*background-color:var\(--button-accent\)[^{}]*\}/g)]
  assert.equal(fills.length, 2)
  for (const [, selector] of fills) {
    assert.match(selector, /:not\(\.brand\)/)
    assert.match(selector, /:not\(:is\(\.music-album-open,\.music-artwork-open,\.paperback-open,\.cartridge-art-open,\.game-card-open\)\)/)
  }
  assert.ok(fills.some(([, selector]) => selector.includes(':hover')))
  assert.ok(fills.some(([, selector]) => selector.includes(':active')))
})

test('vinyl reveal uses contrasting colored grooves and a larger two-way slide', () => {
  const css = readFileSync(new URL('../src/VinylSleeve.css', import.meta.url), 'utf8')
  assert.match(css, /conic-gradient/)
  assert.match(css, /repeating-radial-gradient\(circle,#74658f/)
  assert.equal((css.match(/translateX\(16%\)/g) || []).length, 2)
  assert.equal((css.match(/translateX\(-6%\)/g) || []).length, 2)
  assert.match(css, /prefers-reduced-motion:reduce/)
})

test('only current club listens render an always-spinning decorative turntable', () => {
  const mode = readFileSync(new URL('../src/MusicMode.tsx', import.meta.url), 'utf8')
  const component = readFileSync(new URL('../src/MusicTurntable.tsx', import.meta.url), 'utf8')
  const css = readFileSync(new URL('../src/MusicTurntable.css', import.meta.url), 'utf8')
  assert.match(mode, /if\(item.club\?\.status==='listening'\)return <MusicTurntable/)
  assert.match(component, /aria-haspopup="dialog" onClick={onOpen}/)
  assert.doesNotMatch(component, /setInterval|setTimeout|onMouseEnter|Pause|<audio|<video/)
  assert.match(component, /safeHttpUrl\(item.coverUrl\)/)
  assert.doesNotMatch(component, /checkpoint · hi-fi/)
  assert.match(css, /music-turntable-menu \{[^}]*right:8px; top:8px/)
  assert.match(css, /animation:music-vinyl-spin 18s linear infinite/)
  assert.match(css, /height:47%; transform-origin:50% 0; transform:rotate\(41deg\)/)
  assert.match(css, /prefers-reduced-motion:reduce.*animation:none/s)
})

test('non-current cards and library tiles share a worn sleeve with explicit artwork controls', () => {
  for (const file of ['MusicCard', 'MusicAlbumTile']) {
    const source = readFileSync(new URL('../src/' + file + '.tsx', import.meta.url), 'utf8')
    assert.match(source, /<VinylSleeve item={item}>/)
    assert.match(source, /<ArtworkControls/)
    assert.doesNotMatch(source, /card-glass|music-cinematic/)
  }
  const sleeve = readFileSync(new URL('../src/VinylSleeve.tsx', import.meta.url), 'utf8')
  assert.match(sleeve, /<SharpArtwork src={url}/)
  assert.match(sleeve, /vinyl-sleeve-fallback/)
  assert.match(sleeve, /safeHttpUrl\(item.coverUrl\)/)
  assert.match(sleeve, /\{children\}\s*<\/div>\s*<\/div>/)
  assert.doesNotMatch(sleeve, /className="vinyl-sleeve" aria-hidden/)
})

test('sleeves have varied stable tilts and edge-to-edge artwork without a left spine stripe', () => {
  const css = readFileSync(new URL('../src/VinylSleeve.css', import.meta.url), 'utf8')
  assert.equal(new Set([...css.matchAll(/--sleeve-tilt:([\d.-]+deg);/g)].map(match=>match[1])).size, 4)
  assert.match(css, /\.collection-stack-front>\.music-album-tile \{ --sleeve-tilt:inherit/)
  assert.match(css, /\.music-album-grid>:nth-child/)
  assert.match(css, /\.music-album-tile:nth-of-type/)
  assert.match(css, /rotate\(calc\(var\(--sleeve-tilt/)
  assert.match(css, /\.vinyl-sleeve > \.sharp-artwork > img \{ position:absolute; inset:0; width:100%; height:100%/)
  assert.doesNotMatch(css, /#bbb19955|#fceac633|inset 0 0 0 1px #dbc79c80/)
})
