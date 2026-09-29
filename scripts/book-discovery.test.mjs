import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseJeselnikPage, mergePicks, refreshJeselnikBooks } from './update-jeselnik-books.mjs'
import { addDiscoveryBook, centralMonth, discoveryPickLabel, findDiscoveryBook } from '../src/lib/bookDiscovery.ts'

const pick = { id: 'jeselnik-2026-09', month: '2026-09', title: 'A Book', authors: ['Author Name'], isbn13: '9780525562948', description: 'Synopsis', bookshopUrl: 'https://bookshop.org/a/122208/9780525562948' }
const htmlPick = (heading, isbn, video = '') => `<section><p><span>${heading}</span></p></section><section>${video}<p>A review with <a href="https://bookshop.org/a/122208/${isbn}">A Book</a>.</p><a href="https://bookshop.org/a/122208/${isbn}">Buy on BOOKSHOP.ORG</a></section>`

test('source parser keeps month, ISBN and discussion associated across sections', () => {
  const html = htmlPick('SEPTEMBER 2026', pick.isbn13) + htmlPick('AUGUST DISCUSSION', '9780525541370', '<iframe src="https://www.youtube.com/embed/TJbCYJPv--I?rel=0"></iframe>') + '<p>2025</p><iframe src="https://www.youtube.com/embed/94SgISJH9Dk"></iframe>'
  const result = parseJeselnikPage(html)
  assert.equal(result.length, 2)
  assert.equal(result[0].month, '2026-09')
  assert.equal(result[0].discussionUrl, undefined)
  assert.equal(result[1].month, '2026-08')
  assert.equal(result[1].discussionUrl, 'https://www.youtube.com/watch?v=TJbCYJPv--I')
  assert.equal(result[0].title, 'A Book')
})

test('year rollover comes from source, not current date', () => {
  const parsed = parseJeselnikPage(htmlPick('JANUARY 2027', pick.isbn13) + htmlPick('DECEMBER DISCUSSION', '9780525541370'))
  assert.deepEqual(parsed.map((item) => item.month), ['2027-01', '2026-12'])
  assert.throws(() => parseJeselnikPage(htmlPick('DECEMBER DISCUSSION', pick.isbn13)), /explicit source year/)
})

test('layout changes, incomplete months and ambiguous books fail safely', () => {
  assert.throws(() => parseJeselnikPage('<p>Maintenance</p>'))
  assert.throws(() => parseJeselnikPage('<p>SEPTEMBER 2026</p><a href="javascript:alert(1)">Book</a>'))
  assert.throws(() => parseJeselnikPage(htmlPick('SEPTEMBER 2026', pick.isbn13) + '<p>OCTOBER DISCUSSION</p>'))
  assert.throws(() => parseJeselnikPage(htmlPick('SEPTEMBER 2026', pick.isbn13) + '<a href="https://bookshop.org/a/122208/9780525541370">Other</a>'), /Ambiguous/)
})

test('refresh keeps archived months and updates discussion without duplicates', () => {
  const old = { ...pick, month: '2026-08', id: 'jeselnik-2026-08' }
  const merged = mergePicks([pick, old], [{ ...pick, discussionUrl: 'https://www.youtube.com/watch?v=TJbCYJPv--I' }])
  assert.equal(merged.length, 2)
  assert.equal(merged[0].discussionUrl, 'https://www.youtube.com/watch?v=TJbCYJPv--I')
  assert.deepEqual(merged[1], old)
  assert.deepEqual(mergePicks(merged, []), merged)
})

test('personal add does not nominate or create a group read; repeat add is safe', () => {
  let books = addDiscoveryBook([], pick, 'nern', 'shelf')
  assert.equal(books[0].shelves.nern, 'to-read')
  assert.equal(books[0].nominated, false)
  assert.equal(books[0].club, undefined)
  books = addDiscoveryBook(books, pick, 'nern', 'shelf')
  books = addDiscoveryBook(books, pick, 'vern', 'shelf')
  assert.equal(books.length, 1)
  assert.deepEqual(books[0].shelves, { nern: 'to-read', vern: 'to-read' })
})

test('source outages and changed layouts retain the exact saved list and timestamp', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'checkpoint-book-feed-'))
  const outputUrl = join(directory, 'feed.json')
  const original = JSON.stringify({ version: 1, lastCheckedAt: '2026-09-01T12:00:00Z', picks: [pick] })
  await writeFile(outputUrl, original)
  await refreshJeselnikBooks({ outputUrl, fetchSource: async () => { throw new Error('Offline') } })
  assert.equal(await readFile(outputUrl, 'utf8'), original)
  await refreshJeselnikBooks({ outputUrl, fetchSource: async () => '<p>New layout</p>' })
  assert.equal(await readFile(outputUrl, 'utf8'), original)
  await refreshJeselnikBooks({ outputUrl, fetchSource: async () => htmlPick('OCTOBER 2026', '9780525541370'), lookupBook: async () => { throw new Error('Catalog outage') } })
  assert.equal(await readFile(outputUrl, 'utf8'), original)
})

