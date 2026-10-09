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
  assert.match(home, /<PaperbackCard book=\{currentClubBook\}[^>]+club/)
})

test('paperback motion has touch, keyboard, reduced-motion, and full-bleed-cover support', () => {
  const css = readFileSync(new URL('../src/PaperbackCard.css', import.meta.url), 'utf8')
  const card = readFileSync(new URL('../src/PaperbackCard.tsx', import.meta.url), 'utf8')
  assert.match(card, /event.pointerType === 'mouse'/)
  assert.match(card, /onFocus=\{riffle\}/)
  assert.match(card, /length: 20/)
  assert.match(css, /animation-delay:calc\(\(19 - var\(--page\)\) \* 24ms\)/)
  assert.match(css, /rotateY\(-58deg\)/)
  assert.match(css, /paperback-curl-light/)
  assert.doesNotMatch(css, /rotateY\(-108deg\)|paperback-cover-back/)
  assert.match(css, /paperback-wear/)
  assert.match(card, /paperback-settings icon-button/)
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/)
  assert.match(css, /object-fit:cover; object-position:center/)
  assert.match(css, /repeat\(2,minmax\(0,1fr\)\)/)
})

test('club book has no redundant chapter icon below it, while details and bookmarks remain editable', () => {
  const home = readFileSync(new URL('../src/BookClub.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(home, /aria-label="Update my chapter"/)
  assert.match(home, /<PaperbackCard book=\{currentClubBook\}[^\n]+onOpen=\{\(\) => setSelectedId\(currentClubBook.id\)\}[^\n]+onChapter=/)
  assert.match(home, /<BookDetails[^\n]+onChapter=\{\(\) => setChapterBookId\(selected.id\)\}/)
  assert.match(home, /!currentClubBook.club!.participantIds.includes\(currentUser\) && <div className="club-paperback-actions"/)
})
