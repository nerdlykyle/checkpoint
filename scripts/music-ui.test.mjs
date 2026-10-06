import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('global accent fills exclude artwork hit areas on hover and press', () => {
  const css = readFileSync(new URL('../src/VisualControls.css', import.meta.url), 'utf8')
  const fills = [...css.matchAll(/([^{}]+)\{[^{}]*background-color:var\(--button-accent\)[^{}]*\}/g)]
  assert.equal(fills.length, 2)
  for (const [, selector] of fills) {
    assert.match(selector, /:not\(:is\(\.music-album-open,\.music-artwork-open\)\)/)
  }
  assert.ok(fills.some(([, selector]) => selector.includes(':hover')))
  assert.ok(fills.some(([, selector]) => selector.includes(':active')))
})
