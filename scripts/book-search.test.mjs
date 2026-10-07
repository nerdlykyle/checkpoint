import test from 'node:test'
import assert from 'node:assert/strict'
import { createBookSearch } from '../src/lib/bookSearch.ts'

const abyss = { id: 'cHF-EQAAQBAJ', volumeInfo: { title: 'Abyss', authors: ['Nicholas Binge'], industryIdentifiers: [{ type: 'ISBN_13', identifier: '9781250373892' }] } }
const openBook = { key: '/works/OL123W', title: 'Abyss', author_name: ['Nicholas Binge'] }

test('Google Books receives the dedicated key and preserves the selected edition', async t => {
  const calls = []
  t.mock.method(globalThis, 'fetch', async url => { calls.push(new URL(url)); return Response.json({ items: [abyss] }) })
  const search = createBookSearch(' test-key ')
  const result = await search('978-1-250-37389-2')
  assert.equal(calls.length, 1)
  assert.equal(calls[0].searchParams.get('key'), 'test-key')
  assert.equal(calls[0].searchParams.get('q'), 'isbn:9781250373892')
  assert.equal(result.warning, undefined)
  assert.equal(result.results[0].googleBooksId, abyss.id)
  assert.equal(result.results[0].isbn13, '9781250373892')
})

test('successful searches are cached, isolated from caller changes, and expire after five minutes', async t => {
  let calls = 0, now = 1000
  t.mock.method(Date, 'now', () => now)
  t.mock.method(globalThis, 'fetch', async () => { calls++; return Response.json({ items: [abyss] }) })
  const search = createBookSearch('test-key')
  const first = await search('Abyss Nicholas Binge')
  first.results[0].title = 'Edited locally'
  assert.equal((await search(' Abyss Nicholas Binge ')).results[0].title, 'Abyss')
  assert.equal(calls, 1)
  now += 300_000
  await search('Abyss Nicholas Binge')
  assert.equal(calls, 2)
})

test('quota failures remain visible even when Open Library returns no matches; failures are not cached', async t => {
  let calls = 0
  t.mock.method(globalThis, 'fetch', async url => {
    calls++
    return String(url).includes('googleapis') ? Response.json({}, { status: 429 }) : Response.json({ docs: [] })
  })
  const search = createBookSearch('test-key')
  const result = await search('Abyss Nicholas Binge')
  assert.deepEqual(result.results, [])
  assert.match(result.warning, /search limit/)
  assert.match(result.warning, /Google Books could not be checked/)
  await search('Abyss Nicholas Binge')
  assert.equal(calls, 4)
})

test('missing keys skip unauthenticated Google requests and label fallback-only results', async t => {
  t.mock.method(globalThis, 'fetch', async url => {
    assert.ok(String(url).startsWith('https://openlibrary.org/'))
    return Response.json({ docs: [openBook] })
  })
  const result = await createBookSearch('')('Abyss')
  assert.equal(result.results[0].openLibraryKey, openBook.key)
  assert.match(result.warning, /not configured/)
  assert.match(result.warning, /Open Library results only/)
})

test('key restrictions give actionable feedback without exposing the key or API response', async t => {
  t.mock.method(globalThis, 'fetch', async url => String(url).includes('googleapis')
    ? Response.json({ error: { message: 'sensitive-key' } }, { status: 403 }) : Response.json({ docs: [] }))
  const result = await createBookSearch('sensitive-key')('Abyss')
  assert.match(result.warning, /website restrictions/)
  assert.ok(!result.warning.includes('sensitive-key'))
})

test('Google timeouts leave an independent, usable fallback timeout', async t => {
  let firstSignal
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (String(url).includes('googleapis')) {
      firstSignal = options.signal
      throw new DOMException('Timed out', 'TimeoutError')
    }
    assert.notEqual(options.signal, firstSignal)
    assert.equal(options.signal.aborted, false)
    return Response.json({ docs: [openBook] })
  })
  const result = await createBookSearch('test-key')('Abyss')
  assert.match(result.warning, /too long/)
  assert.equal(result.results.length, 1)
})

test('caller cancellation never starts a fallback or returns cached results', async t => {
  const controller = new AbortController()
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => {
    calls++
    controller.abort()
    return Response.json({ items: [abyss] })
  })
  const search = createBookSearch('test-key')
  await assert.rejects(search('Abyss', controller.signal), { name: 'AbortError' })
  await assert.rejects(search('Abyss', controller.signal), { name: 'AbortError' })
  assert.equal(calls, 1)
})

test('a genuine empty search remains distinct from unavailable catalogs', async t => {
  t.mock.method(globalThis, 'fetch', async url => Response.json(String(url).includes('googleapis') ? { items: [] } : { docs: [] }))
  assert.deepEqual(await createBookSearch('test-key')('Abyss'), { results: [] })
})

test('both providers failing does not report a missing book', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Failed to fetch') })
  await assert.rejects(createBookSearch('test-key')('Abyss'), /Google Books could not be reached.*Open Library could not be reached/)
})
