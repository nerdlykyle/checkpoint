import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/App.css', import.meta.url), 'utf8')
test('logo hover area has balanced padding and external navigation spacing', () => {
  const brand = css.match(/^\.brand \{([^}]+)\}/m)[1]
  assert.match(brand, /padding: 6px 8px;/)
  assert.match(brand, /margin-bottom: 13px;/)
  assert.match(css, /\.sidebar \.brand \{ padding: 6px; \}/)
})

test('club paperback is 25 percent larger with responsive mobile sizing', () => {
  const paperback = readFileSync(new URL('../src/PaperbackCard.css', import.meta.url), 'utf8')
  assert.match(paperback, /club-paperback-shelf \{ width:250px/)
  assert.match(paperback, /minmax\(150px,200px\)/)
  assert.match(paperback, /width:calc\(\(100% - 40px\) \* \.625\)/)
  const source = readFileSync(new URL('../src/BookClub.tsx', import.meta.url), 'utf8')
  assert.match(source, /book-club-paperback-section/)
  assert.match(source, /<PaperbackCard book=\{currentClubBook\}/)
})
