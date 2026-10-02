import test from 'node:test'
import assert from 'node:assert/strict'
import { inferSeries, matchesCatalogBook, movePersonalBook, nextSeriesBook, normalizeGenres, personalQueue, sameSeries, setPersonalShelf } from '../src/lib/bookOrganization.ts'

const book = (id, extra = {}) => ({ id, title: id, authors: ['A. Writer'], createdAt: '2026-10-01', shelves: { nern: 'to-read', jern: 'reading' }, progress: { jern: { lastChapter: 12 } }, ratings: { jern: { stars: 5 } }, comments: [{ text: 'Shared' }], club: { status: 'up-next', order: 3 }, ...extra })

test('personal ordering preserves other readers, club state, progress, ratings and comments', () => {
  const initial = [book('a'), book('b'), book('c')]
  const moved = movePersonalBook(initial, 'nern', 'c', 1)
  assert.deepEqual(personalQueue(moved, 'nern', 'to-read').map((item) => item.id), ['c','a','b'])
  assert.deepEqual(personalQueue(moved, 'jern', 'reading').map((item) => item.id), ['a','b','c'])
  for (const [index, item] of moved.entries()) for (const field of ['shelves','progress','ratings','comments','club']) assert.deepEqual(item[field], initial[index][field])
  assert.equal(initial[2].readerOrganization, undefined)
})

test('shelf changes append after legacy books, keep personal tags and are separate from club reading', () => {
  const initial = [book('a'), book('b'), book('c', { shelves: { nern: 'reading', jern: 'read' }, readerOrganization: { nern: { tags: ['Audio'] }, jern: { order: 2 } } })]
  const changed = setPersonalShelf(initial, 'nern', 'c', 'to-read')
  assert.deepEqual(personalQueue(changed, 'nern', 'to-read').map((item) => item.id), ['a','b','c'])
  assert.deepEqual(changed[2].readerOrganization.nern.tags, ['Audio'])
  assert.deepEqual(changed[2].readerOrganization.jern, { order: 2 })
  assert.equal(changed[2].shelves.jern, 'read')
  for (const shelf of ['paused','dnf','read']) {
    const result = setPersonalShelf(changed, 'nern', 'c', shelf)
    assert.equal(result[2].shelves.nern, shelf)
    assert.deepEqual(result[2].club, initial[2].club)
  }
  assert.equal(setPersonalShelf(changed, 'nern', 'c', 'to-read'), changed)
})

test('filtered moves use full shelf positions and cannot modify absent reader shelves', () => {
  const initial = [book('a'), book('b'), book('c'), book('d', { shelves: { jern: 'read' } })]
  assert.deepEqual(personalQueue(movePersonalBook(initial,'nern','c',2),'nern').map((item) => item.id), ['a','c','b'])
  assert.equal(movePersonalBook(initial, 'nern', 'd', 1), initial)
  assert.equal(movePersonalBook(initial, 'nern', 'c', NaN), initial)
  assert.equal(personalQueue(movePersonalBook(initial, 'nern', 'a', 999),'nern').at(-1).id, 'a')
})

test('series inference only uses explicit numbers and does not invent a total', () => {
  assert.deepEqual(inferSeries('A Title (The Saga, #2 of 6)'), { name: 'The Saga', position: 2, total: 6 })
  assert.deepEqual(inferSeries('The Saga: Book 2.5'), { name: 'The Saga', position: 2.5 })
  assert.equal(inferSeries('A Standalone Title'), undefined)
  assert.equal(inferSeries('Published in 2025'), undefined)
})

test('series match requires author overlap; next installment follows series order, not queue rank', () => {
  const first = book('first', { series: { name: 'The Saga', position: 1 } })
  const second = book('second', { series: { name: 'The Saga', position: 2 }, readerOrganization: { nern: { order: 99 } } })
  const third = book('third', { series: { name: 'The Saga', position: 3 } })
  const unrelated = book('other', { authors: ['Someone else'], series: { name: 'The Saga', position: 1.5 } })
  assert.equal(sameSeries(first, unrelated), false)
  assert.equal(nextSeriesBook([third, unrelated, second], first), second)
})

test('genre normalization supports cross-genre books and metadata matches fail closed', () => {
  assert.deepEqual(normalizeGenres(['Fiction / Science Fiction / General', 'Horror fiction']), ['Sci-fi','Horror'])
  assert.deepEqual(normalizeGenres(['Unrecognized subject']), [])
  assert.equal(matchesCatalogBook(book('same'), { title: 'same', authors: ['Different writer'] }), false)
  assert.equal(matchesCatalogBook(book('same'), { title: 'Same', authors: ['A. Writer'] }), true)
  assert.equal(matchesCatalogBook(book('edition', { isbn13: '9781234567890' }), { isbn13: '9781234567890' }), true)
})
