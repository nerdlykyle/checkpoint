import test from 'node:test'
import assert from 'node:assert/strict'
import { applyClubBookAction, clubBookQueue, isBookPollCandidate, moveClubBook } from '../src/lib/clubBooks.ts'

const book = (id, extra = {}) => ({
  id, title: id, authors: [], description: '', addedBy: 'nern', createdAt: '',
  nominated: false, upvotes: [], downvotes: [], shelves: { nern: 'to-read' },
  progress: {}, ratings: {}, comments: [], ...extra,
})

test('existing personal shelves do not imply a club read or poll entry', () => {
  const books = [book('personal', { shelves: { nern: 'reading', jern: 'read' } })]
  assert.equal(books.some((item) => item.club), false)
  assert.equal(isBookPollCandidate(books[0]), false)
  assert.deepEqual(clubBookQueue(books), [])
  // Legacy nominees stay available without migrating any shelves.
  assert.equal(isBookPollCandidate(book('legacy', { nominated: undefined })), true)
})

test('queue and ordering never modify personal shelves or votes', () => {
  const initial = [book('a', { upvotes: ['nern'] }), book('b', { shelves: { vern: 'read' }, upvotes: ['jern', 'vern'] })]
  let books = applyClubBookAction(initial, 'a', 'nern', 'queue')
  books = applyClubBookAction(books, 'b', 'nern', 'queue')
  assert.deepEqual(clubBookQueue(books).map((item) => item.id), ['a','b'])
  books = moveClubBook(books, 'b', -1)
  assert.deepEqual(clubBookQueue(books).map((item) => item.id), ['b','a'])
  books.forEach((item, i) => {
    assert.deepEqual(item.shelves, initial[i].shelves)
    assert.deepEqual(item.upvotes, initial[i].upvotes)
    assert.equal(isBookPollCandidate(item), false)
  })
  const removed = applyClubBookAction(books, 'b', 'nern', 'unqueue')[1]
  assert.equal(removed.club, undefined)
  assert.equal(removed.nominated, false)
  assert.deepEqual(removed.shelves, initial[1].shelves)
})

test('start and join are opt-in, preserving chapters and other readers', () => {
  const initial = [book('a', {
    shelves: { nern: 'to-read', vern: 'read', jern: 'to-read' },
    progress: { nern: { lastChapter: 7, updatedAt: '' }, jern: { lastChapter: 3, updatedAt: '' } },
  }), book('b')]
  let books = applyClubBookAction(initial, 'a', 'nern', 'start', '2026-09-29T12:00:00Z')
  assert.deepEqual(books[0].club.participantIds, ['nern'])
  assert.deepEqual(books[0].shelves, { nern: 'reading', vern: 'read', jern: 'to-read' })
  assert.deepEqual(books[0].progress, initial[0].progress)
  assert.equal(applyClubBookAction(books, 'b', 'jern', 'start'), books)
  books = applyClubBookAction(books, 'a', 'jern', 'join')
  books = applyClubBookAction(books, 'a', 'jern', 'join')
  assert.deepEqual(books[0].club.participantIds, ['nern','jern'])
  assert.equal(books[0].shelves.vern, 'read')
  assert.equal(books[0].progress.jern.lastChapter, 3)
  const leaving = applyClubBookAction(books, 'a', 'jern', 'leave')[0]
  assert.deepEqual(leaving.club.participantIds, ['nern'])
  assert.equal(leaving.shelves.jern, 'reading')
})

test('finish records club history without marking anyone personally finished', () => {
  let books = applyClubBookAction([book('a')], 'a', 'nern', 'start', '2026-09-29T12:00:00Z')
  const personal = books[0].shelves
  books = applyClubBookAction(books, 'a', 'nern', 'finish', '2026-10-03T12:00:00Z')
  assert.deepEqual(books[0].shelves, personal)
  assert.equal(books[0].club.status, 'completed')
  assert.equal(books[0].club.startedAt, '2026-09-29T12:00:00Z')
  assert.equal(books[0].club.completedAt, '2026-10-03T12:00:00Z')
  assert.deepEqual(books[0].club.participantIds, ['nern'])
  assert.equal(applyClubBookAction(books, 'a', 'jern', 'queue'), books)
})
