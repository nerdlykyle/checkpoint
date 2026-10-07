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
    assert.match(selector, /:not\(:is\(\.music-album-open,\.music-artwork-open,\.paperback-open\)\)/)
  }
  assert.ok(fills.some(([, selector]) => selector.includes(':hover')))
  assert.ok(fills.some(([, selector]) => selector.includes(':active')))
})
