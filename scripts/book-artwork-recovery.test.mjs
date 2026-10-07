import test from 'node:test'
import assert from 'node:assert/strict'
import { artworkKey, bookArtworkVersion, refreshBookArtwork, resolveBookArtwork, retryBookCover, subscribeBookArtwork } from '../src/lib/bookArtwork.ts'
import { lookupGoogleBookCover, lookupGoogleCoverForBook } from '../src/lib/bookSearch.ts'
import { probeBookCover } from '../src/lib/bookImageProbe.ts'

const book = { title: 'Meddling Kids', authors: ['Edgar Cantero'], coverUrl: 'https://covers.openlibrary.org/b/id/8446638-M.jpg', openLibraryKey: '/works/OL19334534W' }
const google = 'https://books.google.com/books/content?id=q5ZnDQAAQBAJ&printsec=frontcover&img=1&zoom=1&source=gbs_api'

test('an Open Library image outage recovers through Google without changing the saved book', async () => {
  const original = structuredClone(book), tried = []
  const result = await resolveBookArtwork(book, { large: false, signal: new AbortController().signal,
    probe: async url => { tried.push(url); return url.includes('books.google.com') }, lookup: async () => [google] })
  assert.equal(result, google)
  assert.ok(tried[0].includes('covers.openlibrary.org'))
  assert.deepEqual(book, original)
})

test('the small cover is used when a volume has no working large image', async () => {
  const result = await resolveBookArtwork({ title: 'Small only', authors: ['Test'], coverUrl: google }, {
    large: true, signal: new AbortController().signal, probe: async url => new URL(url).searchParams.get('zoom') === '1',
    lookup: async () => { throw Error('Working thumbnail must not trigger metadata lookup') },
  })
  assert.equal(new URL(result).searchParams.get('zoom'), '1')
})

test('refresh invalidates successful cover cache and notifies every instance of only that book', async () => {
  const key = artworkKey(book), notifications = []
  const offA = subscribeBookArtwork(key, () => notifications.push('shelf'))
  const offB = subscribeBookArtwork(key, () => notifications.push('details'))
  const offOther = subscribeBookArtwork('unrelated', () => notifications.push('wrong book'))
  refreshBookArtwork(book)
  assert.deepEqual(notifications, ['shelf', 'details'])
  const version = bookArtworkVersion(key)
  assert.ok(version > 0)
  let first
  const result = await resolveBookArtwork(book, { large: false, refreshToken: version, signal: new AbortController().signal,
    probe: async url => { first ??= url; return true }, lookup: async () => [] })
  assert.equal(new URL(first).hostname, 'covers.openlibrary.org')
  assert.equal(new URL(result).searchParams.get('checkpoint_retry'), String(version))
  offA(); offB(); offOther()
})

test('explicit retries change known provider URLs but never modify custom signed images', () => {
  assert.match(retryBookCover(google, 123), /checkpoint_retry=123/)
  const custom = 'https://example.test/cover.jpg?signature=keep-me'
  assert.equal(retryBookCover(custom, 123), custom)
})

test('manual refresh checks fresh metadata before accepting old artwork again', async () => {
  const target = { ...book, title: 'Refresh first' }, tried = []
  const result = await resolveBookArtwork(target, { large: false, refreshToken: 456, signal: new AbortController().signal,
    lookup: async () => [google], probe: async url => { tried.push(url); return true } })
  assert.equal(tried.length, 1)
  assert.equal(new URL(result).hostname, 'books.google.com')
  assert.equal(new URL(result).searchParams.get('checkpoint_retry'), '456')
})

test('cancelled metadata recovery cannot display or cache a late result', async () => {
  const controller = new AbortController()
  await assert.rejects(resolveBookArtwork({ title: 'Cancelled', authors: ['Test'] }, {
    large: false, signal: controller.signal, probe: async () => true,
    lookup: async () => { controller.abort(); return [google] },
  }), { name: 'AbortError' })
})

test('Google cover recovery verifies an exact volume ID and keeps the request keyed', async t => {
  t.mock.method(globalThis, 'fetch', async url => {
    assert.equal(new URL(url).searchParams.get('key'), 'test-key')
    assert.equal(new URL(url).pathname, '/books/v1/volumes/q5ZnDQAAQBAJ')
    return Response.json({ id: 'wrong-edition', volumeInfo: { imageLinks: { thumbnail: google } } })
  })
  assert.equal(await lookupGoogleBookCover('q5ZnDQAAQBAJ', undefined, 'test-key'), undefined)
})

test('legacy books only recover Google artwork from matching title AND author, or exact ISBN', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ items: [
    { id: 'wrong', volumeInfo: { title: book.title, authors: ['Someone Else'], imageLinks: { thumbnail: 'https://example.test/wrong.jpg' } } },
    { id: 'correct', volumeInfo: { title: book.title, authors: book.authors, imageLinks: { thumbnail: google }, industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780385541992' }] } },
  ] }))
  assert.equal(await lookupGoogleCoverForBook(book, undefined, 'test-key'), google)
  assert.equal(await lookupGoogleCoverForBook({ ...book, isbn13: '9780000000000' }, undefined, 'test-key'), undefined)
  assert.equal(await lookupGoogleCoverForBook({ ...book, isbn13: '9780385541992' }, undefined, 'test-key'), google)
})

test('image timeout and late load can settle only once; cancellation cleans up', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const original = globalThis.Image, images = []
  globalThis.Image = class { constructor() { images.push(this) } naturalWidth = 120; naturalHeight = 180 }
  try {
    const timed = probeBookCover(google, new AbortController().signal)
    const lateLoad = images[0].onload
    t.mock.timers.tick(8001)
    assert.equal(await timed, false)
    lateLoad()
    assert.equal(images[0].onload, null)
    assert.equal(images[0].src, '')
    const controller = new AbortController()
    const cancelled = probeBookCover(google, controller.signal)
    controller.abort()
    await assert.rejects(cancelled, { name: 'AbortError' })
    assert.equal(images[1].onerror, null)
    assert.equal(images[1].src, '')
  } finally { globalThis.Image = original }
})
