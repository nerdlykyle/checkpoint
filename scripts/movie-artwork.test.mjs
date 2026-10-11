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
  assert.match(cassette, /className="movie-cassette" role="group"/)
  assert.match(cassette, /movie-cassette-menu[\s\S]*movie-screw/)
  assert.doesNotMatch(cassette, /High grade|T-120|movie-actions/)
  assert.equal((cassette.match(/<button /g) || []).length, 1)
  assert.match(css, /movie-cassette-menu\{[^}]*right:6%[^}]*width:44px;height:44px/)
  assert.match(css, /movie-cassette-title\{[^}]*inset:auto 0 0[^}]*text-align:center/)
  assert.match(css, /prefers-reduced-motion:reduce.*animation:none!important/)
})
