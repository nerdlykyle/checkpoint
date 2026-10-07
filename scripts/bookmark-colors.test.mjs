import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { bookmarkColor, bookmarkInk, validBookmarkColor } from '../src/lib/bookmarkColors.ts'

test('crew defaults are distinct and stable across device/order changes', () => {
  const members = ['Nern', 'Jern', 'Vern'].map(name => ({ id: name.toLowerCase(), name }))
  const colors = members.map(bookmarkColor)
  assert.equal(new Set(colors).size, 3)
  assert.deepEqual([...members].reverse().map(bookmarkColor), [...colors].reverse())
  assert.equal(bookmarkColor({ ...members[0], id: 'new-device-id' }), colors[0])
})
test('saved custom colors are validated and readable', () => {
  assert.equal(bookmarkColor({ id: 'n', name: 'Nern', bookmarkColor: '#ABCDEF' }), '#abcdef')
  for (const color of ['', '#fff', 'red', 'url(x)', undefined, null, '#zzzzzz']) assert.equal(validBookmarkColor(color), false)
  assert.equal(bookmarkInk('#ffffff'), '#111820')
  assert.equal(bookmarkInk('#000000'), '#ffffff')
})
test('profile mapping preserves colors and writes only the signed-in user’s preference', () => {
  const board = readFileSync(new URL('../src/lib/sharedBoard.ts', import.meta.url), 'utf8')
  assert.match(board, /bookmarkColor: existing\?\.bookmarkColor/)
  assert.match(board, /bookmarkColor: member.bookmarkColor/)
  assert.match(board, /new FieldPath\('members', user.uid, 'bookmarkColor'\)/)
  const card = readFileSync(new URL('../src/PaperbackCard.tsx', import.meta.url), 'utf8')
  assert.match(card, /member.id === user && Boolean\(onChapter\)/)
  assert.match(card, /return own \? <button/)
  assert.match(card, /if \(value === null\) return \[\]/)
})
