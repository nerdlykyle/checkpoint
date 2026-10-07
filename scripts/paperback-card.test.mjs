import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { bookChapterBookmark } from '../src/lib/bookChapterBookmark.ts'

test('bookmark is absent for unregistered, zero, or invalid chapters', () => {
  assert.equal(bookChapterBookmark({ progress: {} }, 'nern'), null)
  for (const lastChapter of [undefined, null, 0, -1, 1.5, NaN, Infinity, '26', Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(bookChapterBookmark({ progress: { nern: { lastChapter } } }, 'nern'), null)
  }
})

test('bookmark uses only the signed-in reader’s saved chapter', () => {
  const book = { progress: { nern: { lastChapter: 26 }, jern: { lastChapter: 8 } } }
  assert.equal(bookChapterBookmark(book, 'nern'), 26)
  assert.equal(bookChapterBookmark(book, 'jern'), 8)
  assert.equal(bookChapterBookmark(book, 'vern'), null)
  assert.equal(bookChapterBookmark({ progress: { nern: { lastChapter: 1 } } }, 'nern'), 1)
})

test('paperback opens the existing book dialog, without an extra settings screen', () => {
  const home = readFileSync(new URL('../src/BookClub.tsx', import.meta.url), 'utf8')
  const card = readFileSync(new URL('../src/PaperbackCard.tsx', import.meta.url), 'utf8')
  assert.match(home, /<PaperbackCard[^>]+onOpen=\{\(\) => setSelectedId\(book.id\)\}/)
  assert.match(home, /selected && <BookDetails/)
  assert.match(card, /onClick=\{onOpen\}/)
  assert.match(card, /aria-haspopup="dialog"/)
  assert.match(card, /<SlidersHorizontal size=\{20\}/)
  assert.doesNotMatch(card, />Details & settings</)
  assert.match(card, /chapter !== null && <span/)
  assert.match(card, /<BookCoverImage book=\{book\} large/)
  assert.match(home, /<ReadingCard book=\{currentClubBook\}[^>]+club/)
})

test('paperback motion has touch, keyboard, reduced-motion, and uncropped-cover support', () => {
  const css = readFileSync(new URL('../src/PaperbackCard.css', import.meta.url), 'utf8')
  assert.match(css, /hover:hover\) and \(pointer:fine/)
  assert.match(css, /paperback-open:focus-visible \.paperback-cover/)
  assert.match(css, /@media\(hover:none\)/)
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/)
  assert.match(css, /object-fit:contain/)
  assert.match(css, /repeat\(2,minmax\(0,1fr\)\)/)
})
