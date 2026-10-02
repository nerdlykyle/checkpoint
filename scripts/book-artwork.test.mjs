import test from 'node:test'
import assert from 'node:assert/strict'
import { bookCoverCandidates, normalizeBookCover, matchingCover, lookupBookArtwork } from '../src/lib/bookArtwork.ts'

const book = { title: 'The First Signal', authors: ['Example Author'] }
test('stored artwork is HTTPS, shelf-sized, and does not accept blank Open Library placeholders', () => {
  assert.equal(normalizeBookCover('http://covers.openlibrary.org/b/id/123-L.jpg'), 'https://covers.openlibrary.org/b/id/123-M.jpg?default=false')
  assert.equal(normalizeBookCover('https://covers.openlibrary.org/b/id/123-M.jpg', true), 'https://covers.openlibrary.org/b/id/123-L.jpg?default=false')
  const google = new URL(normalizeBookCover('http://books.google.com/books/content?id=ABC&edge=curl&zoom=5'))
  assert.equal(google.protocol, 'https:'); assert.equal(google.searchParams.has('edge'), false); assert.equal(google.searchParams.get('zoom'), '1')
  for (const url of ['javascript:alert(1)', 'data:image/svg+xml,test', 'https://user:password@example.test/cover.jpg']) assert.equal(normalizeBookCover(url), undefined)
})
test('existing books gain independent fallback sources without changing saved data', () => {
  const input = { ...book, coverUrl: 'http://books.google.com/books/content?id=ABC&edge=curl', isbn13: '978-0385533225', isbn10: '0385472579', openLibraryKey: '/books/OL7440033M' }
  const original = structuredClone(input), urls = bookCoverCandidates(input)
  assert.ok(urls.some(url => url.includes('source=gbs_api')))
  assert.ok(urls.includes('https://covers.openlibrary.org/b/isbn/9780385533225-M.jpg?default=false'))
  assert.ok(urls.includes('https://covers.openlibrary.org/b/olid/OL7440033M-M.jpg?default=false'))
  assert.deepEqual(input, original)
  assert.equal(bookCoverCandidates({ ...book, isbn13: 'bad', openLibraryKey: '/works/OL123W' }).length, 0)
})
test('metadata recovery never chooses a similarly named book by another author', () => {
  assert.equal(matchingCover(book, [{ title: book.title, author_name: ['Another Author'], cover_i: 100 }]), undefined)
  assert.equal(matchingCover(book, [{ title: book.title, author_name: book.authors, cover_i: -1 }]), undefined)
  assert.equal(matchingCover(book, [{ title: 'The First Signal!', author_name: book.authors, cover_i: 123 }]), 123)
  assert.equal(matchingCover({ ...book, authors: ['Unknown author'] }, [{ title: book.title, author_name: ['Unknown author'], cover_i: 123 }]), undefined)
})
test('failed-source lookups are coalesced and a retry can refresh metadata', async () => {
  const original = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => { calls++; return Response.json({ covers: [0, -1, 456] }) }
  try {
    const input = { ...book, openLibraryKey: '/works/OL123W' }
    const [a,b] = await Promise.all([lookupBookArtwork(input), lookupBookArtwork(input)])
    assert.equal(a, 'https://covers.openlibrary.org/b/id/456-M.jpg?default=false')
    assert.equal(a,b); assert.equal(calls,1)
    await lookupBookArtwork(input,true); assert.equal(calls,2)
  } finally { globalThis.fetch = original }
})