test('new monthly pick is saved alongside older picks and changes current selection', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'checkpoint-book-feed-'))
  const outputUrl = join(directory, 'feed.json')
  await writeFile(outputUrl, JSON.stringify({ version: 1, picks: [pick] }))
  await refreshJeselnikBooks({ outputUrl, fetchSource: async () => htmlPick('OCTOBER 2026', '9780525541370'), lookupBook: async (next) => ({ ...next, authors: ['Next author'], description: 'New synopsis' }) })
  const saved = JSON.parse(await readFile(outputUrl, 'utf8'))
  assert.deepEqual(saved.picks.map((item) => item.month), ['2026-10', '2026-09'])
  assert.equal(discoveryPickLabel(saved.picks[0], saved.picks[0].month, new Date('2026-10-02T12:00:00Z')), 'Current monthly pick')
  assert.equal(saved.picks[1].title, pick.title)
})

test('nomination is separate and preserves readers, notes, progress and ratings', () => {
  const books = addDiscoveryBook([], pick, 'jern', 'shelf')
  books[0].shelves.jern = 'read'
  books[0].progress.jern = { lastChapter: 12, updatedAt: 'today' }
  books[0].comments = [{ id: 'note', text: 'Keep me' }]
  books[0].ratings.jern = { stars: 5 }
  const result = addDiscoveryBook(books, pick, 'nern', 'nominate')
  assert.equal(result[0].nominated, true)
  assert.deepEqual(result[0].upvotes, ['nern'])
  assert.deepEqual(result[0].shelves, { jern: 'read' })
  assert.deepEqual(result[0].comments, books[0].comments)
  assert.deepEqual(result[0].progress, books[0].progress)
  assert.deepEqual(result[0].ratings, books[0].ratings)
  assert.equal(result[0].club, undefined)
  assert.equal(addDiscoveryBook(result, pick, 'nern', 'nominate')[0].upvotes.length, 1)
  assert.equal(addDiscoveryBook(result, pick, 'jern', 'shelf')[0].shelves.jern, 'read')
})

test('passed-on and club books cannot be re-nominated by discovery', () => {
  const books = addDiscoveryBook([], pick, 'nern', 'shelf')
  books[0].passedOnAt = 'today'
  assert.equal(addDiscoveryBook(books, pick, 'jern', 'nominate'), books)
  assert.equal(addDiscoveryBook(books, pick, 'jern', 'shelf')[0].shelves.jern, 'to-read')
  delete books[0].passedOnAt
  books[0].club = { status: 'reading', participantIds: ['nern'] }
  assert.equal(addDiscoveryBook(books, pick, 'jern', 'nominate'), books)
})

test('matching uses ISBN, work, stable source id or both normalized author and title', () => {
  const books = addDiscoveryBook([], pick, 'nern', 'shelf')
  assert.equal(findDiscoveryBook(books, { ...pick, id: 'other' }), books[0])
  assert.equal(findDiscoveryBook(books, { ...pick, isbn13: 'different' }), books[0])
  assert.equal(findDiscoveryBook(books, { ...pick, id: 'other', isbn13: 'different', title: 'A book!', authors: ['Author NAME'] }), books[0])
  assert.equal(findDiscoveryBook(books, { ...pick, id: 'other', isbn13: 'different', authors: ['Different author'] }), undefined)
})

test('current and past labels respect Central month and do not imply our reading status', () => {
  assert.equal(centralMonth(new Date('2026-10-01T03:00:00Z')), '2026-09')
  assert.equal(discoveryPickLabel(pick, pick.month, new Date('2026-09-29T12:00:00Z')), 'Current monthly pick')
  assert.equal(discoveryPickLabel(pick, pick.month, new Date('2026-10-02T12:00:00Z')), 'Latest announced pick')
  assert.equal(discoveryPickLabel(pick, '2026-10', new Date('2026-10-02T12:00:00Z')), 'Past pick')
})

test('initial saved feed has nine complete monthly picks and eight discussions', () => {
  const feed = JSON.parse(readFileSync(new URL('../public/jeselnik-books.json', import.meta.url)))
  assert.equal(feed.version, 1)
  assert.ok(feed.picks.length >= 9)
  const initial = feed.picks.filter((item) => item.month >= '2026-01' && item.month <= '2026-09')
  assert.equal(initial.length, 9)
  assert.ok(initial.filter((item) => item.discussionUrl).length >= 8)
  assert.ok(initial.every((item) => item.title && item.authors.length && item.coverUrl && item.description))
  assert.equal(new Set(feed.picks.map((item) => item.month)).size, feed.picks.length)
})
