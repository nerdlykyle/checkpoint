import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = file => readFileSync(new URL('../src/' + file, import.meta.url), 'utf8')
test('My Books and Readers shelves share paperback cards in every tab and collection', () => {
  const source = read('BookOrganizer.tsx')
  assert.match(source, /return <div[^>]+className="organized-paperback"/)
  assert.doesNotMatch(source, /if \(!readers\) return|organized-book clean-split/)
  assert.match(source, /<PaperbackCard[^\n]+user=\{owner\}[^\n]+onOpen=\{\(\) => onOpen\(book.id, mine \? undefined : owner\)\}/)
  assert.match(source, /organized-books paperback-library-grid/)
  assert.match(source, /\['all', ...Object.keys\(shelfNames\)\]/)
  assert.match(source, /items.map\(card\)/)
  assert.match(source, /visible.map\(card\)/)
})
test('Readers shelves keep progress, attribution and read-only permissions tied to the selected reader', () => {
  const source = read('BookOrganizer.tsx')
  assert.match(source, /const owner = readers \? reader : currentUser/)
  assert.match(source, /const mine = owner === currentUser/)
  assert.match(source, /const canReorder = mine &&/)
  assert.match(source, /mine && book.shelves\[currentUser\] === 'to-read'/)
  assert.match(source, /readerOrganization\?\.\[owner\]\?\.savedFrom/)
  assert.match(source, /shelfNames\[book.shelves\[owner\]\]/)
  assert.match(source, /!mine && <button[^\n]+disabled=\{Boolean\(book.shelves\[currentUser\]\)\}[^\n]+onShelf\(book, 'to-read', owner\)/)
})
test('paperback series retain their own accessible expand action and friend attribution', () => {
  const source = read('PaperbackCard.tsx')
  assert.match(source, /useContext\(CollectionActionContext\)/)
  assert.match(source, /data-collection-toggle aria-label=\{collection.label\}/)
  assert.match(source, /aria-controls=\{collection.controlsId\}/)
  assert.match(source, /onClick=\{collection.onOpen\}/)
  assert.match(source, /Saved from \$\{source.name\}/)
})
test('reading-order mode keeps a vertical layout for the existing live drag mechanism', () => {
  const css = read('BookOrganizer.css')
  assert.match(css, /\.organized-books.paperback-library-grid.is-arranging \{ grid-template-columns:minmax\(150px,200px\)/)
  const source = read('BookOrganizer.tsx')
  assert.match(source, /className="organized-paperback" data-shelf-book=\{book.id\} data-reorder-id=\{book.id\}/)
  assert.match(source, /Read \$\{book.title\} next/)
  assert.match(source, /Move \$\{book.title\} to position/)
})
