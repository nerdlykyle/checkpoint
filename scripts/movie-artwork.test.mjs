import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

test('featured VHS puts its title on the artwork without a playback control', () => {
  const source=readFileSync(new URL('../src/MovieArtwork.tsx',import.meta.url),'utf8')
  const css=readFileSync(new URL('../src/MovieArtwork.css',import.meta.url),'utf8')
  const cassette=source.split('export function MovieCassette')[1].split('export function MovieSleeve')[0]
  assert.match(cassette, /movie-art-label.*movie-cassette-title/)
  assert.doesNotMatch(cassette, /Pause|Play|paused|movie-motion/)
  assert.match(cassette, /onClick={onOpen}/)
  assert.match(css, /movie-cassette-title\{[^}]*inset:auto 0 0[^}]*text-align:center/)
  assert.match(css, /prefers-reduced-motion:reduce.*animation:none!important/)
})
