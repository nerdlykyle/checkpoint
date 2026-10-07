import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = file => readFileSync(new URL('../src/' + file, import.meta.url), 'utf8')
test('every My Books shelf renders the shared paperback component and opens full details', () => {
  const source = read('BookOrganizer.tsx')
  assert.match(source, /if \(!readers\) return <div[^>]+className="organized-paperback"/)
  assert.match(source, /<PaperbackCard[^\n]+user=\{currentUser\}[^\n]+onOpen=\{\(\) => onOpen\(book.id\)\}/)
  assert.match(source, /\['all', ...Object.keys\(shelfNames\)\]/)
  assert.match(source, /items.map\(card\)/)
  assert.match(source, /visible.map\(card\)/)
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
